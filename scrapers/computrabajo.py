from scrapers.shared.base import ScraplingBaseScraper, run_scraper_cli
from scrapers.shared.models import Job


class ComputrabajoScraper(ScraplingBaseScraper):
    name = "computrabajo"

    def build_url(self, query: str) -> str:
        base = (self.config.extra or {}).get("base_url", "https://co.computrabajo.com")
        slug = query.lower().replace(" ", "-")
        return f"{base}/trabajo-de-{slug}?q={query}"

    def _wait_selector(self) -> str | None:
        return None

    def _fetcher_options(self) -> dict:
        return {"network_idle": False, "wait": 3000}

    def parse_page(self, page) -> list[Job]:
        jobs: list[Job] = []
        job_elements = page.css("article.box_offer")

        if not job_elements:
            job_elements = page.css("[class*='box_offer']")

        self._log("info", f"Found {len(job_elements)} offer elements")

        for el in job_elements:
            job = self._parse_card(el)
            if job:
                jobs.append(job)

        return jobs

    def _parse_card(self, el) -> Job | None:
        try:
            title = ""
            title_els = el.css("a.js-o-link")
            if title_els:
                title = title_els[0].text.strip() if title_els[0].text else ""
            if not title:
                title_els = el.css("h2 a, h3 a")
                if title_els:
                    title = title_els[0].text.strip() if title_els[0].text else ""

            company = ""
            company_els = el.css("a.fc_base.t_ellipsis")
            if company_els:
                company = company_els[0].text.strip() if company_els[0].text else ""
            if not company:
                company_els = el.css("p.dFlex.vm_fx.fs16.fc_base.mt5")
                if company_els:
                    company = company_els[0].text.strip() if company_els[0].text else ""

            location = ""
            loc_els = el.css("span.mr10")
            if loc_els:
                location = loc_els[0].text.strip() if loc_els[0].text else ""

            link = ""
            link_els = el.css("a.js-o-link")
            if link_els:
                link = link_els[0].attrib.get("href", "")

            if not title:
                return None

            if company.lower() == "computrabajo":
                return None

            if link and not link.startswith("http"):
                base = (self.config.extra or {}).get("base_url", "https://co.computrabajo.com")
                prefix = "" if link.startswith("/") else "/"
                link = f"{base}{prefix}{link}"

            return Job(
                id=self._generate_id(link),
                title=title,
                company=company,
                location=location,
                link=link,
                description="",
                source="computrabajo",
            )
        except Exception as exc:
            self._log("warning", f"Error parsing card: {exc}")
            return None


if __name__ == "__main__":
    run_scraper_cli(ComputrabajoScraper)
