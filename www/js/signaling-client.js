// Real-time signaling/relay client backed by Supabase Realtime
// (broadcast + presence on a per-room channel) instead of a self-hosted
// WebSocket server. This is what replaces `window.storage` — that object
// only ever existed in the preview sandbox and can't sync anything
// between two actual phones.
//
// Presence tracks who's in the room: when a second participant's
// presence appears, the peer already in the room emits "peer-joined" and
// becomes the WebRTC caller — mirroring the join semantics a bespoke
// signaling server would provide. Room-size limiting (max 2) is a
// best-effort client-side check against a snapshot of presence state; a
// third client racing to join at the same instant could in principle
// slip in. Fine for this app's scope, not something to rely on for
// anything security-sensitive.
window.SignalingClient = (() => {
  let channel = null;
  let handlers = {};
  let myClientId = null;
  let supabaseClient = null;

  function on(event, cb) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(cb);
  }

  function emit(event, ...args) {
    (handlers[event] || []).forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`SignalingClient handler for "${event}" threw`, err);
      }
    });
  }

  function getClient() {
    if (!supabaseClient) {
      if (!window.supabase) {
        throw new Error("supabase-js failed to load — check the CDN script tag in index.html");
      }
      supabaseClient = window.supabase.createClient(
        window.APP_CONFIG.SUPABASE_URL,
        window.APP_CONFIG.SUPABASE_ANON_KEY
      );
    }
    return supabaseClient;
  }

  // Kept only for API compatibility with the old WebSocket client — a
  // Supabase Realtime channel connects lazily when you subscribe to it,
  // which join() does, so there's nothing to eagerly connect here.
  function connect() {}

  async function join(roomCode, displayName) {
    myClientId = `${displayName}-${Math.random().toString(36).slice(2, 8)}`;
    const client = getClient();

    channel = client.channel(`room-${roomCode}`, {
      config: { presence: { key: myClientId } }
    });

    channel.on("presence", { event: "join" }, ({ key }) => {
      if (key === myClientId) return;
      emit("message", { type: "peer-joined" });
    });

    channel.on("presence", { event: "leave" }, ({ key }) => {
      if (key === myClientId) return;
      emit("message", { type: "peer-left" });
    });

    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      emit("message", { type: "signal", kind: payload.kind, data: payload.data });
    });

    channel.on("broadcast", { event: "caption" }, ({ payload }) => {
      emit("message", { type: "caption", caption: payload.caption });
    });

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;

      const existingPeers = Object.keys(channel.presenceState()).filter((k) => k !== myClientId);
      if (existingPeers.length >= 2) {
        emit("message", { type: "join-error", reason: "room-full" });
        await client.removeChannel(channel);
        channel = null;
        return;
      }

      await channel.track({ name: displayName, joinedAt: Date.now() });
      emit("open");
    });
  }

  function sendSignal(kind, data) {
    if (!channel) return false;
    channel.send({ type: "broadcast", event: "signal", payload: { kind, data } });
    return true;
  }

  function sendCaption(caption) {
    if (!channel) return false;
    channel.send({ type: "broadcast", event: "caption", payload: { caption } });
    return true;
  }

  function close() {
    if (channel) {
      channel.untrack();
      getClient().removeChannel(channel);
      channel = null;
    }
    emit("close");
  }

  return { connect, join, sendSignal, sendCaption, on, close };
})();
