// Server-side translation client with an offline queue. Every caption
// line is persisted (via Capacitor Preferences, falling back to
// localStorage in-browser) the moment it's captured, then marked
// translated once the server responds — so a dropped connection mid-call
// loses no transcript data, only delays its translation.
window.TranslateQueue = (() => {
  const STORAGE_KEY = "translate_queue_v1";
  let onUpdateCb = null;
  let flushing = false;
  let online = true;

  async function storageGet() {
    if (window.Capacitor && window.Capacitor.Plugins.Preferences) {
      const { value } = await window.Capacitor.Plugins.Preferences.get({ key: STORAGE_KEY });
      return value ? JSON.parse(value) : [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  async function storageSet(items) {
    const raw = JSON.stringify(items);
    if (window.Capacitor && window.Capacitor.Plugins.Preferences) {
      await window.Capacitor.Plugins.Preferences.set({ key: STORAGE_KEY, value: raw });
    } else {
      localStorage.setItem(STORAGE_KEY, raw);
    }
  }

  async function enqueue(entry) {
    const items = await storageGet();
    items.push({ ...entry, status: "pending", attempts: 0, queuedAt: Date.now() });
    await storageSet(items);
    onUpdateCb && onUpdateCb(items);
    flush();
    return items[items.length - 1];
  }

  async function translateOne(item) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), window.APP_CONFIG.TRANSLATION_TIMEOUT_MS);
    try {
      // Calling the Edge Function directly via fetch (rather than
      // supabase-js's `functions.invoke`) keeps this module independent
      // of the Supabase client instance signaling-client.js owns.
      const res = await fetch(`${window.APP_CONFIG.SUPABASE_URL}/functions/v1/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
          apikey: window.APP_CONFIG.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          text: item.text,
          sourceLang: item.sourceLang,
          targetLang: item.targetLang
        }),
        signal: controller.signal
      });
      if (!res.ok) throw new Error(`translate failed: ${res.status}`);
      const data = await res.json();
      return data.translation;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function flush() {
    if (flushing || !online) return;
    flushing = true;
    try {
      let items = await storageGet();
      let changed = false;
      for (const item of items) {
        if (item.status === "done") continue;
        try {
          item.translation = await translateOne(item);
          item.status = "done";
          changed = true;
        } catch (err) {
          item.attempts += 1;
          item.status = item.attempts >= 5 ? "failed" : "pending";
          changed = true;
          // Stop this pass on the first failure — likely a dropped
          // connection, so retrying the rest immediately would just
          // burn through their attempt counts for nothing.
          break;
        }
        onUpdateCb && onUpdateCb(items);
      }
      // Drop entries that are done and older than 10 minutes to keep
      // the persisted queue from growing across long calls.
      const cutoff = Date.now() - 10 * 60 * 1000;
      items = items.filter((i) => i.status !== "done" || i.queuedAt > cutoff);
      if (changed) await storageSet(items);
      onUpdateCb && onUpdateCb(items);
    } finally {
      flushing = false;
    }
  }

  function setOnline(isOnline) {
    const wasOffline = !online;
    online = isOnline;
    if (isOnline && wasOffline) flush();
  }

  async function pendingCount() {
    const items = await storageGet();
    return items.filter((i) => i.status !== "done").length;
  }

  function onUpdate(cb) {
    onUpdateCb = cb;
  }

  return { enqueue, flush, setOnline, pendingCount, onUpdate };
})();
