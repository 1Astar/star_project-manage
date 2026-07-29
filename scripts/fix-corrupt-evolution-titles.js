const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    v = v.replace(/\\n/g, "\n").replace(/\\"/g, '"');
    o[k] = v;
  }
  return o;
}

const root = path.join(__dirname, "..");
const env = {
  ...loadEnv(path.join(root, ".env.local")),
  ...loadEnv(path.join(root, ".env.vercel.local")),
  ...loadEnv(path.join(root, ".env.production.local")),
};

let url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!url && anon) {
  try {
    const payload = JSON.parse(Buffer.from(anon.split(".")[1], "base64url").toString());
    if (payload.ref) url = `https://${payload.ref}.supabase.co`;
  } catch {
    /* ignore */
  }
}

console.log(
  JSON.stringify({
    hasUrl: Boolean(url),
    hasService: Boolean(key && key.length > 20),
    urlHost: url ? new URL(url).host : null,
  })
);

if (!url || !key) {
  console.error("Missing SUPABASE url/service key");
  process.exit(2);
}

function stripBulletDecor(text) {
  return text.replace(/^\*\*(.+?)\*\*[：:]?\s*/, "$1：").trim();
}

function parseChangelog(md) {
  const out = [];
  const parts = md.split(/^## /m).slice(1);
  for (const part of parts) {
    const lines = part.split(/\r?\n/);
    const head = lines[0] || "";
    const m = head.match(/^(v[\d.]+)\s*[·•]\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    for (const l of lines.slice(1)) {
      if (!l.trim().startsWith("- ")) continue;
      const bullet = l.replace(/^\s*-\s*/, "").trim();
      const clean = stripBulletDecor(bullet);
      const title = clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
      out.push({ tag: m[1], date: m[2], title, bullet });
    }
  }
  return out;
}

/** corrupted title matches candidate if non-? chars align and ? count ≈ chinese slots */
function scoreMatch(corrupt, candidate) {
  if (!corrupt.includes("?")) return -1;
  // Prefer candidates that share ASCII fingerprints
  const ascii = corrupt.replace(/[^A-Za-z0-9_.:()+\-\/·\s]/g, "");
  const candAscii = candidate.replace(/[^A-Za-z0-9_.:()+\-\/·\s]/g, "");
  if (ascii.replace(/\s+/g, "") && !candAscii.replace(/\s+/g, "").includes(ascii.replace(/\s+/g, "").slice(0, 12)) && ascii.length > 8) {
    // require ascii fingerprint when substantial
    if (!candidate.includes("studio_app_settings") && corrupt.includes("studio_app_settings")) return -1;
    if (corrupt.includes("studio_app_settings") && candidate.includes("studio_app_settings")) {
      /* ok */
    } else if (ascii.length > 10 && !candAscii.includes(ascii.slice(0, 8))) {
      return -1;
    }
  }

  // Build regex: ? → \S, keep literals
  let reSrc = "";
  for (const ch of corrupt) {
    if (ch === "?") reSrc += "\\S";
    else reSrc += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const re = new RegExp(`^${reSrc}`);
  if (!re.test(candidate) && candidate.length !== corrupt.length) {
    // length-based: same length and fixed positions match
    if (candidate.length !== corrupt.length) {
      // try prefix title before truncation
      if (!re.test(candidate) && !candidate.startsWith(corrupt.replace(/\?/g, "").slice(0, 0))) {
        // soft: count matching fixed chars
        let fixed = 0;
        let need = 0;
        const n = Math.min(corrupt.length, candidate.length);
        for (let i = 0; i < n; i++) {
          if (corrupt[i] === "?") continue;
          need++;
          if (corrupt[i] === candidate[i]) fixed++;
        }
        if (need === 0) return -1;
        if (fixed / need < 0.85) return -1;
        if (Math.abs(candidate.length - corrupt.length) > 8) return -1;
        return fixed * 10 - Math.abs(candidate.length - corrupt.length);
      }
    }
  }
  if (re.test(candidate) || (candidate.length === corrupt.length && [...corrupt].every((c, i) => c === "?" || c === candidate[i]))) {
    return 1000 - Math.abs(candidate.length - corrupt.length);
  }
  // special studio_app_settings
  if (corrupt.includes("studio_app_settings") && candidate.includes("studio_app_settings")) {
    return 500;
  }
  return -1;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from("studio_evolution_logs")
    .select("id,title,project_id,module,release_tag,created_at,after_text,reason")
    .eq("project_id", "proj-star-pm")
    .like("title", "%?%")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  // column might be `after` not after_text - check
  let rows = data || [];
  if (!rows.length) {
    const retry = await sb
      .from("studio_evolution_logs")
      .select("*")
      .eq("project_id", "proj-star-pm")
      .order("created_at", { ascending: false })
      .limit(200);
    if (retry.error) throw retry.error;
    rows = (retry.data || []).filter((r) => String(r.title || "").includes("?"));
  }

  const changelog = parseChangelog(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"));
  console.log(`corrupted=${rows.length} changelogBullets=${changelog.length}`);

  const updates = [];
  for (const row of rows) {
    let best = null;
    let bestScore = -1;
    for (const c of changelog) {
      const s = scoreMatch(row.title, c.title);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    updates.push({
      id: row.id,
      old: row.title,
      newTitle: bestScore >= 0 ? best.title : null,
      tag: best?.tag ?? null,
      score: bestScore,
    });
  }

  console.log(JSON.stringify(updates, null, 2));

  if (dry) return;

  for (const u of updates) {
    if (!u.newTitle) {
      console.log("SKIP", u.id, u.old);
      continue;
    }
    const { error: upErr } = await sb
      .from("studio_evolution_logs")
      .update({ title: u.newTitle, release_tag: u.tag })
      .eq("id", u.id);
    if (upErr) console.error("FAIL", u.id, upErr.message);
    else console.log("OK", u.id, "→", u.newTitle.slice(0, 60));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
