import asyncio
import os
from datetime import date, datetime, timedelta, timezone

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, JSON, String, UniqueConstraint, or_
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
    payload = Column(JSON, nullable=True)            # None = tracking-only, payload not yet cached
    is_full = Column(Boolean, nullable=False, default=False)
    is_standard = Column(Boolean, nullable=False, default=False)  # maintained by background tasks
    request_count = Column(Integer, nullable=False, default=0)    # total requests for this scope
    last_requested_at = Column(DateTime(timezone=True), nullable=True)  # last user-facing request
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    refreshed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# ---------------------------------------------------------------------------
# Cache behaviour constants
# ---------------------------------------------------------------------------
CACHE_HIT_THRESHOLD = 5   # min requests before a custom period gets its payload cached
STALE_DAYS = 7             # days without access before a non-standard entry is purged
REFRESH_BATCH_SIZE = 10   # custom-period rows refreshed concurrently per batch

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery_app = Celery("workerpunch", broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.timezone = os.getenv("CELERY_TIMEZONE", "Asia/Yekaterinburg")

_refresh_hours = max(1, int(os.getenv("CACHE_REFRESH_HOURS", "2")))
celery_app.conf.beat_schedule = {
    "periodic-report-cache-refresh": {
        "task": "app.background_replication.refresh_all_cached_reports",
        "schedule": crontab(minute=5, hour=f"*/{_refresh_hours}"),
    },
}


def _find_row(
    db: Session,
    report_type: str,
    date_from: date,
    date_to: date,
    user_id: int | None,
    project_id: int | None,
) -> "CachedReportSnapshot | None":
    return (
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


def track_and_get_cached_report(
    db: Session,
    report_type: str,
    date_from: date,
    date_to: date,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
) -> tuple[dict | None, bool]:
    """
    Increment request_count and update last_requested_at for the given scope.

    Returns (payload, is_eligible) where:
      - payload     — cached data when eligible and populated, otherwise None
      - is_eligible — True when is_standard=True or request_count >= CACHE_HIT_THRESHOLD
    """
    now = datetime.now(tz=timezone.utc)
    row = _find_row(db, report_type, date_from, date_to, user_id, project_id)

    if row is None:
        row = CachedReportSnapshot(
            report_type=report_type,
            date_from=date_from,
            date_to=date_to,
            user_id=user_id,
            project_id=project_id,
            payload=None,
            request_count=1,
            last_requested_at=now,
            is_standard=False,
        )
        db.add(row)
        db.commit()
        return None, False

    row.request_count = (row.request_count or 0) + 1
    row.last_requested_at = now
    db.commit()

    is_eligible = row.is_standard or row.request_count >= CACHE_HIT_THRESHOLD
    return (row.payload if is_eligible else None), is_eligible


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
    is_standard: bool = False,
) -> None:
    now = datetime.now(tz=timezone.utc)
    row = _find_row(db, report_type, date_from, date_to, user_id, project_id)
    if row is None:
        row = CachedReportSnapshot(
            report_type=report_type,
            date_from=date_from,
            date_to=date_to,
            user_id=user_id,
            project_id=project_id,
            request_count=0,
            last_requested_at=now,
        )
        db.add(row)
    row.payload = payload
    row.is_full = is_full
    if is_standard:
        row.is_standard = True  # never demote a standard period
    db.commit()


def cleanup_stale_caches(db: Session) -> int:
    """Delete non-standard entries not accessed within STALE_DAYS days."""
    threshold = datetime.now(tz=timezone.utc) - timedelta(days=STALE_DAYS)
    deleted = (
        db.query(CachedReportSnapshot)
        .filter(
            CachedReportSnapshot.is_standard == False,  # noqa: E712
            CachedReportSnapshot.payload.isnot(None),
            or_(
                CachedReportSnapshot.last_requested_at < threshold,
                CachedReportSnapshot.last_requested_at.is_(None),
            ),
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def common_periods(today: date | None = None) -> list[tuple[date, date]]:
    today = today or date.today()
    month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())
    quarter_start = (month_start - timedelta(days=62)).replace(day=1)
    year_start = today.replace(month=1, day=1)
    return [
        (today, today),
        (week_start, today),
        (month_start, today),
        (quarter_start, today),
        (year_start, today),
    ]


@celery_app.task(name="app.background_replication.refresh_all_cached_reports")
def refresh_all_cached_reports() -> dict:
    return asyncio.run(_refresh_all_cached())


async def _refresh_all_cached() -> dict:
    from app.routers.reports import (
        report_employees_comparison,
        report_my_dashboard,
        report_projects,
        report_team_heatmap,
        report_users_summary,
    )
    from app.kpi_snapshots import build_kpi_snapshot

    db = SessionLocal()
    try:
        # Step 1: cleanup stale non-standard entries BEFORE refreshing
        deleted = cleanup_stale_caches(db)

        # Step 2: load all rows that have a cached payload, most popular first
        cached_rows = (
            db.query(CachedReportSnapshot)
            .filter(CachedReportSnapshot.payload.isnot(None))
            .order_by(
                CachedReportSnapshot.is_standard.desc(),
                CachedReportSnapshot.request_count.desc(),
            )
            .all()
        )
    finally:
        db.close()

    # Step 3: always refresh all standard periods (create if missing in cache)
    standard_periods = common_periods()
    refreshed_standard = 0
    for date_from, date_to in standard_periods:
        await report_users_summary(
            date_from=date_from, date_to=date_to, user_id=None,
            db=None, current_user=None, use_cache=False, is_full_refresh=False, is_standard=True,
        )
        await report_employees_comparison(
            date_from=date_from, date_to=date_to,
            db=None, current_user=None, use_cache=False, is_full_refresh=False, is_standard=True,
        )
        await report_projects(
            date_from=date_from, date_to=date_to, user_id=None, project_id=None,
            db=None, current_user=None, use_cache=False, is_full_refresh=False, is_standard=True,
        )
        await report_team_heatmap(
            date_from=date_from, date_to=date_to, user_ids=None,
            db=None, current_user=None, use_cache=False, is_full_refresh=False, is_standard=True,
        )
        kpi_db = SessionLocal()
        try:
            build_kpi_snapshot(kpi_db, date_from, date_to, is_full=False)
        finally:
            kpi_db.close()
        refreshed_standard += 1

    # Step 4: refresh cached custom periods in batches, most popular first
    standard_keys = {
        (r.report_type, r.date_from, r.date_to, r.user_id, r.project_id)
        for r in cached_rows
        if r.is_standard
    }
    custom_rows = [
        r for r in cached_rows
        if not r.is_standard
        and (r.report_type, r.date_from, r.date_to, r.user_id, r.project_id) not in standard_keys
    ]

    async def _refresh_row(row: CachedReportSnapshot) -> None:
        kwargs: dict = dict(
            date_from=row.date_from,
            date_to=row.date_to,
            db=None,
            current_user=None,
            use_cache=False,
            is_full_refresh=False,
            is_standard=False,
        )
        if row.report_type == "users_summary":
            await report_users_summary(user_id=row.user_id, **kwargs)
        elif row.report_type in ("employees_comparison", "employees_comparison_kpi_v2"):
            await report_employees_comparison(**kwargs)
        elif row.report_type == "projects":
            await report_projects(user_id=row.user_id, project_id=row.project_id, **kwargs)
        elif row.report_type in ("team_heatmap", "team_heatmap_v2"):
            await report_team_heatmap(user_ids=None, **kwargs)
        elif row.report_type in ("my_dashboard", "my_dashboard_v2") and row.user_id is not None:
            await report_my_dashboard(user_id=row.user_id, **kwargs)

    refreshed_custom = 0
    for i in range(0, len(custom_rows), REFRESH_BATCH_SIZE):
        batch = custom_rows[i : i + REFRESH_BATCH_SIZE]
        await asyncio.gather(*[_refresh_row(row) for row in batch])
        refreshed_custom += len(batch)

    return {
        "status": "ok",
        "deleted_stale": deleted,
        "refreshed_standard_periods": refreshed_standard,
        "refreshed_custom_cached": refreshed_custom,
    }
