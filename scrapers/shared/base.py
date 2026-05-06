import sys
import json
import time
import hashlib
import argparse
import logging
from abc import ABC, abstractmethod
from typing import Optional

def _get_fetcher():
    from scrapling.fetchers import StealthyFetcher
    return StealthyFetcher

from .models import Job
from .config import ScraperConfig


log = logging.getLogger("scrapers")


class ScraplingBaseScraper(ABC):
    name: str = "base"

    def __init__(self, config: ScraperConfig):
        self.config = config
        self.max_retries = 3
        self.base_backoff = 5

    @abstractmethod
    def build_url(self, query: str) -> str:
        ...

    @abstractmethod
    def parse_page(self, page) -> list[Job]:
        ...

    def _generate_id(self, link: str) -> str:
        h = hashlib.sha256(link.encode()).hexdigest()[:16]
        return f"job-{h}"

    def _log(self, level: str, message: str):
        record = json.dumps({"level": level, "scraper": self.name, "message": message})
        print(record, file=sys.stderr, flush=True)

    def run(self) -> list[dict]:
        url = self.build_url(self.config.query)
        self._log("info", f"Fetching {url}")

        for attempt in range(1, self.max_retries + 1):
            try:
                fetcher = _get_fetcher()
                opts = {
                    "headless": True,
                    "network_idle": True,
                    "timeout": 30000,
                }
                opts.update(self._fetcher_options())
                ws = self._wait_selector()
                if ws:
                    opts["wait_selector"] = ws
                page = fetcher.fetch(url, **opts)
                if page is None:
                    raise RuntimeError("StealthyFetcher returned None")

                jobs = self.parse_page(page)
                jobs = jobs[: self.config.max_jobs]

                self._log("info", f"Extracted {len(jobs)} jobs (attempt {attempt})")
                return [j.to_dict() for j in jobs]

            except Exception as exc:
                wait = self.base_backoff * (3 ** (attempt - 1))
                self._log(
                    "warning",
                    f"Attempt {attempt}/{self.max_retries} failed: {exc}. Retrying in {wait}s",
                )
                if attempt < self.max_retries:
                    time.sleep(wait)
                else:
                    self._log("error", f"All {self.max_retries} attempts failed for {self.name}")
                    raise

        return []

    def _wait_selector(self) -> Optional[str]:
        return None

    def _fetcher_options(self) -> dict:
        return {}


def run_scraper_cli(scraper_cls: type[ScraplingBaseScraper]):
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--max-jobs", type=int, default=10)
    parser.add_argument("--rate-limit-ms", type=int, default=5000)
    args = parser.parse_args()

    config = ScraperConfig(
        query=args.query,
        max_jobs=args.max_jobs,
        rate_limit_ms=args.rate_limit_ms,
    )
    scraper = scraper_cls(config)

    try:
        jobs = scraper.run()
        print(json.dumps(jobs), flush=True)
    except Exception as exc:
        print(json.dumps([]), flush=True)
        sys.exit(1)
