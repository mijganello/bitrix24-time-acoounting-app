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
from fastapi import APIRouter, HTTPException, Query

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


# ---------------------------------------------------------------------------
# Отчёт 1: Сводка по пользователям за период
# ---------------------------------------------------------------------------

@router.get("/users-summary")
async def report_users_summary(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Фильтр по конкретному пользователю"),
):
    """
    Сводка: кто сколько времени потратил за период.
    Разбивка на задачи с проектом и без проекта.
    """
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

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "users": rows,
        "total_seconds": sum(r["seconds_total"] for r in rows),
        "total_hours": round(sum(r["seconds_total"] for r in rows) / 3600, 2),
    }


# ---------------------------------------------------------------------------
# Отчёт 2: Детализация по проектам
# ---------------------------------------------------------------------------

@router.get("/projects")
async def report_projects(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Фильтр по пользователю"),
    project_id: Optional[int] = Query(None, description="Фильтр по проекту (0 = без проекта)"),
):
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

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "projects": with_projects,
        "no_project": no_project,
        "total_seconds": sum(p["seconds"] for p in project_nodes),
        "total_hours": round(sum(p["seconds"] for p in project_nodes) / 3600, 2),
    }


# ---------------------------------------------------------------------------
# Отчёт 3: Нагрузка команды по дням (тепловая карта)
# ---------------------------------------------------------------------------

@router.get("/team-heatmap")
async def report_team_heatmap(
    date_from: date = Query(..., description="Начало периода (YYYY-MM-DD)"),
    date_to: date = Query(..., description="Конец периода (YYYY-MM-DD)"),
    user_ids: Optional[str] = Query(None, description="ID пользователей через запятую"),
):
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

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "dates": dates,
        "users": user_rows,
    }


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
):
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

    return {
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


# ---------------------------------------------------------------------------
# Вспомогательный endpoint: список пользователей Bitrix24
# ---------------------------------------------------------------------------

@router.get("/users-list")
async def report_users_list():
    """Все активные пользователи портала (для фильтров)."""
    async with httpx.AsyncClient() as client:
        result = await _bx(client, "user.get", {"ACTIVE": True})
    items = result if isinstance(result, list) else []
    return [
        {
            "id": int(u["ID"]),
            "name": f"{u.get('NAME', '')} {u.get('LAST_NAME', '')}".strip(),
        }
        for u in items
    ]
