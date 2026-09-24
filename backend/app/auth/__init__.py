"""Backend-managed auth: username/email/password + 6-digit email verification.

Email is sent via Brevo's HTTP API (free, no domain needed), mirroring the
approach proven in the user's Face Studio project — Supabase email is not used.
"""
