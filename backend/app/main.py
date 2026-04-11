from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Bitrix24 Time Accounting API",
    description="API для учёта времязатрат из Bitrix24",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: заменить на конкретные домены в продакшене
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
