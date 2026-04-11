import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base
from app.routers import auth, bitrix


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Bitrix24 Time Accounting API",
    description="API для учёта времязатрат из Bitrix24",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: заменить на конкретные домены в продакшене
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bitrix.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "API работает"}


@app.get("/api/info")
async def get_info() -> dict[str, str]:
    return {
        "app": "Bitrix24 Time Accounting",
        "version": "0.1.0",
        "description": "Учёт времязатрат по задачам и проектам Bitrix24",
    }
