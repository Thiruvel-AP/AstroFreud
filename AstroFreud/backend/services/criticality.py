import config_loader
import re

def decisionMaking(score):

    config = config_loader.configLoader()

    for rule in config["rules"]:
        if rule["min"] <= score <= rule["max"]:
            return rule["situation"], rule["condition"]

    return "unknown", "no decision available"


def decisionMakingForEmail(score):

    config = config_loader.configLoader()

    for rule in config["rules"]:
        if rule["min"] <= score <= rule["max"]:
            cond = rule["condition"]
            pattern = r"\bCall the captain\b"
            if re.search(pattern, cond, re.IGNORECASE):
                return True

    return False