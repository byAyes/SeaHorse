import sys
import json
import argparse
import importlib
from pathlib import Path

import yaml

from .config import ScraperConfig


def load_scraper_config(yaml_path: str = "scrapers.yaml") -> dict:
    p = Path(yaml_path)
    if p.exists():
        with open(p) as f:
            return yaml.safe_load(f) or {}
    return {}


def run_all(config: ScraperConfig, yaml_path: str = "scrapers.yaml"):
    cfg = load_scraper_config(yaml_path)
    scrapers_cfg = cfg.get("scrapers", {})
    enabled = {k: v for k, v in scrapers_cfg.items() if v.get("enabled", True)}

    all_jobs: list[dict] = []

    for name, board_cfg in enabled.items():
        module_path = board_cfg.get("module", f"scrapers.{name}")
        default_cls = "".join(part.capitalize() for part in name.split("-")) + "Scraper"
        cls_name = board_cfg.get("class", default_cls)

        try:
            mod = importlib.import_module(module_path)
            cls = getattr(mod, cls_name)
        except (ImportError, AttributeError) as exc:
            record = json.dumps({"level": "error", "scraper": name, "message": f"Cannot load {module_path}.{cls_name}: {exc}"})
            print(record, file=sys.stderr, flush=True)
            continue

        merged = ScraperConfig(
            query=config.query,
            max_jobs=board_cfg.get("max_jobs", config.max_jobs),
            rate_limit_ms=board_cfg.get("rate_limit_ms", config.rate_limit_ms),
            extra=board_cfg,
        )

        scraper = cls(merged)
        try:
            jobs = scraper.run()
            all_jobs.extend(jobs)
        except Exception as exc:
            record = json.dumps({"level": "error", "scraper": name, "message": f"Failed: {exc}"})
            print(record, file=sys.stderr, flush=True)

    return all_jobs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--max-jobs", type=int, default=10)
    parser.add_argument("--rate-limit-ms", type=int, default=5000)
    parser.add_argument("--config", default="scrapers.yaml")
    args = parser.parse_args()

    config = ScraperConfig(
        query=args.query,
        max_jobs=args.max_jobs,
        rate_limit_ms=args.rate_limit_ms,
    )

    jobs = run_all(config, args.config)
    print(json.dumps(jobs), flush=True)


if __name__ == "__main__":
    main()
