from typing import Any, Dict, Optional


def build_repair_card(
    title: str,
    summary: str,
    pr_url: str,
    diff_preview: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a Feishu interactive card for auto-repair notification.

    Args:
        title: Card header title.
        summary: Brief description of the bug and fix.
        pr_url: Link to the GitHub pull request.
        diff_preview: Optional short diff preview (truncated).

    Returns:
        Feishu interactive card JSON dict.
    """
    elements: list[dict[str, Any]] = [
        {
            "tag": "div",
            "text": {
                "tag": "lark_md",
                "content": f"**Bug Summary**\n{summary}",
            },
        },
        {"tag": "hr"},
        {
            "tag": "action",
            "actions": [
                {
                    "tag": "button",
                    "text": {"tag": "plain_text", "content": "View PR"},
                    "url": pr_url,
                    "type": "primary",
                },
            ],
        },
    ]

    if diff_preview:
        elements.insert(
            1,
            {
                "tag": "div",
                "text": {
                    "tag": "lark_md",
                    "content": f"**Diff Preview**\n```diff\n{diff_preview[:500]}\n```",
                },
            },
        )

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": title},
            "template": "red",
        },
        "elements": elements,
    }


def build_text_card(content: str) -> Dict[str, Any]:
    """Simple text card for generic bot responses."""
    return {
        "config": {"wide_screen_mode": True},
        "elements": [
            {
                "tag": "div",
                "text": {"tag": "lark_md", "content": content},
            }
        ],
    }
