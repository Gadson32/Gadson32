// Thin WebSocket client for the real-time signaling/relay server in
// /server. This is what replaces `window.storage` — that object only
// ever existed in the preview sandbox and can't sync anything between
// two actual phones. Handles auto-reconnect with backoff so a brief
// network blip during a call doesn't kill the session.
window.SignalingClient = (() => {
  let ws = null;
  let handlers = {};
  let reconnectAttempts = 0;
  let manualClose = false;
  let joinInfo = null;

  function connect() {
    manualClose = false;
    ws = new WebSocket(window.APP_CONFIG.SERVER_URL);

    ws.onopen = () => {
      reconnectAttempts = 0;
      handlers.open && handlers.open();
      if (joinInfo) send({ type: "join", ...joinInfo });
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      handlers.message && handlers.message(msg);
    };

    ws.onclose = () => {
      handlers.close && handlers.close();
      if (!manualClose) scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose fires right after; reconnect logic lives there.
    };
  }

  function scheduleReconnect() {
    reconnectAttempts += 1;
    const delay = Math.min(1000 * 2 ** reconnectAttempts, 15000);
    setTimeout(connect, delay);
  }

  function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  function join(roomCode, displayName) {
    joinInfo = { room: roomCode, name: displayName };
    if (!send({ type: "join", ...joinInfo })) connect();
  }

  function sendSignal(kind, data) {
    send({ type: "signal", kind, data });
  }

  function sendCaption(caption) {
    send({ type: "caption", caption });
  }

  function on(event, cb) {
    handlers[event] = cb;
  }

  function close() {
    manualClose = true;
    joinInfo = null;
    if (ws) ws.close();
  }

  return { connect, join, sendSignal, sendCaption, on, close };
})();
