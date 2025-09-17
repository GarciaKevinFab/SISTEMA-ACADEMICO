import logging

# Configuración básica del logger
def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger("api")
    logger.setLevel(logging.INFO)
    return logger
