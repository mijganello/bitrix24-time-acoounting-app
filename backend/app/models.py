from sqlalchemy import Boolean, Column, Integer, String
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    avatar_color = Column(String, nullable=True)
    role = Column(String, nullable=False, default="admin")
    bitrix_user_id = Column(Integer, unique=True, index=True, nullable=True)
    display_name = Column(String, nullable=True)
    department_id = Column(Integer, nullable=True)
