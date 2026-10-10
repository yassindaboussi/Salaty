"use strict";
/**
 * check-locales.js — every language must have the same translation keys and the same
 * {placeholders}, so a text can never show up untranslated or with a raw "{count}".
 * English (en) is the reference. Run by `npm run lint`.
 */

const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "../src/renderer/locales");
const REFERENCE = "en";

// "a.b.c" paths of every string in a JSON value, with the {placeholders} each one uses.
function flatten(value, prefix = "", out = {}) {
  if (typeof value === "string") {
    out[prefix] = [...value.matchAll(/\{(\w+)\}/g)]
      .map((m) => m[1])
      .sort()
      .join(",");
  } else if (Array.isArray(value)) {
    out[prefix] = `array(${value.length})`;
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value))
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

function jsonFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? jsonFiles(path.join(dir, e.name)).map((f) => path.join(e.name, f))
        : e.name.endsWith(".json")
          ? [e.name]
          : [],
    );
}

const languages = fs.readdirSync(LOCALES_DIR).filter((d) => d !== REFERENCE);
const problems = [];

for (const file of jsonFiles(path.join(LOCALES_DIR, REFERENCE))) {
  const read = (lang) => {
    const p = path.join(LOCALES_DIR, lang, file);
    return fs.existsSync(p)
      ? flatten(JSON.parse(fs.readFileSync(p, "utf8")))
      : null;
  };
  const ref = read(REFERENCE);
  for (const lang of languages) {
    const other = read(lang);
    if (!other) {
      problems.push(`${lang}/${file}: file missing`);
      continue;
    }
    for (const key of Object.keys(ref)) {
      if (!(key in other)) problems.push(`${lang}/${file}: missing "${key}"`);
      else if (!ref[key].startsWith("array") && other[key] !== ref[key])
        problems.push(
          `${lang}/${file}: "${key}" placeholders {${other[key]}} instead of {${ref[key]}}`,
        );
    }
    for (const key of Object.keys(other))
      if (!(key in ref))
        problems.push(`${lang}/${file}: "${key}" is not in ${REFERENCE}`);
  }
}

if (problems.length) {
  console.error(
    `[check-locales] ${problems.length} problem(s):\n  ${problems.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(
  `[check-locales] ${languages.length + 1} languages, all keys and placeholders match`,
);
