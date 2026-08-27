# Auth Flow — Full Trace, All Scenarios

Everything that happens from the moment the app loads to a fully logged-in (or rejected) request, across every file involved: `page.tsx` / `login/page.tsx` (frontend) → `routes/auth.py` → `api/deps.py` → `core/security.py` → Postgres. Every `alt/else` branch below is a real fork that exists in the code, not a hypothetical.

## Diagram

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend (page.tsx / login/page.tsx)
    participant BE as Backend route (routes/auth.py)
    participant DEP as Auth dependency (api/deps.py)
    participant SEC as security.py
    participant DB as Postgres (users table)

    Note over FE: App loads at /
    FE->>FE: AuthGuard checks getToken() in localStorage

    alt No token stored
        FE->>FE: router.replace(/login)
        Note over FE: User sees the login form
    else Token already stored
        Note over FE: Skip straight to the auth-me flow below
    end

    Note over FE,BE: LOGIN FLOW
    FE->>FE: User submits email + password
    FE->>BE: POST /auth/login with email and password

    BE->>DB: SELECT user WHERE email = given email
    alt No user with that email
        DB-->>BE: none found
        BE-->>FE: 401 Invalid email or password
        FE->>FE: show error, stay on /login
    else User found
        DB-->>BE: user row: id, email, hashed_password
        BE->>SEC: verify_password(password, hashed_password)
        SEC->>SEC: bcrypt compare via pwd_context.verify
        alt Password does not match
            SEC-->>BE: False
            BE-->>FE: 401 Invalid email or password
            FE->>FE: show error, stay on /login
        else Password matches
            SEC-->>BE: True
            BE->>SEC: create_access_token(subject = user email)
            SEC->>SEC: build payload sub=email, exp=now plus N minutes
            SEC->>SEC: jwt.encode using SECRET_KEY, HS256
            SEC-->>BE: signed JWT string
            BE-->>FE: 200 access_token, token_type=bearer
            FE->>FE: saveToken stores it in localStorage
            FE->>FE: router.push to /
        end
    end

    Note over FE,DB: AUTH-ME FLOW, runs once a token exists
    FE->>BE: GET /auth/me, header Authorization Bearer token

    alt Header missing or malformed
        BE-->>FE: 401 or 403 Not authenticated
        Note over FE: getMe throws, useQuery isError becomes true
    else Header present
        BE->>DEP: get_current_user(token, db)
        DEP->>SEC: decode_access_token(token)
        SEC->>SEC: jwt.decode using SECRET_KEY, HS256
        alt Signature invalid, malformed, or expired
            SEC-->>DEP: None, exception caught internally
            DEP-->>BE: raises 401 Could not validate credentials
            BE-->>FE: 401 Could not validate credentials
            Note over FE: not auto-redirected today, see gap below
        else Token valid
            SEC-->>DEP: email from the sub claim
            DEP->>DB: SELECT user WHERE email = decoded email
            alt User no longer exists
                DB-->>DEP: none found
                DEP-->>BE: raises 401 Could not validate credentials
                BE-->>FE: 401 Could not validate credentials
            else User exists
                DB-->>DEP: user row
                DEP-->>BE: user object
                BE-->>FE: 200 id and email, password hash stripped
                FE->>FE: render Logged in as email
            end
        end
    end

    Note over FE: LOGOUT
    FE->>FE: user clicks Log out
    FE->>FE: clearToken removes it from localStorage
    FE->>FE: router.push to /login
```

## Scenario reference

### Page load
| Scenario | Where it's decided | Outcome |
|---|---|---|
| No token in `localStorage` | `AuthGuard` (`app/auth-guard.tsx`), `getToken()` returns `null` | Redirected to `/login` |
| Token present | Same check passes | Renders `HomeContent`, proceeds to the auth-me flow |

### `POST /auth/login`
| Scenario | Where it's decided | Outcome |
|---|---|---|
| No user with that email | `login()` in `routes/auth.py`, `db.query(User).filter(...).first()` returns `None` | `401 "Invalid email or password"` — deliberately the same message as a wrong password, so the API never reveals whether an email is registered |
| User found, password wrong | `verify_password()` in `security.py` returns `False` (bcrypt comparison) | `401 "Invalid email or password"` |
| User found, password correct | `verify_password()` returns `True` → `create_access_token()` builds `{sub: email, exp: now+N}` and signs it with `SECRET_KEY` | `200` with `access_token` + `token_type` |

### `GET /auth/me` (or any route depending on `get_current_user`)
| Scenario | Where it's decided | Outcome |
|---|---|---|
| No `Authorization` header at all | The security scheme itself, before `get_current_user` even runs | `401`/`403 Not authenticated` |
| Header present, token signature invalid/tampered, or expired | `decode_access_token()` — `jwt.decode()` raises internally, caught, returns `None` | `401 "Could not validate credentials"` |
| Token valid, but that user was deleted since the token was issued | `get_current_user()`'s DB lookup returns `None` | `401 "Could not validate credentials"` |
| Token valid, user exists | Full success path | `200` with `UserOut` (`id`, `email` — `hashed_password` is stripped by the response model, never sent) |

### Logout
| Scenario | Where it's decided | Outcome |
|---|---|---|
| User clicks "Log out" | `handleLogout()` in `app/page.tsx` | `clearToken()` wipes `localStorage`, redirect to `/login` — purely client-side, the backend never "knows" a logout happened (stateless JWTs can't be revoked early — see the note on this in our earlier discussion about cookies/refresh tokens) |

## Known gap (not yet handled)

If your token expires **while you're already on the page** (rather than on page load), `/auth/me` correctly returns `401`, but nothing in the frontend currently catches that and redirects you — `useQuery`'s `isError` just flips to `true` and the UI silently fails to show your email. This is a real, currently-unhandled scenario, not a mistake in the diagram. A future fix would be a shared error handler (e.g. a `QueryCache` `onError` in the TanStack Query client, or a small fetch wrapper) that clears the token and redirects to `/login` whenever any request comes back `401`. Not built yet — flagging it here since you asked for every real scenario, including the ones the current code doesn't gracefully handle.
