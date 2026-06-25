import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.resolve(
  root,
  "../工具/pinMark-master原型标注/pinMark-master/pinmark.html"
);
const dstDir = path.join(root, "public/pinmark");
const dst = path.join(dstDir, "pinmark.html");

fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, dst);
console.log("copied", fs.statSync(dst).size, "bytes to", dst);
