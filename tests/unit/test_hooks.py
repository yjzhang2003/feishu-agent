import pytest

from hooks.manager import HookManager


def test_register_and_emit():
    manager = HookManager()
    calls = []

    def capture(**kwargs):
        calls.append(kwargs)

    manager.register("before_repair", capture)
    manager.emit("before_repair", context="demo")

    assert len(calls) == 1
    assert calls[0]["context"] == "demo"


def test_multiple_hooks():
    manager = HookManager()
    results = []

    def add_one(**kwargs):
        results.append(1)

    def add_two(**kwargs):
        results.append(2)

    manager.register("after_repair", add_one)
    manager.register("after_repair", add_two)
    manager.emit("after_repair", result="ok")

    assert sorted(results) == [1, 2]


def test_invalid_event_raises():
    manager = HookManager()

    def dummy(**kwargs):
        pass

    with pytest.raises(ValueError):
        manager.register("invalid_event", dummy)


def test_hook_error_graceful():
    manager = HookManager()

    def boom(**kwargs):
        raise RuntimeError("boom")

    def ok(**kwargs):
        return "ok"

    manager.register("on_error", boom)
    manager.register("on_error", ok)
    results = manager.emit("on_error", error="something")

    assert results == ["ok"]
