#!/usr/bin/env python3
"""
Миграция: добавление поля avatar_color для существующих пользователей.

Использование:
    python migrate_avatar_color.py
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from app.database import SessionLocal, engine
from app.models import Base

AVATAR_COLORS = [
    "#f56a00", "#7265e6", "#ffbf00", "#00a2ae",
    "#1677ff", "#52c41a", "#eb2f96", "#722ed1",
    "#13c2c2", "#fa8c16", "#2f54eb", "#a0d911",
]


def random_color() -> str:
    return random.choice(AVATAR_COLORS)


def migrate():
    # Убедимся, что колонка существует
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_color VARCHAR"))
            conn.commit()
            print("[+] Колонка avatar_color добавлена в таблицу users.")
        except Exception:
            print("[~] Колонка avatar_color уже существует, пропускаем DDL.")

    # Заполняем NULL-значения для существующих пользователей
    db = SessionLocal()
    try:
        from app.models import User
        users = db.query(User).filter(User.avatar_color == None).all()  # noqa: E711
        if not users:
            print("[~] Нет пользователей без avatar_color.")
            return
        for user in users:
            user.avatar_color = random_color()
        db.commit()
        print(f"[+] Обновлено {len(users)} пользователей.")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
