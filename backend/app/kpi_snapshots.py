from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.auth import get_current_user
from app.database import Base, get_db
from app.models import User
from app.rbac import apply_visibility_to_report


class KpiSnapshot(Base):
    __tablename__ = "kpi_snapshots"
    __table_args__ = (UniqueConstraint("date_from", "date_to", "scope", name="uq_kpi_snapshot_scope"),)

    id = Column(Integer, primary_key=True)
    date_from = Column(Date, nullable=False, index=True)
    date_to = Column(Date, nullable=False, index=True)
    scope = Column(String, nullable=False, default="company")
    payload = Column(JSON, nullable=False)
    is_full = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    refreshed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


router = APIRouter(prefix="/api/kpi", tags=["kpi"])


def build_kpi_snapshot(db: Session, date_from: date, date_to: date, *, is_full: bool = False) -> dict | None:
    from app.background_replication import get_cached_report

    comparison = get_cached_report(db, "employees_comparison", date_from, date_to)
    summary = get_cached_report(db, "users_summary", date_from, date_to)
    if not comparison:
        return None

    employees = comparison.get("employees", [])
    summary_by_user = {int(row["user_id"]): row for row in (summary or {}).get("users", [])}
    max_hours = max([row.get("hours_total", 0) for row in employees] or [1])

    rows = []
    for row in employees:
        uid = int(row["user_id"])
        summary_row = summary_by_user.get(uid, {})
        hours = float(row.get("hours_total", 0))
        tasks = int(row.get("tasks_count", 0))
        active_days = int(row.get("active_days", 0))
        overtime = int(row.get("overtime_days", 0))
        project_share = float(row.get("project_share", 0))
        period_days = max(int(comparison.get("period_days", 1)), 1)
        task_hours = [task.get("hours", 0) for task in summary_row.get("tasks", [])]
        largest_task_share = max(task_hours, default=0) / hours if hours else 0

        utilization = min(hours / max(max_hours, 1), 1)
        consistency = active_days / period_days
        focus_index = project_share * (1 - min(largest_task_share, 1) * 0.35)
        task_diversity = min(tasks / 12, 1)
        overtime_risk = min(overtime / max(period_days / 5, 1), 1)
        quality_proxy = (0.35 * consistency) + (0.25 * focus_index) + (0.25 * task_diversity) + (0.15 * utilization)
        composite = max(0, quality_proxy - overtime_risk * 0.2)

        rows.append({
            "user_id": uid,
            "user_name": row.get("user_name"),
            "score": round(composite * 100, 1),
            "utilization": round(utilization, 3),
            "consistency": round(consistency, 3),
            "focus_index": round(focus_index, 3),
            "task_diversity": round(task_diversity, 3),
            "project_share": round(project_share, 3),
            "overtime_risk": round(overtime_risk, 3),
            "active_days": active_days,
            "tasks_count": tasks,
            "hours_total": hours,
        })

    rows.sort(key=lambda item: item["score"], reverse=True)
    for index, row in enumerate(rows, start=1):
        row["rank"] = index

    payload = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "scope": "company",
        "metrics": rows,
        "formula": "0.35*consistency + 0.25*focus + 0.25*diversity + 0.15*utilization - 0.20*overtime_risk",
    }

    snapshot = (
        db.query(KpiSnapshot)
        .filter(KpiSnapshot.date_from == date_from, KpiSnapshot.date_to == date_to, KpiSnapshot.scope == "company")
        .first()
    )
    if snapshot is None:
        snapshot = KpiSnapshot(date_from=date_from, date_to=date_to, scope="company")
        db.add(snapshot)
    snapshot.payload = payload
    snapshot.is_full = is_full
    db.commit()
    return payload


@router.get("/snapshots")
async def get_kpi_snapshot(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    snapshot = (
        db.query(KpiSnapshot)
        .filter(KpiSnapshot.date_from == date_from, KpiSnapshot.date_to == date_to, KpiSnapshot.scope == "company")
        .first()
    )
    if snapshot is None:
        payload = build_kpi_snapshot(db, date_from, date_to) or {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "scope": "company",
            "metrics": [],
        }
    else:
        payload = snapshot.payload
    scoped = apply_visibility_to_report({"employees": payload.get("metrics", []), **payload}, current_user)
    scoped["metrics"] = scoped.get("employees", [])
    scoped.pop("employees", None)
    return scoped
