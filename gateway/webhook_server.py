import hashlib
import hmac
import json
import logging
import os
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, Request

from gateway.bot import FeishuBot

logger = logging.getLogger(__name__)

app = FastAPI(title="Feishu Agent Webhook")

# Global bot instance (set at startup)
_bot: Optional[FeishuBot] = None


def set_bot(bot: FeishuBot) -> None:
    global _bot
    _bot = bot


def _verify_signature(request_body: bytes, timestamp: str, nonce: str, signature: str, key: str) -> bool:
    """Verify Feishu request signature."""
    expected = hmac.new(key.encode(), f"{timestamp}{nonce}{request_body.decode()}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@app.post("/webhook")
async def webhook(request: Request) -> Dict[str, Any]:
    body = await request.body()
    payload = json.loads(body)

    # Handle challenge (initial webhook verification)
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    event = payload.get("event", {})
    if not event:
        raise HTTPException(status_code=400, detail="Missing event")

    msg_type = event.get("message", {}).get("message_type")
    if msg_type != "text":
        return {"status": "ignored"}

    text = event.get("message", {}).get("content", {})
    if isinstance(text, str):
        text = json.loads(text)
    message_text = text.get("text", "")

    sender = event.get("sender", {}).get("sender_id", {}).get("open_id", "")
    if _bot:
        reply = _bot.dispatch("message", sender, message_text, extra=event)
        if reply:
            _bot.send_message(sender, {"text": reply}, msg_type="text")

    return {"status": "ok"}
