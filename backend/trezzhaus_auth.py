"""
TrezzHaus account SSO — validates a bearer token issued by the main
trezzhaus.com auth backend (apps/api/src/server.js, deployed at
trezzhaus-os.onrender.com) so this app can recognize who's logged in
without keeping its own user database.

"Owner" is intentionally NOT a role in that system (it only has
PLAYER/ADMIN/OPERATOR, no OWNER concept) — it's a specific account id,
set via OWNER_ACCOUNT_ID here, so unlocking LUMI's elevated behavior is
tied to one person rather than to a role anyone could be assigned.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

AUTH_API_BASE = os.environ.get("TREZZHAUS_AUTH_API_BASE", "https://trezzhaus-os.onrender.com")


def get_session(token: str) -> dict | None:
    """Validate a bearer token against the live trezzhaus.com auth API. Returns the account dict, or None."""
    if not token:
        return None
    req = urllib.request.Request(
        f"{AUTH_API_BASE}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("account")
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError):
        return None


def is_owner(account: dict | None) -> bool:
    if not account:
        return False
    owner_id = os.environ.get("OWNER_ACCOUNT_ID", "")
    return bool(owner_id) and str(account.get("id", "")) == owner_id


def read_bearer_token(authorization_header: str | None) -> str:
    if not authorization_header or not authorization_header.startswith("Bearer "):
        return ""
    return authorization_header[len("Bearer "):].strip()
