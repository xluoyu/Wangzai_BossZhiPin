"""把 root logger 的输出路由到注册的 callback（PyTauri Channel / 测试断言）。

logger 是被业务代码的同步上下文用，所以 handler 的 ``emit`` 必须同步。
caller 在 callback 里做同步推送即可——PyTauri Channel 的 send 本身是 sync 的。

**仅 GUI 进程安装这个 handler**。CLI 模式（``main.py``）不调本模块，
logger 行为完全不变。
"""
from __future__ import annotations

import logging
from typing import Callable, Optional


class CallbackHandler(logging.Handler):
    """把格式化后的 LogRecord 字符串扔给 callback。

    callback 抛异常不传播给业务代码——GUI 侧的 bug 不应让 logger 挂。
    """

    def __init__(self, callback: Callable[[str], None]) -> None:
        super().__init__()
        self.callback = callback

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
        except Exception:
            self.handleError(record)
            return
        try:
            self.callback(msg)
        except Exception:
            pass


_installed_handler: Optional[CallbackHandler] = None


def install(callback: Callable[[str], None], level: int = logging.INFO) -> CallbackHandler:
    """挂一个桥接 handler 到 root logger。重复调会先卸掉旧的。"""
    global _installed_handler
    if _installed_handler is not None:
        uninstall(_installed_handler)
    # logging 会先在 root logger 的级别过滤记录，再分发给 handler。GUI 可能运行在
    # 已经配置成 WARNING 的宿主进程里；显式放开到 bridge 所需级别，才能完整收到 CLI
    # 正常输出的 INFO/WARNING/ERROR。
    logging.getLogger().setLevel(level)
    handler = CallbackHandler(callback)
    handler.setLevel(level)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    logging.getLogger().addHandler(handler)
    _installed_handler = handler
    return handler


def uninstall(handler: CallbackHandler) -> None:
    """从 root logger 移除指定 handler。idempotent。"""
    global _installed_handler
    try:
        logging.getLogger().removeHandler(handler)
    except Exception:
        pass
    if _installed_handler is handler:
        _installed_handler = None
