"""Password hashing, JWT session tokens, and 6-digit code generation.

All stdlib except PyJWT (already present as a dependency).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time

import jwt

_PBKDF2_ROUNDS = 200_000
_TOKEN_ALGO = "HS256"


def generate_code() -> str:
    """A 6-digit numeric verification code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_password(password: str, salt_b64: str | None = None) -> tuple[str, str]:
    """Return (salt_b64, hash_b64). Pass an existing salt to verify."""
    salt = base64.b64decode(salt_b64) if salt_b64 else secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ROUNDS)
    return base64.b64encode(salt).decode(), base64.b64encode(dk).decode()


def verify_password(password: str, salt_b64: str, hash_b64: str) -> bool:
    _, computed = hash_password(password, salt_b64)
    return hmac.compare_digest(computed, hash_b64)


def make_token(user_id: int, email: str, secret: str, days: int = 30) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": now + days * 86_400,
    }
    return jwt.encode(payload, secret, algorithm=_TOKEN_ALGO)


def decode_token(token: str, secret: str) -> dict | None:
    try:
        return jwt.decode(token, secret, algorithms=[_TOKEN_ALGO])
    except jwt.PyJWTError:
        return None
