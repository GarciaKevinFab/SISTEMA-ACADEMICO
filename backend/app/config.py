import os
from pydantic import BaseSettings
from dotenv import load_dotenv
import logging

# Cargar el archivo .env
load_dotenv()

class Settings(BaseSettings):
    # Variables de entorno para configuración
    DB_URI: str = os.getenv("MONGO_URL", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("DB_NAME", "sistemaacademico")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")  # Orígenes permitidos para CORS
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key")
    JWT_EXPIRATION_TIME: int = int(os.getenv("JWT_EXPIRATION_TIME", 3600))  # 1 hour
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
# Cargar las configuraciones desde el archivo .env
settings = Settings()

# Configuración del logging
def setup_logging():
    log_level = logging.getLevelName(settings.LOG_LEVEL)
    logging.basicConfig(level=log_level, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger("api")
    logger.setLevel(log_level)
    return logger
