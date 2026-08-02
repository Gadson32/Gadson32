// Runtime config for the web client. Overridden at build time by
// injecting a different value here (or via a native-config plugin) per
// environment — dev points at localhost, prod points at the deployed
// signaling/translation server.
window.APP_CONFIG = {
  // Signaling + translation relay server (see /server). Must be wss:// in
  // production — plain ws:// only works for local dev.
  SERVER_URL: window.__SERVER_URL__ || "ws://localhost:8787",
  API_BASE_URL: window.__API_BASE_URL__ || "http://localhost:8787",
  // Must match the server's CLIENT_API_KEY in any deployment where that's
  // set. Left blank for local dev where the server runs open.
  CLIENT_API_KEY: window.__CLIENT_API_KEY__ || "",

  // STUN is enough for most NATs; a TURN server is required for calls
  // across restrictive NATs/firewalls (add credentials before shipping).
  ICE_SERVERS: [
    { urls: "stun:stun.l.google.com:19302" }
  ],

  // How long a caption line waits for a translation before it's marked
  // failed-but-queued instead of pending forever.
  TRANSLATION_TIMEOUT_MS: 8000
};
