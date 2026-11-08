import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public"), { recursive: true });
copyFileSync(join(root, "content", "live.json"), join(root, "public", "live.json"));

// Keep public/app-version.json in sync with content/app-download.ts for the website fallback.
const packageVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const manifest = {
  version: packageVersion,
  apk: "https://github.com/makaiopluto-maker/stella-now/releases/download/apk-latest/StellaNow.apk",
  releases: "https://github.com/makaiopluto-maker/stella-now/releases/tag/apk-latest",
};
writeFileSync(join(root, "public", "app-version.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(root, "content", "app-version.json"), `${JSON.stringify(manifest, null, 2)}\n`);
