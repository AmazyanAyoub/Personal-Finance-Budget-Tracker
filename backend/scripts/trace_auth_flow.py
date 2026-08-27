import sys
from datetime import datetime
from pathlib import Path

from jose import jwt

from app.core.security import create_access_token, decode_access_token, verify_password
from app.db.session import SessionLocal
from app.models.user import User

PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
OUTPUT_FILE = "AUTH_TRACE.md"

log: list[str] = []
_depth = 0


def safe_repr(value, max_len=200):
    try:
        r = repr(value)
    except Exception:
        r = f"<unreprable {type(value).__name__}>"
    return r if len(r) <= max_len else r[:max_len] + "...>"


def tracer(frame, event, arg):
    """Auto-logs every function call/return happening inside backend/app/**."""
    global _depth
    filename = frame.f_code.co_filename
    if not filename.startswith(PROJECT_ROOT) or "site-packages" in filename or "/.venv/" in filename or "trace_auth_flow.py" in filename:
        return None


    code = frame.f_code
    rel_file = filename[len(PROJECT_ROOT) + 1 :]

    if event == "call":
        arg_names = code.co_varnames[: code.co_argcount]
        args_repr = ", ".join(f"{n}={safe_repr(frame.f_locals.get(n))}" for n in arg_names)
        log.append(f"{'  ' * _depth}- **CALL** `{code.co_name}({args_repr})` _(`{rel_file}`)_")
        _depth += 1
        return tracer

    if event == "return":
        _depth = max(_depth - 1, 0)
        log.append(f"{'  ' * _depth}  → **returns** `{safe_repr(arg)}`")
    return tracer


def traced(fn, *args):
    sys.settrace(tracer)
    try:
        return fn(*args)
    finally:
        sys.settrace(None)


def log_query(label, query):
    sql = str(query.statement.compile(compile_kwargs={"literal_binds": True}))
    log.append(f"- **SQL executed** (`{label}`):\n  ```sql\n  {sql}\n  ```")


def main():
    email = input("Email (must already exist): ").strip()
    password = input("Password: ").strip()
    db = SessionLocal()

    log.append(f"# Auth Flow Trace\n\nRun at: {datetime.now().isoformat(timespec='seconds')}\n")

    try:
        log.append("## Step 1 — look up the user\n")
        query = db.query(User).filter(User.email == email)
        log_query("SELECT user by email", query)
        user = query.first()
        log.append(f"  → **returns** `{safe_repr(user)}`\n")
        if not user:
            log.append("**Result:** no user found — `/auth/login` would 401 here.\n")
            return

        log.append("## Step 2 — verify password (`verify_password`)\n")
        matched = traced(verify_password, password, user.hashed_password)
        log.append(f"\n**Result:** `{matched}`\n")
        if not matched:
            log.append("\n**Result:** mismatch — `/auth/login` would 401 here.\n")
            return

        log.append("## Step 3 — create the JWT (`create_access_token`)\n")
        token = traced(create_access_token, user.email)
        raw_payload = jwt.get_unverified_claims(token)
        log.append(f"\n- **Payload actually encoded:** `{raw_payload}`")
        log.append(f"- **Resulting token:** `{token}`\n")

        log.append("## Step 4 — `/auth/me`: decode the token (`decode_access_token`)\n")
        decoded_email = traced(decode_access_token, token)
        log.append(f"\n**Email extracted from `sub`:** `{decoded_email}`\n")

        log.append("## Step 5 — look up the user again by decoded email\n")
        query = db.query(User).filter(User.email == decoded_email)
        log_query("SELECT user by decoded email", query)
        me = query.first()
        log.append(f"  → **returns** `{safe_repr(me)}`\n")

        log.append(f"\n**Final — what `/auth/me` returns:** `{{'id': {me.id}, 'email': {me.email!r}}}`\n")
    finally:
        db.close()
        Path(OUTPUT_FILE).write_text("\n".join(log))
        print(f"Saved detailed trace to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
