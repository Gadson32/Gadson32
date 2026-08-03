// Copies the supabase-js UMD build into www/js/vendor so the Capacitor
// app bundles it locally instead of fetching it from a CDN at runtime —
// keeps the app usable offline and avoids depending on a third-party
// host being reachable from the WebView.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js");
const destDir = path.join(__dirname, "..", "www", "js", "vendor");
const dest = path.join(destDir, "supabase.js");

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);
