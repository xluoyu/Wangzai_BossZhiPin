"""Unit tests for the JSONL task and review queue store."""

from __future__ import annotations

import json
import logging

import pytest

from boss_zhipin.audit.task_store import TaskStore


def _task(store: TaskStore, **overrides):
    fields = {
        "group_id": "group_test",
        "company_name": "示例公司",
        "job_title": "Python 后端",
        "job_url": "https://www.zhipin.com/job_detail/abc",
        "jd": "负责后端服务开发和维护。",
    }
    fields.update(overrides)
    return store.create_task(**fields)


class TestTaskStore:
    def test_creates_group_and_active_task_with_expected_files(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        group = store.create_group(mode="dry_run", label="本轮测试", exclude_keywords=["外包"])
        task = _task(store, group_id=group["group_id"])

        assert store.groups_path.exists()
        assert store.tasks_path.exists()
        assert not store.queue_path.exists()
        assert group["status"] == "running"
        assert task["task_status"] == "processing"
        assert task["started_at"]
        assert json.loads(store.tasks_path.read_text(encoding="utf-8"))["jd"] == task["jd"]

    def test_updates_and_finishes_group_counters(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        group = store.create_group(mode="direct")

        store.increment_group(group["group_id"], total_tasks=1, generated_count=1, sent_count=1)
        finished = store.finish_group(group["group_id"], status="completed")

        assert finished["total_tasks"] == 1
        assert finished["generated_count"] == 1
        assert finished["sent_count"] == 1
        assert finished["status"] == "completed"
        assert finished["finished_at"]

    def test_moves_active_task_to_queue_and_preserves_business_fields(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        task = _task(
            store,
            greeting="您好，看到您在招聘后端工程师。",
            filter_result={"blacklist": False, "keyword": False, "vector_distance": 0.21},
            llm_analysis={"matched": True, "reason": "技能匹配"},
        )

        moved = store.move_to_queue(
            task["task_id"],
            task_status="sent",
            review_status="approved",
            send_status="sent",
            sent_at="2026-10-10T10:00:00+08:00",
        )

        assert not store.query_tasks(scope="active")
        assert store.query_tasks(scope="queue", task_status="sent") == [moved]
        assert moved["job_url"] == task["job_url"]
        assert moved["jd"] == task["jd"]
        assert moved["greeting"] == task["greeting"]
        assert moved["sent_at"] == "2026-10-10T10:00:00+08:00"

    def test_move_is_idempotent_and_does_not_duplicate_terminal_record(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        task = _task(store)

        first = store.move_to_queue(task["task_id"], task_status="rejected", failure_reason="人工拒绝")
        second = store.move_to_queue(task["task_id"], task_status="sent", send_status="sent")

        assert second == first
        lines = store.queue_path.read_text(encoding="utf-8").splitlines()
        assert len(lines) == 1

    def test_query_filters_by_scope_status_group_and_time(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        active = _task(
            store,
            task_id="task_active",
            group_id="group_a",
            started_at="2026-10-10T10:00:00+08:00",
            review_status="pending",
        )
        queued = _task(
            store,
            task_id="task_queued",
            group_id="group_a",
            started_at="2026-10-10T11:00:00+08:00",
        )
        store.move_to_queue(queued["task_id"], task_status="filtered", send_status="skipped")
        _task(store, task_id="task_other", group_id="group_b")

        result = store.query_tasks(
            scope="all",
            group_id="group_a",
            review_status="pending",
            since="2026-10-10T09:00:00+08:00",
            until="2026-10-10T10:30:00+08:00",
        )

        assert [item["task_id"] for item in result] == [active["task_id"]]
        assert [item["task_id"] for item in store.query_tasks(scope="queue", task_status="filtered")] == [
            "task_queued"
        ]

    def test_bad_json_line_is_skipped_and_logged(self, tmp_path, caplog):
        store = TaskStore(tmp_path / "logs")
        _task(store, task_id="valid")
        with store.tasks_path.open("a", encoding="utf-8") as handle:
            handle.write("not-json\n")

        with caplog.at_level(logging.WARNING):
            records = store.query_tasks(scope="active")

        assert [record["task_id"] for record in records] == ["valid"]
        assert "跳过损坏的 JSONL 行" in caplog.text

    def test_duplicate_task_id_is_rejected(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        _task(store, task_id="same")

        with pytest.raises(ValueError, match="already exists"):
            _task(store, task_id="same")

    def test_atomic_updates_leave_valid_jsonl(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        group = store.create_group(mode="direct")
        store.update_group(group["group_id"], label="已更新")
        task = _task(store)
        store.update_task(task["task_id"], failure_reason="测试失败")

        for path in (store.groups_path, store.tasks_path):
            lines = path.read_text(encoding="utf-8").splitlines()
            assert len(lines) == 1
            json.loads(lines[0])

    def test_unknown_scope_or_counter_is_rejected(self, tmp_path):
        store = TaskStore(tmp_path / "logs")
        group = store.create_group(mode="direct")

        with pytest.raises(ValueError, match="scope"):
            store.query_tasks(scope="invalid")
        with pytest.raises(ValueError, match="unknown group counters"):
            store.increment_group(group["group_id"], unknown=1)
