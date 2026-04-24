import logging
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)


class HealthChecker:
    """HTTP health probe for a web service."""

    def __init__(self, url: str, timeout: float = 5.0, expected_status: int = 200) -> None:
        self.url = url
        self.timeout = timeout
        self.expected_status = expected_status

    def check(self) -> Dict[str, Any]:
        try:
            resp = httpx.get(self.url, timeout=self.timeout)
            healthy = resp.status_code == self.expected_status
            return {
                "url": self.url,
                "status_code": resp.status_code,
                "healthy": healthy,
                "response_time_ms": resp.elapsed.total_seconds() * 1000,
            }
        except httpx.RequestError as exc:
            logger.error("Health check failed for %s: %s", self.url, exc)
            return {"url": self.url, "healthy": False, "error": str(exc)}
