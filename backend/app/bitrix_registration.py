import os
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, Form, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import create_access_token, get_password_hash
from app.database import get_db
from app.models import User


router = APIRouter(prefix="/api/auth/bitrix", tags=["bitrix-auth"])


class BitrixLoginIn(BaseModel):
    auth_id: str
    domain: str | None = None
    refresh_id: str | None = None


class BitrixLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    created: bool


def _portal_url(domain: str | None) -> str:
    if domain:
        if domain.startswith("http://") or domain.startswith("https://"):
            return domain.rstrip("/")
        return f"https://{domain}".rstrip("/")
    webhook = os.getenv("BITRIX24_WEBHOOK_URL", "")
    parsed = urlparse(webhook)
    if not parsed.netloc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Не настроен домен Bitrix24")
    return f"{parsed.scheme}://{parsed.netloc}"


async def load_current_bitrix_user(auth_id: str, domain: str | None = None) -> dict:
    portal_url = _portal_url(domain)
    async with httpx.AsyncClient(timeout=12.0) as client:
        response = await client.post(f"{portal_url}/rest/user.current.json", data={"auth": auth_id})
        response.raise_for_status()
        data = response.json()
    if "error" in data:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=f"Bitrix24 OAuth: {data.get('error_description') or data['error']}",
        )
    return data.get("result", {})


def upsert_bitrix_user(db: Session, bitrix_user: dict) -> tuple[User, bool]:
    bitrix_user_id = int(bitrix_user["ID"])
    display_name = f"{bitrix_user.get('NAME', '')} {bitrix_user.get('LAST_NAME', '')}".strip() or f"user#{bitrix_user_id}"
    departments = bitrix_user.get("UF_DEPARTMENT") or []
    department_id = int(departments[0]) if departments else None

    user = db.query(User).filter(User.bitrix_user_id == bitrix_user_id).first()
    created = False
    if user is None:
        created = True
        user = User(
            username=f"bitrix_{bitrix_user_id}",
            hashed_password=get_password_hash(os.urandom(24).hex()),
            role="employee",
            bitrix_user_id=bitrix_user_id,
            is_active=True,
        )
        db.add(user)

    user.display_name = display_name
    user.department_id = department_id
    user.is_active = bitrix_user.get("ACTIVE", True) in (True, "Y", "1", 1)
    db.commit()
    db.refresh(user)
    return user, created


@router.post("/frame")
async def bitrix_frame(
    AUTH_ID: str | None = Form(None),
    REFRESH_ID: str | None = Form(None),
    DOMAIN: str | None = Form(None),
    PLACEMENT: str | None = Form(None),
    auth_id: str | None = Form(None),
    refresh_id: str | None = Form(None),
    domain: str | None = Form(None),
    placement: str | None = Form(None),
):
    """
    Принимает POST от Bitrix24 (form-data) при открытии приложения в iframe.
    Редиректит на фронтенд с параметрами в query string, чтобы useAuth.jsx мог их прочитать.
    Если PLACEMENT отсутствует — Bitrix24 вызвал страницу установки, передаём install=1.
    """
    effective_auth_id = AUTH_ID or auth_id
    effective_domain = DOMAIN or domain
    effective_refresh_id = REFRESH_ID or refresh_id
    effective_placement = PLACEMENT or placement

    frontend_url = os.getenv("FRONTEND_URL", "").rstrip("/") or ""
    params: dict[str, str] = {}
    if effective_auth_id:
        params["AUTH_ID"] = effective_auth_id
    if effective_domain:
        params["DOMAIN"] = effective_domain
    if effective_refresh_id:
        params["REFRESH_ID"] = effective_refresh_id
    if not effective_placement:
        params["install"] = "1"

    redirect_url = f"{frontend_url}/"
    if params:
        redirect_url += "?" + urlencode(params)

    return RedirectResponse(url=redirect_url, status_code=302)


@router.post("/login", response_model=BitrixLoginOut)
async def bitrix_login(payload: BitrixLoginIn, db: Session = Depends(get_db)):
    bitrix_user = await load_current_bitrix_user(payload.auth_id, payload.domain)
    user, created = upsert_bitrix_user(db, bitrix_user)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован")
    token = create_access_token({"sub": user.username})
    return BitrixLoginOut(access_token=token, created=created)
