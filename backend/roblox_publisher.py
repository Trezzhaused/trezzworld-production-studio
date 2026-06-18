"""
Roblox Publisher — Open Cloud API integration to actually deploy a generated
game (see roblox_creator.py) to a Roblox experience.

roblox_creator.py only produces Luau source files + a design document; Roblox's
Open Cloud "Publish Place" endpoint expects a compiled place file (.rbxl binary
or .rbxlx XML). We build a minimal but valid .rbxlx place file in memory that
embeds the generated scripts under the correct services, then publish it via:

    POST https://apis.roblox.com/universes/v1/{universeId}/places/{placeId}/versions?versionType=Published

Requires a Roblox Open Cloud API key with the "universe-places:write" scope —
see https://create.roblox.com/credentials. Pass the key per-request or set
ROBLOX_API_KEY / ROBLOX_UNIVERSE_ID / ROBLOX_PLACE_ID as environment variables.
"""
from __future__ import annotations

import json as _json
import mimetypes
import os
import urllib.error
import urllib.request
import uuid
from typing import Any
from xml.sax.saxutils import escape

_OPEN_CLOUD_BASE = "https://apis.roblox.com/universes/v1"
_GAME_PASS_BASE = "https://apis.roblox.com/game-passes/v1"
_DEV_PRODUCT_BASE = "https://apis.roblox.com/developer-products/v2"

# Rojo path prefix -> Roblox service class name
_SERVICE_MAP: dict[str, str] = {
    "src/ServerScriptService": "ServerScriptService",
    "src/ReplicatedStorage": "ReplicatedStorage",
    "src/StarterPlayerScripts": "StarterPlayer.StarterPlayerScripts",
    "src/StarterPlayer/StarterPlayerScripts": "StarterPlayer.StarterPlayerScripts",
    "src/StarterGui": "StarterGui",
    "src/Workspace": "Workspace",
}

_SCRIPT_CLASS_BY_TYPE = {
    "server": "Script",
    "local": "LocalScript",
    "module": "ModuleScript",
}


class RobloxPublishError(Exception):
    """Raised when the Roblox Open Cloud API rejects a publish request."""


def get_roblox_credentials(
    api_key: str | None = None,
    universe_id: str | None = None,
    place_id: str | None = None,
) -> tuple[str, str, str]:
    """Resolve Roblox Open Cloud credentials from request overrides or environment."""
    api_key = api_key or os.environ.get("ROBLOX_API_KEY") or ""
    universe_id = universe_id or os.environ.get("ROBLOX_UNIVERSE_ID") or ""
    place_id = place_id or os.environ.get("ROBLOX_PLACE_ID") or ""
    if not api_key or not universe_id or not place_id:
        raise RobloxPublishError(
            "Missing Roblox credentials. Provide apiKey, universeId, and placeId "
            "(or set ROBLOX_API_KEY / ROBLOX_UNIVERSE_ID / ROBLOX_PLACE_ID)."
        )
    return api_key, universe_id, place_id


def auth_headers(api_key: str | None = None, bearer_token: str | None = None) -> dict[str, str]:
    """Build Open Cloud auth headers — prefers an OAuth bearer token (acts on the
    signed-in user's own account) over a static admin API key when both are given."""
    if bearer_token:
        return {"Authorization": f"Bearer {bearer_token}"}
    if api_key:
        return {"x-api-key": api_key}
    raise RobloxPublishError("No Roblox credentials available — sign in with Roblox or configure an API key.")


def _script_node(referent: int, name: str, script_type: str, content: str) -> str:
    klass = _SCRIPT_CLASS_BY_TYPE.get(script_type, "Script")
    return (
        f'<Item class="{klass}" referent="RBX{referent}">'
        f'<Properties>'
        f'<string name="Name">{escape(name)}</string>'
        f'<ProtectedString name="Source"><![CDATA[{content}]]></ProtectedString>'
        f'</Properties>'
        f'</Item>'
    )


def _resolve_service_path(rojo_path: str) -> tuple[str, str]:
    """Split a Rojo script path into (service chain, script name)."""
    directory, _, filename = rojo_path.rpartition("/")
    name = filename.split(".")[0]
    for prefix, service_chain in _SERVICE_MAP.items():
        if directory == prefix:
            return service_chain, name
    return "ServerScriptService", name


