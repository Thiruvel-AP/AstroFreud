"""
session_store.py
Stores active in-progress session state as JSON, keyed by identity ("VIAN").
No external dependencies. Survives server restarts.
File: data/sessions.json
"""

import json
import os
from typing import Optional

SESSION_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "sessions.json")


def _load_all() -> dict:
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    if not os.path.exists(SESSION_FILE):
        return {}
    try:
        with open(SESSION_FILE, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _save_all(data: dict) -> None:
    os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
    with open(SESSION_FILE, "w") as f:
        json.dump(data, f, indent=2)


class SessionStore:

    def get(self, identity: str) -> Optional[dict]:
        """Load state for this identity. Returns None if no active session."""
        return _load_all().get(identity)

    def set(self, identity: str, state: dict) -> None:
        """Save/update state for this identity."""
        all_sessions = _load_all()
        all_sessions[identity] = state
        _save_all(all_sessions)

    def delete(self, identity: str) -> None:
        """Remove completed session from the store."""
        all_sessions = _load_all()
        all_sessions.pop(identity, None)
        _save_all(all_sessions)


session_store = SessionStore()