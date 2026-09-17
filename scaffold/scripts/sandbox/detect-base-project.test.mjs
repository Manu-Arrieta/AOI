import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import {
  classifyRoots,
  detectFromDisk,
  expandWorkspaceGlob,
  parsePnpmWorkspacePackages,
} from "./detect-base-project.mjs";

// The trees accumulate and are removed once, at the end: the builder is called
// inline and there is no per-test variable to clean up in.
const temporales = [];
after(() => {
  for (const dir of temporales) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * Builds a throwaway tree with AOI's own shape: a root pnpm workspace that
 * declares `aoi_apps/*`, and the packages that live inside it.
 *
 * The two tests below used to run against the real repository instead, and that
 * was wrong in both directions at once.
 *
 * They FAILED wherever AOI is installed. A `core` or `advanced` install drops
 * the whole `aoi_apps` tree (`profileExcludesRelativePath`), and the root
 * `pnpm-workspace.yaml` is deliberately never shipped — it is absent from
 * `DEFAULT_SYNC_PATHS` and from `scaffold/` because a previous version DID ship
 * and replaced a real monorepo's workspace manifest with AOI's. Both exclusions
 * are correct decisions; the tests simply never learned about them, and asserted
 * on artifacts the installation intentionally lacks.
 *
 * And the `detectFromDisk` case PROVED NOTHING where it did pass. The root
 * manifest declares `packages: []`, so detection falls back to `apps/*` and
 * `packages/*`, neither of which exists here — the walk never reaches
 * `aoi_apps`, and the exclusion the test is named after is never executed. It
 * was green because nothing was found, not because anything was excluded.
 *
 * Built here, the tree declares `aoi_apps/*` and puts a Nuxt package inside it,
 * so the dashboard WOULD be classified as a frontend root if `isAoiInternal`
 * stopped working. The assertion can now fail, which is the only thing that
 * makes it an assertion.
 */
function aoiShapedTree({ workspaceGlobs = ["aoi_apps/*"], packages = {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aoi-base-project-"));
  temporales.push(root);

  const declared = workspaceGlobs.map((glob) => `  - "${glob}"\n`).join("");
  fs.writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    `packages:\n${declared}`,
  );

  for (const [dir, packageJson] of Object.entries(packages)) {
    const full = path.join(root, dir);
    fs.mkdirSync(full, { recursive: true });
    fs.writeFileSync(
      path.join(full, "package.json"),
      `${JSON.stringify(packageJson, null, 2)}\n`,
    );
  }

  return root;
}

test("frontend-only workspace classifies the app as a frontend root", () => {
  const roots = classifyRoots({
    pnpmWorkspace: "packages:\n  - apps/*\n",
    packageJsons: [
      {
        dir: "apps/web",
        packageJson: { dependencies: { nuxt: "4.0.0", vue: "3.5.0" } },
        hasServerDir: false,
      },
    ],
  });

  assert.deepEqual(roots, {
    frontend: ["apps/web"],
    backend: [],
    sharedLibs: [],
  });
});

test("frontend app with a server/ dir plus a standalone backend package", () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: "apps/dashboard",
        packageJson: { dependencies: { nuxt: "4.0.0" } },
        hasServerDir: true,
      },
      {
        dir: "apps/api",
        packageJson: { dependencies: { express: "4.19.0" } },
        hasServerDir: false,
      },
    ],
  });

  assert.deepEqual(roots, {
    frontend: ["apps/dashboard"],
    backend: ["apps/api", "apps/dashboard/server"],
    sharedLibs: [],
  });
});

test("packages/* without an app entry are classified as sharedLibs", () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: "apps/web",
        packageJson: { dependencies: { react: "19.0.0" } },
        hasServerDir: false,
      },
      {
        dir: "packages/ui-kit",
        packageJson: { dependencies: { lodash: "4.17.21" } },
        hasServerDir: false,
      },
      {
        dir: "packages/utils",
        packageJson: {},
        hasServerDir: false,
      },
    ],
  });

  assert.deepEqual(roots, {
    frontend: ["apps/web"],
    backend: [],
    sharedLibs: ["packages/ui-kit", "packages/utils"],
  });
});