def build_place_xml(title: str, scripts: list[dict[str, str]]) -> bytes:
    """Build a minimal .rbxlx place file embedding the generated Luau scripts."""
    referent = 1
    # service_chain -> nested item XML fragments (built innermost-out as needed)
    grouped: dict[str, list[str]] = {}
    for script in scripts:
        path = script.get("path", "")
        if not path.endswith((".lua", ".luau")):
            continue
        service_chain, name = _resolve_service_path(path)
        referent += 1
        node = _script_node(referent, name, script.get("type", "server"), script.get("content", ""))
        grouped.setdefault(service_chain, []).append(node)

    service_items = []
    ref = 1000
    for service_chain, nodes in grouped.items():
        parts = service_chain.split(".")
        ref += 1
        if len(parts) == 1:
            service_items.append(
                f'<Item class="{parts[0]}" referent="RBX{ref}">'
                f'<Properties><string name="Name">{parts[0]}</string></Properties>'
                f'{"".join(nodes)}'
                f'</Item>'
            )
        else:
            ref += 1
            inner = (
                f'<Item class="{parts[1]}" referent="RBX{ref}">'
                f'<Properties><string name="Name">{parts[1]}</string></Properties>'
                f'{"".join(nodes)}'
                f'</Item>'
            )
            service_items.append(
                f'<Item class="{parts[0]}" referent="RBX{ref - 1}">'
                f'<Properties><string name="Name">{parts[0]}</string></Properties>'
                f'{inner}'
                f'</Item>'
            )

    xml = (
        '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="4">'
        f'<Meta name="ExplicitAutoJoints">true</Meta>'
        f'{"".join(service_items)}'
        '</roblox>'
    )
    return xml.encode("utf-8")


def publish_place(
    place_xml: bytes,
    universe_id: str,
    place_id: str,
    api_key: str | None = None,
    bearer_token: str | None = None,
    version_type: str = "Published",
) -> dict[str, Any]:
    """Publish a place file to Roblox via the Open Cloud Publish Place API.
    Pass either api_key (admin key) or bearer_token (signed-in user's OAuth token)."""
    url = f"{_OPEN_CLOUD_BASE}/{universe_id}/places/{place_id}/versions?versionType={version_type}"
    headers = {**auth_headers(api_key, bearer_token), "Content-Type": "application/xml"}
    req = urllib.request.Request(url, data=place_xml, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RobloxPublishError(f"Roblox Open Cloud rejected the publish ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise RobloxPublishError(f"Could not reach Roblox Open Cloud: {exc}") from exc


# ---------------------------------------------------------------------------
# Monetization — Game Passes & Developer Products (beta Open Cloud APIs)
# ---------------------------------------------------------------------------

def _encode_multipart(fields: dict[str, str]) -> tuple[bytes, str]:
    """Build a multipart/form-data body (text fields only — no image upload support yet)."""
    boundary = uuid.uuid4().hex
    parts: list[bytes] = []
    for name, value in fields.items():
        if value is None:
            continue
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode("utf-8")
        )
    parts.append(f"--{boundary}--\r\n".encode("utf-8"))
    return b"".join(parts), f"multipart/form-data; boundary={boundary}"


def _post_multipart(url: str, fields: dict[str, str], headers: dict[str, str]) -> dict[str, Any]:
    body, content_type = _encode_multipart(fields)
    req = urllib.request.Request(
        url, data=body, headers={**headers, "Content-Type": content_type}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RobloxPublishError(f"Roblox Open Cloud rejected the request ({exc.code}): {body_text[:300]}") from exc
    except urllib.error.URLError as exc:
        raise RobloxPublishError(f"Could not reach Roblox Open Cloud: {exc}") from exc


def create_game_pass(
    universe_id: str,
    name: str,
    price: int,
    description: str = "",
    is_for_sale: bool = True,
    api_key: str | None = None,
    bearer_token: str | None = None,
) -> dict[str, Any]:
    """Create a Game Pass at a given Robux price point (beta Open Cloud API)."""
    url = f"{_GAME_PASS_BASE}/universes/{universe_id}/game-passes"
    headers = auth_headers(api_key, bearer_token)
    return _post_multipart(url, {
        "name": name,
        "description": description,
        "price": str(price),
        "isForSale": str(is_for_sale).lower(),
    }, headers)


def create_developer_product(
    universe_id: str,
    name: str,
    price: int,
    description: str = "",
    is_for_sale: bool = True,
    api_key: str | None = None,
    bearer_token: str | None = None,
) -> dict[str, Any]:
    """Create a Developer Product at a given Robux price point (beta Open Cloud API)."""
    url = f"{_DEV_PRODUCT_BASE}/universes/{universe_id}/developer-products"
    headers = auth_headers(api_key, bearer_token)
    return _post_multipart(url, {
        "name": name,
        "description": description,
        "price": str(price),
        "isForSale": str(is_for_sale).lower(),
    }, headers)


def list_game_passes(universe_id: str, api_key: str | None = None, bearer_token: str | None = None) -> dict[str, Any]:
    url = f"{_GAME_PASS_BASE}/universes/{universe_id}/game-passes/creator"
    headers = auth_headers(api_key, bearer_token)
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RobloxPublishError(f"Could not list game passes ({exc.code}): {exc.read().decode('utf-8', errors='replace')[:300]}") from exc


def list_developer_products(universe_id: str, api_key: str | None = None, bearer_token: str | None = None) -> dict[str, Any]:
    url = f"{_DEV_PRODUCT_BASE}/universes/{universe_id}/developer-products/creator"
    headers = auth_headers(api_key, bearer_token)
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise RobloxPublishError(f"Could not list developer products ({exc.code}): {exc.read().decode('utf-8', errors='replace')[:300]}") from exc
