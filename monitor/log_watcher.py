import logging
import time
from pathlib import Path
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class LogWatcher:
    """Watch a log file for new lines matching a pattern."""

    def __init__(self, log_path: str, poll_interval: float = 1.0) -> None:
        self.log_path = Path(log_path)
        self.poll_interval = poll_interval
        self._position = 0
        if self.log_path.exists():
            self._position = self.log_path.stat().st_size

    def tail(self, lines: int = 100) -> str:
        try:
            with open(self.log_path, "r", encoding="utf-8", errors="ignore") as f:
                all_lines = f.readlines()
                return "".join(all_lines[-lines:])
        except Exception as exc:
            logger.error("Failed to tail %s: %s", self.log_path, exc)
            return ""

    def poll_once(self, callback: Optional[Callable[[str], None]] = None) -> list[str]:
        new_lines: list[str] = []
        try:
            with open(self.log_path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self._position)
                new_lines = f.readlines()
                self._position = f.tell()
        except Exception as exc:
            logger.error("Poll failed for %s: %s", self.log_path, exc)

        if callback and new_lines:
            for line in new_lines:
                callback(line)
        return new_lines
