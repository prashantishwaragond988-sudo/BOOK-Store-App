import time
from dataclasses import dataclass
from typing import Dict, Tuple
import secrets
from datetime import datetime


@dataclass
class OtpRecord:
    otp: str
    expires_at: float
    attempts: int


@dataclass
class DailySendRecord:
    day: str
    count: int


@dataclass
class VerifiedRecord:
    expires_at: float


class InMemoryOtpStore:
    """
    Simple in-memory OTP store.

    Notes:
    - This resets on server restart (fine for dev; use Redis for production).
    - Email keys are stored as lowercase for consistency.
    """

    def __init__(self) -> None:
        self._otp_by_email: Dict[str, OtpRecord] = {}
        self._verified_by_email: Dict[str, VerifiedRecord] = {}
        self._daily_send_by_email: Dict[str, DailySendRecord] = {}

    @staticmethod
    def _now() -> float:
        return time.time()

    @staticmethod
    def _today_key() -> str:
        # Daily limit uses UTC day boundary for predictability on servers.
        return datetime.utcnow().date().isoformat()

    @staticmethod
    def generate_otp() -> str:
        # 6-digit numeric OTP (000000-999999), returned as string with leading zeros.
        return f"{secrets.randbelow(1_000_000):06d}"

    def _cleanup(self) -> None:
        now = self._now()
        self._otp_by_email = {k: v for k, v in self._otp_by_email.items() if v.expires_at > now}
        self._verified_by_email = {k: v for k, v in self._verified_by_email.items() if v.expires_at > now}

        today = self._today_key()
        # Keep only today's daily counters to avoid unbounded growth.
        self._daily_send_by_email = {k: v for k, v in self._daily_send_by_email.items() if v.day == today}

    def set_otp(self, email: str, otp: str, *, ttl_seconds: int) -> None:
        self._cleanup()
        key = (email or "").strip().lower()
        self._otp_by_email[key] = OtpRecord(otp=otp, expires_at=self._now() + ttl_seconds, attempts=0)

    def clear_otp(self, email: str) -> None:
        key = (email or "").strip().lower()
        self._otp_by_email.pop(key, None)

    def daily_send_count(self, email: str) -> int:
        self._cleanup()
        key = (email or "").strip().lower()
        record = self._daily_send_by_email.get(key)
        if not record or record.day != self._today_key():
            return 0
        return record.count

    def can_send_today(self, email: str, *, max_per_day: int) -> bool:
        return self.daily_send_count(email) < int(max_per_day)

    def record_sent_today(self, email: str) -> int:
        self._cleanup()
        key = (email or "").strip().lower()
        today = self._today_key()
        record = self._daily_send_by_email.get(key)
        if not record or record.day != today:
            record = DailySendRecord(day=today, count=0)
        record.count += 1
        self._daily_send_by_email[key] = record
        return record.count

    def verify_otp(
        self,
        email: str,
        otp: str,
        *,
        verified_ttl_seconds: int,
    ) -> Tuple[bool, str]:
        self._cleanup()
        key = (email or "").strip().lower()
        record = self._otp_by_email.get(key)
        if not record:
            return False, "Invalid OTP"
        if record.expires_at <= self._now():
            self._otp_by_email.pop(key, None)
            return False, "OTP expired"
        if str(record.otp) != str(otp).strip():
            record.attempts += 1
            self._otp_by_email[key] = record
            return False, "Invalid OTP"

        # OTP used successfully: remove it and mark email verified temporarily.
        self._otp_by_email.pop(key, None)
        self._verified_by_email[key] = VerifiedRecord(expires_at=self._now() + verified_ttl_seconds)
        return True, "OTP verified"

    def is_verified(self, email: str) -> bool:
        self._cleanup()
        key = (email or "").strip().lower()
        record = self._verified_by_email.get(key)
        return bool(record and record.expires_at > self._now())

    def clear_verification(self, email: str) -> None:
        key = (email or "").strip().lower()
        self._verified_by_email.pop(key, None)


otp_store = InMemoryOtpStore()
