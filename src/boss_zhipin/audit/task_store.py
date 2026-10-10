"""JSONL storage for task groups, active review tasks, and terminal tasks.

This module owns task history introduced by the review queue workflow.  It is
intentionally separate from ``audit.log_attempt`` so the existing
``letters.jsonl`` format remains compatible.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping

log = logging.getLogger(__name__)

_COUNTERS = (
    "total_tasks",
    "processed_count",
    "generated_count",
    "pending_review_count",
    "sent_count",
    "filtered_count",
    "rejected_count",
    "failed_count",
    "send_failed_count",
    "cancelled_count",
    "blacklist_count",
    "keyword_filtered_count",
    "vector_filtered_count",
    "llm_filtered_count",
    "fetch_failed_count",
)

_TASK_FIELDS: dict[str, Any] = {
    "schema_version": 1,
    "company_name": "",
    "job_title": "",
    "job_url": "",
    "jd": "",
    "task_status": "processing",
    "review_status": "not_required",
    "send_status": "not_sent",
    "filter_result": {},
    "llm_analysis": None,
    "greeting": "",
    "failure_reason": None,
    "started_at": None,
    "finished_at": None,
    "reviewed_at": None,
    "sent_at": None,
}


def _now() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def _coerce_datetime(value: datetime | str | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        result = value
    else:
        result = datetime.fromisoformat(value)
    if result.tzinfo is None:
        return result.astimezone()
    return result


def _record_in_time_range(
    record: Mapping[str, Any],
    *,
    since: datetime | str | None,
    until: datetime | str | None,
) -> bool:
    timestamp = record.get("started_at") or record.get("ts")
    if not timestamp:
        return since is None and until is None
    try:
        current = _coerce_datetime(timestamp)
        lower = _coerce_datetime(since)
        upper = _coerce_datetime(until)
    except (TypeError, ValueError):
        return False
    if current is None:
        return False
    return (lower is None or current >= lower) and (upper is None or current <= upper)


class TaskStore:
    """Persist task workflow records in three JSONL files.

    A store instance uses a process-wide lock for all operations.  This keeps
    append, update, and active-to-terminal moves from interleaving when the
    runner and a review command share one Python process.  JSONL files remain
    human-readable and can still be inspected with standard command-line tools.
    """

    _lock = threading.RLock()

    def __init__(
        self,
        log_dir: str | os.PathLike[str] = "./logs",
        *,
        groups_path: str | os.PathLike[str] | None = None,
        tasks_path: str | os.PathLike[str] | None = None,
        queue_path: str | os.PathLike[str] | None = None,
    ) -> None:
        root = Path(log_dir)
        self.groups_path = Path(groups_path) if groups_path else root / "task_groups.jsonl"
        self.tasks_path = Path(tasks_path) if tasks_path else root / "tasks.jsonl"
        self.queue_path = Path(queue_path) if queue_path else root / "task_queue.jsonl"

    # ---------- low-level JSONL operations ----------

    @staticmethod
    def _ensure_parent(path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)

    @classmethod
    def _append(cls, path: Path, record: Mapping[str, Any]) -> None:
        cls._ensure_parent(path)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
            handle.write("\n")
            handle.flush()

    @staticmethod
    def _read(path: Path) -> list[dict[str, Any]]:
        if not path.exists():
            return []
        records: list[dict[str, Any]] = []
        try:
            with path.open(encoding="utf-8") as handle:
                for line_number, line in enumerate(handle, start=1):
                    text = line.strip()
                    if not text:
                        continue
                    try:
                        value = json.loads(text)
                    except json.JSONDecodeError:
                        log.warning("跳过损坏的 JSONL 行: %s:%d", path, line_number)
                        continue
                    if not isinstance(value, dict):
                        log.warning("跳过非对象 JSONL 行: %s:%d", path, line_number)
                        continue
                    records.append(value)
        except OSError as exc:
            log.warning("读取任务 JSONL 失败: %s: %s", path, exc)
        return records

    @classmethod
    def _replace(cls, path: Path, records: Iterable[Mapping[str, Any]]) -> None:
        cls._ensure_parent(path)
        temporary: str | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=path.parent,
                prefix=f".{path.name}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temporary = handle.name
                for record in records:
                    handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
                    handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
            temporary = None
        finally:
            if temporary:
                try:
                    os.unlink(temporary)
                except FileNotFoundError:
                    pass

    @staticmethod
    def _find(records: Iterable[Mapping[str, Any]], record_id: str, field: str) -> dict[str, Any] | None:
        for record in records:
            if record.get(field) == record_id:
                return dict(record)
        return None

    # ---------- task groups ----------

    def create_group(
        self,
        *,
        mode: str,
        label: str = "",
        exclude_keywords: Iterable[str] | None = None,
        group_id: str | None = None,
        started_at: str | None = None,
    ) -> dict[str, Any]:
        """Create and persist a new run group, returning its record."""
        record: dict[str, Any] = {
            "schema_version": 1,
            "group_id": group_id or _new_id("group"),
            "mode": mode,
            "label": label,
            "started_at": started_at or _now(),
            "finished_at": None,
            "status": "running",
            "exclude_keywords": list(exclude_keywords or []),
        }
        record.update({counter: 0 for counter in _COUNTERS})
        with self._lock:
            if self._find(self._read(self.groups_path), record["group_id"], "group_id"):
                raise ValueError(f"group_id already exists: {record['group_id']}")
            self._append(self.groups_path, record)
        return record

    def get_group(self, group_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._find(self._read(self.groups_path), group_id, "group_id")

    def update_group(self, group_id: str, **updates: Any) -> dict[str, Any]:
        """Update one group using atomic JSONL replacement."""
        with self._lock:
            records = self._read(self.groups_path)
            updated: dict[str, Any] | None = None
            for index, record in enumerate(records):
                if record.get("group_id") == group_id:
                    record.update(updates)
                    records[index] = record
                    updated = dict(record)
                    break
            if updated is None:
                raise KeyError(f"unknown group_id: {group_id}")
            self._replace(self.groups_path, records)
            return updated

    def increment_group(self, group_id: str, **increments: int) -> dict[str, Any]:
        """Increment known aggregate counters for a group."""
        unknown = set(increments) - set(_COUNTERS)
        if unknown:
            raise ValueError(f"unknown group counters: {sorted(unknown)}")
        group = self.get_group(group_id)
        if group is None:
            raise KeyError(f"unknown group_id: {group_id}")
        updates = {
            key: int(group.get(key, 0)) + int(value)
            for key, value in increments.items()
        }
        return self.update_group(group_id, **updates)

    def finish_group(
        self,
        group_id: str,
        *,
        status: str = "completed",
        finished_at: str | None = None,
        **updates: Any,
    ) -> dict[str, Any]:
        updates.update({"status": status, "finished_at": finished_at or _now()})
        return self.update_group(group_id, **updates)

    # ---------- active and terminal tasks ----------

    def create_task(self, *, task_id: str | None = None, **fields: Any) -> dict[str, Any]:
        """Create an active task record and return the normalized record."""
        record = dict(_TASK_FIELDS)
        record.update(fields)
        record["task_id"] = task_id or fields.get("task_id") or _new_id("task")
        record["started_at"] = record.get("started_at") or _now()
        with self._lock:
            if self._find(self._read(self.tasks_path), record["task_id"], "task_id"):
                raise ValueError(f"task_id already exists in active tasks: {record['task_id']}")
            if self._find(self._read(self.queue_path), record["task_id"], "task_id"):
                raise ValueError(f"task_id already exists in task queue: {record['task_id']}")
            self._append(self.tasks_path, record)
        return record

    def get_task(self, task_id: str) -> dict[str, Any] | None:
        with self._lock:
            return self._find(self._read(self.tasks_path), task_id, "task_id") or self._find(
                self._read(self.queue_path), task_id, "task_id"
            )

    def update_task(self, task_id: str, **updates: Any) -> dict[str, Any]:
        """Update an active task in place using atomic replacement."""
        with self._lock:
            records = self._read(self.tasks_path)
            for index, record in enumerate(records):
                if record.get("task_id") == task_id:
                    record.update(updates)
                    records[index] = record
                    self._replace(self.tasks_path, records)
                    return dict(record)
            if self._find(self._read(self.queue_path), task_id, "task_id"):
                raise ValueError(f"cannot update terminal task: {task_id}")
            raise KeyError(f"unknown task_id: {task_id}")

    def move_to_queue(
        self,
        task_id: str,
        *,
        task_status: str,
        review_status: str = "not_required",
        send_status: str = "skipped",
        finished_at: str | None = None,
        **updates: Any,
    ) -> dict[str, Any]:
        """Move an active task to the terminal queue exactly once."""
        with self._lock:
            active = self._read(self.tasks_path)
            queued = self._read(self.queue_path)
            existing = self._find(queued, task_id, "task_id")
            if existing is not None:
                return existing

            task: dict[str, Any] | None = None
            remaining: list[dict[str, Any]] = []
            for record in active:
                if record.get("task_id") == task_id and task is None:
                    task = dict(record)
                else:
                    remaining.append(record)
            if task is None:
                raise KeyError(f"unknown active task_id: {task_id}")

            task.update(updates)
            task.update(
                {
                    "task_status": task_status,
                    "review_status": review_status,
                    "send_status": send_status,
                    "finished_at": finished_at or task.get("finished_at") or _now(),
                }
            )
            self._replace(self.tasks_path, remaining)
            self._append(self.queue_path, task)
            return task

    # ---------- queries ----------

    def query_tasks(
        self,
        *,
        scope: str = "all",
        group_id: str | None = None,
        task_status: str | None = None,
        review_status: str | None = None,
        send_status: str | None = None,
        since: datetime | str | None = None,
        until: datetime | str | None = None,
    ) -> list[dict[str, Any]]:
        """Return tasks matching exact status, group, and time filters."""
        if scope not in {"all", "active", "queue"}:
            raise ValueError("scope must be one of: all, active, queue")
        with self._lock:
            records: list[dict[str, Any]] = []
            if scope in {"all", "active"}:
                records.extend(self._read(self.tasks_path))
            if scope in {"all", "queue"}:
                records.extend(self._read(self.queue_path))
        return [
            record
            for record in records
            if (group_id is None or record.get("group_id") == group_id)
            and (task_status is None or record.get("task_status") == task_status)
            and (review_status is None or record.get("review_status") == review_status)
            and (send_status is None or record.get("send_status") == send_status)
            and _record_in_time_range(record, since=since, until=until)
        ]

    def query_groups(
        self,
        *,
        group_id: str | None = None,
        status: str | None = None,
        since: datetime | str | None = None,
        until: datetime | str | None = None,
    ) -> list[dict[str, Any]]:
        with self._lock:
            records = self._read(self.groups_path)
        return [
            record
            for record in records
            if (group_id is None or record.get("group_id") == group_id)
            and (status is None or record.get("status") == status)
            and _record_in_time_range(record, since=since, until=until)
        ]


__all__ = ["TaskStore"]
