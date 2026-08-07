import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

const packages = [
  "storage",
  "storage-react",
  "storage-postgres-pg",
  "storage-postgres-neon",
  "storage-postgres-hyperdrive",
  "storage-conformance",
] as const;

const expectedEntrypoints = {
  storage: [
    ".",
    "./browser",
    "./browser/effect",
    "./server",
    "./server/effect",
    "./s3",
    "./s3/effect",
    "./persistence/effect",
    "./package.json",
  ],
  "storage-react": [".", "./package.json"],
  "storage-postgres-pg": [".", "./migrations", "./package.json"],
  "storage-postgres-neon": [".", "./package.json"],
  "storage-postgres-hyperdrive": [".", "./package.json"],
  "storage-conformance": [".", "./storage/v1", "./persistence/v1", "./package.json"],
} as const;

test.each(packages)("%s exposes importable built entrypoints", async (packageName) => {
  const packageRoot = resolve(root, "packages", packageName);
  const manifest = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
    exports: Record<string, string>;
  };

  for (const entrypoint of Object.keys(manifest.exports)) {
    if (entrypoint === "./package.json") continue;

    const specifier = `@hvn-oss/${packageName}${entrypoint === "." ? "" : entrypoint.slice(1)}`;
    const fixture = await mkdtemp(join(tmpdir(), "hvn-storage-"));

    try {
      const packageDirectory = join(fixture, "node_modules", "@hvn-oss");
      await mkdir(packageDirectory, { recursive: true });
      await symlink(packageRoot, join(packageDirectory, packageName), "dir");
      const importer = join(fixture, "import.mjs");
      await writeFile(importer, `import ${JSON.stringify(specifier)};\n`);
      await execFileAsync(process.execPath, [importer]);
    } finally {
      await rm(fixture, { force: true, recursive: true });
    }
  }

  expect(Object.keys(manifest.exports).sort()).toEqual(
    [...expectedEntrypoints[packageName]].sort(),
  );
});
