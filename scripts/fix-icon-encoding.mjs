import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const targets = [
  "features/video/providers/livekit/MeetingContainer.tsx",
  "features/video/providers/videosdk/MeetingContainer.tsx",
];

execSync(
  `git checkout -- ${targets.map((t) => `"${t}"`).join(" ")}`,
  { stdio: "inherit", shell: true }
);

for (const f of targets) {
  let t = fs.readFileSync(f, "utf8");
  t = t.replace(/from ['"]lucide-react['"]/g, "from '@/shared/icons'");
  fs.writeFileSync(f, t, "utf8");
  console.log("fixed", f);
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (["node_modules", ".next", "svg"].includes(e.name)) continue;
      if (p.replace(/\\/g, "/").endsWith("shared/icons")) {
        // still scan ts/tsx in icons? skip generated noise
        walk(p, acc);
        continue;
      }
      walk(p, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) {
      if (p.replace(/\\/g, "/").includes("shared/icons/")) continue;
      acc.push(p);
    }
  }
  return acc;
}

const files = [...walk("app"), ...walk("features"), ...walk("shared")];
const bad = [];
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  if (t.includes("\uFFFD")) bad.push(f);
}
console.log("corrupted count", bad.length);
bad.forEach((f) => console.log(f));
