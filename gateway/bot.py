import json
import logging
import os
from typing import Any, Callable, Dict, Optional

import httpx

from agent.core import AgentCore
from gateway.card_builder import build_repair_card, build_text_card

logger = logging.getLogger(__name__)

FEISHU_API_BASE = "https://open.feishu.cn/open-apis"

Handler = Callable[[str, str, Dict[str, Any]], Optional[str]]


class FeishuBot:
    """Feishu (Lark) bot event dispatcher and responder."""

    def __init__(
        self,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
        agent: Optional[AgentCore] = None,
    ) -> None:
        self.app_id = app_id or os.environ.get("FEISHU_APP_ID", "")
        self.app_secret = app_secret or os.environ.get("FEISHU_APP_SECRET", "")
        self.agent = agent
        self._token: Optional[str] = None
        self._handlers: Dict[str, Handler] = {
            "repair": self._handle_repair,
            "status": self._handle_status,
        }

    def _get_token(self) -> Optional[str]:
        if self._token:
            return self._token
        url = f"{FEISHU_API_BASE}/auth/v3/tenant_access_token/internal"
        resp = httpx.post(
            url, json={"app_id": self.app_id, "app_secret": self.app_secret}, timeout=10.0
        )
        data = resp.json()
        self._token = data.get("tenant_access_token")
        return self._token

    def send_message(
        self, receive_id: str, content: Dict[str, Any], msg_type: str = "interactive", receive_id_type: str = "open_id"
    ) -> Dict[str, Any]:
        token = self._get_token()
        if not token:
            return {"error": "No tenant_access_token"}

        url = f"{FEISHU_API_BASE}/im/v1/messages?receive_id_type={receive_id_type}"
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        body = {
            "receive_id": receive_id,
            "msg_type": msg_type,
            "content": json.dumps(content),
        }
        try:
            resp = httpx.post(url, headers=headers, json=body, timeout=10.0)
            return resp.json()
        except Exception as exc:
            logger.error("send_message failed: %s", exc)
            return {"error": str(exc)}

    def dispatch(self, event_type: str, user_id: str, message: str, extra: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Dispatch an incoming message to the appropriate handler.

        Args:
            event_type: 'message' or 'command'.
            user_id: Sender open_id.
            message: Text content or command string.
            extra: Additional event payload.

        Returns:
            Optional reply text.
        """
        extra = extra or {}
        text = message.strip()

        # Slash commands
        if text.startswith("/"):
            parts = text[1:].split(None, 1)
            cmd = parts[0]
            args = parts[1] if len(parts) > 1 else ""
            handler = self._handlers.get(cmd)
            if handler:
                return handler(user_id, args, extra)
            return self._handle_unknown(user_id, text, extra)

        # @mention or P2P message — route to agent
        if self.agent:
            return self.agent.run_task(text)

        return self._handle_unknown(user_id, text, extra)

    def _handle_repair(self, user_id: str, args: str, extra: Dict[str, Any]) -> str:
        return "Repair command received. (Integration with repair flow pending.)"

    def _handle_status(self, user_id: str, args: str, extra: Dict[str, Any]) -> str:
        return "Agent is running. Skills loaded: service_monitor, auto_repair."

    def _handle_unknown(self, user_id: str, text: str, extra: Dict[str, Any]) -> str:
        return f"Unknown command: {text}. Supported: /repair, /status"

    def send_repair_card(self, receive_id: str, title: str, summary: str, pr_url: str, diff_preview: Optional[str] = None) -> Dict[str, Any]:
        card = build_repair_card(title, summary, pr_url, diff_preview)
        return self.send_message(receive_id, card, msg_type="interactive")
