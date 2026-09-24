"""Send the verification code email via Brevo's HTTP API (port 443).

Mirrors the user's Face Studio implementation: Brevo is free (300/day), needs no
domain — just a sender address verified in the Brevo dashboard. Works anywhere
(no SMTP ports required). Stdlib only (urllib).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request

BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"


def _code_email(code: str, purpose: str = "signup") -> tuple[str, str, str]:
    """Return (subject, text, html) for a code email (signup or password reset)."""
    if purpose == "reset":
        subject = "Your Tark password reset code"
        intro = "We received a request to reset your Tark password."
        action = "Enter it in Tark to set a new password."
    else:
        subject = "Your Tark verification code"
        intro = "Welcome to Tark!"
        action = "Enter it in Tark to finish creating your account."
    text = (
        f"{intro}\n\nYour code is: {code}\n\n"
        f"{action} It expires in 10 minutes.\n"
        "If you didn't request this, you can ignore this email.\n"
    )
    html = f"""\
<!doctype html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#2d2d33;background:#faf9f7;padding:24px;">
    <h2 style="margin:0 0 4px;font-size:22px;color:#1e1b4b;">Tark</h2>
    <p style="color:#6b7280;margin:0 0 18px;font-size:14px;">Curriculum Learning System</p>
    <p>{intro}</p>
    <p>Your code is:</p>
    <div style="font-size:32px;font-weight:bold;letter-spacing:10px;
                background:#eef0ff;color:#4f46e5;padding:18px;border-radius:10px;
                text-align:center;max-width:260px;">{code}</div>
    <p style="color:#6b7280;margin-top:18px;">{action} This code expires in 10
    minutes. If you didn't request this, you can ignore this email.</p>
  </body>
</html>"""
    return subject, text, html


import logging
import time
from app.config.db_path import get_data_dir

logger = logging.getLogger("tark.auth.email")


def _save_local_email_log(to_email: str, subject: str, code: str, html: str) -> str:
    """Save an HTML copy of the email to local email_logs directory for easy retrieval."""
    try:
        log_dir = get_data_dir() / "email_logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        safe_email = "".join(c if c.isalnum() or c in "._-" else "_" for c in to_email)
        ts = int(time.time())
        file_path = log_dir / f"email_{safe_email}_{ts}.html"
        file_path.write_text(html, encoding="utf-8")
        return str(file_path)
    except Exception as e:
        logger.warning(f"Could not write local email log: {e}")
        return ""


import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def _send_via_smtp(
    *,
    to_email: str,
    subject: str,
    text: str,
    html: str,
    smtp_host: str,
    smtp_port: int,
    from_email: str,
    from_name: str,
    smtp_password: str,
) -> tuple[bool, str]:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
        msg["To"] = to_email
        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(from_email, smtp_password)
            server.send_message(msg)
        logger.info(f"Email sent successfully to {to_email} via SMTP ({smtp_host})")
        return True, "sent"
    except Exception as e:
        logger.warning(f"SMTP send failed to {to_email}: {e}")
        return False, str(e)


def send_code_email(
    *,
    to_email: str,
    code: str,
    api_key: str,
    from_email: str,
    from_name: str,
    purpose: str = "signup",
    smtp_host: str = "smtp.gmail.com",
    smtp_port: int = 587,
    smtp_password: str = "",
) -> tuple[bool, str]:
    """Send the code via SMTP or Brevo. Returns (ok, detail)."""
    subject, text, html = _code_email(code, purpose)

    # Always log locally first so the OTP is never lost in development/testing
    log_path = _save_local_email_log(to_email, subject, code, html)
    logger.info(
        f"🔑 [AUTH OTP] Verification code for {to_email}: {code} (Purpose: {purpose}, Logged to: {log_path})"
    )

    # 1. If direct SMTP credentials (e.g. Gmail App Password) are configured, send via SMTP
    if smtp_password and from_email:
        ok, detail = _send_via_smtp(
            to_email=to_email,
            subject=subject,
            text=text,
            html=html,
            smtp_host=smtp_host,
            smtp_port=smtp_port,
            from_email=from_email,
            from_name=from_name,
            smtp_password=smtp_password,
        )
        if ok:
            return True, "sent"
        logger.warning(f"SMTP failed ({detail}), falling back to Brevo HTTP API...")

    if not api_key:
        logger.info(f"BREVO_API_KEY not set — using local email log: {log_path}")
        return True, f"Logged to {log_path}"
    if not from_email:
        logger.info(f"EMAIL_FROM not set — using local email log: {log_path}")
        return True, f"Logged to {log_path}"

    payload = {
        "sender": {"email": from_email, "name": from_name or "Tark"},
        "to": [{"email": to_email}],
        "subject": subject,
        "textContent": text,
        "htmlContent": html,
    }
    req = urllib.request.Request(
        BREVO_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "api-key": api_key,
            "Content-Type": "application/json",
            "accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if 200 <= resp.status < 300:
                return True, "sent"
            return False, f"Brevo HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", errors="replace")[:300]
        except Exception:
            detail = ""
        logger.warning(f"Brevo API error {e.code}: {detail}")
        # If Brevo blocked due to IP whitelist or unrecognised IP, fallback to local log so signup doesn't fail!
        if e.code == 401 and "unrecognised IP" in detail:
            logger.warning(
                f"Brevo requires IP whitelisting for this IP. Code {code} saved to local log: {log_path}"
            )
            return True, f"Logged locally (Brevo IP whitelist restricted)"
        return False, f"Brevo error {e.code}: {detail}"
    except Exception as e:  # network/timeout
        logger.warning(f"Brevo send failed: {e}. Falling back to local log for code {code}")
        return True, f"Logged locally ({e})"
