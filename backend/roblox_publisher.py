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

import os
import urllib.error
import urllib.request
from typing import Any
from xml.sax.saxutils import escape

_OPEN_CLOUD_BASE = "https://apis.roblox.com/universes/v1"

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
    api_key: str,
    universe_id: str,
    place_id: str,
    version_type: str = "Published",
) -> dict[str, Any]:
    """Publish a place file to Roblox via the Open Cloud Publish Place API."""
    url = f"{_OPEN_CLOUD_BASE}/{universe_id}/places/{place_id}/versions?versionType={version_type}"
    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/xml",
    }
    req = urllib.request.Request(url, data=place_xml, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            import json as _json  # noqa: PLC0415
            return _json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RobloxPublishError(f"Roblox Open Cloud rejected the publish ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise RobloxPublishError(f"Could not reach Roblox Open Cloud: {exc}") from exc
