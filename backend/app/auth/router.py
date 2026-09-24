"""Auth API: username/email/password signup with a 6-digit email code, plus
login and a token check. Email goes out via Brevo (see email.py)."""
from __future__ import annotations

import json
import logging
import re
import secrets
import time
import urllib.request

logger = logging.getLogger("tark.auth")

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.auth.email import send_code_email
from app.auth.security import (
    decode_token,
    generate_code,
    hash_password,
    make_token,
    verify_password,
)
from app.auth.store import UserStore
from app.config.settings import Settings

CODE_TTL_SECONDS = 600  # 10 minutes
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SignupReq(BaseModel):
    username: str = Field(min_length=2, max_length=40)
    email: str
    password: str = Field(min_length=6, max_length=128)


class VerifyReq(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


class EmailReq(BaseModel):
    email: str


class LoginReq(BaseModel):
    email: str
    password: str


class ProfileReq(BaseModel):
    board: str | None = None
    grade: str | None = None
    school: str | None = None
    exam: str | None = None
    tutoring_style: str | None = None
    language: str | None = None
    weak_subjects: str | None = None
    goal: str | None = None


class ResetReq(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=6, max_length=128)


class FirebaseLoginReq(BaseModel):
    id_token: str


def create_auth_router(settings: Settings, store: UserStore) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])
    admin_emails = settings.admin_email_set

    def _user(row) -> dict:
        email = row["email"]
        keys = row.keys()
        return {
            "id": row["id"],
            "username": row["username"],
            "email": email,
            "is_admin": email.lower() in admin_emails,
            "board": row["board"] if "board" in keys else None,
            "grade": row["grade"] if "grade" in keys else None,
            "school": row["school"] if "school" in keys else None,
            "exam": row["exam"] if "exam" in keys else None,
            "tutoring_style": row["tutoring_style"] if "tutoring_style" in keys else None,
            "language": row["language"] if "language" in keys else None,
            "weak_subjects": row["weak_subjects"] if "weak_subjects" in keys else None,
            "goal": row["goal"] if "goal" in keys else None,
        }

    def _send(email: str, code: str, purpose: str = "signup") -> tuple[bool, str]:
        return send_code_email(
            to_email=email,
            code=code,
            api_key=settings.brevo_api_key,
            from_email=settings.email_from,
            from_name=settings.email_from_name,
            purpose=purpose,
            smtp_host=settings.smtp_host,
            smtp_port=settings.smtp_port,
            smtp_password=settings.smtp_password,
        )

    @router.post("/signup")
    def signup(req: SignupReq) -> dict:
        email = req.email.strip().lower()
        if not _EMAIL_RE.match(email):
            raise HTTPException(400, "Please enter a valid email address.")

        existing = store.get_by_email(email)
        if existing and existing["verified"]:
            raise HTTPException(
                409, "An account with this email already exists. Please log in."
            )

        username = req.username.strip()
        if not username:
            raise HTTPException(400, "Please choose a username.")
        if store.username_taken(username, exclude_email=email):
            raise HTTPException(409, "That username is taken. Please choose another.")

        salt, pwhash = hash_password(req.password)
        code = generate_code()

        # Re-signup before verifying just refreshes the pending account.
        if existing:
            store.delete_by_email(email)
        store.create_unverified(
            username=username,
            email=email,
            password_hash=pwhash,
            salt=salt,
            code=code,
            code_ttl_seconds=CODE_TTL_SECONDS,
        )

        ok, detail = _send(email, code)
        if not ok:
            store.delete_by_email(email)  # roll back so they can retry cleanly
            raise HTTPException(502, f"Couldn't send the verification email: {detail}")
        return {"ok": True, "needsConfirm": True}

    @router.post("/verify")
    def verify(req: VerifyReq) -> dict:
        email = req.email.strip().lower()
        row = store.get_by_email(email)
        if not row:
            raise HTTPException(404, "No pending sign-up for this email.")
        if row["verified"]:
            token = make_token(row["id"], email, settings.token_secret)
            return {"token": token, "user": _user(row)}
        if not row["code"] or row["code"] != req.code.strip():
            raise HTTPException(400, "Incorrect code. Please check and try again.")
        if not row["code_expires"] or row["code_expires"] < time.time():
            raise HTTPException(400, "This code has expired. Request a new one.")

        store.mark_verified(email)
        token = make_token(row["id"], email, settings.token_secret)
        return {"token": token, "user": _user(row)}

    @router.post("/resend")
    def resend(req: EmailReq) -> dict:
        email = req.email.strip().lower()
        row = store.get_by_email(email)
        if not row:
            raise HTTPException(404, "No pending sign-up for this email.")
        if row["verified"]:
            raise HTTPException(400, "This account is already verified. Please log in.")
        code = generate_code()
        store.set_code(email, code, CODE_TTL_SECONDS)
        ok, detail = _send(email, code)
        if not ok:
            raise HTTPException(502, f"Couldn't send the verification email: {detail}")
        return {"ok": True}

    @router.post("/forgot")
    def forgot(req: EmailReq) -> dict:
        email = req.email.strip().lower()
        row = store.get_by_email(email)
        # Act only for a verified account, but ALWAYS return ok so we don't reveal
        # whether an email is registered.
        if row and row["verified"]:
            code = generate_code()
            store.set_code(email, code, CODE_TTL_SECONDS)
            _send(email, code, purpose="reset")
        return {"ok": True}

    @router.post("/reset")
    def reset(req: ResetReq) -> dict:
        email = req.email.strip().lower()
        row = store.get_by_email(email)
        if not row or not row["verified"]:
            raise HTTPException(400, "No account found for this email.")
        if not row["code"] or row["code"] != req.code.strip():
            raise HTTPException(400, "Incorrect code. Please check and try again.")
        if not row["code_expires"] or row["code_expires"] < time.time():
            raise HTTPException(400, "This code has expired. Request a new one.")
        salt, pwhash = hash_password(req.password)
        store.set_password(email, pwhash, salt)
        token = make_token(row["id"], email, settings.token_secret)
        return {"token": token, "user": _user(store.get_by_email(email))}

    @router.post("/login")
    def login(req: LoginReq) -> dict:
        # The identifier may be an email OR a username — both are accepted.
        row = store.get_by_login(req.email)
        if not row or not verify_password(
            req.password, row["salt"], row["password_hash"]
        ):
            raise HTTPException(401, "Incorrect username/email or password.")
        if not row["verified"]:
            raise HTTPException(403, "Please verify your email first.")
        token = make_token(row["id"], row["email"], settings.token_secret)
        return {"token": token, "user": _user(row)}

    @router.get("/me")
    def me(authorization: str | None = Header(default=None)) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Missing token.")
        payload = decode_token(authorization.split(" ", 1)[1], settings.token_secret)
        if not payload:
            raise HTTPException(401, "Invalid or expired token.")
        row = store.get_by_email(str(payload.get("email", "")))
        if not row:
            raise HTTPException(404, "User not found.")
        return {"user": _user(row)}

    @router.post("/profile")
    def profile(
        req: ProfileReq, authorization: str | None = Header(default=None)
    ) -> dict:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(401, "Missing token.")
        payload = decode_token(authorization.split(" ", 1)[1], settings.token_secret)
        if not payload:
            raise HTTPException(401, "Invalid or expired token.")
        email = str(payload.get("email", ""))
        if not store.get_by_email(email):
            raise HTTPException(404, "User not found.")
        store.update_profile(
            email,
            board=(req.board or "").strip() or None,
            grade=(req.grade or "").strip() or None,
            school=(req.school or "").strip() or None,
            exam=(req.exam or "").strip() or None,
            tutoring_style=(req.tutoring_style or "").strip() or None,
            language=(req.language or "").strip() or None,
            weak_subjects=(req.weak_subjects or "").strip() or None,
            goal=(req.goal or "").strip() or None,
        )
        return {"user": _user(store.get_by_email(email))}

    @router.post("/firebase")
    def firebase_auth(req: FirebaseLoginReq) -> dict:
        """Authenticate via Firebase / Google ID token and return Tark session token."""
        id_token = req.id_token.strip()
        if not id_token:
            raise HTTPException(400, "Missing id_token")

        data: dict = {}
        # 1. Try Google oauth2 tokeninfo endpoint (for Google Sign-In tokens)
        try:
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
            r = urllib.request.Request(url, headers={"accept": "application/json"})
            with urllib.request.urlopen(r, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            # 2. Fallback: Parse Firebase ID token JWT payload (for Firebase Email/Password & Google tokens)
            try:
                import base64
                parts = id_token.split(".")
                if len(parts) == 3:
                    payload_b64 = parts[1]
                    payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
                    payload_bytes = base64.urlsafe_b64decode(payload_b64)
                    parsed = json.loads(payload_bytes.decode("utf-8"))
                    iss = str(parsed.get("iss", ""))
                    exp = parsed.get("exp", 0)
                    if (
                        ("securetoken.google.com" in iss or "accounts.google.com" in iss)
                        and exp > time.time()
                    ):
                        data = parsed
            except Exception as ex:
                logger.warning(f"Failed to parse Firebase token payload: {ex}")

        if not data:
            raise HTTPException(401, "Invalid or expired Firebase / Google token.")

        email = str(data.get("email", "")).strip().lower()
        if not email:
            raise HTTPException(400, "No email returned from Google token.")

        row = store.get_by_email(email)
        if not row:
            name = str(data.get("name", "")).strip() or email.split("@")[0]
            base_user = re.sub(r"[^a-zA-Z0-9_]", "", name) or "Learner"
            username = base_user
            idx = 1
            while store.username_taken(username):
                username = f"{base_user}_{idx}"
                idx += 1

            salt, pwhash = hash_password(secrets.token_hex(16))
            store.create_unverified(
                username=username,
                email=email,
                password_hash=pwhash,
                salt=salt,
                code="VERIFIED",
                code_ttl_seconds=3600,
            )
            store.mark_verified(email)
            row = store.get_by_email(email)
        elif not row["verified"]:
            store.mark_verified(email)
            row = store.get_by_email(email)

        token = make_token(row["id"], email, settings.token_secret)
        return {"token": token, "user": _user(row)}

    return router
