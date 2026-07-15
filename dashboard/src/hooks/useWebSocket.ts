"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { WSMessage } from "@/types";

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const url = `${process.env.NEXT_PUBLIC_WS_URL}/ws/global`;
    const ws = new WebSocket(url);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000); // reconnect
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data) as WSMessage);
      } catch {}
    };
    wsRef.current = ws;
  }, [onMessage]);

  useEffect(() => {
    connect();
    const ping = setInterval(() => {
      wsRef.current?.readyState === WebSocket.OPEN && wsRef.current.send("ping");
    }, 25000);
    return () => {
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [connect]);

  return connected;
}
