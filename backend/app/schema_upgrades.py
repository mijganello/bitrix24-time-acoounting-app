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

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
