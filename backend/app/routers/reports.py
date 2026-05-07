"""
Роутер аналитических отчётов по времязатратам.

Отчёты:
  1. /users-summary   — сводка по пользователям за период
  2. /projects        — детализация по проектам
  3. /team-heatmap    — нагрузка команды по дням
  4. /my-dashboard    — личный дашборд сотрудника
"""

import os
from collections import defaultdict
from datetime import date, datetime, timezone, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.background_replication import get_cached_report, upsert_cached_report
from app.database import get_db, SessionLocal
from app.kpi_snapshots import build_kpi_snapshot
from app.models import User
from app.rbac import apply_visibility_to_report, assert_can_view_bitrix_user, visible_bitrix_user_ids

router = APIRouter(prefix="/api/reports", tags=["reports"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _webhook() -> str:
    url = os.getenv("BITRIX24_WEBHOOK_URL", "").rstrip("/")
    if not url:
        raise HTTPException(503, detail="BITRIX24_WEBHOOK_URL не настроен")
    return url


async def _bx(client: httpx.AsyncClient, method: str, params) -> dict | list:
    """Вызов метода Bitrix24 REST API."""
    resp = await client.post(f"{_webhook()}/{method}.json", json=params, timeout=30.0)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise HTTPException(502, detail=f"Bitrix24 [{method}]: {data['error']} — {data.get('error_description', '')}")
    return data.get("result", data)


async def _get_all_tasks(client: httpx.AsyncClient, group_id: int | None = None) -> list[dict]:
    """Получить все задачи с пагинацией. group_id=0 — задачи без проекта."""
    tasks: list[dict] = []
    start = 0
    flt: dict = {}
    if group_id is not None:
        flt["GROUP_ID"] = group_id

    while True:
        result = await _bx(client, "tasks.task.list", {
            "select": ["ID", "TITLE", "GROUP_ID", "RESPONSIBLE_ID", "STATUS"],
            "filter": flt,
            "start": start,
        })
        page = result.get("tasks", [])
        tasks.extend(page)
        if len(page) < 50:
            break
        start += 50
    return tasks


async def _get_elapsed_batch(client: httpx.AsyncClient, task_ids: list[int]) -> list[dict]:
    """
    Batch-запрос task.elapseditem.getlist для списка задач.
    Bitrix24 batch принимает до 50 команд. task_ids режется на части.
    """
    if not task_ids:
        return []

    all_items: list[dict] = []
    for chunk_start in range(0, len(task_ids), 50):
        chunk = task_ids[chunk_start: chunk_start + 50]
        # В batch-режиме через query-string TASKID работает
        cmd = {f"e{tid}": f"task.elapseditem.getlist?TASKID={tid}" for tid in chunk}
        result = await _bx(client, "batch", {"halt": 0, "cmd": cmd})
        items_by_key = result.get("result", {})
        for key in cmd:
            items = items_by_key.get(key) or []
            all_items.extend(items)
    return all_items


async def _get_users(client: httpx.AsyncClient, user_ids: list[int]) -> dict[int, dict]:
    """Вернуть {user_id: {id, name}} для списка ID."""
    if not user_ids:
        return {}
    result = await _bx(client, "user.get", {"filter": {"ID": user_ids}})
    return {
        int(u["ID"]): {"id": int(u["ID"]), "name": f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip()}
        for u in (result if isinstance(result, list) else [])
    }


async def _get_projects(client: httpx.AsyncClient) -> dict[int, str]:
    """Вернуть {project_id: name} всех активных проектов."""
    result = await _bx(client, "sonet_group.get", {
        "FILTER": {"PROJECT": "Y", "ACTIVE": "Y"},
        "select": ["ID", "NAME"],
    })
    items = result if isinstance(result, list) else []
    return {int(p["ID"]): p["NAME"] for p in items}


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


def _in_range(item: dict, date_from: date | None, date_to: date | None) -> bool:
    """Проверить, попадает ли запись времени в диапазон дат (по CREATED_DATE)."""
    dt = _parse_dt(item.get("CREATED_DATE"))
    if dt is None:
        return True
    d = dt.date()
    if date_from and d < date_from:
        return False
    if date_to and d > date_to:
        return False
    return True


def _days_in_range(date_from: date, date_to: date) -> int:
    return (date_to - date_from).days + 1


def _min_max_normalize(values: dict[int, float]) -> dict[int, float]:
    if not values:
        return {}

    min_value = min(values.values())
    max_value = max(values.values())

    if max_value == min_value:
        fill = 0.0 if max_value == 0 else 1.0
        return {key: fill for key in values}

    return {
        key: (value - min_value) / (max_value - min_value)
        for key, value in values.items()
    }


def _comparison_profile(
    *,
    project_share: float,
    active_days: int,
    overtime_days: int,
    period_days: int,
) -> str:
    if overtime_days >= max(1, period_days // 5):
        return "risk_of_overload"
    if project_share >= 0.7:
        return "project_focused"
    if active_days >= max(3, int(period_days * 0.6)):
        return "stable"
    return "spot_activity"


def _db_for_cache(db: Session | None):
    if db is not None:
        return db, False
    return SessionLocal(), True


def _read_cached(
    report_type: str,
    date_from: date,
    date_to: date,
    current_user: User | None,
    db: Session | None,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
) -> dict | None:
    cache_db, should_close = _db_for_cache(db)
    try:
        cached = get_cached_report(
            cache_db,
            report_type,
            date_from,
            date_to,
            user_id=user_id,
            project_id=project_id,
        )
        return apply_visibility_to_report(cached, current_user) if cached else None
    finally:
        if should_close:
            cache_db.close()


def _store_cached(
    report_type: str,
    date_from: date,
    date_to: date,
    payload: dict,
    db: Session | None,
    *,
    user_id: int | None = None,
    project_id: int | None = None,
    is_full: bool = False,
) -> None:
    cache_db, should_close = _db_for_cache(db)
    try:
        upsert_cached_report(
            cache_db,
            report_type,
            date_from,
            date_to,
            payload,
            user_id=user_id,
            project_id=project_id,
            is_full=is_full,
        )
    finally:
        if should_close:
            cache_db.close()


# ---------------------------------------------------------------------------
# Отчёт 1: Сводка по пользователям за период
# ---------------------------------------------------------------------------

@router.get("/users-summary")
async def report_users_summary(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Фильтр по конкретному пользователю"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
    use_cache: bool = Query(True, include_in_schema=False),
    is_full_refresh: bool = Query(False, include_in_schema=False),
):
    """
    Сводка: кто сколько времени потратил за период.
    Разбивка на задачи с проектом и без проекта.
    """
    if user_id is not None:
        assert_can_view_bitrix_user(current_user, user_id)
    if use_cache:
        cached = _read_cached("users_summary", date_from, date_to, current_user, db, user_id=user_id)
        if cached:
            return cached

    async with httpx.AsyncClient() as client:
        tasks = await _get_all_tasks(client)
        task_ids = [int(t["id"]) for t in tasks]

        # Карта task_id → {has_project, title, group_id, group_name}
        task_info: dict[int, dict] = {
            int(t["id"]): {
                "has_project": bool(t.get("groupId") and int(t["groupId"]) != 0),
                "title": t.get("title", ""),
                "group_id": int(t.get("groupId") or 0),
                "group_name": (t.get("group") or {}).get("name") or None,
            }
            for t in tasks
        }

        elapsed = await _get_elapsed_batch(client, task_ids)

    # Фильтр по дате и пользователю
    elapsed = [e for e in elapsed if _in_range(e, date_from, date_to)]
    if user_id is not None:
        elapsed = [e for e in elapsed if int(e["USER_ID"]) == user_id]

    # Агрегация: user_id → {totals, tasks: {task_id → seconds}}
    agg: dict[int, dict] = defaultdict(lambda: {
        "seconds_total": 0,
        "seconds_with_project": 0,
        "seconds_without_project": 0,
        "task_secs": defaultdict(int),
    })
    for e in elapsed:
        uid = int(e["USER_ID"])
        secs = int(e["SECONDS"])
        tid = int(e["TASK_ID"])
        agg[uid]["seconds_total"] += secs
        agg[uid]["task_secs"][tid] += secs
        if task_info.get(tid, {}).get("has_project", False):
            agg[uid]["seconds_with_project"] += secs
        else:
            agg[uid]["seconds_without_project"] += secs

    async with httpx.AsyncClient() as client:
        users = await _get_users(client, list(agg.keys()))

    def _build_user_tasks(task_secs: dict) -> list[dict]:
        items = sorted(task_secs.items(), key=lambda x: x[1], reverse=True)
        return [
            {
                "task_id": tid,
                "task_title": task_info.get(tid, {}).get("title", f"task#{tid}"),
                "group_id": task_info.get(tid, {}).get("group_id", 0) or None,
                "group_name": task_info.get(tid, {}).get("group_name"),
                "seconds": secs,
                "hours": round(secs / 3600, 2),
            }
            for tid, secs in items
        ]

    rows = sorted(
        [
            {
                "user_id": uid,
                "user_name": users.get(uid, {}).get("name", f"user#{uid}"),
                "seconds_total": v["seconds_total"],
                "hours_total": round(v["seconds_total"] / 3600, 2),
                "seconds_with_project": v["seconds_with_project"],
                "hours_with_project": round(v["seconds_with_project"] / 3600, 2),
                "seconds_without_project": v["seconds_without_project"],
                "hours_without_project": round(v["seconds_without_project"] / 3600, 2),
                "tasks": _build_user_tasks(v["task_secs"]),
            }
            for uid, v in agg.items()
        ],
        key=lambda r: r["seconds_total"],
        reverse=True,
    )

    payload = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "users": rows,
        "total_seconds": sum(r["seconds_total"] for r in rows),
        "total_hours": round(sum(r["seconds_total"] for r in rows) / 3600, 2),
    }
    _store_cached("users_summary", date_from, date_to, payload, db, user_id=user_id, is_full=is_full_refresh)
    return apply_visibility_to_report(payload, current_user)


# ---------------------------------------------------------------------------
# Отчёт 2: Детализация по проектам
# ---------------------------------------------------------------------------

@router.get("/employees-comparison")
async def report_employees_comparison(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
    use_cache: bool = Query(True, include_in_schema=False),
    is_full_refresh: bool = Query(False, include_in_schema=False),
):
    if use_cache:
        cached = _read_cached("employees_comparison", date_from, date_to, current_user, db)
        if cached:
            return cached

    async with httpx.AsyncClient() as client:
        tasks = await _get_all_tasks(client)
        task_ids = [int(t["id"]) for t in tasks]
        elapsed_raw = await _get_elapsed_batch(client, task_ids)

    elapsed = [e for e in elapsed_raw if _in_range(e, date_from, date_to)]
    task_has_project = {
        int(t["id"]): bool(t.get("groupId") and int(t["groupId"]) != 0)
        for t in tasks
    }

    aggregates: dict[int, dict] = defaultdict(lambda: {
        "seconds_total": 0,
        "task_ids": set(),
        "active_days": set(),
        "seconds_with_project": 0,
        "day_seconds": defaultdict(int),
    })

    for e in elapsed:
        uid = int(e["USER_ID"])
        tid = int(e["TASK_ID"])
        secs = int(e["SECONDS"])
        dt = _parse_dt(e.get("CREATED_DATE"))
        day_key = dt.date().isoformat() if dt else None

        aggregates[uid]["seconds_total"] += secs
        aggregates[uid]["task_ids"].add(tid)
        if day_key:
            aggregates[uid]["active_days"].add(day_key)
            aggregates[uid]["day_seconds"][day_key] += secs
        if task_has_project.get(tid, False):
            aggregates[uid]["seconds_with_project"] += secs

    async with httpx.AsyncClient() as client:
        users = await _get_users(client, list(aggregates.keys()))

    period_days = _days_in_range(date_from, date_to)
    employee_rows: list[dict] = []

    for uid, agg in aggregates.items():
        total_seconds = agg["seconds_total"]
        active_days = len(agg["active_days"])
        overtime_days = sum(1 for secs in agg["day_seconds"].values() if secs > 8 * 3600)
        project_share = (agg["seconds_with_project"] / total_seconds) if total_seconds else 0.0

        employee_rows.append({
            "user_id": uid,
            "user_name": users.get(uid, {}).get("name", f"user#{uid}"),
            "seconds_total": total_seconds,
            "hours_total": round(total_seconds / 3600, 2),
            "tasks_count": len(agg["task_ids"]),
            "active_days": active_days,
            "active_days_share": round(active_days / period_days, 3) if period_days else 0.0,
            "project_share": round(project_share, 3),
            "project_share_percent": round(project_share * 100, 1),
            "overtime_days": overtime_days,
            "profile": _comparison_profile(
                project_share=project_share,
                active_days=active_days,
                overtime_days=overtime_days,
                period_days=period_days,
            ),
        })

    hours_norm = _min_max_normalize({row["user_id"]: row["hours_total"] for row in employee_rows})
    tasks_norm = _min_max_normalize({row["user_id"]: row["tasks_count"] for row in employee_rows})
    active_days_norm = _min_max_normalize({row["user_id"]: row["active_days"] for row in employee_rows})
    project_share_norm = _min_max_normalize({row["user_id"]: row["project_share"] for row in employee_rows})
    overtime_norm = _min_max_normalize({row["user_id"]: row["overtime_days"] for row in employee_rows})

    for row in employee_rows:
        uid = row["user_id"]
        normalized = {
            "hours": round(hours_norm.get(uid, 0.0), 3),
            "tasks": round(tasks_norm.get(uid, 0.0), 3),
            "active_days": round(active_days_norm.get(uid, 0.0), 3),
            "project_share": round(project_share_norm.get(uid, 0.0), 3),
            "overtime": round(overtime_norm.get(uid, 0.0), 3),
        }
        score_raw = (
            0.35 * normalized["hours"]
            + 0.25 * normalized["tasks"]
            + 0.20 * normalized["active_days"]
            + 0.20 * normalized["project_share"]
            - 0.10 * normalized["overtime"]
        )
        row["score"] = round(max(score_raw, 0) * 100, 1)
        row["normalized"] = normalized

    employee_rows.sort(key=lambda row: (row["score"], row["hours_total"]), reverse=True)

    for index, row in enumerate(employee_rows, start=1):
        row["rank"] = index

    payload = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "period_days": period_days,
        "formula": "0.35*H + 0.25*T + 0.20*D + 0.20*P - 0.10*O",
        "weights": {
            "hours": 0.35,
            "tasks": 0.25,
            "active_days": 0.20,
            "project_share": 0.20,
            "overtime": -0.10,
        },
        "employees": employee_rows,
    }
    _store_cached("employees_comparison", date_from, date_to, payload, db, is_full=is_full_refresh)
    kpi_db, should_close = _db_for_cache(db)
    try:
        build_kpi_snapshot(kpi_db, date_from, date_to, is_full=is_full_refresh)
    finally:
        if should_close:
            kpi_db.close()
    return apply_visibility_to_report(payload, current_user)


# ---------------------------------------------------------------------------
# Report 3: Projects report
# ---------------------------------------------------------------------------

@router.get("/projects")
async def report_projects(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Фильтр по пользователю"),
    project_id: Optional[int] = Query(None, description="Фильтр по проекту (0 = без проекта)"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
    use_cache: bool = Query(True, include_in_schema=False),
    is_full_refresh: bool = Query(False, include_in_schema=False),
):
    if user_id is not None:
        assert_can_view_bitrix_user(current_user, user_id)
    if use_cache:
        cached = _read_cached("projects", date_from, date_to, current_user, db, user_id=user_id, project_id=project_id)
        if cached:
            return cached

    """
    Дерево: проект → задача → пользователь → секунды.
    Задачи без проекта выделены в отдельную группу.
    """
    async with httpx.AsyncClient() as client:
        tasks = await _get_all_tasks(client)
        task_ids = [int(t["id"]) for t in tasks]
        elapsed_raw = await _get_elapsed_batch(client, task_ids)
        projects_map = await _get_projects(client)

    # Фильтр по дате и пользователю
    elapsed = [e for e in elapsed_raw if _in_range(e, date_from, date_to)]
    if user_id is not None:
        elapsed = [e for e in elapsed if int(e["USER_ID"]) == user_id]

    # Карты
    task_info: dict[int, dict] = {
        int(t["id"]): {
            "title": t.get("title", ""),
            "group_id": int(t.get("groupId") or 0),
        }
        for t in tasks
    }

    # Агрегация: group_id → task_id → user_id → seconds
    tree: dict[int, dict[int, dict[int, int]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    all_user_ids: set[int] = set()
    for e in elapsed:
        tid = int(e["TASK_ID"])
        uid = int(e["USER_ID"])
        secs = int(e["SECONDS"])
        gid = task_info.get(tid, {}).get("group_id", 0)

        # Фильтр по project_id если указан
        if project_id is not None and gid != project_id:
            continue

        tree[gid][tid][uid] += secs
        all_user_ids.add(uid)

    async with httpx.AsyncClient() as client:
        users = await _get_users(client, list(all_user_ids))

    def _build_project_node(gid: int, tasks_agg: dict) -> dict:
        task_nodes = []
        for tid, user_agg in tasks_agg.items():
            user_nodes = [
                {
                    "user_id": uid,
                    "user_name": users.get(uid, {}).get("name", f"user#{uid}"),
                    "seconds": secs,
                    "hours": round(secs / 3600, 2),
                }
                for uid, secs in sorted(user_agg.items(), key=lambda x: x[1], reverse=True)
            ]
            task_secs = sum(user_agg.values())
            task_nodes.append({
                "task_id": tid,
                "task_title": task_info.get(tid, {}).get("title", f"task#{tid}"),
                "seconds": task_secs,
                "hours": round(task_secs / 3600, 2),
                "users": user_nodes,
            })
        task_nodes.sort(key=lambda x: x["seconds"], reverse=True)
        proj_secs = sum(t["seconds"] for t in task_nodes)
        return {
            "project_id": gid if gid != 0 else None,
            "project_name": projects_map.get(gid, "Без проекта") if gid != 0 else "Без проекта",
            "seconds": proj_secs,
            "hours": round(proj_secs / 3600, 2),
            "tasks": task_nodes,
        }

    project_nodes = [
        _build_project_node(gid, tasks_agg)
        for gid, tasks_agg in tree.items()
    ]
    project_nodes.sort(key=lambda x: x["seconds"], reverse=True)

    # Вынести «Без проекта» в отдельное поле
    no_project = next((p for p in project_nodes if p["project_id"] is None), None)
    with_projects = [p for p in project_nodes if p["project_id"] is not None]

    payload = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "projects": with_projects,
        "no_project": no_project,
        "total_seconds": sum(p["seconds"] for p in project_nodes),
        "total_hours": round(sum(p["seconds"] for p in project_nodes) / 3600, 2),
    }
    _store_cached("projects", date_from, date_to, payload, db, user_id=user_id, project_id=project_id, is_full=is_full_refresh)
    return apply_visibility_to_report(payload, current_user)


# ---------------------------------------------------------------------------
# Отчёт 3: Нагрузка команды по дням (тепловая карта)
# ---------------------------------------------------------------------------

@router.get("/team-heatmap")
async def report_team_heatmap(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    user_ids: Optional[str] = Query(None, description="ID пользователей через запятую"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
    use_cache: bool = Query(True, include_in_schema=False),
    is_full_refresh: bool = Query(False, include_in_schema=False),
):
    if use_cache and not user_ids:
        cached = _read_cached("team_heatmap", date_from, date_to, current_user, db)
        if cached:
            return cached
    """
    Матрица нагрузки: user × date → секунды.
    Позволяет построить тепловую карту переработок и простоев.
    """
    filter_user_ids: list[int] | None = None
    if user_ids:
        try:
            filter_user_ids = [int(x.strip()) for x in user_ids.split(",") if x.strip()]
        except ValueError:
            raise HTTPException(400, detail="user_ids должны быть числами через запятую")

    async with httpx.AsyncClient() as client:
        tasks = await _get_all_tasks(client)
        task_ids = [int(t["id"]) for t in tasks]
        elapsed_raw = await _get_elapsed_batch(client, task_ids)

    elapsed = [e for e in elapsed_raw if _in_range(e, date_from, date_to)]
    if filter_user_ids is not None:
        elapsed = [e for e in elapsed if int(e["USER_ID"]) in filter_user_ids]

    # Агрегация: user_id → date_str → seconds
    matrix: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    all_user_ids: set[int] = set()
    for e in elapsed:
        uid = int(e["USER_ID"])
        dt = _parse_dt(e.get("CREATED_DATE"))
        if dt is None:
            continue
        d_str = dt.date().isoformat()
        matrix[uid][d_str] += int(e["SECONDS"])
        all_user_ids.add(uid)

    async with httpx.AsyncClient() as client:
        users = await _get_users(client, list(all_user_ids))

    # Сформировать полный список дат в периоде
    dates: list[str] = []
    cur = date_from
    while cur <= date_to:
        dates.append(cur.isoformat())
        cur = cur.replace(day=cur.day + 1) if cur.day < _days_in_month(cur) else _next_month_start(cur)

    user_rows = sorted(
        [
            {
                "user_id": uid,
                "user_name": users.get(uid, {}).get("name", f"user#{uid}"),
                "days": {
                    d: {
                        "seconds": matrix[uid].get(d, 0),
                        "hours": round(matrix[uid].get(d, 0) / 3600, 2),
                        # уровень нагрузки: idle / low / normal / overtime
                        "level": _load_level(matrix[uid].get(d, 0)),
                    }
                    for d in dates
                },
                "total_seconds": sum(matrix[uid].values()),
                "total_hours": round(sum(matrix[uid].values()) / 3600, 2),
            }
            for uid in all_user_ids
        ],
        key=lambda r: r["total_seconds"],
        reverse=True,
    )

    payload = {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "dates": dates,
        "users": user_rows,
    }
    if not user_ids:
        _store_cached("team_heatmap", date_from, date_to, payload, db, is_full=is_full_refresh)
    return apply_visibility_to_report(payload, current_user)


def _load_level(seconds: int) -> str:
    hours = seconds / 3600
    if hours == 0:
        return "idle"
    if hours < 4:
        return "low"
    if hours <= 8:
        return "normal"
    return "overtime"


def _days_in_month(d: date) -> int:
    import calendar
    return calendar.monthrange(d.year, d.month)[1]


def _next_month_start(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


# ---------------------------------------------------------------------------
# Отчёт 4: Личный дашборд сотрудника
# ---------------------------------------------------------------------------

@router.get("/my-dashboard")
async def report_my_dashboard(
    user_id: int = Query(..., description="ID пользователя"),
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
    use_cache: bool = Query(True, include_in_schema=False),
    is_full_refresh: bool = Query(False, include_in_schema=False),
):
    assert_can_view_bitrix_user(current_user, user_id)
    if use_cache:
        cached = _read_cached("my_dashboard", date_from, date_to, current_user, db, user_id=user_id)
        if cached:
            return cached
    """
    Личный дашборд: итоговые часы, топ задач, разбивка по проектам и дням.
    """
    async with httpx.AsyncClient() as client:
        tasks = await _get_all_tasks(client)
        task_ids = [int(t["id"]) for t in tasks]
        elapsed_raw = await _get_elapsed_batch(client, task_ids)
        projects_map = await _get_projects(client)
        users = await _get_users(client, [user_id])

    task_info: dict[int, dict] = {
        int(t["id"]): {"title": t.get("title", ""), "group_id": int(t.get("groupId") or 0)}
        for t in tasks
    }

    elapsed = [
        e for e in elapsed_raw
        if int(e["USER_ID"]) == user_id and _in_range(e, date_from, date_to)
    ]

    total_seconds = sum(int(e["SECONDS"]) for e in elapsed)

    # По задачам
    task_secs: dict[int, int] = defaultdict(int)
    for e in elapsed:
        task_secs[int(e["TASK_ID"])] += int(e["SECONDS"])

    top_tasks = sorted(
        [
            {
                "task_id": tid,
                "task_title": task_info.get(tid, {}).get("title", f"task#{tid}"),
                "seconds": secs,
                "hours": round(secs / 3600, 2),
            }
            for tid, secs in task_secs.items()
        ],
        key=lambda x: x["seconds"],
        reverse=True,
    )[:10]

    # По проектам
    proj_secs: dict[int, int] = defaultdict(int)
    for tid, secs in task_secs.items():
        gid = task_info.get(tid, {}).get("group_id", 0)
        proj_secs[gid] += secs

    by_project = sorted(
        [
            {
                "project_id": gid if gid != 0 else None,
                "project_name": projects_map.get(gid, "Без проекта") if gid != 0 else "Без проекта",
                "seconds": secs,
                "hours": round(secs / 3600, 2),
                "percent": round(secs / total_seconds * 100, 1) if total_seconds else 0,
            }
            for gid, secs in proj_secs.items()
        ],
        key=lambda x: x["seconds"],
        reverse=True,
    )

    # По дням
    by_date: dict[str, int] = defaultdict(int)
    for e in elapsed:
        dt = _parse_dt(e.get("CREATED_DATE"))
        if dt:
            by_date[dt.date().isoformat()] += int(e["SECONDS"])

    by_date_list = sorted(
        [{"date": d, "seconds": s, "hours": round(s / 3600, 2)} for d, s in by_date.items()],
        key=lambda x: x["date"],
    )

    payload = {
        "user_id": user_id,
        "user_name": users.get(user_id, {}).get("name", f"user#{user_id}"),
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_seconds": total_seconds,
        "total_hours": round(total_seconds / 3600, 2),
        "top_tasks": top_tasks,
        "by_project": by_project,
        "by_date": by_date_list,
    }
    _store_cached("my_dashboard", date_from, date_to, payload, db, user_id=user_id, is_full=is_full_refresh)
    return payload


# ---------------------------------------------------------------------------
# Вспомогательный endpoint: список пользователей Bitrix24
# ---------------------------------------------------------------------------

@router.get("/users-list")
async def report_users_list(current_user: User = Depends(get_current_user)):
    """Все активные пользователи портала (для фильтров)."""
    async with httpx.AsyncClient() as client:
        result = await _bx(client, "user.get", {"ACTIVE": True})
    items = result if isinstance(result, list) else []
    rows = [
        {
            "id": int(u["ID"]),
            "name": f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip(),
        }
        for u in items
    ]
    allowed = visible_bitrix_user_ids(current_user)
    if allowed is not None:
        rows = [row for row in rows if row["id"] in allowed]
    return rows
