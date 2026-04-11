import os
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/bitrix", tags=["bitrix"])


def _webhook_url() -> str:
    return os.getenv("BITRIX24_WEBHOOK_URL", "").rstrip("/")


class PortalInfo(BaseModel):
    portal_url: str | None = None
    portal_name: str | None = None
    license: str | None = None
    language: str | None = None
    connected: bool = False


@router.get("/portal", response_model=PortalInfo)
async def get_portal_info():
    webhook = _webhook_url()
    if not webhook:
        return PortalInfo(connected=False)

    parsed = urlparse(webhook)
    portal_url = f"{parsed.scheme}://{parsed.netloc}"

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(f"{webhook}/app.info.json")
            resp.raise_for_status()
            data = resp.json()
            result = data.get("result", {})

        return PortalInfo(
            portal_url=portal_url,
            portal_name=result.get("PORTAL_NAME") or parsed.netloc,
            license=result.get("LICENSE"),
            language=result.get("LANGUAGE_ID"),
            connected=True,
        )
    except Exception:
        return PortalInfo(portal_url=portal_url, portal_name=parsed.netloc, connected=False)
