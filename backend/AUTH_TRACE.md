# Auth Flow Trace

Run at: 2026-08-28T00:39:44

## Step 1 — look up the user

- **SQL executed** (`SELECT user by email`):
  ```sql
  SELECT users.id, users.email, users.hashed_password, users.created_at 
FROM users 
WHERE users.email = 'amzayoub3@gmail.com'
  ```
  → **returns** `<app.models.user.User object at 0x1086fe9d0>`

## Step 2 — verify password (`verify_password`)

- **CALL** `verify_password(plain_password='1234', hashed_password='$2b$12$AltEdDR0lGMGKkkLisyg0.Nh60Gfgv5aihYBfGeRzomaJUTHO8Z6m')` _(`app/core/security.py`)_
  → **returns** `True`

**Result:** `True`

## Step 3 — create the JWT (`create_access_token`)

- **CALL** `create_access_token(subject='amzayoub3@gmail.com')` _(`app/core/security.py`)_
  → **returns** `'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbXpheW91YjNAZ21haWwuY29tIiwiZXhwIjoxNzg3OTYwMzg0fQ.SOhHHPsI2ucRGuxLwOU_Z6rRMTFMnMGHXuNgjjGzugE'`

- **Payload actually encoded:** `{'sub': 'amzayoub3@gmail.com', 'exp': 1787960384}`
- **Resulting token:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbXpheW91YjNAZ21haWwuY29tIiwiZXhwIjoxNzg3OTYwMzg0fQ.SOhHHPsI2ucRGuxLwOU_Z6rRMTFMnMGHXuNgjjGzugE`

## Step 4 — `/auth/me`: decode the token (`decode_access_token`)

- **CALL** `decode_access_token(token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhbXpheW91YjNAZ21haWwuY29tIiwiZXhwIjoxNzg3OTYwMzg0fQ.SOhHHPsI2ucRGuxLwOU_Z6rRMTFMnMGHXuNgjjGzugE')` _(`app/core/security.py`)_
  → **returns** `'amzayoub3@gmail.com'`

**Email extracted from `sub`:** `amzayoub3@gmail.com`

## Step 5 — look up the user again by decoded email

- **SQL executed** (`SELECT user by decoded email`):
  ```sql
  SELECT users.id, users.email, users.hashed_password, users.created_at 
FROM users 
WHERE users.email = 'amzayoub3@gmail.com'
  ```
  → **returns** `<app.models.user.User object at 0x1086fe9d0>`


**Final — what `/auth/me` returns:** `{'id': 1, 'email': 'amzayoub3@gmail.com'}`
