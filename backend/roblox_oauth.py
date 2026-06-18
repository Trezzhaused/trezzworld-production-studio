"""
Roblox OAuth2 ("Sign in with Roblox") — Authorization Code + PKCE flow.

Lets a user authenticate with their own Roblox account so Open Cloud calls
(publish, game passes, developer products) act on their account/experiences
instead of a single shared admin API key.

Requires a registered OAuth app at https://create.roblox.com/credentials —
set ROBLOX_OAUTH_CLIENT_ID / ROBLOX_OAUTH_CLIENT_SECRET / ROBLOX_OAUTH_REDIRECT_URI
as environment variables (never paste secrets into chat or commit them).

Single-tenant by design (this app has no multi-user account system anywhere
else): one stored token set, not per-visitor. If multi-user support is added
later, this module's storage layer is the first thing that needs to change.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from .mission_store import DATA_DIR

_DB_PATH = DATA_DIR / "roblox_oauth.sqlite"

_AUTHORIZE_URL = "https://apis.roblox.com/oauth/v1/authorize"
_TOKEN_URL = "https://apis.roblox.com/oauth/v1/token"
_USERINFO_URL = "https://apis.roblox.com/oauth/v1/userinfo"

# Identity scopes (openid/profile) plus the Open Cloud resource scopes needed
# to publish places and manage monetization on the signed-in user's behalf.
SCOPES = "openid profile universe-place:write universe-place:read game-pass:write game-pass:read developer-product:write developer-product:read"

# In-memory only — short-lived (minutes), doesn't need to survive a restart.
_pending_states: dict[str, str] = {}


class RobloxOAuthError(Exception):
    pass


def _get_conn() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tokens (id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL)"
    )
    conn.commit()
    return conn


def _client_credentials() -> tuple[str, str, str]:
    client_id = os.environ.get("ROBLOX_OAUTH_CLIENT_ID", "")
    client_secret = os.environ.get("ROBLOX_OAUTH_CLIENT_SECRET", "")
    redirect_uri = os.environ.get("ROBLOX_OAUTH_REDIRECT_URI", "")
    if not client_id or not client_secret or not redirect_uri:
        raise RobloxOAuthError(
            "Roblox OAuth is not configured. Set ROBLOX_OAUTH_CLIENT_ID, "
            "ROBLOX_OAUTH_CLIENT_SECRET, and ROBLOX_OAUTH_REDIRECT_URI as "
            "environment variables (register an app at https://create.roblox.com/credentials)."
        )
    return client_id, client_secret, redirect_uri


def _save_tokens(data: dict[str, Any]) -> None:
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT INTO tokens (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
            (json.dumps(data),),
        )
        conn.commit()
    finally:
        conn.close()


def _load_tokens() -> dict[str, Any] | None:
    conn = _get_conn()
    try:
        row = conn.execute("SELECT data FROM tokens WHERE id = 1").fetchone()
        return json.loads(row[0]) if row else None
    finally:
        conn.close()


def clear_tokens() -> None:
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM tokens WHERE id = 1")
        conn.commit()
    finally:
        conn.close()


def build_authorize_url() -> str:
    """Build the Roblox authorization URL with PKCE, returning the full redirect URL."""
    client_id, _, redirect_uri = _client_credentials()

    state = secrets.token_urlsafe(24)
    code_verifier = secrets.token_urlsafe(48)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode("utf-8")).digest()
    ).decode("utf-8").rstrip("=")

    _pending_states[state] = code_verifier

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": SCOPES,
        "response_type": "code",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    query = "&".join(f"{k}={urllib.parse.quote(v)}" for k, v in params.items())
    return f"{_AUTHORIZE_URL}?{query}"


def handle_callback(code: str, state: str) -> dict[str, Any]:
    """Exchange the authorization code for tokens and store them. Returns user info."""
    code_verifier = _pending_states.pop(state, None)
    if code_verifier is None:
        raise RobloxOAuthError("Invalid or expired OAuth state — please try signing in again.")

    client_id, client_secret, redirect_uri = _client_credentials()
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
        "code_verifier": code_verifier,
    }
    token_data = _post_form(_TOKEN_URL, payload)
    token_data["obtained_at"] = time.time()
    _save_tokens(token_data)

    user_info = get_user_info(token_data["access_token"])
    return user_info


def _post_form(url: str, payload: dict[str, str]) -> dict[str, Any]:
    body = "&".join(f"{k}={urllib.parse.quote(str(v))}" for k, v in payload.items()).encode("utf-8")
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RobloxOAuthError(f"Roblox OAuth error ({exc.code}): {exc.read().decode('utf-8', errors='replace')[:300]}") from exc


def get_user_info(access_token: str) -> dict[str, Any]:
    req = urllib.request.Request(_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RobloxOAuthError(f"Could not fetch Roblox user info: HTTP {exc.code}") from exc


def get_valid_access_token() -> str | None:
    """Return a currently-valid access token, refreshing it if expired. None if never signed in."""
    tokens = _load_tokens()
    if tokens is None:
        return None

    expires_at = tokens.get("obtained_at", 0) + tokens.get("expires_in", 900)
    if time.time() < expires_at - 30:
        return tokens["access_token"]

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        return None

    try:
        client_id, client_secret, _ = _client_credentials()
        new_tokens = _post_form(_TOKEN_URL, {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        })
        new_tokens["obtained_at"] = time.time()
        _save_tokens(new_tokens)
        return new_tokens["access_token"]
    except RobloxOAuthError:
        return None


def get_status() -> dict[str, Any]:
    """Return whether a Roblox account is currently connected, and basic identity info."""
    tokens = _load_tokens()
    if tokens is None:
        return {"connected": False}
    access_token = get_valid_access_token()
    if access_token is None:
        return {"connected": False, "expired": True}
    try:
        user_info = get_user_info(access_token)
        return {"connected": True, "user": user_info}
    except RobloxOAuthError:
        return {"connected": False, "expired": True}
