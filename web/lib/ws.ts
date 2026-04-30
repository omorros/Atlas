"use client";

import { useEffect, useRef } from "react";

type Handlers = Record<string, (payload: any) => void>;

export function useWS(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/events/stream";
    let ws: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(url);
        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data);
            const h = handlersRef.current[msg.type];
            if (h) {
              // Pull whichever payload key the event used
              const payload = msg.counterparty || msg.transaction || msg.risk_event || msg.brief || msg.metrics || msg;
              h(payload);
            }
          } catch (e) { /* swallow */ }
        };
        ws.onclose = () => {
          if (!closed) reconnectTimer = setTimeout(connect, 2000);
        };
        ws.onerror = () => ws?.close();
      } catch {
        reconnectTimer = setTimeout(connect, 2000);
      }
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}
