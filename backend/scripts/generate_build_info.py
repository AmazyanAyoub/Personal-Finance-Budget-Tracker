import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
VERSION_FILE = PROJECT_ROOT / "VERSION"
HISTORY_FILE = PROJECT_ROOT / "APP_VERSION_HISTORY.json"
OUTPUT_FILE = PROJECT_ROOT / "BUILD_INFO.json"
TIMEZONE = ZoneInfo("Africa/Casablanca")


def run(command: list[str], cwd: Path = PROJECT_ROOT) -> str:
    result = subprocess.run(command, cwd=cwd, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def main() -> None:
    version = VERSION_FILE.read_text(encoding="utf-8").strip()
    history = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    if history["current_version"] != version:
        raise RuntimeError("VERSION and APP_VERSION_HISTORY.json do not match")

    commit = run(["git", "rev-parse", "HEAD"])
    payload = {
        "app_name": history["app_name"],
        "version": version,
        "build_date": datetime.now(TIMEZONE).isoformat(timespec="seconds"),
        "timezone": str(TIMEZONE),
        "git_commit": commit,
        "git_commit_short": commit[:7],
        "git_commit_date": run(["git", "show", "-s", "--format=%cI", "HEAD"]),
        "git_dirty": bool(run(["git", "status", "--porcelain"])),
        "alembic_heads": run([sys.executable, "-m", "alembic", "heads"], BACKEND_ROOT).splitlines(),
    }
    OUTPUT_FILE.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
