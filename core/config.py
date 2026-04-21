from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    env = open(".env", "r")
    key = env.readlines()[0]
    env.close()
    SECRET_KEY: str = key
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
