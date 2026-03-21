import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket(url, onMessage) {
  const wsRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const timerRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen    = () => { setIsConnected(true); clearTimeout(timerRef.current); };
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch(_){} };
    ws.onclose   = () => { setIsConnected(false); timerRef.current = setTimeout(connect, 2500); };
    ws.onerror   = () => ws.close();
  }, [url, onMessage]);

  useEffect(() => {
    connect();
    return () => { clearTimeout(timerRef.current); wsRef.current?.close(); };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(data);
  }, []);

  return { isConnected, send };
}
