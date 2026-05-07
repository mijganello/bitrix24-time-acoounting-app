import asyncio
import os
from datetime import date, timedelta

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.database import Base, SessionLocal


class CachedReportSnapshot(Base):
    __tablename__ = "cached_report_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "report_type",
            "date_from",
            "date_to",
            "user_id",
            "project_id",
            name="uq_cached_report_scope",
        ),
    )

    id = Column(Integer, primary_key=True)
    report_type = Column(String, nullable=False, index=True)
    date_from = Column(Date, nullable=False, index=True)
    date_to = Column(Date, nullable=False, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    project_id = Column(Integer, nullable=True, index=True)
    payload = Column(JSON, nullable=False)
    is_full = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    refreshed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("workerpunch", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.timezone = os.getenv("CELERY_TIMEZONE", "Asia/Yekaterinburg")
celery_app.conf.beat_schedule = {
    "hourly-report-replication": {
        "task": "app.background_replication.refresh_hourly_reports",
        "schedule": crontab(minute=5),
    },
    "daily-full-report-recalculation": {
        "task": "app.background_replication.refresh_daily_full_reports",
        "schedule": crontab(hour=3, minute=15),
    },
}


def get_cached_report(
    db: Session,
    report_type: str,
    date_from: date,
    date_to: date,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
) -> dict | None:
    row = (
        db.query(CachedReportSnapshot)
        .filter(
            CachedReportSnapshot.report_type == report_type,
            CachedReportSnapshot.date_from == date_from,
            CachedReportSnapshot.date_to == date_to,
            CachedReportSnapshot.user_id.is_(None) if user_id is None else CachedReportSnapshot.user_id == user_id,
            CachedReportSnapshot.project_id.is_(None) if project_id is None else CachedReportSnapshot.project_id == project_id,
        )
        .first()
    )
    return row.payload if row else None


def upsert_cached_report(
    db: Session,
    report_type: str,
    date_from: date,
    date_to: date,
    payload: dict,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
    is_full: bool = False,
) -> None:
    row = (
        db.query(CachedReportSnapshot)
        .filter(
            CachedReportSnapshot.report_type == report_type,
            CachedReportSnapshot.date_from == date_from,
            CachedReportSnapshot.date_to == date_to,
            CachedReportSnapshot.user_id.is_(None) if user_id is None else CachedReportSnapshot.user_id == user_id,
            CachedReportSnapshot.project_id.is_(None) if project_id is None else CachedReportSnapshot.project_id == project_id,
        )
        .first()
    )
    if row is None:
        row = CachedReportSnapshot(
            report_type=report_type,
            date_from=date_from,
            date_to=date_to,
            user_id=user_id,
            project_id=project_id,
        )
        db.add(row)
    row.payload = payload
    row.is_full = is_full
    db.commit()


def common_periods(today: date | None = None) -> list[tuple[date, date]]:
    today = today or date.today()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())
    quarter_start = (month_start - timedelta(days=62)).replace(day=1)
    return [
        (today, today),
        (week_start, today),
        (month_start, today),
        (quarter_start, today),
    ]


@celery_app.task(name="app.background_replication.refresh_hourly_reports")
def refresh_hourly_reports() -> dict:
    return asyncio.run(_refresh_reports(common_periods(), is_full=False))


@celery_app.task(name="app.background_replication.refresh_daily_full_reports")
def refresh_daily_full_reports() -> dict:
    today = date.today()
    year_start = today.replace(month=1, day=1)
    periods = common_periods(today) + [(year_start, today)]
    return asyncio.run(_refresh_reports(periods, is_full=True))


async def _refresh_reports(periods: list[tuple[date, date]], *, is_full: bool) -> dict:
    from app.routers.reports import (
        report_employees_comparison,
        report_projects,
        report_team_heatmap,
        report_users_summary,
    )
    from app.kpi_snapshots import build_kpi_snapshot

    refreshed = 0
    for date_from, date_to in periods:
        await report_users_summary(date_from=date_from, date_to=date_to, user_id=None, db=None, current_user=None, use_cache=False, is_full_refresh=is_full)
        refreshed += 1
        await report_employees_comparison(date_from=date_from, date_to=date_to, db=None, current_user=None, use_cache=False, is_full_refresh=is_full)
        refreshed += 1
        await report_projects(date_from=date_from, date_to=date_to, user_id=None, project_id=None, db=None, current_user=None, use_cache=False, is_full_refresh=is_full)
        refreshed += 1
        await report_team_heatmap(date_from=date_from, date_to=date_to, user_ids=None, db=None, current_user=None, use_cache=False, is_full_refresh=is_full)
        refreshed += 1
        db = SessionLocal()
        try:
            build_kpi_snapshot(db, date_from, date_to, is_full=is_full)
        finally:
            db.close()
    return {"status": "ok", "refreshed": refreshed}
