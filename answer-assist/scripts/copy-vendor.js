// Copies vendored browser libraries into www/js/vendor so the app
// bundles them locally instead of fetching from a CDN at runtime.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const destDir = path.join(root, "www", "js", "vendor");
fs.mkdirSync(destDir, { recursive: true });

const files = [
  [path.join(root, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"), "supabase.js"],
  [path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.min.js"), "pdf.min.js"],
  [path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.js"), "pdf.worker.min.js"]
];

for (const [src, name] of files) {
  const dest = path.join(destDir, name);
  fs.copyFileSync(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
}
