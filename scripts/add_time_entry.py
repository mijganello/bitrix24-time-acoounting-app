#!/usr/bin/env python3
"""
Скрипт добавления записи о затраченном времени к задаче в Bitrix24.

Использование:
  python add_time_entry.py --task-id 42 --user-id 3 --seconds 3600
  python add_time_entry.py --task-id 42 --user-id 3 --seconds 7200 \
      --comment "Разработка компонента авторизации" --date "2026-04-10"

Требуемые права вебхука: task (task.elapsed.item.add)
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from bitrix_api import call


def add_time_entry(
    task_id: int,
    user_id: int,
    seconds: int,
    comment: str = "",
    date: str = None,
) -> int:
    """
    Добавляет запись о затраченном времени к задаче. Возвращает ID записи.

    Параметры:
      task_id  — ID задачи
      user_id  — ID пользователя, чьё время фиксируется
      seconds  — количество секунд
      comment  — комментарий к записи
      date     — дата записи "YYYY-MM-DD" (если не указана — текущая дата)
    """
    # task.elapseditem.add принимает позиционные аргументы: [taskId, fields]
    import requests
    from bitrix_api import WEBHOOK_URL as _url

    fields = {
        "USER_ID": user_id,
        "SECONDS": seconds,
        "COMMENT_TEXT": comment,
    }
    if date:
        from datetime import datetime
        dt = datetime.strptime(date, "%Y-%m-%d")
        fields["CREATED_DATE"] = dt.strftime("%Y-%m-%dT%H:%M:%S+03:00")

    resp = requests.post(f"{_url}/task.elapseditem.add.json", json=[task_id, fields], timeout=15)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"API error: {data['error']} — {data.get('error_description', '')}")
    result = data.get("result", data)
    entry_id = int(result) if result else 0
    hours = seconds / 3600
    print(f"  Время добавлено: ID={entry_id}, задача {task_id}, пользователь {user_id}, {hours:.1f} ч")
    return entry_id


def main():
    parser = argparse.ArgumentParser(description="Добавление записи времени к задаче в Bitrix24")
    parser.add_argument("--task-id", type=int, required=True, help="ID задачи")
    parser.add_argument("--user-id", type=int, required=True, help="ID пользователя")
    parser.add_argument("--seconds", type=int, required=True, help="Количество секунд")
    parser.add_argument("--comment", default="", help="Комментарий")
    parser.add_argument("--date", default=None, help="Дата записи (YYYY-MM-DD)")
    args = parser.parse_args()

    print("=== Добавление записи времени ===")
    entry_id = add_time_entry(
        task_id=args.task_id,
        user_id=args.user_id,
        seconds=args.seconds,
        comment=args.comment,
        date=args.date,
    )
    print(f"Готово. Entry ID: {entry_id}")


if __name__ == "__main__":
    main()
