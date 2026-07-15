"""WebSocket manager — broadcasts real-time events to all connected dashboard clients."""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = {}  # room → sockets

    async def connect(self, ws: WebSocket, room: str = "global") -> None:
        await ws.accept()
        self._connections.setdefault(room, set()).add(ws)
        logger.info("WS connected to room '%s' (total: %d)", room, len(self._connections[room]))

    def disconnect(self, ws: WebSocket, room: str = "global") -> None:
        self._connections.get(room, set()).discard(ws)

    async def broadcast(self, message: dict, room: str = "global") -> None:
        data = json.dumps(message, default=str)
        dead = set()
        for ws in list(self._connections.get(room, set())):
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws, room)

    async def broadcast_all(self, message: dict) -> None:
        for room in list(self._connections.keys()):
            await self.broadcast(message, room)


manager = ConnectionManager()
