from sqlalchemy import inspect, text


def ensure_schema_upgrades(engine) -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    statements = []
    if "role" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'admin' NOT NULL")
    if "bitrix_user_id" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN bitrix_user_id INTEGER")
    if "display_name" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN display_name VARCHAR")
    if "department_id" not in columns:
        statements.append("ALTER TABLE users ADD COLUMN department_id INTEGER")

    if "cached_report_snapshots" in inspector.get_table_names():
        cache_columns = {c["name"] for c in inspector.get_columns("cached_report_snapshots")}
        if "is_standard" not in cache_columns:
            statements.append(
                "ALTER TABLE cached_report_snapshots ADD COLUMN IF NOT EXISTS is_standard BOOLEAN NOT NULL DEFAULT FALSE"
            )
        if "request_count" not in cache_columns:
            statements.append(
                "ALTER TABLE cached_report_snapshots ADD COLUMN IF NOT EXISTS request_count INTEGER NOT NULL DEFAULT 0"
            )
        if "last_requested_at" not in cache_columns:
            statements.append(
                "ALTER TABLE cached_report_snapshots ADD COLUMN IF NOT EXISTS last_requested_at TIMESTAMPTZ"
            )
        # Make payload nullable so tracking-only rows (count < threshold) can exist without a payload
        statements.append(
            "ALTER TABLE cached_report_snapshots ALTER COLUMN payload DROP NOT NULL"
        )

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
