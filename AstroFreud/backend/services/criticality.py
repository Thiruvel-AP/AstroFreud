import config_loader

def decisionMaking(score):

    config = config_loader.configLoader()

    for rule in config["rules"]:
        if rule["min"] <= score <= rule["max"]:
            return rule["situation"], rule["condition"]

    return "unknown", "no decision available"