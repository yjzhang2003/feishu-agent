import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


class IssuePoller:
    """Poll GitHub issues for a repository."""

    def __init__(
        self,
        owner: Optional[str] = None,
        repo: Optional[str] = None,
        token: Optional[str] = None,
        label: Optional[str] = "bug",
    ) -> None:
        self.owner = owner or os.environ.get("GITHUB_REPO_OWNER", "")
        self.repo = repo or os.environ.get("GITHUB_REPO_NAME", "")
        self.token = token or os.environ.get("GITHUB_TOKEN", "")
        self.label = label

    def fetch_recent(self, state: str = "open", per_page: int = 10) -> List[Dict[str, Any]]:
        url = f"{GITHUB_API}/repos/{self.owner}/{self.repo}/issues"
        headers = {"Accept": "application/vnd.github+json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        params: Dict[str, Any] = {"state": state, "per_page": per_page}
        if self.label:
            params["labels"] = self.label

        try:
            resp = httpx.get(url, headers=headers, params=params, timeout=15.0)
            resp.raise_for_status()
            return list(resp.json())
        except Exception as exc:
            logger.error("Issue poll failed: %s", exc)
            return []
