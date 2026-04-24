import tempfile
from pathlib import Path

import pytest

from skills.registry import Skill, SkillRegistry


class DummySkill(Skill):
    def load(self) -> None:
        self.register_tool(
            {
                "type": "function",
                "function": {
                    "name": "dummy_tool",
                    "description": "A dummy tool",
                    "parameters": {"type": "object", "properties": {}},
                },
            }
        )

    def unload(self) -> None:
        pass


def test_skill_registry_load_from_directory():
    with tempfile.TemporaryDirectory() as tmpdir:
        skill_dir = Path(tmpdir) / "dummy_skill"
        skill_dir.mkdir()
        (skill_dir / "skill.yaml").write_text(
            "name: dummy_skill\nentrypoint: skill.py\n", encoding="utf-8"
        )
        (skill_dir / "skill.py").write_text(
            "from skills.registry import Skill\n"
            "class DummySkillImpl(Skill):\n"
            "    def load(self):\n"
            "        self.register_tool({'type': 'function', 'function': {'name': 't', 'description': 't', 'parameters': {'type': 'object', 'properties': {}}}})\n"
            "    def unload(self): pass\n"
            "SkillImpl = DummySkillImpl\n",
            encoding="utf-8",
        )

        registry = SkillRegistry(search_paths=[Path(tmpdir)])
        skills = registry.load_all()

        assert "dummy_skill" in skills
        assert len(skills["dummy_skill"].get_tools()) == 1


def test_skill_get_tools():
    skill = DummySkill(name="test")
    skill.load()
    tools = skill.get_tools()
    assert len(tools) == 1
    assert tools[0]["function"]["name"] == "dummy_tool"
