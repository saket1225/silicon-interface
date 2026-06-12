// Assembles the Next.js standalone output into a self-contained, symlink-free
// bundle for the Electron app at .next/standalone-desktop.
//
// Two transformations on top of `next build`:
//  1. public/ and .next/static are copied in so server.js serves them (per
//     node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md).
//  2. pnpm's symlinked node_modules layout is flattened into a plain
//     npm-style tree — symlinks don't survive Windows zips/installers, and
//     electron-builder skips a fileset's root node_modules anyway.
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const staging = path.join(root, ".next", "standalone-desktop");

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("desktop/assemble.mjs: no .next/standalone/server.js — run the standalone build first.");
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });

// Everything except node_modules verbatim.
cpSync(standalone, staging, {
  recursive: true,
  filter: (src) => src !== path.join(standalone, "node_modules"),
});

// Flatten node_modules: every real package dir inside .pnpm/<id>/node_modules
// moves to the top level. The standalone trace of this app has one version of
// everything (a collision aborts the build), so flat resolution is sound.
const pnpmDir = path.join(standalone, "node_modules", ".pnpm");
const outModules = path.join(staging, "node_modules");
mkdirSync(outModules, { recursive: true });
const seen = new Map();
for (const id of readdirSync(pnpmDir)) {
  if (id === "node_modules") continue; // pnpm's internal fallback links
  const modulesDir = path.join(pnpmDir, id, "node_modules");
  for (const entry of readdirSync(modulesDir)) {
    const entryPath = path.join(modulesDir, entry);
    // Scoped packages live one level deeper (@scope/name).
    const pkgs = entry.startsWith("@")
      ? readdirSync(entryPath).map((name) => [`${entry}/${name}`, path.join(entryPath, name)])
      : [[entry, entryPath]];
    for (const [name, dir] of pkgs) {
      if (lstatSync(dir).isSymbolicLink()) continue; // link to a sibling dep, not the package itself
      const previous = seen.get(name);
      if (previous) {
        console.error(`desktop/assemble.mjs: ${name} exists in both ${previous} and ${id} — can't flatten.`);
        process.exit(1);
      }
      seen.set(name, id);
      cpSync(dir, path.join(outModules, name), { recursive: true });
    }
  }
}

for (const [from, to] of [
  [path.join(root, "public"), path.join(staging, "public")],
  [path.join(root, ".next", "static"), path.join(staging, ".next", "static")],
]) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

console.log(`assembled ${path.relative(root, staging)} (${seen.size} packages flattened)`);
