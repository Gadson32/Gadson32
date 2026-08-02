const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");
const rooms = require("./rooms");
const { translate } = require("./translate");

const PORT = process.env.PORT || 8787;
// Shared client secret so a stranger who finds the server URL can't burn
// through the Anthropic API key. Set CLIENT_API_KEY in production; a
// missing value only degrades to "open" for local dev, with a warning.
const CLIENT_API_KEY = process.env.CLIENT_API_KEY;

const app = express();
app.use(express.json({ limit: "16kb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function requireClientAuth(req, res, next) {
  if (!CLIENT_API_KEY) return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== CLIENT_API_KEY) return res.status(401).json({ error: "unauthorized" });
  next();
}

app.post("/api/translate", requireClientAuth, async (req, res) => {
  const { text, sourceLang, targetLang } = req.body || {};
  if (typeof text !== "string" || !text.trim() || text.length > 2000) {
    return res.status(400).json({ error: "invalid text" });
  }
  if (typeof sourceLang !== "string" || typeof targetLang !== "string") {
    return res.status(400).json({ error: "invalid language codes" });
  }

  try {
    const translation = await translate(text.trim(), sourceLang, targetLang);
    res.json({ translation });
  } catch (err) {
    console.error("translate error:", err.message);
    res.status(502).json({ error: "translation failed" });
  }
});

app.get("/healthz", (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => (socket.isAlive = true));

  socket.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return;
    }

    if (msg.type === "join" && typeof msg.room === "string") {
      const roomCode = msg.room.trim().toUpperCase().slice(0, 32);
      const result = rooms.join(roomCode, socket);
      if (!result.ok) {
        socket.send(JSON.stringify({ type: "join-error", reason: result.reason }));
      }
      return;
    }

    if (msg.type === "signal" && msg.kind) {
      rooms.broadcast(socket, { type: "signal", kind: msg.kind, data: msg.data });
      return;
    }

    if (msg.type === "caption" && msg.caption) {
      rooms.broadcast(socket, { type: "caption", caption: msg.caption });
      return;
    }
  });

  socket.on("close", () => rooms.leave(socket));
});

// Drop dead connections (e.g. a phone that lost network without a clean
// close) so rooms don't get stuck thinking a peer is still present.
const heartbeat = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (!socket.isAlive) return socket.terminate();
    socket.isAlive = false;
    socket.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(heartbeat));

server.listen(PORT, () => {
  if (!CLIENT_API_KEY) {
    console.warn("CLIENT_API_KEY not set — /api/translate is open to anyone who can reach this server.");
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY not set — translation requests will fail until it is configured.");
  }
  console.log(`Signaling + translation server listening on :${PORT}`);
});
