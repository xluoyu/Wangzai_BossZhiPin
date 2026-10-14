"""CLI 运行组收尾行为测试。"""

from __future__ import annotations

import asyncio

import pytest

from boss_zhipin import cli


class _FakeStore:
    def __init__(self):
        self.group = {"group_id": "group_test"}
        self.calls: list[tuple[str, str]] = []

    def create_group(self, **kwargs):
        return self.group

    def cancel_processing_tasks(self, group_id):
        self.calls.append(("cancel_processing_tasks", group_id))

    def reconcile_group(self, group_id, **kwargs):
        self.calls.append(("reconcile_group", kwargs["status"]))


def test_run_provider_reconciles_cancelled_group(monkeypatch):
    store = _FakeStore()

    async def cancelled(**kwargs):
        raise asyncio.CancelledError

    monkeypatch.setattr(cli, "TaskStore", lambda: store)
    monkeypatch.setattr(cli, "_run_provider", cancelled)

    with pytest.raises(asyncio.CancelledError):
        asyncio.run(cli.run_provider("测试", "", True, "resume.pdf"))

    assert store.calls == [
        ("cancel_processing_tasks", "group_test"),
        ("reconcile_group", "cancelled"),
    ]


def test_run_provider_marks_internal_failure_group_failed(monkeypatch):
    store = _FakeStore()

    async def failed(**kwargs):
        return False

    monkeypatch.setattr(cli, "TaskStore", lambda: store)
    monkeypatch.setattr(cli, "_run_provider", failed)

    asyncio.run(cli.run_provider("测试", "", True, "resume.pdf"))

    assert store.calls == [("reconcile_group", "failed")]