test("@nestjs scoped deps classify a package as backend", () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: "services/auth",
        packageJson: {
          dependencies: {
            "@nestjs/core": "10.0.0",
            "@nestjs/common": "10.0.0",
          },
        },
        hasServerDir: false,
      },
    ],
  });

  assert.deepEqual(roots, {
    frontend: [],
    backend: ["services/auth"],
    sharedLibs: [],
  });
});

test("ambiguous package under apps/ falls back to frontend", () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: "apps/marketing",
        packageJson: { dependencies: { "some-unknown-lib": "1.0.0" } },
        hasServerDir: false,
      },
    ],
  });

  assert.deepEqual(roots, {
    frontend: ["apps/marketing"],
    backend: [],
    sharedLibs: [],
  });
});

test("AOI's own aoi_apps packages are excluded from base-project roots", () => {
  const roots = classifyRoots({
    packageJsons: [
      {
        dir: "aoi_apps/agentic-ops-dashboard",
        packageJson: { dependencies: { nuxt: "4.0.0", vue: "3.5.0" } },
        hasServerDir: true,
      },
      {
        dir: "apps/web",
        packageJson: { dependencies: { nuxt: "4.0.0" } },
        hasServerDir: false,
      },
    ],
  });

  assert.deepEqual(roots, {
    frontend: ["apps/web"],
    backend: [],
    sharedLibs: [],
  });
});

test("parsePnpmWorkspacePackages reads the packages list and skips exclusions", () => {
  const globs = parsePnpmWorkspacePackages(
    [
      "# AOI workspace",
      "packages:",
      "  - apps/*",
      "  - 'packages/*'",
      '  - "!**/test/**"',
      "allowBuilds:",
      "  esbuild: true",
    ].join("\n"),
  );

  assert.deepEqual(globs, ["apps/*", "packages/*"]);
});

test("expandWorkspaceGlob resolves aoi_apps/* to the packages inside it", () => {
  const root = aoiShapedTree({
    packages: {
      "aoi_apps/agentic-ops-dashboard": { name: "agentic-ops-dashboard" },
    },
  });

  assert.deepEqual(expandWorkspaceGlob("aoi_apps/*", root), [
    "aoi_apps/agentic-ops-dashboard",
  ]);
});

test("detectFromDisk excludes AOI's own aoi_apps from base-project roots", () => {
  // Declared in the workspace AND present on disk, so detection really walks
  // into it. Without `isAoiInternal` these dependencies classify it as a
  // frontend root, which is exactly the regression this guards.
  const root = aoiShapedTree({
    packages: {
      "aoi_apps/agentic-ops-dashboard": {
        dependencies: { nuxt: "4.0.0", vue: "3.5.0" },
      },
    },
  });

  const proposal = detectFromDisk(root);

  assert.equal(proposal.$schemaVersion, 1);
  assert.equal(proposal.baseRoot, ".");
  assert.equal(proposal.confirmedBy, null);
  assert.equal(proposal.workspaceManager, "pnpm");

  assert.deepEqual(proposal.roots.frontend, []);
  assert.deepEqual(proposal.roots.backend, []);
  assert.deepEqual(proposal.roots.sharedLibs, []);
});

test("a package outside aoi_apps is still proposed, so the exclusion is narrow", () => {
  const root = aoiShapedTree({
    workspaceGlobs: ["aoi_apps/*", "apps/*"],
    packages: {
      "aoi_apps/agentic-ops-dashboard": { dependencies: { nuxt: "4.0.0" } },
      "apps/web": { dependencies: { nuxt: "4.0.0" } },
    },
  });

  const proposal = detectFromDisk(root);

  assert.deepEqual(proposal.roots.frontend, ["apps/web"]);
});
