#!/usr/bin/env python3
"""
Скрипт создания задачи внутри проекта (рабочей группы) в Bitrix24.

Использование:
  python create_task_in_project.py --group-id 5 --title "Задача" --responsible-id 2
  python create_task_in_project.py --group-id 5 --title "Задача" --responsible-id 2 \
      --description "Подробное описание" --deadline "2026-05-01" --priority 1

Требуемые права вебхука: task (tasks.task.add)
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from bitrix_api import call


# Статусы задач Bitrix24:
# 1 — Новая, 2 — Выполняется, 3 — Ждёт контроля, 4 — Завершена, 5 — Отложена
TASK_STATUS_NEW = 1
TASK_STATUS_IN_PROGRESS = 2
TASK_STATUS_DONE = 4

# Приоритеты: 0 — низкий, 1 — средний, 2 — высокий
PRIORITY_LOW = 0
PRIORITY_NORMAL = 1
PRIORITY_HIGH = 2


def create_task_in_project(
    group_id: int,
    title: str,
    responsible_id: int,
    created_by: int = None,
    description: str = "",
    deadline: str = None,
    priority: int = PRIORITY_NORMAL,
    status: int = TASK_STATUS_NEW,
    tags: list = None,
) -> int:
    """
    Создаёт задачу, привязанную к проекту (группе). Возвращает ID задачи.

    Параметры:
      group_id       — ID рабочей группы/проекта
      title          — заголовок задачи
      responsible_id — ID ответственного
      created_by     — ID создателя (если None — используется владелец вебхука)
      description    — описание задачи (поддерживает BB-код)
      deadline       — дедлайн в формате "YYYY-MM-DD" или "YYYY-MM-DD HH:MM:SS"
      priority       — приоритет (0/1/2)
      status         — статус задачи (1/2/3/4/5)
      tags           — список тегов
    """
    fields = {
        "TITLE": title,
        "DESCRIPTION": description,
        "RESPONSIBLE_ID": responsible_id,
        "GROUP_ID": group_id,
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
    print(f"  Задача создана: ID={task_id} «{title}» (проект {group_id}, ответственный {responsible_id})")
    return task_id


def main():
    parser = argparse.ArgumentParser(description="Создание задачи в проекте Bitrix24")
    parser.add_argument("--group-id", type=int, required=True, help="ID проекта (рабочей группы)")
    parser.add_argument("--title", required=True, help="Заголовок задачи")
    parser.add_argument("--responsible-id", type=int, required=True, help="ID ответственного")
    parser.add_argument("--created-by", type=int, default=None, help="ID создателя")
    parser.add_argument("--description", default="", help="Описание задачи")
    parser.add_argument("--deadline", default=None, help="Дедлайн (YYYY-MM-DD)")
    parser.add_argument("--priority", type=int, default=1, choices=[0, 1, 2], help="Приоритет (0/1/2)")
    parser.add_argument("--status", type=int, default=1, choices=[1, 2, 3, 4, 5], help="Статус")
    args = parser.parse_args()

    print("=== Создание задачи в проекте ===")
    task_id = create_task_in_project(
        group_id=args.group_id,
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
