#!/usr/bin/env python3
"""
CLI-инструмент для управления пользователями.

Использование:
    python create_user.py                        # интерактивный режим
    python create_user.py -u admin -p secret     # передача параметров
    python create_user.py --list                 # список пользователей
    python create_user.py --deactivate <username>
    python create_user.py --activate <username>
    python create_user.py --delete <username>
"""

import argparse
import getpass
import random
import sys
import os

# Добавляем корень проекта в PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.database import SessionLocal, engine
from app.models import Base, User
from app.auth import get_password_hash, get_user_by_username

AVATAR_COLORS = [
    "#f56a00", "#7265e6", "#ffbf00", "#00a2ae",
    "#1677ff", "#52c41a", "#eb2f96", "#722ed1",
    "#13c2c2", "#fa8c16", "#2f54eb", "#a0d911",
]


def random_color() -> str:
    return random.choice(AVATAR_COLORS)


def ensure_tables():
    os.makedirs("data", exist_ok=True)
    Base.metadata.create_all(bind=engine)


def create_user(username: str, password: str) -> None:
    db = SessionLocal()
    try:
        existing = get_user_by_username(db, username)
        if existing:
            print(f"[!] Пользователь '{username}' уже существует.")
            sys.exit(1)
        user = User(username=username, hashed_password=get_password_hash(password), avatar_color=random_color())
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[+] Пользователь '{username}' успешно создан (id={user.id}).")
    finally:
        db.close()


def list_users() -> None:
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("Пользователей нет.")
            return
        print(f"{'ID':<5} {'Логин':<30} {'Активен'}")
        print("-" * 45)
        for u in users:
            status = "да" if u.is_active else "нет"
            print(f"{u.id:<5} {u.username:<30} {status}")
    finally:
        db.close()


def set_active(username: str, active: bool) -> None:
    db = SessionLocal()
    try:
        user = get_user_by_username(db, username)
        if not user:
            print(f"[!] Пользователь '{username}' не найден.")
            sys.exit(1)
        user.is_active = active
        db.commit()
        state = "активирован" if active else "деактивирован"
        print(f"[+] Пользователь '{username}' {state}.")
    finally:
        db.close()


def delete_user(username: str) -> None:
    db = SessionLocal()
    try:
        user = get_user_by_username(db, username)
        if not user:
            print(f"[!] Пользователь '{username}' не найден.")
            sys.exit(1)
        confirm = input(f"Удалить пользователя '{username}'? [y/N]: ").strip().lower()
        if confirm != "y":
            print("Отменено.")
            return
        db.delete(user)
        db.commit()
        print(f"[+] Пользователь '{username}' удалён.")
    finally:
        db.close()


def main():
    ensure_tables()

    parser = argparse.ArgumentParser(description="Управление пользователями приложения")
    parser.add_argument("-u", "--username", help="Логин пользователя")
    parser.add_argument("-p", "--password", help="Пароль (не рекомендуется передавать в аргументах)")
    parser.add_argument("--list", action="store_true", help="Показать всех пользователей")
    parser.add_argument("--deactivate", metavar="USERNAME", help="Деактивировать пользователя")
    parser.add_argument("--activate", metavar="USERNAME", help="Активировать пользователя")
    parser.add_argument("--delete", metavar="USERNAME", help="Удалить пользователя")

    args = parser.parse_args()

    if args.list:
        list_users()
    elif args.deactivate:
        set_active(args.deactivate, False)
    elif args.activate:
        set_active(args.activate, True)
    elif args.delete:
        delete_user(args.delete)
    else:
        # Режим создания пользователя
        username = args.username
        if not username:
            username = input("Логин: ").strip()
        if not username:
            print("[!] Логин не может быть пустым.")
            sys.exit(1)

        password = args.password
        if not password:
            password = getpass.getpass("Пароль: ")
            password_confirm = getpass.getpass("Повторите пароль: ")
            if password != password_confirm:
                print("[!] Пароли не совпадают.")
                sys.exit(1)
        if len(password) < 8:
            print("[!] Пароль должен содержать минимум 8 символов.")
            sys.exit(1)

        create_user(username, password)


if __name__ == "__main__":
    main()
