import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedData } from "../lib/db/seed-data.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data");
const outFile = path.join(outDir, "db.seed.json");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(createSeedData(), null, 2), "utf8");
console.log("Wrote", outFile);
