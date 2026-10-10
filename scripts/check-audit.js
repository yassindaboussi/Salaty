"use strict";
/**
 * check-audit.js: fails when `npm audit` reports a moderate (or worse) advisory that is not
 * on the accepted list below. Run in CI (`npm run audit`); needs the network.
 *
 * All packages are checked, dev ones too: Electron is a devDependency (electron-builder
 * requires that) but its runtime ships inside the installer.
 *
 * Accept an advisory only when it has no fix and cannot be reached in our use, and say why.
 * The script tells you when an accepted advisory is no longer reported, so it can be removed.
 */

const { execSync } = require("child_process");

const ACCEPTED = {
  // braces <=3.0.3, no patched version exists. Only used by stylelint (via micromatch /
  // fast-glob) to expand our own glob "src/renderer/css/**/*.css"; never ships in the app
  // and never sees outside input. npm's suggested "fix" is a downgrade to stylelint 7 (2017).
  "GHSA-vfj7-8cjw-p6xm": "braces: dev-only, our own glob patterns",
};

const BLOCKING = new Set(["moderate", "high", "critical"]);

let report;
try {
  report = execSync("npm audit --json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
} catch (err) {
  // npm audit exits with 1 when it finds anything; the JSON is still on stdout
  report = err.stdout;
}

let data;
try {
  data = JSON.parse(report);
} catch {
  console.error("check-audit: could not read the npm audit report");
  process.exit(1);
}
if (data.error) {
  console.error(
    "check-audit: npm audit failed:",
    data.error.summary ?? data.error,
  );
  process.exit(1);
}

// advisory id -> { severity, title, packages }
const advisories = new Map();
for (const [pkg, vuln] of Object.entries(data.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === "string") continue; // "depends on a vulnerable package"
    const id = via.url?.split("/").pop() ?? String(via.source);
    const entry = advisories.get(id) ?? {
      severity: via.severity,
      title: via.title,
      packages: new Set(),
    };
    entry.packages.add(pkg);
    advisories.set(id, entry);
  }
}

const blocking = [...advisories].filter(
  ([id, a]) => BLOCKING.has(a.severity) && !Object.hasOwn(ACCEPTED, id),
);
const stale = Object.keys(ACCEPTED).filter((id) => !advisories.has(id));

for (const id of stale)
  console.warn(
    `check-audit: ${id} is no longer reported; remove it from ACCEPTED`,
  );

if (blocking.length) {
  for (const [id, a] of blocking)
    console.error(
      `${a.severity.padEnd(8)} ${id}  ${[...a.packages].join(", ")}: ${a.title}`,
    );
  console.error(
    `\ncheck-audit: ${blocking.length} advisory(ies) to fix (try \`npm audit fix\`, never --force blindly)`,
  );
  process.exit(1);
}

const accepted = [...advisories.keys()].filter((id) =>
  Object.hasOwn(ACCEPTED, id),
);
console.log(
  `check-audit: no unaccepted advisories (${accepted.length} accepted: ${accepted.join(", ") || "none"})`,
);
