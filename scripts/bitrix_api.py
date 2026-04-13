"""
Базовый модуль для работы с Bitrix24 REST API через вебхук.
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

# Загружаем .env из корня проекта
def load_env():
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, val = line.partition("=")
                    os.environ.setdefault(key.strip(), val.strip())

load_env()

WEBHOOK_URL = os.environ.get("BITRIX24_WEBHOOK_URL", "").rstrip("/")

if not WEBHOOK_URL:
    print("ОШИБКА: BITRIX24_WEBHOOK_URL не задан в .env")
    sys.exit(1)


def call(method: str, params: dict = None, retry: int = 3) -> dict:
    """Вызов метода REST API Bitrix24."""
    url = f"{WEBHOOK_URL}/{method}.json"
    for attempt in range(retry):
        try:
            resp = requests.post(url, json=params or {}, timeout=30)
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise RuntimeError(f"API error [{method}]: {data['error']} — {data.get('error_description', '')}")
            return data.get("result", data)
        except requests.exceptions.RequestException as e:
            if attempt == retry - 1:
                raise
            print(f"  Повтор {attempt+1}/{retry} для {method}: {e}")
            time.sleep(2)


def batch(commands: dict) -> dict:
    """
    Пакетный вызов. commands = {"key": ["method", {params}], ...}
    Возвращает {"key": result, ...}
    """
    cmd_params = {}
    for key, (method, params) in commands.items():
        cmd_params[f"cmd[{key}]"] = f"{method}?{_encode_params(params)}"

    url = f"{WEBHOOK_URL}/batch.json"
    resp = requests.post(url, data=cmd_params, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    result = data.get("result", {})
    results = result.get("result", {})
    errors = result.get("result_error", {})
    if errors:
        for k, err in errors.items():
            print(f"  Batch ошибка [{k}]: {err}")
    return results


def _encode_params(params: dict, prefix: str = "") -> str:
    """URL-encode вложенных параметров для batch."""
    parts = []
    for k, v in (params or {}).items():
        full_key = f"{prefix}[{k}]" if prefix else k
        if isinstance(v, dict):
            parts.append(_encode_params(v, full_key))
        elif isinstance(v, list):
            for i, item in enumerate(v):
                if isinstance(item, dict):
                    parts.append(_encode_params(item, f"{full_key}[{i}]"))
                else:
                    parts.append(f"{full_key}[{i}]={requests.utils.quote(str(item))}")
        else:
            parts.append(f"{full_key}={requests.utils.quote(str(v))}")
    return "&".join(parts)


def print_result(label: str, result):
    print(f"  {label}: {json.dumps(result, ensure_ascii=False)[:200]}")
