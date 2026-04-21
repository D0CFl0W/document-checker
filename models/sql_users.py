from databases import sqlite_users_service
from sqlalchemy import  Column, Integer, String

class User(sqlite_users_service.Base):
    __tablename__ = "Users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True)
    password = Column(String)
