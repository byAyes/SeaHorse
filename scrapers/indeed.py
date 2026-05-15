from scrapers.shared.base import ScraplingBaseScraper, run_scraper_cli
from scrapers.shared.models import Job


class IndeedScraper(ScraplingBaseScraper):
    name = "indeed"

    def build_url(self, query: str) -> str:
        base = (self.config.extra or {}).get("base_url", "https://www.indeed.com")
        return f"{base}/jobs?q={query}&sort=date&fromage=3"

    def _wait_selector(self) -> str | None:
        # Wait for job search results to render
        return ".mosaic-zone, [id*='job'], .jobsearch-ResultsList, [data-testid='job-card'], .job_seen_beacon"

    def _fetcher_options(self) -> dict:
        return {"network_idle": True, "wait": 5000}

    def parse_page(self, page) -> list[Job]:
        jobs: list[Job] = []
        # Indeed uses multiple card selectors depending on A/B testing
        card_selectors = [
            ".job_seen_beacon",
            ".cardOutline",
            "[data-testid='job-card']",
            "li[class*='job']",
            "div[class*='jobsearch'] > div > div",
            "[class*='card']",
            # Broader fallbacks
            "div[id*='job']",
            "a[href*='/rc/clk']",
        ]

        job_elements = []
        for sel in card_selectors:
            found = page.css(sel)
            if found and len(found) > 0:
                # For the broader selectors, only use them if we get 2+ results
                if sel.startswith("div[id*='job']") or sel.startswith("a[href*='/rc/clk']"):
                    if len(found) < 3:
                        continue
                job_elements = found
                self._log("info", f"Found {len(job_elements)} cards with selector: {sel}")
                break

        if not job_elements:
            self._log("warning", "No job cards found — page structure may have changed")
            return []

        self._log("info", f"Total card elements: {len(job_elements)}")

        for el in job_elements:
            job = self._parse_card(el)
            if job:
                jobs.append(job)

        return jobs

    def _parse_card(self, el) -> Job | None:
        try:
            # Title — try multiple selector patterns
            title = ""
            for sel in [
                "h2 a[data-testid='job-card-title']",
                "a[data-testid='job-card-title']",
                "a.jobCardLink",
                "h2 a span",
                "a[class*='jobtitle']",
                "a[class*='title']",
                "h2 span",
                "span[class*='title']",
                # Broader fallback: any link with job-related text
                "a[href*='/rc/clk']",
                "a[href*='job']",
            ]:
                found = el.css(sel)
                if found and found[0].text:
                    title = found[0].text.strip()
                    break

            if not title:
                return None

            # Company
            company = ""
            for sel in [
                "[data-testid='job-card-company-name']",
                "[data-testid='company-name']",
                "span[class*='company']",
                "div[class*='company']",
                "a[class*='company']",
                "[class*='companyName']",
                "[data-testid*='company']",
                # 2025+: Indeed sometimes puts company in a data attribute
                "[class*='employer']",
            ]:
                found = el.css(sel)
                if found and found[0].text:
                    company = found[0].text.strip()
                    break

            # Try parsing from heading structure as fallback
            if not company:
                # Sometimes company is in a div sibling after heading
                heading = el.css("h2")
                if heading:
                    parent = heading[0].parent()
                    if parent:
                        all_divs = parent.css("div")
                        for d in all_divs:
                            text = d.text.strip()
                            if text and text != title and len(text) < 60:
                                company = text
                                break

            # Location
            location = ""
            for sel in [
                "[data-testid='job-card-location']",
                "[data-testid='text-location']",
                "div[class*='location']",
                "[class*='location']",
                "[class*='loc']",
                "[data-testid*='location']",
            ]:
                found = el.css(sel)
                if found and found[0].text:
                    location = found[0].text.strip()
                    break

            # Link
            link = ""
            for sel in [
                "h2 a",
                "a.jobCardLink",
                "a[class*='title']",
                "a[href*='/rc/clk']",
                "a[href*='job']",
                "a[href*='jk=']",
            ]:
                found = el.css(sel)
                if found:
                    link = found[0].attrib.get("href", "")
                    break

            if link and not link.startswith("http"):
                base = (self.config.extra or {}).get("base_url", "https://www.indeed.com")
                prefix = "" if link.startswith("/") else "/"
                link = f"{base}{prefix}{link}"

            return Job(
                id=self._generate_id(link),
                title=title,
                company=company,
                location=location,
                link=link,
                description="",
                source="indeed",
            )
        except Exception as exc:
            self._log("warning", f"Error parsing card: {exc}")
            return None


if __name__ == "__main__":
    run_scraper_cli(IndeedScraper)
