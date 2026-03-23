export function getWsBase() {
  const env = process.env.REACT_APP_WS_BASE;
  if (env) return env.replace(/\/$/, '');
  const { protocol, hostname } = window.location;
  if (protocol === 'https:') return `wss://${hostname}`;
  return `ws://${hostname}:8000`;
}
