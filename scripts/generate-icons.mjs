import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgDir = path.join(root, "shared/icons/svg");
const files = fs.readdirSync(svgDir).filter((f) => f.endsWith(".svg")).sort();

function toPascal(name) {
  const pascal = name
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  // Avoid clashing with the React namespace
  if (pascal === "React") return "ReactIcon";
  return pascal;
}

function extractInner(svg) {
  let inner = svg
    .replace(/<\?xml[^>]*>/g, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>/i, "")
    .trim();

  // Remove Tabler invisible background paths
  inner = inner.replace(/<path[^>]*stroke="none"[^>]*\/>/g, "");

  inner = inner
    .replace(/stroke-width=/g, "strokeWidth=")
    .replace(/stroke-linecap=/g, "strokeLinecap=")
    .replace(/stroke-linejoin=/g, "strokeLinejoin=")
    .replace(/fill-rule=/g, "fillRule=")
    .replace(/clip-rule=/g, "clipRule=")
    .replace(/class=/g, "className=")
    .replace(/\s+/g, " ")
    .trim();

  return inner;
}

const icons = [];
for (const file of files) {
  const base = file.replace(".svg", "");
  const name = toPascal(base);
  const raw = fs.readFileSync(path.join(svgDir, file), "utf8");
  const inner = extractInner(raw);
  icons.push({ base, name, inner });
}

let out = `/* Auto-generated from shared/icons/svg — do not edit by hand */
import { createIcon } from "./createIcon";

`;

for (const icon of icons) {
  const parts = icon.inner.match(/<[^>]+\/>|<[^>]+>[^<]*<\/[^>]+>/g) || [
    icon.inner,
  ];
  const children = parts.map((p) => `    ${p.trim()}`).join("\n");
  out += `export const ${icon.name} = createIcon(
  "${icon.name}",
  <>
${children}
  </>
);

`;
}

fs.writeFileSync(path.join(root, "shared/icons/generated.tsx"), out);
console.log(`Generated ${icons.length} icons`);
console.log(icons.map((i) => i.name).join(", "));
