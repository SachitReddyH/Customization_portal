from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    MONGODB_URI: str
    DATABASE_NAME: str = "capstone_portal"

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    ADMIN_EMAIL: str = "admin@capstonelife.com"
    ADMIN_PASSWORD: str = "Admin@1234"

    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    @property
    def origins(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
