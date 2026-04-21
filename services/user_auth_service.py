from schemas.users import UserInDB
from core.security import verify_password, get_password_hash

def get_user_by_username(username: str) -> UserInDB | None:
    if username in fake_users_db:
        return UserInDB(**fake_users_db[username])
    return None

def authenticate_user(username: str, password: str) -> UserInDB | None:
    """Аутентифицирует пользователя: проверяет, что такой есть и пароль верный"""
    user = get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
