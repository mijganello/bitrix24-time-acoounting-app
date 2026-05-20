from enum import StrEnum

from fastapi import Depends, HTTPException, status

from app.auth import get_current_user
from app.models import User


class Role(StrEnum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ADMIN = "admin"


ROLE_LEVELS = {
    Role.EMPLOYEE: 10,
    Role.MANAGER: 50,
    Role.ADMIN: 80,
}


def normalize_role(role: str | None) -> Role:
    try:
        return Role(role or Role.EMPLOYEE)
    except ValueError:
        return Role.EMPLOYEE


def role_level(role: str | Role | None) -> int:
    return ROLE_LEVELS[normalize_role(str(role) if role is not None else None)]


def can_view_all(user: User | None) -> bool:
    if user is None:
        return True
    return role_level(user.role) >= ROLE_LEVELS[Role.MANAGER]


def visible_bitrix_user_ids(user: User | None) -> set[int] | None:
    if can_view_all(user):
        return None
    if user and user.bitrix_user_id:
        return {int(user.bitrix_user_id)}
    return set()


def require_role(min_role: Role):
    async def dependency(current_user: User = Depends(get_current_user)) -> User:
        if role_level(current_user.role) < ROLE_LEVELS[min_role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав для этого действия",
            )
        return current_user

    return dependency


def assert_can_view_bitrix_user(current_user: User | None, bitrix_user_id: int) -> None:
    allowed = visible_bitrix_user_ids(current_user)
    if allowed is not None and int(bitrix_user_id) not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Можно смотреть только свою статистику",
        )


def apply_visibility_to_report(payload: dict, current_user: User | None) -> dict:
    allowed = visible_bitrix_user_ids(current_user)
    if allowed is None:
        return payload

    scoped = dict(payload)

    if "users" in scoped:
        scoped["users"] = [row for row in scoped.get("users", []) if int(row.get("user_id", 0)) in allowed]
        scoped["total_seconds"] = sum(int(row.get("seconds_total", row.get("total_seconds", 0))) for row in scoped["users"])
        scoped["total_hours"] = round(scoped["total_seconds"] / 3600, 2)

    if "employees" in scoped:
        scoped["employees"] = [row for row in scoped.get("employees", []) if int(row.get("user_id", 0)) in allowed]
        for index, row in enumerate(scoped["employees"], start=1):
            row["rank"] = index

    if "projects" in scoped or "no_project" in scoped:
        scoped["projects"] = [_scope_project(project, allowed) for project in scoped.get("projects", [])]
        scoped["projects"] = [project for project in scoped["projects"] if project["seconds"] > 0]
        if scoped.get("no_project"):
            scoped["no_project"] = _scope_project(scoped["no_project"], allowed)
            if scoped["no_project"]["seconds"] == 0:
                scoped["no_project"] = None
        all_projects = scoped["projects"] + ([scoped["no_project"]] if scoped.get("no_project") else [])
        scoped["total_seconds"] = sum(project["seconds"] for project in all_projects)
        scoped["total_hours"] = round(scoped["total_seconds"] / 3600, 2)

    return scoped


def _scope_project(project: dict, allowed: set[int]) -> dict:
    scoped_project = dict(project)
    tasks = []
    for task in scoped_project.get("tasks", []):
        scoped_task = dict(task)
        scoped_task["users"] = [user for user in task.get("users", []) if int(user.get("user_id", 0)) in allowed]
        scoped_task["seconds"] = sum(int(user.get("seconds", 0)) for user in scoped_task["users"])
        scoped_task["hours"] = round(scoped_task["seconds"] / 3600, 2)
        if scoped_task["seconds"] > 0:
            tasks.append(scoped_task)
    scoped_project["tasks"] = tasks
    scoped_project["seconds"] = sum(int(task.get("seconds", 0)) for task in tasks)
    scoped_project["hours"] = round(scoped_project["seconds"] / 3600, 2)
    return scoped_project
