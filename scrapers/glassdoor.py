from scrapers.shared.base import ScraplingBaseScraper, run_scraper_cli
from scrapers.shared.models import Job


class GlassdoorScraper(ScraplingBaseScraper):
    name = "glassdoor"

    def build_url(self, query: str) -> str:
        base = (self.config.extra or {}).get("base_url", "https://www.glassdoor.com/Job/jobs.htm")
        return f"{base}?sc.keyword={query}"

    def _wait_selector(self) -> str | None:
        return None

    def _fetcher_options(self) -> dict:
        return {"network_idle": False, "wait": 3000}

    def parse_page(self, page) -> list[Job]:
        jobs: list[Job] = []
        card_selectors = [
            "[class*='JobCard_jobCardContainer']",
            "[class*='JobCard_jobCardWrapper']",
        ]
        job_elements = []
        for sel in card_selectors:
            found = page.css(sel)
            if found:
                job_elements = found
                break

        self._log("info", f"Found {len(job_elements)} card elements")

        for el in job_elements:
            job = self._parse_card(el)
            if job:
                jobs.append(job)

        return jobs

    def _parse_card(self, el) -> Job | None:
        try:
            title = ""
            for sel in [
                "[class*='JobCard_jobTitle']",
                "[data-test='job-title']",
                "a[data-test='job-link']",
            ]:
                found = el.css(sel)
                if found:
                    title = found[0].text.strip() if found[0].text else ""
                if title:
                    break

            company = ""
            for sel in [
                "[class*='EmployerProfile_compactEmployerName']",
                "[class*='EmployerProfile_employerName']",
                "[data-test='emp-name']",
            ]:
                found = el.css(sel)
                if found:
                    company = found[0].text.strip() if found[0].text else ""
                if company:
                    break

            location = ""
            for sel in [
                "[class*='JobCard_location']",
                "[data-test='emp-location']",
            ]:
                found = el.css(sel)
                if found:
                    location = found[0].text.strip() if found[0].text else ""
                if location:
                    break

            if not title:
                return None

            # Link — aggressive multi-strategy extraction
            link = ""
            link_selectors = [
                "a[data-test='job-link']",
                "a[href*='/Job/']",
                "a[href*='job']",
                "a[class*='jobLink']",
                "a[href*='partner/jobs']",
            ]
            for sel in link_selectors:
                found = el.css(sel)
                if found:
                    href = found[0].attrib.get("href", "")
                    if href:
                        link = href
                        break

            # Fallback: any anchor with a job-related href in the card
            if not link:
                all_links = el.css("a[href]")
                for a in all_links:
                    href = a.attrib.get("href", "")
                    if href and ("/Job/" in href or "/job" in href.lower() or "partner/jobs" in href):
                        link = href
                        break

            if link and not link.startswith("http"):
                prefix = "" if link.startswith("/") else "/"
                link = f"https://www.glassdoor.com{prefix}{link}"

            return Job(
                id=self._generate_id(link),
                title=title,
                company=company,
                location=location,
                link=link,
                description="",
                source="glassdoor",
            )
        except Exception as exc:
            self._log("warning", f"Error parsing card: {exc}")
            return None


if __name__ == "__main__":
    run_scraper_cli(GlassdoorScraper)
