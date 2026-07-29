const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, ".env.prod.pull");
try {
  execSync("vercel env pull .env.prod.pull --environment=production --yes", {
    cwd: root,
    stdio: "inherit",
  });
} catch (e) {
  console.error("vercel env pull failed", e.message);
}

function loadEnv(file) {
  const o = {};
  if (!fs.existsSync(file)) return o;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    // Vercel: KEY="value" or KEY=\"value\"
    v = v.replace(/^\\"/, '"').replace(/\\"$/, '"');
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[k] = v;
  }
  return o;
}

const env = loadEnv(out);
for (const k of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  const v = env[k] || "";
  console.log(`${k} len=${v.length}`);
}
