// Runtime config for the web client.
window.APP_CONFIG = {
  // Supabase project used for both signaling (Realtime channels) and
  // translation (the `translate` Edge Function). The anon/publishable
  // key is designed to be embedded in clients — it is not a secret, it's
  // scoped by the project's RLS policies and the function's own auth.
  SUPABASE_URL: window.__SUPABASE_URL__ || "https://lufmsqbqxkubhvdsdpon.supabase.co",
  SUPABASE_ANON_KEY:
    window.__SUPABASE_ANON_KEY__ ||
    "sb_publishable_vrW4Cs7sa-qRq0kZRU_mSw_GesSJLzB",

  // STUN is enough for most NATs; a TURN server is required for calls
  // across restrictive NATs/firewalls (add credentials before shipping —
  // see README "Known gaps").
  ICE_SERVERS: [
    { urls: "stun:stun.l.google.com:19302" }
  ],

  // How long a caption line waits for a translation before it's marked
  // failed-but-queued instead of pending forever.
  TRANSLATION_TIMEOUT_MS: 8000
};
