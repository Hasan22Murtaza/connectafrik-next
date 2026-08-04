import fs from "fs";
import path from "path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      if (p.replace(/\\/g, "/").includes("shared/icons")) continue;
      walk(p, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = [...walk("app"), ...walk("features"), ...walk("shared")];
let count = 0;
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  if (!/from ['"]lucide-react['"]/.test(t)) continue;
  const next = t.replace(/from ['"]lucide-react['"]/g, "from '@/shared/icons'");
  if (next !== t) {
    fs.writeFileSync(f, next);
    count++;
    console.log("updated", f);
  }
}
console.log("Updated", count, "files");
