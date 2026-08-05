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
const stillLucide = [];
const names = new Set();

for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  const re =
    /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](?:lucide-react|@\/shared\/icons)['"]/g;
  let m;
  while ((m = re.exec(t))) {
    m[1].split(",").forEach((s) => {
      const n = s.replace(/\s+as\s+\w+/, "").trim();
      if (n) names.add(n);
    });
  }
  if (/from ['"]lucide-react['"]/.test(t)) stillLucide.push(f);
}

console.log("STILL_LUCIDE", stillLucide.length);
stillLucide.forEach((f) => console.log(f));
console.log("---NAMES---");
console.log([...names].sort().join("\n"));
