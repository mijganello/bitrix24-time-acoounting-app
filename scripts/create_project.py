#!/usr/bin/env python3
"""
Скрипт создания проекта (рабочей группы) в Bitrix24.

Использование:
  python create_project.py
  python create_project.py --name "Мой проект" --description "Описание" --owner-id 1

Требуемые права вебхука: sonet_group (sonet_group.create)
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from bitrix_api import call


def create_project(
    name: str,
    description: str = "",
    owner_id: int = 1,
    visible: str = "Y",
    opened: str = "N",
    project: str = "Y",
) -> int:
    """
    Создаёт проект (рабочую группу). Возвращает ID группы.

    Параметры:
      name        — название проекта
      description — описание
      owner_id    — ID владельца (пользователь Bitrix24)
      visible     — видимость группы (Y/N)
      opened      — открытая группа (Y/N)
      project     — является ли группа проектом (Y/N)
    """
    params = {
        "NAME": name,
        "DESCRIPTION": description,
        "OWNER_ID": owner_id,
        "VISIBLE": visible,
        "OPENED": opened,
        "PROJECT": project,
    }

    result = call("sonet_group.create", params)
    group_id = int(result)
    print(f"  Проект создан: ID={group_id} («{name}»)")
    return group_id


def main():
    parser = argparse.ArgumentParser(description="Создание проекта в Bitrix24")
    parser.add_argument("--name", default="Тестовый проект", help="Название проекта")
    parser.add_argument("--description", default="", help="Описание проекта")
    parser.add_argument("--owner-id", type=int, default=1, help="ID владельца")
    parser.add_argument("--visible", default="Y", choices=["Y", "N"], help="Видимость")
    parser.add_argument("--opened", default="N", choices=["Y", "N"], help="Открытая группа")
    args = parser.parse_args()

    print("=== Создание проекта ===")
    group_id = create_project(
        name=args.name,
        description=args.description,
        owner_id=args.owner_id,
        visible=args.visible,
        opened=args.opened,
    )
    print(f"Готово. Group ID: {group_id}")


if __name__ == "__main__":
    main()
