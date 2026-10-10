"use strict";
/**
 * check-csp.js: every HTML page must carry the app's Content-Security-Policy, the same one
 * on every page, as the first tag after <meta charset>. Run by `npm run lint`;
 * `node scripts/check-csp.js --fix` writes it into the pages.
 *
 * Why a <meta> tag: the pages are local files (file://), so there are no response headers
 * to set it in. A meta CSP ignores frame-ancestors, report-uri and sandbox, so none are
 * used here (https://developer.mozilla.org/docs/Web/HTTP/Guides/CSP).
 *
 * To allow a new site, add it to the matching list below and run with --fix.
 */

const fs = require("fs");
const path = require("path");

const PAGES_DIR = path.join(__dirname, "../src/renderer/pages");

const POLICY = {
  "default-src": ["'none'"],
  // only our own bundles: no inline <script>, no eval, no onclick="" attributes
  "script-src": ["'self'"],
  "style-src": ["'self'", "https://fonts.googleapis.com"],
  // style="" attributes in the markup and in JS templates
  "style-src-attr": ["'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https://*.tile.openstreetmap.org"],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
  "connect-src": [
    "'self'", // ../../locales/*.json, ../../data/*.json
    "https://api.aladhan.com",
    "https://api.alquran.cloud",
    "https://mp3quran.net",
    "https://www.mp3quran.net", // mp3quran.net/api redirects here
    "https://countriesnow.space",
    "https://photon.komoot.io", // Qibla: city -> coordinates
    "https://ipapi.co", // Qibla: last-resort location guess
  ],
  // Quran recitations and radio streams come from many hosts, but always over HTTPS
  "media-src": ["'self'", "https:", "blob:"],
  "frame-src": ["https://makkahlive.netlify.app"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
};

const POLICY_TEXT = Object.entries(POLICY)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

// written the way Prettier formats a tag this long, so `npm run format` leaves it alone
const meta = (indent, eol) =>
  [
    `${indent}<meta`,
    `${indent}  http-equiv="Content-Security-Policy"`,
    `${indent}  content="${POLICY_TEXT}"`,
    `${indent}/>`,
  ].join(eol) + eol;
const META_RE =
  /^[ \t]*<meta\s+http-equiv="Content-Security-Policy"[^>]*>\r?\n/im;
const CHARSET_RE = /^([ \t]*)<meta charset="UTF-8" \/>(\r?\n)/im;

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(full);
    return e.name.endsWith(".html") ? [full] : [];
  });
}

const fix = process.argv.includes("--fix");
const problems = [];

for (const file of htmlFiles(PAGES_DIR)) {
  const rel = path.relative(process.cwd(), file);
  const html = fs.readFileSync(file, "utf8");
  const withoutMeta = html.replace(META_RE, "");
  const charset = withoutMeta.match(CHARSET_RE);
  if (!charset) {
    problems.push(`${rel}: no <meta charset="UTF-8" /> to put the CSP after`);
    continue;
  }
  const [, indent, eol] = charset;
  const expected = withoutMeta.replace(
    CHARSET_RE,
    (line) => line + meta(indent, eol),
  );
  if (html === expected) continue;
  if (fix) {
    fs.writeFileSync(file, expected);
    console.log(`updated ${rel}`);
  } else {
    problems.push(`${rel}: missing or outdated Content-Security-Policy`);
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(
    `\n${problems.length} page(s) without the app's CSP; run: node scripts/check-csp.js --fix`,
  );
  process.exit(1);
}
if (!fix) console.log("CSP: every page has the app's policy.");
