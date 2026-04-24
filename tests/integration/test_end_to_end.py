"""
End-to-end integration test skeleton.

This test verifies the full pipeline wiring:
- AgentCore can load skills and tools.
- RepairFlow can be instantiated with mocked LLM.
- FeishuBot can dispatch messages.

A full live E2E test requires:
- Running Flask demo service
- Valid Feishu credentials
- Valid GitHub token
"""

from unittest.mock import MagicMock

from agent.core import AgentCore
from gateway.bot import FeishuBot
from hooks.manager import HookManager
from repair.flow import RepairFlow
from skills.registry import SkillRegistry


def test_pipeline_instantiation():
    """Smoke test that all major components wire together."""
    registry = SkillRegistry()
    hooks = HookManager()
    agent = AgentCore(api_key="dummy", skill_registry=registry, hook_manager=hooks)
    flow = RepairFlow(agent=agent, hook_manager=hooks)
    bot = FeishuBot(app_id="a", app_secret="s", agent=agent)

    assert agent is not None
    assert flow is not None
    assert bot is not None


def test_repair_flow_with_mock_agent():
    mock_agent = MagicMock()
    mock_agent.run_task.side_effect = [
        "Root cause: division by zero",
        "--- a/app.py\n+++ b/app.py\n@@ -10 +10 @@\n-    result = a / b\n+    result = a / b if b != 0 else 0\n",
    ]

    flow = RepairFlow(agent=mock_agent)
    result = flow.run(context="ZeroDivisionError", error_log="Traceback...")

    assert result["status"] == "success"
