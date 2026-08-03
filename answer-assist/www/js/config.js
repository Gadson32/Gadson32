// Runtime config for the web client.
window.APP_CONFIG = {
  SUPABASE_URL: window.__SUPABASE_URL__ || "https://lufmsqbqxkubhvdsdpon.supabase.co",
  SUPABASE_ANON_KEY:
    window.__SUPABASE_ANON_KEY__ ||
    "sb_publishable_vrW4Cs7sa-qRq0kZRU_mSw_GesSJLzB",

  // Shared secret checked by every Edge Function via the x-app-secret
  // header, in addition to the anon key — see README. Set this to
  // whatever you set as the APP_SECRET Supabase secret; leave blank
  // during local dev if you haven't set one yet (functions treat a
  // missing/blank APP_SECRET as "no extra gate").
  APP_SECRET: window.__APP_SECRET__ || "",

  ANSWER_TIMEOUT_MS: 20000
};
