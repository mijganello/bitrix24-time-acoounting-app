import os
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
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


@router.post("/login", response_model=BitrixLoginOut)
async def bitrix_login(payload: BitrixLoginIn, db: Session = Depends(get_db)):
    bitrix_user = await load_current_bitrix_user(payload.auth_id, payload.domain)
    user, created = upsert_bitrix_user(db, bitrix_user)
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован")
    token = create_access_token({"sub": user.username})
    return BitrixLoginOut(access_token=token, created=created)
