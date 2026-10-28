"""
Module 1: Config & State Manager.
Loads config.yaml + .env, sets up logging, and exposes a single Config
object the other modules pull paths/settings from. No hardcoded paths or
API keys anywhere else in the codebase — everything routes through here.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent


@dataclass
class Config:
    raw: dict = field(repr=False)
    project_root: Path = PROJECT_ROOT

    def __getitem__(self, key):
        return self.raw[key]

    def get(self, *keys, default=None):
        """Nested lookup, e.g. cfg.get('render', 'subtitle', 'font_size_px')."""
        node = self.raw
        for k in keys:
            if not isinstance(node, dict) or k not in node:
                return default
            node = node[k]
        return node

    def path(self, *keys) -> Path:
        """Resolve a paths.* config entry into an absolute Path under project_root."""
        rel = self.get("paths", *keys)
        if rel is None:
            raise KeyError(f"No paths.{'.'.join(keys)} in config.yaml")
        return self.project_root / rel

    @property
    def env(self) -> dict:
        return {
            "agentgw_api_key": os.environ.get("AGENTGW_API_KEY", ""),
            "agentgw_base_url": os.environ.get(
                "AGENTGW_BASE_URL", self.get("ai", "base_url", default="https://agentgw.cloud/v1")
            ),
            "agentgw_model": os.environ.get(
                "AGENTGW_MODEL", self.get("ai", "model", default="agentgw-opus-4-8")
            ),
            "gemini_api_key": os.environ.get("GEMINI_API_KEY", ""),
            "youtube_client_secrets_file": os.environ.get(
                "YOUTUBE_CLIENT_SECRETS_FILE", "client_secrets.json"
            ),
            "youtube_token_file": os.environ.get("YOUTUBE_TOKEN_FILE", "token.json"),
            "youtube_token_file_us": os.environ.get("YOUTUBE_TOKEN_FILE_US", "token_us.json"),
            "youtube_token_file_jp": os.environ.get("YOUTUBE_TOKEN_FILE_JP", "token_jp.json"),
            "tiktok_access_token": os.environ.get("TIKTOK_ACCESS_TOKEN", ""),
        }

    def market(self, code: str | None = None) -> dict:
        key = (code or "VI").strip().upper()
        markets = self.get("markets", default={}) or {}
        if key in markets:
            return markets[key]
        return markets.get("VI", {
            "language": "vi",
            "locale": "vi-VN",
            "voice": self.get("tts", "voice", default="vi-VN-NamMinhNeural"),
            "rate": self.get("tts", "rate", default="-5%"),
            "font_family": self.get("render", "subtitle", "font_family", default="sans-serif"),
            "youtube_category_id": self.get("youtube", "category_id", default="22"),
            "youtube_token_file": "token.json",
        })


_config: Config | None = None


def load_config() -> Config:
    global _config
    if _config is not None:
        return _config

    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv(PROJECT_ROOT.parent / ".env")

    config_path = PROJECT_ROOT / "config.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    _config = Config(raw=raw)

    for key in ("audio_dir", "media_dir", "output_dir", "logs_dir"):
        _config.path(key).mkdir(parents=True, exist_ok=True)
    _config.path("data_file").parent.mkdir(parents=True, exist_ok=True)

    _setup_logging(_config)
    return _config


def _setup_logging(cfg: Config) -> None:
    log_file = cfg.path("logs_dir") / "app.log"
    root = logging.getLogger()
    if root.handlers:
        return  # already configured (e.g. re-imported in the same process)

    root.setLevel(logging.INFO)

    file_handler = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("[%(levelname)s] %(name)s: %(message)s"))

    root.addHandler(file_handler)
    root.addHandler(console_handler)


def get_logger(name: str) -> logging.Logger:
    load_config()  # ensure logging is initialized
    return logging.getLogger(name)
