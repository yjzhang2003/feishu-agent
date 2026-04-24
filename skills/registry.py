import abc
import importlib.util
import logging
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class Skill(abc.ABC):
    """Abstract base class for a domain skill."""

    def __init__(self, name: str, config: Optional[Dict[str, Any]] = None) -> None:
        self.name = name
        self.config = config or {}
        self._tools: List[Dict[str, Any]] = []

    @abc.abstractmethod
    def load(self) -> None:
        """Initialize the skill (load models, connect to APIs, etc.)."""

    @abc.abstractmethod
    def unload(self) -> None:
        """Clean up resources."""

    def get_tools(self) -> List[Dict[str, Any]]:
        """Return tool schemas for the Agent SDK."""
        return self._tools

    def register_tool(self, tool_def: Dict[str, Any]) -> None:
        self._tools.append(tool_def)


class SkillRegistry:
    """Discovers and loads skills from filesystem directories."""

    def __init__(self, search_paths: Optional[List[Path]] = None) -> None:
        self.search_paths = search_paths or [Path(__file__).parent]
        self._skills: Dict[str, Skill] = {}

    def discover(self) -> List[Path]:
        """Find all directories containing a skill.yaml manifest."""
        manifests: List[Path] = []
        for base in self.search_paths:
            if not base.exists():
                continue
            for item in base.rglob("skill.yaml"):
                manifests.append(item.parent)
        return manifests

    def load_skill(self, skill_dir: Path) -> Optional[Skill]:
        """Load a single skill from its directory."""
        manifest_path = skill_dir / "skill.yaml"
        if not manifest_path.exists():
            return None

        # Read manifest (minimal YAML parsing without full loader dependency)
        import yaml

        manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
        name = manifest.get("name", skill_dir.name)
        entrypoint = manifest.get("entrypoint", "skill.py")
        config = manifest.get("config", {})

        module_path = skill_dir / entrypoint
        if not module_path.exists():
            logger.warning("Skill %s entrypoint missing: %s", name, module_path)
            return None

        spec = importlib.util.spec_from_file_location(f"skills.{name}", module_path)
        if spec is None or spec.loader is None:
            logger.warning("Cannot import skill %s from %s", name, module_path)
            return None

        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        skill_cls = getattr(module, "SkillImpl", None)
        if skill_cls is None:
            logger.warning("Skill %s does not define SkillImpl class", name)
            return None

        try:
            skill = skill_cls(name=name, config=config)
            skill.load()
            self._skills[name] = skill
            logger.info("Loaded skill: %s", name)
            return skill
        except Exception as exc:
            logger.error("Failed to load skill %s: %s", name, exc)
            return None

    def load_all(self) -> Dict[str, Skill]:
        """Discover and load all available skills."""
        for skill_dir in self.discover():
            self.load_skill(skill_dir)
        return dict(self._skills)

    def get_skill(self, name: str) -> Optional[Skill]:
        return self._skills.get(name)

    def list_skills(self) -> List[str]:
        return list(self._skills.keys())

    def unload_all(self) -> None:
        for skill in self._skills.values():
            try:
                skill.unload()
            except Exception as exc:
                logger.error("Error unloading skill %s: %s", skill.name, exc)
        self._skills.clear()
