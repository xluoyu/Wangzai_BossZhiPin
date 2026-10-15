"""PyTauri 日志 Channel 的 payload 编码测试。"""
from __future__ import annotations

import json

from boss_zhipin.tauri import _safe_send


class _FakeChannel:
    def __init__(self) -> None:
        self.values: list[str] = []

    def send(self, value: str) -> None:
        self.values.append(value)


def test_safe_send_encodes_log_line_as_json_string() -> None:
    channel = _FakeChannel()
    line = "16:16:15 [INFO] boss_zhipin.cli: 中文日志"

    _safe_send(channel, line)

    assert channel.values == [json.dumps(line, ensure_ascii=False)]
    assert json.loads(channel.values[0]) == line
