#!/usr/bin/env python3
"""
Скрипт создания пользователя в Bitrix24.

Использование:
  python create_user.py
  python create_user.py --name "Иван Иванов" --email "ivan@example.com" --position "Разработчик"

Требуемые права вебхука: user (user.add)
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from bitrix_api import call, print_result


def create_user(
    name: str,
    last_name: str,
    email: str,
    position: str = "",
    department: int = None,
    password: str = "Test1234!",
) -> int:
    """
    Создаёт пользователя. Возвращает ID созданного пользователя.

    Параметры:
      name        — имя
      last_name   — фамилия
      email       — email (логин)
      position    — должность
      department  — ID отдела (необязательно)
      password    — пароль (по умолчанию Test1234!)
    """
    # user.add требует form-data, а не JSON
    import requests
    from bitrix_api import WEBHOOK_URL
    data = {
        "NAME": name,
        "LAST_NAME": last_name,
        "EMAIL": email,
        "PASSWORD": password,
        "CONFIRM_PASSWORD": password,
        "ACTIVE": "Y",
        "EXTRANET": "N",
        "WORK_POSITION": position,
    }
    if department:
        data["UF_DEPARTMENT[]"] = str(department)
    else:
        data["UF_DEPARTMENT[]"] = "1"

    resp = requests.post(f"{WEBHOOK_URL}/user.add.json", data=data, timeout=15)
    resp.raise_for_status()
    api_data = resp.json()
    if "error" in api_data:
        raise RuntimeError(f"API error [user.add]: {api_data['error']} — {api_data.get('error_description', '')}")
    result = api_data.get("result", api_data)
    user_id = int(result)
    print(f"  Пользователь создан: ID={user_id} ({name} {last_name}, {email})")
    return user_id



def main():
    parser = argparse.ArgumentParser(description="Создание пользователя в Bitrix24")
    parser.add_argument("--name", default="Иван", help="Имя пользователя")
    parser.add_argument("--last-name", default="Тестов", help="Фамилия пользователя")
    parser.add_argument("--email", default="test.user@cucumber-test.ru", help="Email пользователя")
    parser.add_argument("--position", default="Разработчик", help="Должность")
    parser.add_argument("--department", type=int, default=None, help="ID отдела")
    parser.add_argument("--password", default="Test1234!", help="Пароль")
    args = parser.parse_args()

    print("=== Создание пользователя ===")
    user_id = create_user(
        name=args.name,
        last_name=args.last_name,
        email=args.email,
        position=args.position,
        department=args.department,
        password=args.password,
    )
    print(f"Готово. User ID: {user_id}")


if __name__ == "__main__":
    main()
