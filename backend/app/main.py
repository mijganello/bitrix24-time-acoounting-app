import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.models import Base
from app.routers import auth, bitrix, reports
from app.version import APP_NAME, STAGE, VERSION


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=f"{APP_NAME} API",
    description=f"API платформы {APP_NAME} — учёт рабочего времени, аналитика задач и проектов Bitrix24",
    version=VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(bitrix.router)
app.include_router(reports.router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "message": "API работает"}


@app.get("/api/info")
async def get_info() -> dict[str, str]:
    return {
        "app": APP_NAME,
        "version": VERSION,
        "stage": STAGE,
        "description": "Платформа учёта рабочего времени для команд на базе Bitrix24. Аналитические отчёты, контроль нагрузки и прозрачность по задачам и проектам.",
    }
