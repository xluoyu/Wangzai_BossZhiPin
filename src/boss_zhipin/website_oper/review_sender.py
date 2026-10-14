"""审核队列的批准、拒绝和人工发送流程。"""

from __future__ import annotations

from typing import Any

from boss_zhipin.audit.task_store import TaskStore
from boss_zhipin.website_oper import finding_jobs


def _store(store: TaskStore | None) -> TaskStore:
    return store or TaskStore()


def _increment_group_if_present(store: TaskStore, record: dict[str, Any], **counts: int) -> None:
    group_id = record.get("group_id")
    if not group_id:
        return
    try:
        store.increment_group(group_id, **counts)
    except KeyError:
        pass


async def send_task(task_id: str, *, store: TaskStore | None = None) -> dict[str, Any]:
    """发送一个已批准任务，并在成功或失败后移动到终态队列。"""
    task_store = _store(store)
    task = task_store.get_task(task_id)
    if task is None:
        raise KeyError(f"unknown task_id: {task_id}")
    if task.get("task_status") != "approved_pending_send" or task.get("review_status") != "approved":
        raise ValueError(f"task is not approved for sending: {task_id}")
    job_url = str(task.get("job_url") or "").strip()
    greeting = str(task.get("greeting") or "").strip()

    try:
        if not job_url:
            raise ValueError(f"task has no job URL: {task_id}")
        if not greeting:
            raise ValueError(f"task has no greeting: {task_id}")
        await finding_jobs.open_browser_with_options(job_url, "chrome")
        await finding_jobs.log_in()
        await finding_jobs.click_by_xpath("//a[contains(@class, 'op-btn-chat')]", timeout=10)
        await finding_jobs.dismiss_greeting_dialog(timeout=5)
        if not await finding_jobs.wait_for_css("#chat-input", timeout=50):
            raise RuntimeError("chat input (#chat-input) 未找到")
        await finding_jobs.send_chat_message(greeting)
        await finding_jobs.click_send_resume(timeout=5)
        record = task_store.move_to_queue(
            task_id,
            task_status="sent",
            review_status="approved",
            send_status="sent",
            sent_at=_now(),
        )
        _increment_group_if_present(task_store, record, sent_count=1)
        return record
    except Exception as exc:
        record = task_store.move_to_queue(
            task_id,
            task_status="send_failed",
            review_status="approved",
            send_status="failed",
            failure_reason=f"send:{type(exc).__name__}: {exc}",
        )
        _increment_group_if_present(task_store, record, send_failed_count=1)
        raise


def _now() -> str:
    from datetime import datetime

    return datetime.now().astimezone().isoformat(timespec="seconds")


async def process_tasks(
    task_ids: list[str],
    action: str,
    *,
    store: TaskStore | None = None,
) -> dict[str, Any]:
    """按顺序处理一批任务，单个失败不会阻塞后续任务。"""
    task_store = _store(store)
    if action not in {"approve", "reject", "send"}:
        raise ValueError("action must be approve, reject, or send")
    results: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    for task_id in dict.fromkeys(task_ids):
        try:
            if action == "approve":
                record = task_store.approve_task(task_id)
            elif action == "reject":
                record = task_store.reject_task(task_id)
                _increment_group_if_present(task_store, record, rejected_count=1)
            else:
                record = await send_task(task_id, store=task_store)
            if record.get("group_id"):
                try:
                    task_store.reconcile_group(record["group_id"])
                except KeyError:
                    pass
            results.append(record)
        except Exception as exc:  # noqa: BLE001 - return per-task UI errors
            errors.append({"task_id": task_id, "message": f"{type(exc).__name__}: {exc}"})
    return {"results": results, "errors": errors}


__all__ = ["process_tasks", "send_task"]
