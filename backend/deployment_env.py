from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Iterable, Sequence

from dotenv import dotenv_values

ENV_KEYS = frozenset({"MASTER_FILE", "MASTER_ENV_FILE", "SHARED_ENV_FILE", "ENV_FILE", "DOTENV_PATH"})
DEFAULT_SHARED_ENV_FILES = (
    Path.home() / ".config" / "trezzworld" / "master.env",
    Path.home() / ".env",
    Path("/etc/trezzworld/master.env"),
)
DEFAULT_DEPLOYMENT_REQUIRED_VARS = ("RAILWAY_TOKEN", "RAILWAY_PROJECT_ID")
# Export the deployment variables that the workflow and Railway CLI need to
# consume after the shared env file has been discovered and validated.
DEFAULT_EXPORT_VARS = (
    "MASTER_FILE",
    "RAILWAY_TOKEN",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_SERVICE",
    "RAILWAY_SERVICE_ID",
    "RAILWAY_ENVIRONMENT",
    "PRODUCTION_URL",
)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _expand_path(path_value: str, repo_root: Path) -> Path:
    path = Path(path_value).expanduser()
    if not path.is_absolute():
        path = (repo_root / path).resolve()
    return path


def _candidate_env_paths(repo_root: Path | None = None) -> list[Path]:
    repo_root = repo_root or _repo_root()
    candidates: list[Path] = []

    def add(path: Path | None) -> None:
        if not path:
            return
        if path not in candidates:
            candidates.append(path)

    for key in ENV_KEYS:
        value = os.environ.get(key)
        if value:
            add(_expand_path(value, repo_root))

    # GitHub Actions can check out a shared env repo into a dedicated path, so
    # search the common repo-root locations used by that workflow.
    for checkout_root in (repo_root / ".master-file-repo", repo_root / "master-file-repo", repo_root / "master-file"):
        if not checkout_root.exists():
            continue
        for filename in ("master.env", ".env", ".env.production", ".env.local", "production.env", "shared.env"):
            add(checkout_root / filename)

    for path in DEFAULT_SHARED_ENV_FILES:
        add(path)

    local_candidates = [repo_root / ".env", repo_root / ".env.local", repo_root / ".env.production"]
    for path in local_candidates:
        add(path)

    return candidates


def discover_master_file(repo_root: Path | None = None) -> Path | None:
    for path in _candidate_env_paths(repo_root):
        if path.exists() and path.is_file():
            return path
    return None


def load_deployment_environment(
    repo_root: Path | None = None,
    required_vars: Sequence[str] | None = None,
) -> tuple[Path | None, list[str]]:
    repo_root = repo_root or _repo_root()
    required_vars = tuple(required_vars or DEFAULT_DEPLOYMENT_REQUIRED_VARS)

    env_file = discover_master_file(repo_root)
    file_values: dict[str, str | None] = {}
    if env_file is not None:
        file_values = dotenv_values(env_file) or {}

    for key, value in file_values.items():
        if value is None:
            continue
        existing_value = os.environ.get(key)
        if existing_value and existing_value.strip():
            continue
        os.environ[key] = value

    if env_file is not None:
        os.environ["MASTER_FILE"] = str(env_file)

    missing = [var for var in required_vars if not os.environ.get(var)]

    return env_file, missing


def write_github_env(output_path: str | Path | None, variables: Iterable[str] | None = None) -> None:
    if not output_path:
        return

    export_variables = tuple(variables or DEFAULT_EXPORT_VARS)
    output_file = Path(output_path)
    with output_file.open("a", encoding="utf-8") as handle:
        for key in export_variables:
            value = os.environ.get(key)
            if value is None or value == "":
                continue
            handle.write(f"{key}={value}\n")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Load shared deployment env values and export them for CI")
    parser.add_argument("--repo-root", type=Path, help="Repo root to search for env files")
    parser.add_argument("--output", type=Path, help="Optional GitHub Actions env file to append exports to")
    parser.add_argument(
        "--require",
        action="append",
        dest="required_vars",
        help="Additional required environment variable names",
    )
    parser.add_argument(
        "--export",
        action="append",
        dest="export_vars",
        help="Environment variable names to export to the output file",
    )
    args = parser.parse_args(argv)

    repo_root = args.repo_root.resolve() if args.repo_root else _repo_root()
    required_vars = tuple(args.required_vars or DEFAULT_DEPLOYMENT_REQUIRED_VARS)
    env_file, missing = load_deployment_environment(repo_root=repo_root, required_vars=required_vars)

    if env_file is not None:
        print(f"Loaded deployment environment from {env_file}")
    else:
        print("No shared deployment env file was located; using existing environment values if present.")

    if missing:
        print("Missing deployment values: " + ", ".join(missing), file=sys.stderr)
        return 1

    write_github_env(args.output, args.export_vars or DEFAULT_EXPORT_VARS)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
