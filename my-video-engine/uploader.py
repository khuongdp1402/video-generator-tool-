"""
Module 5: Uploader (official APIs only).
Deliberately does NOT use anti-detect browsers or automated web-UI uploads —
those exist specifically to evade platform bot-detection, which breaks ToS
and risks account bans. Uses each platform's own publishing API instead:
- YouTube: YouTube Data API v3, resumable upload, OAuth (your own app).
- TikTok: Content Posting API, requires an approved developer app.
"""

from __future__ import annotations

from pathlib import Path

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from config_manager import get_logger, load_config

logger = get_logger(__name__)

YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def _youtube_client(cfg, market: str = "US"):
    market_code = (market or "US").strip().upper()
    m_cfg = cfg.market(market_code)
    if market_code == "US":
        token_rel = cfg.env.get("youtube_token_file_us") or m_cfg.get("youtube_token_file", "token_us.json")
    elif market_code == "JP":
        token_rel = cfg.env.get("youtube_token_file_jp") or m_cfg.get("youtube_token_file", "token_jp.json")
    else:
        token_rel = cfg.env.get("youtube_token_file") or m_cfg.get("youtube_token_file", "token.json")

    token_file = Path(token_rel)
    if not token_file.is_absolute():
        token_file = cfg.project_root / token_file

    # Fallback to default token.json if market-specific token file doesn't exist yet
    default_token = cfg.project_root / cfg.env["youtube_token_file"]
    if not token_file.exists() and default_token.exists():
        token_file = default_token

    client_secrets_file = Path(cfg.env["youtube_client_secrets_file"])
    if not client_secrets_file.is_absolute():
        client_secrets_file = cfg.project_root / client_secrets_file

    creds = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), YOUTUBE_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not client_secrets_file.exists():
                raise RuntimeError(
                    f"Missing {client_secrets_file}. Create an OAuth client (Desktop app) in "
                    "Google Cloud Console > APIs & Services > Credentials, enable the YouTube "
                    "Data API v3, and download the JSON as client_secrets.json."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets_file), YOUTUBE_SCOPES)
            creds = flow.run_local_server(port=0)
        token_file.write_text(creds.to_json(), encoding="utf-8")

    return build("youtube", "v3", credentials=creds)


def upload_youtube(
    video_path: str,
    title: str,
    description: str,
    tags: list[str] | None = None,
    market: str = "US",
) -> str:
    """Uploads video_path to YouTube with market-specific locale metadata. Returns the resulting video URL."""
    cfg = load_config()
    market_code = (market or "US").strip().upper()
    m_cfg = cfg.market(market_code)
    youtube = _youtube_client(cfg, market=market_code)

    locale = m_cfg.get("locale", "en-US")
    lang = m_cfg.get("language", "en")
    category_id = str(m_cfg.get("youtube_category_id") or cfg.get("youtube", "category_id", default="27"))

    body = {
        "snippet": {
            "title": title[:100],
            "description": description,
            "tags": tags or [],
            "categoryId": category_id,
            "defaultLanguage": lang,
            "defaultAudioLanguage": locale,
        },
        "status": {
            "privacyStatus": cfg.get("youtube", "privacy_status", default="private"),
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(video_path, chunksize=-1, resumable=True, mimetype="video/mp4")

    logger.info(
        "Uploading %s to YouTube (market=%s, locale=%s, privacy=%s)...",
        video_path,
        market_code,
        locale,
        body["status"]["privacyStatus"],
    )
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            logger.info("Upload progress: %d%%", int(status.progress() * 100))

    video_id = response["id"]
    url = f"https://youtu.be/{video_id}"
    logger.info("YouTube upload complete (%s): %s", market_code, url)
    return url


def upload_tiktok(video_path: str, title: str) -> dict:
    """
    Publishes video_path via TikTok's Content Posting API.
    Requires TIKTOK_ACCESS_TOKEN from an approved TikTok for Developers app
    (https://developers.tiktok.com/doc/content-posting-api-get-started/) —
    this cannot be obtained programmatically, you must apply for API access
    and grant your own account the video.publish scope.
    """
    cfg = load_config()
    access_token = cfg.env["tiktok_access_token"]
    if not access_token:
        raise RuntimeError(
            "TIKTOK_ACCESS_TOKEN is not set. TikTok's Content Posting API requires an "
            "approved developer app; see the docstring for the application link."
        )

    video_path = Path(video_path)
    file_size = video_path.stat().st_size
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

    init_resp = requests.post(
        "https://open.tiktokapis.com/v2/post/publish/video/init/",
        headers=headers,
        json={
            "post_info": {
                "title": title,
                "privacy_level": cfg.get("tiktok", "privacy_level", default="SELF_ONLY"),
            },
            "source_info": {
                "source": "FILE_UPLOAD",
                "video_size": file_size,
                "chunk_size": file_size,
                "total_chunk_count": 1,
            },
        },
        timeout=30,
    )
    init_resp.raise_for_status()
    init_data = init_resp.json()["data"]
    upload_url = init_data["upload_url"]
    publish_id = init_data["publish_id"]

    with open(video_path, "rb") as f:
        video_bytes = f.read()
    put_resp = requests.put(
        upload_url,
        headers={"Content-Range": f"bytes 0-{file_size - 1}/{file_size}", "Content-Type": "video/mp4"},
        data=video_bytes,
        timeout=120,
    )
    put_resp.raise_for_status()

    logger.info("TikTok upload initiated: publish_id=%s", publish_id)
    return {"publish_id": publish_id}
