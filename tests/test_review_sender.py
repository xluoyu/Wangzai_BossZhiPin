"""审核后发送流程的局部测试。"""

from __future__ import annotations

import asyncio

import pytest

from boss_zhipin.audit.task_store import TaskStore
from boss_zhipin.website_oper import finding_jobs
from boss_zhipin.website_oper.review_sender import send_task


def _approved(store: TaskStore):
    task = store.create_task(
        group_id="group_test",
        job_url="https://www.zhipin.com/job_detail/demo",
        greeting="您好，想和您交流这个岗位。",
        task_status="approved_pending_send",
        review_status="approved",
        send_status="not_sent",
    )
    return task["task_id"]


def test_send_task_moves_success_to_terminal_queue(monkeypatch, tmp_path):
    async def noop(*args, **kwargs):
        return True

    async def click(*args, **kwargs):
        return True

    monkeypatch.setattr(finding_jobs, "open_browser_with_options", noop)
    monkeypatch.setattr(finding_jobs, "log_in", noop)
    monkeypatch.setattr(finding_jobs, "click_by_xpath", click)
    monkeypatch.setattr(finding_jobs, "dismiss_greeting_dialog", noop)
    monkeypatch.setattr(finding_jobs, "wait_for_css", noop)
    monkeypatch.setattr(finding_jobs, "send_chat_message", noop)
    monkeypatch.setattr(finding_jobs, "click_send_resume", noop)

    store = TaskStore(tmp_path / "logs")
    task_id = _approved(store)
    sent = asyncio.run(send_task(task_id, store=store))

    assert sent["task_status"] == "sent"
    assert sent["send_status"] == "sent"
    assert store.query_tasks(scope="active") == []


def test_send_task_records_failure(monkeypatch, tmp_path):
    async def noop(*args, **kwargs):
        return True

    async def click(*args, **kwargs):
        return True

    async def fail(*args, **kwargs):
        raise RuntimeError("browser send failed")

    monkeypatch.setattr(finding_jobs, "open_browser_with_options", noop)
    monkeypatch.setattr(finding_jobs, "log_in", noop)
    monkeypatch.setattr(finding_jobs, "click_by_xpath", click)
    monkeypatch.setattr(finding_jobs, "dismiss_greeting_dialog", noop)
    monkeypatch.setattr(finding_jobs, "wait_for_css", noop)
    monkeypatch.setattr(finding_jobs, "send_chat_message", fail)

    store = TaskStore(tmp_path / "logs")
    task_id = _approved(store)

    with pytest.raises(RuntimeError, match="browser send failed"):
        asyncio.run(send_task(task_id, store=store))

    failed = store.query_tasks(scope="queue")[0]
    assert failed["task_status"] == "send_failed"
    assert failed["send_status"] == "failed"
