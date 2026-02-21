import yaml
import os

BACKEND_ROOT = os.path.dirname(os.path.abspath(__file__))

def configLoader() -> dict:
    config_path = os.path.join(BACKEND_ROOT, "configs", "configmap.yaml")
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
    return config