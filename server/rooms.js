// In-memory room registry for WebRTC signaling + caption relay. This is
// the real sync layer that replaces `window.storage` (sandbox-only) so
// two actual devices can find each other and exchange offer/answer/ICE
// and caption events. A single process is enough for one deployment;
// scaling beyond one instance would need a shared pub/sub (Redis) instead
// of this Map.
const rooms = new Map(); // roomCode -> Set<WebSocket>

function join(roomCode, socket) {
  if (!rooms.has(roomCode)) rooms.set(roomCode, new Set());
  const peers = rooms.get(roomCode);

  if (peers.size >= 2) {
    return { ok: false, reason: "room-full" };
  }

  const hadPeer = peers.size === 1;
  peers.add(socket);
  socket.roomCode = roomCode;

  if (hadPeer) {
    for (const peer of peers) {
      if (peer !== socket) peer.send(JSON.stringify({ type: "peer-joined" }));
    }
  }

  return { ok: true };
}

function leave(socket) {
  const roomCode = socket.roomCode;
  if (!roomCode) return;
  const peers = rooms.get(roomCode);
  if (!peers) return;
  peers.delete(socket);
  for (const peer of peers) {
    peer.send(JSON.stringify({ type: "peer-left" }));
  }
  if (peers.size === 0) rooms.delete(roomCode);
}

function broadcast(socket, message) {
  const roomCode = socket.roomCode;
  if (!roomCode) return;
  const peers = rooms.get(roomCode);
  if (!peers) return;
  const payload = JSON.stringify(message);
  for (const peer of peers) {
    if (peer !== socket && peer.readyState === peer.OPEN) peer.send(payload);
  }
}

module.exports = { join, leave, broadcast };
