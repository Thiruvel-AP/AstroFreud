import logging
import os
from logging.handlers import RotatingFileHandler
from config_loader import configLoader

def get_logger(name: str, frontend: bool = False) -> logging.Logger:
    config = configLoader()
    log_config = config.get("logging", {})

    log_dir = log_config.get("logpath", "logs/")
    log_file = log_config.get("frontendfile" if frontend else "backendfile", "backend.log")

    # Ensure logs/ directory exists
    os.makedirs(log_dir, exist_ok=True)

    log_path = os.path.join(log_dir, log_file)

    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    logger.setLevel(logging.DEBUG)

    file_handler = RotatingFileHandler(log_path, maxBytes=5 * 1024 * 1024, backupCount=3)
    file_handler.setLevel(logging.DEBUG)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    formatter = logging.Formatter(
        "[%(asctime)s] [%(levelname)s] [%(name)s] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger