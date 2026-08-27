# Phase 1 — Auth: What We Built & Why

This document walks through every file added/changed in Phase 1, what each function does, and the concepts behind them. Goal: you should be able to read this and understand the whole login flow without re-reading the code line by line.

---

## The big picture

There's only one user (you), so there's no public "sign up" page. Instead:

1. You create your account once, offline, via a script (`create_user.py`) that writes your email + a **hashed** password straight into the database.
2. To log in, the frontend sends your email/password to `POST /auth/login`. The backend checks them against the DB and, if correct, returns a **JWT** (a signed token).
3. The frontend stores that token and attaches it to every request that needs to prove "this is really you" (like `GET /auth/me`).
4. The backend never "remembers" you between requests (no server-side sessions) — it just re-validates the token's signature every time it receives one. This is what "stateless JWT auth" means.

Two concepts worth knowing before the file-by-file breakdown:

- **Password hashing (bcrypt):** we never store your real password. `hash_password()` runs it through bcrypt, a one-way function — you can check if a guess matches the hash, but you can't reverse the hash back into the password. So even if the database ever leaked, your actual password wouldn't be exposed.
- **JWT (JSON Web Token):** a token with three parts (`header.payload.signature`). The payload here holds your email and an expiry time. The signature is created using `SECRET_KEY` from `.env` — anyone can *read* a JWT's payload (it's not encrypted, just base64), but only someone with `SECRET_KEY` can *forge or alter* a valid one. That's how the backend trusts a token without a database lookup for "is this session valid."

---

## Backend

### `app/models/user.py` — the `User` table

Defines the `users` table via SQLAlchemy's ORM:

- `id` — primary key, auto-incrementing.
- `email` — unique, indexed (so lookups by email during login are fast).
- `hashed_password` — the bcrypt hash, never the raw password.
- `created_at` — timestamp, defaults to "now" when the row is created.

This is a plain data model — it doesn't do anything by itself, it just tells SQLAlchemy (and Alembic) what the table should look like.

### `app/models/__init__.py`

Just re-exports `User` so other files can `from app.models import User` instead of reaching into `app.models.user`. Also matters for Alembic (see next).

### `alembic/env.py` (edited)

We added one line: `from app.models import User  # noqa: F401`.

Alembic figures out what migration to generate by comparing your **models** (Python classes) against the **actual database schema**. It only knows about a model if that model's file has been imported somewhere Alembic runs. This import is what makes `User` "visible" to Alembic's autogenerate — without it, `alembic revision --autogenerate` would see an empty set of models and generate an empty migration.

### `app/core/security.py` — password + token utilities

Four functions:

- **`hash_password(password)`** — turns a plain-text password into a bcrypt hash for storage. Used only in `create_user.py` (when creating your account).
- **`verify_password(plain_password, hashed_password)`** — checks a login attempt's password against the stored hash. Returns `True`/`False`. Used in the `/auth/login` route.
- **`create_access_token(subject)`** — builds a JWT. `subject` is your email; it goes into the token's `sub` (subject) claim, plus an `exp` (expiry) claim set `ACCESS_TOKEN_EXPIRE_MINUTES` minutes from now. Signs it with `SECRET_KEY` using the HS256 algorithm. Returns the token string.
- **`decode_access_token(token)`** — the reverse: verifies the token's signature and expiry, and if valid, returns the email stored in `sub`. Returns `None` if the token is invalid, tampered with, or expired. Used on every protected request.

### `app/schemas/auth.py` — request/response shapes

These are Pydantic models — they define what JSON is expected in and what JSON goes out, and FastAPI uses them to auto-validate requests and generate docs.

- **`LoginRequest`** — what `/auth/login` expects in the request body: `email` + `password`.
- **`Token`** — what `/auth/login` returns: `access_token` (the JWT string) + `token_type` (always `"bearer"`, a convention meaning "put this in the `Authorization: Bearer <token>` header").
- **`UserOut`** — what `/auth/me` returns: just `id` and `email` — notice **not** `hashed_password`. This is intentional: even though the `User` DB object has the hash, this schema strips it out before sending anything back to the frontend.

### `app/api/deps.py` — `get_current_user`

This is a FastAPI **dependency** — a function any route can require via `Depends(...)`, and FastAPI runs it before the route's own code.

Flow inside `get_current_user`:
1. `oauth2_scheme` (an `OAuth2PasswordBearer` instance) pulls the token out of the `Authorization: Bearer <token>` header automatically. (`tokenUrl="/auth/login"` is only used to tell FastAPI's auto-generated docs UI where to log in from — it doesn't affect actual request handling.)
2. `decode_access_token(token)` verifies/decodes it. If it fails → `None` → we raise `401 Unauthorized`.
3. Otherwise we look up the `User` row by that email. If somehow no such user exists anymore → `401` again.
4. If everything checks out, the `User` object is returned — and FastAPI injects it into whichever route asked for it.

Any route that adds `current_user: User = Depends(get_current_user)` to its signature is now a **protected route**: it 401s automatically unless a valid token was sent.

### `app/api/routes/auth.py` — the actual endpoints

- **`POST /auth/login`** — looks up the user by email, calls `verify_password` on the submitted password vs. the stored hash. If either the email doesn't exist or the password doesn't match, returns a generic `401 "Invalid email or password"` (deliberately not saying *which* one was wrong — that's a basic security practice, so an attacker probing your API can't tell if an email is registered). On success, calls `create_access_token` and returns it wrapped in a `Token`.
- **`GET /auth/me`** — a protected route (depends on `get_current_user`). Its entire body is just `return current_user` — since `response_model=UserOut`, FastAPI automatically converts the `User` ORM object into the safe `UserOut` shape (dropping the password hash) before sending it. This route exists purely to prove the token mechanism works end-to-end — "give me a token, I'll tell you who you are."

### `app/main.py` (edited)

Added `app.include_router(auth_router)` — this is what actually plugs the two routes above into the running FastAPI app under the `/auth` prefix (set in `APIRouter(prefix="/auth", ...)`). Without this line, the routes exist in code but are never reachable.

### `scripts/create_user.py` — one-time account creation

A standalone script (not part of the API) you run manually from the terminal. It:
1. Prompts for an email and a password (`getpass.getpass` hides the password as you type, unlike `input()`).
2. Opens a direct DB session (`SessionLocal()` — the same session factory the API uses).
3. Checks a user with that email doesn't already exist (prevents accidental duplicates).
4. Hashes the password with `hash_password()` and inserts the new `User` row.

This is intentionally the *only* way to create a user — there's no public registration endpoint, since a solo-use app doesn't need one and it removes an entire class of attack surface (bots hitting a public signup endpoint).

### The migration (`alembic revision --autogenerate` + `alembic upgrade head`)

`--autogenerate` compared the `User` model to the (empty) database and wrote a migration file describing "create a `users` table with these columns." `alembic upgrade head` actually ran that migration against PostgreSQL, creating the real table. This two-step process (generate, then apply) is why the table didn't exist yet the first time you tried to log in — the migration had been generated but not applied.

---

## Frontend

### `lib/auth.ts` — token storage

Three tiny helpers wrapping the browser's `localStorage`:
- **`saveToken(token)`** — stores the JWT after a successful login.
- **`getToken()`** — reads it back (returns `null` if there isn't one, or if called during server-side rendering where `localStorage` doesn't exist — hence the `typeof window === "undefined"` guard).
- **`clearToken()`** — removes it on logout.

`localStorage` is simple and fine for a solo-use app; it persists across browser restarts until explicitly cleared.

### `lib/api.ts` (additions) — `login` and `getMe`

- **`login(email, password)`** — `POST`s to `/auth/login` with a JSON body, throws if the response isn't OK (wrong credentials), otherwise returns the parsed `{access_token, token_type}`.
- **`getMe(token)`** — `GET`s `/auth/me`, manually attaching `Authorization: Bearer <token>` since `fetch` doesn't do this automatically. Throws on failure (e.g. expired/invalid token), otherwise returns `{id, email}`.

### `app/login/page.tsx` — the login form

A client component (`"use client"` — needed because it uses interactive state/hooks, which only work in the browser, not during server rendering) with controlled `email`/`password` inputs. On submit:
1. Calls `login(...)`.
2. On success, `saveToken()`s the returned JWT and redirects to `/` via `router.push`.
3. On failure, shows an error message instead of crashing.

### `app/auth-guard.tsx` — route protection

`AuthGuard` wraps any page that should require login. On mount (`useEffect`), it checks `getToken()`:
- No token → `router.replace("/login")` (redirect, replacing history so "back" doesn't return to the protected page).
- Token exists → sets `checked = true`, which lets `children` render.

While the check hasn't finished yet, it renders `null` (blank) rather than flashing the protected content for a moment before redirecting.

### `app/page.tsx` — the home page

Split into two components:
- **`Home`** — just wraps `HomeContent` in `<AuthGuard>`. This is the actual page Next.js renders at `/`.
- **`HomeContent`** — the real content. Uses TanStack Query's `useQuery` twice:
  - one query for `/health` (unauthenticated, just proves the backend is reachable),
  - one for `getMe(token)`, guarded by `enabled: !!token` so it doesn't even fire if there's somehow no token.
  
  Also has `handleLogout`, which clears the stored token and redirects to `/login`.

---

## End-to-end flow, in one paragraph

You run `create_user.py` once to plant your hashed credentials in Postgres. When you submit the login form, the frontend POSTs your email/password to the backend, which checks the password hash and — if it matches — mints a signed JWT containing your email and an expiry, and sends it back. The frontend stores that JWT in `localStorage`. From then on, any page wrapped in `AuthGuard` checks that a token exists before rendering, and any call to a protected endpoint (like `/auth/me`) attaches the token in the `Authorization` header; the backend's `get_current_user` dependency verifies the token's signature, extracts your email, and loads your user row — all without ever touching a server-side session store.
