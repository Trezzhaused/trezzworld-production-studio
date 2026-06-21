"""
LUMI Creative Tools — Inkscape, GIMP, and FreeCAD wired in as real backend
capabilities, not just installed binaries.

Safety model: LUMI (the LLM) never gets to run arbitrary shell/Script-Fu/CAD
code. The only place LLM output touches these tools is generate_vector_svg(),
where the LLM writes SVG *markup* (just text/XML, no execution semantics) and
Inkscape is used purely as a validator/renderer — if Inkscape rejects the SVG,
we feed the error back to the LLM and ask it to fix it, up to a few retries.
Image filters and CAD shapes are called through a fixed whitelist of
operations with numeric-only parameters; there is no path from chat text to
a shell command.

check_tools() is the "did the install actually work" gate — call it once at
startup or on demand. Any tool that fails its --version self-check is treated
as unavailable rather than silently breaking the first real request.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

EXPORTS_DIR = Path(os.environ.get("LUMI_EXPORT_DIR", "/tmp/trezzworld/exports/lumi")) / "tools"


def _resolve_export_dir() -> Path:
    try:
        EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
        test_file = EXPORTS_DIR / ".write_test"
        test_file.write_text("ok")
        test_file.unlink(missing_ok=True)
        return EXPORTS_DIR
    except OSError:
        fallback = Path(tempfile.gettempdir()) / "trezzworld" / "exports" / "lumi" / "tools"
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def save_output(data: bytes, ext: str) -> str:
    """Save tool output under a fresh job id, returning that id for later retrieval."""
    job_id = str(uuid.uuid4())
    path = _resolve_export_dir() / f"{job_id}.{ext}"
    path.write_bytes(data)
    return job_id


def get_output_path(job_id: str, ext: str) -> Path | None:
    path = _resolve_export_dir() / f"{job_id}.{ext}"
    return path if path.exists() else None

INKSCAPE_BIN = "inkscape"
GIMP_BIN = "gimp"
FREECAD_BIN = "freecadcmd"
XVFB_RUN_BIN = "xvfb-run"

_SVG_RETRY_LIMIT = 2


class CreativeToolError(Exception):
    pass


def _run(cmd: list[str], timeout: int = 30, cwd: str | None = None) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=False,
        )
    except FileNotFoundError as exc:
        raise CreativeToolError(f"'{cmd[0]}' is not installed in this environment.") from exc
    except subprocess.TimeoutExpired as exc:
        raise CreativeToolError(f"'{cmd[0]}' timed out after {timeout}s.") from exc


def _xvfb_wrap(cmd: list[str]) -> list[str]:
    """GIMP needs a display even in batch mode on some builds — run it under a virtual one."""
    if shutil.which(XVFB_RUN_BIN):
        return [XVFB_RUN_BIN, "-a", *cmd]
    return cmd


def _tail_error(proc: subprocess.CompletedProcess, fallback: str) -> str:
    """Errors/tracebacks land at the END of these tools' output, after a startup
    banner — slicing the head (as a naive [:N] would) shows the banner, not the
    failure. Combine both streams and take the tail instead."""
    combined = "\n".join(s for s in (proc.stdout, proc.stderr) if s).strip()
    return (combined or fallback)[-800:]


# ---------------------------------------------------------------------------
# Self-check — gates whether each tool's capability is exposed at all
# ---------------------------------------------------------------------------

def check_tools() -> dict[str, dict]:
    """Verify each tool actually runs in this environment before LUMI relies on it."""
    results: dict[str, dict] = {}
    for name, cmd in (
        ("inkscape", [INKSCAPE_BIN, "--version"]),
        ("gimp", _xvfb_wrap([GIMP_BIN, "-i", "-b", "(gimp-version)", "-b", "(gimp-quit 0)"])),
        ("freecad", [FREECAD_BIN, "--version"]),
    ):
        if not shutil.which(cmd[0]):
            results[name] = {"available": False, "error": f"'{cmd[0]}' not found on PATH."}
            continue
        try:
            proc = _run(cmd, timeout=20)
            ok = proc.returncode == 0
            results[name] = {
                "available": ok,
                "version": (proc.stdout or proc.stderr).strip()[:200] if ok else None,
                "error": None if ok else (proc.stderr or proc.stdout).strip()[:300],
            }
        except CreativeToolError as exc:
            results[name] = {"available": False, "error": str(exc)}
    return results


# ---------------------------------------------------------------------------
# Inkscape — LLM-authored SVG, validated/rendered (never executed as code)
# ---------------------------------------------------------------------------

_SVG_TAG_RE = re.compile(r"<svg\b.*?</svg>", re.IGNORECASE | re.DOTALL)
_VECTOR_INTENT_RE = re.compile(r"\b(vector|svg|scalable\s+graphic)\b", re.IGNORECASE)


def wants_vector_output(message: str) -> bool:
    """Heuristic: does this chat message specifically ask for a vector/SVG asset?"""
    return bool(_VECTOR_INTENT_RE.search(message))


def _extract_svg(text: str) -> str | None:
    match = _SVG_TAG_RE.search(text)
    return match.group(0) if match else None


def render_svg_to_png(svg_text: str, width: int = 512, height: int = 512) -> bytes:
    """Render SVG markup to PNG via Inkscape. Raises CreativeToolError if the SVG is invalid."""
    width = max(16, min(int(width), 4096))
    height = max(16, min(int(height), 4096))
    with tempfile.TemporaryDirectory() as tmp:
        svg_path = Path(tmp) / "in.svg"
        png_path = Path(tmp) / "out.png"
        svg_path.write_text(svg_text, encoding="utf-8")
        proc = _run([
            INKSCAPE_BIN, str(svg_path),
            "--export-type=png", f"--export-filename={png_path}",
            f"--export-width={width}", f"--export-height={height}",
        ], timeout=30)
        if proc.returncode != 0 or not png_path.exists():
            raise CreativeToolError(_tail_error(proc, "Inkscape render failed."))
        return png_path.read_bytes()


def generate_vector_svg(prompt: str, width: int = 512, height: int = 512) -> tuple[bytes | None, str, str]:
    """
    Ask LUMI's LLM to author SVG markup for `prompt`, validate/render it with
    Inkscape, and self-heal by feeding render errors back to the LLM. Returns
    (png_bytes or None, svg_text, error_message).
    """
    from .ai_router import get_router  # noqa: PLC0415

    router = get_router()
    system = (
        "You write clean, valid SVG markup only. Respond with a single <svg>...</svg> "
        "element and nothing else — no markdown fences, no explanation. Use a viewBox, "
        "keep it self-contained (no external references), and make it visually match "
        "the user's description."
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]

    last_error = ""
    svg_text = ""
    for _ in range(_SVG_RETRY_LIMIT + 1):
        result = router.chat(messages, role="executor", temperature=0.5, max_tokens=1500)
        if not result.ok:
            return None, svg_text, result.error or "LLM unavailable."
        svg_text = _extract_svg(result.content) or result.content
        try:
            png = render_svg_to_png(svg_text, width, height)
            return png, svg_text, ""
        except CreativeToolError as exc:
            last_error = str(exc)
            messages.append({"role": "assistant", "content": svg_text})
            messages.append({"role": "user", "content": f"That SVG failed to render: {last_error}. Fix it and respond with only the corrected <svg>...</svg>."})

    return None, svg_text, f"Inkscape could not render the SVG after retries: {last_error}"


# ---------------------------------------------------------------------------
# GIMP — fixed whitelist of raster operations, numeric params only
# ---------------------------------------------------------------------------

IMAGE_FILTERS = ("grayscale", "blur", "sharpen", "autolevels", "resize")


def _gimp_script(operation: str, in_path: str, out_path: str, **params) -> str:
    load = f'(let* ((image (car (gimp-file-load RUN-NONINTERACTIVE "{in_path}" "{in_path}"))) (drawable (car (gimp-image-get-active-drawable image))))'
    save = f'(gimp-image-flatten image) (file-png-save RUN-NONINTERACTIVE image (car (gimp-image-get-active-drawable image)) "{out_path}" "{out_path}" 0 9 1 1 1 1 1))'

    if operation == "grayscale":
        body = "(gimp-image-convert-grayscale image)"
    elif operation == "blur":
        radius = max(1, min(int(params.get("amount", 5)), 50))
        body = f"(plug-in-gauss RUN-NONINTERACTIVE image drawable {radius} {radius} 0)"
    elif operation == "sharpen":
        radius = max(1, min(int(params.get("amount", 5)), 50))
        body = f"(plug-in-unsharp-mask RUN-NONINTERACTIVE image drawable {radius} 0.5 0)"
    elif operation == "autolevels":
        body = "(gimp-levels-stretch drawable)"
    elif operation == "resize":
        w = max(16, min(int(params.get("width", 512)), 4096))
        h = max(16, min(int(params.get("height", 512)), 4096))
        body = f"(gimp-image-scale image {w} {h})"
    else:
        raise CreativeToolError(f"Unknown image filter '{operation}'.")

    return f"{load} {body} {save}"


def apply_image_filter(image_bytes: bytes, operation: str, **params) -> bytes:
    if operation not in IMAGE_FILTERS:
        raise CreativeToolError(f"'{operation}' is not a supported filter. Choose from: {', '.join(IMAGE_FILTERS)}.")

    with tempfile.TemporaryDirectory() as tmp:
        in_path = Path(tmp) / "in.png"
        out_path = Path(tmp) / "out.png"
        in_path.write_bytes(image_bytes)
        script = _gimp_script(operation, str(in_path), str(out_path), **params)
        cmd = _xvfb_wrap([GIMP_BIN, "-i", "-b", script, "-b", "(gimp-quit 0)"])
        proc = _run(cmd, timeout=60)
        if proc.returncode != 0 or not out_path.exists():
            raise CreativeToolError(_tail_error(proc, "GIMP filter failed."))
        return out_path.read_bytes()


# ---------------------------------------------------------------------------
# FreeCAD — fixed whitelist of parametric primitives, exported as STL
# ---------------------------------------------------------------------------

CAD_SHAPES = ("box", "cylinder", "sphere", "cone")


def _freecad_script(shape: str, out_path: str, **dims) -> str:
    def f(key: str, default: float) -> float:
        return max(0.01, min(float(dims.get(key, default)), 10000.0))

    if shape == "box":
        l, w, h = f("length", 10), f("width", 10), f("height", 10)
        make = f"Part.makeBox({l!r}, {w!r}, {h!r})"
    elif shape == "cylinder":
        r, h = f("radius", 5), f("height", 10)
        make = f"Part.makeCylinder({r!r}, {h!r})"
    elif shape == "sphere":
        r = f("radius", 5)
        make = f"Part.makeSphere({r!r})"
    elif shape == "cone":
        r1, r2, h = f("radius1", 5), f("radius2", 0), f("height", 10)
        make = f"Part.makeCone({r1!r}, {r2!r}, {h!r})"
    else:
        raise CreativeToolError(f"Unknown CAD shape '{shape}'.")

    return (
        "import FreeCAD as App\n"
        "import Part\n"
        "doc = App.newDocument('gen')\n"
        f"shape = {make}\n"
        "obj = doc.addObject('Part::Feature', 'Shape')\n"
        "obj.Shape = shape\n"
        "doc.recompute()\n"
        f"Part.export([obj], {out_path!r})\n"
    )


def generate_cad_primitive(shape: str, **dims) -> bytes:
    if shape not in CAD_SHAPES:
        raise CreativeToolError(f"'{shape}' is not a supported CAD shape. Choose from: {', '.join(CAD_SHAPES)}.")

    with tempfile.TemporaryDirectory() as tmp:
        script_path = Path(tmp) / "gen.py"
        out_path = Path(tmp) / f"{uuid.uuid4()}.stl"
        script_path.write_text(_freecad_script(shape, str(out_path), **dims), encoding="utf-8")
        proc = _run([FREECAD_BIN, str(script_path)], timeout=30, cwd=tmp)
        if proc.returncode != 0 or not out_path.exists():
            raise CreativeToolError(_tail_error(proc, "FreeCAD generation failed."))
        return out_path.read_bytes()
