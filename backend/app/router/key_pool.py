"""Multi-key pool with round-robin load-balancing and automatic cooldown on 429."""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)


class KeyPool:
    def __init__(self, provider: str, keys: list[str] | str, cooldown_seconds: float = 60.0) -> None:
        self.provider = provider
        if isinstance(keys, str):
            raw = [k.strip() for k in keys.replace("\n", ",").split(",") if k.strip()]
        else:
            raw = [k.strip() for k in keys if k.strip()]
        if provider == "gemini":
            # Gemini Developer AI Studio keys strictly start with AIzaSy
            self.keys = [k for k in raw if k.startswith("AIzaSy")]
        else:
            self.keys = raw
        self._cooldowns: dict[str, float] = {}
        self._current_idx = 0
        self.cooldown_seconds = cooldown_seconds

    def has_keys(self) -> bool:
        return len(self.keys) > 0

    def get_candidate_keys(self) -> list[str]:
        """Return all available keys starting from current index, active first."""
        now = time.time()
        active = []
        cooling = []
        for i in range(len(self.keys)):
            idx = (self._current_idx + i) % len(self.keys)
            k = self.keys[idx]
            if self._cooldowns.get(k, 0) <= now:
                active.append(k)
            else:
                cooling.append(k)
        if active:
            self._current_idx = (self._current_idx + 1) % len(self.keys)
            return active
        # All keys are currently on cooldown — return empty so caller fails over instantly!
        return []

    def mark_rate_limited(self, key: str, cooldown: float | None = None) -> None:
        cd = cooldown or self.cooldown_seconds
        self._cooldowns[key] = time.time() + cd
        logger.warning(
            f"[{self.provider}] Key ending in ...{key[-6:] if len(key) >= 6 else key} "
            f"marked on cooldown for {cd}s ({len(self.keys)} total keys in pool)"
        )
