#!/usr/bin/env python3
"""
Скрипт создания задачи БЕЗ проекта в Bitrix24.

Использование:
  python create_task_standalone.py --title "Задача" --responsible-id 2
  python create_task_standalone.py --title "Задача" --responsible-id 2 \
      --description "Описание" --deadline "2026-05-01" --priority 2

Требуемые права вебхука: task (tasks.task.add)
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from bitrix_api import call


def create_task_standalone(
    title: str,
    responsible_id: int,
    created_by: int = None,
    description: str = "",
    deadline: str = None,
    priority: int = 1,
    status: int = 1,
    tags: list = None,
) -> int:
    """
    Создаёт задачу без привязки к проекту. Возвращает ID задачи.

    Параметры:
      title          — заголовок задачи
      responsible_id — ID ответственного
      created_by     — ID создателя (если None — используется владелец вебхука)
      description    — описание задачи
      deadline       — дедлайн "YYYY-MM-DD" или "YYYY-MM-DD HH:MM:SS"
      priority       — приоритет (0 — низкий, 1 — средний, 2 — высокий)
      status         — статус (1 — новая, 2 — в работе, 4 — завершена, 5 — отложена)
      tags           — список тегов
    """
    fields = {
        "TITLE": title,
        "DESCRIPTION": description,
        "RESPONSIBLE_ID": responsible_id,
        "PRIORITY": priority,
        "STATUS": status,
    }
    if created_by:
        fields["CREATED_BY"] = created_by
    if deadline:
        fields["DEADLINE"] = deadline
    if tags:
        fields["TAGS"] = tags

    result = call("tasks.task.add", {"fields": fields})
    task = result.get("task", result)
    task_id = int(task.get("id", task) if isinstance(task, dict) else task)
    print(f"  Задача создана: ID={task_id} «{title}» (без проекта, ответственный {responsible_id})")
    return task_id


def main():
    parser = argparse.ArgumentParser(description="Создание задачи без проекта в Bitrix24")
    parser.add_argument("--title", required=True, help="Заголовок задачи")
    parser.add_argument("--responsible-id", type=int, required=True, help="ID ответственного")
    parser.add_argument("--created-by", type=int, default=None, help="ID создателя")
    parser.add_argument("--description", default="", help="Описание задачи")
    parser.add_argument("--deadline", default=None, help="Дедлайн (YYYY-MM-DD)")
    parser.add_argument("--priority", type=int, default=1, choices=[0, 1, 2], help="Приоритет")
    parser.add_argument("--status", type=int, default=1, choices=[1, 2, 3, 4, 5], help="Статус")
    args = parser.parse_args()

    print("=== Создание задачи без проекта ===")
    task_id = create_task_standalone(
        title=args.title,
        responsible_id=args.responsible_id,
        created_by=args.created_by,
        description=args.description,
        deadline=args.deadline,
        priority=args.priority,
        status=args.status,
    )
    print(f"Готово. Task ID: {task_id}")


if __name__ == "__main__":
    main()
