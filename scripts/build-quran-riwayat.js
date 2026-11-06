"use strict";

// Builds the bundled Qalun and Warsh Quran text from the King Fahd Glorious Quran Printing
// Complex data (https://qurancomplex.gov.sa/en/techquran/dev/, mirrored at
// https://github.com/thetruetruth/quran-data-kfgqpc: qaloon/data/QaloonData_v10.json and
// warsh/data/warshData_v10.json).
//
//   node scripts/build-quran-riwayat.js <QaloonData_v10.json> <warshData_v10.json>
//
// Writes src/renderer/data/quran-qalun.json and quran-warsh.json ({ bismillah, surahs: string[][] }:
// the ayahs of each surah, without the number at their end) and quran-madani-index.json (the
// ayah count of each surah and where each juz starts). Qalun and Warsh both count the ayahs the
// Madani way (6214 ayahs), not like Hafs (Kufan count, 6236), so the numbers differ in 50 surahs.
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "src", "renderer", "data");
const AYAH_NUMBER = /\s*[٠-٩]+\s*$/; // the number written at the end of each ayah
const TOTAL = 6214;

/** @param {string} file */
function readRows(file) {
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows) || rows.length !== TOTAL)
    throw new Error(`${file}: expected ${TOTAL} ayahs, got ${rows.length}`);
  return rows;
}

/** @param {any[]} rows */
function surahsOf(rows) {
  /** @type {string[][]} */
  const surahs = Array.from({ length: 114 }, () => []);
  for (const r of rows) {
    const list = surahs[r.sura_no - 1];
    if (r.aya_no !== list.length + 1)
      throw new Error(`ayah out of order at ${r.sura_no}:${r.aya_no}`);
    const text = String(r.aya_text).replace(AYAH_NUMBER, "").trim();
    if (!text || /[٠-٩]$/.test(text))
      throw new Error(`bad text at ${r.sura_no}:${r.aya_no}`);
    list.push(text);
  }
  return surahs;
}

/** The Bismillah as this text writes it, taken from An-Naml 27:30. @param {string[][]} surahs */
function bismillahOf(surahs) {
  const ayah = surahs[26][29];
  const start = ayah.indexOf("بِسْمِ");
  if (start < 0) throw new Error("no Bismillah in 27:30");
  return ayah.slice(start);
}

/** @param {any[]} rows */
function madaniIndex(rows) {
  /** @type {number[]} */
  const counts = Array(114).fill(0);
  /** @type {[number, number][]} */
  const juz = [];
  for (const r of rows) {
    counts[r.sura_no - 1] += 1;
    if (!juz[r.jozz - 1]) juz[r.jozz - 1] = [r.sura_no, r.aya_no];
  }
  if (juz.length !== 30 || juz.some((j) => !j))
    throw new Error("missing juz starts");
  return { counts, juz };
}

function main() {
  const [qalunFile, warshFile] = process.argv.slice(2);
  if (!qalunFile || !warshFile) {
    console.error(
      "usage: node scripts/build-quran-riwayat.js <QaloonData_v10.json> <warshData_v10.json>",
    );
    process.exit(1);
  }
  const index = { qalun: readRows(qalunFile), warsh: readRows(warshFile) };
  const madani = madaniIndex(index.qalun);
  if (JSON.stringify(madani) !== JSON.stringify(madaniIndex(index.warsh)))
    throw new Error("Qalun and Warsh should share the Madani count");

  for (const [name, rows] of Object.entries(index)) {
    const surahs = surahsOf(rows);
    const out = {
      source: "KFGQPC v10",
      bismillah: bismillahOf(surahs),
      surahs,
    };
    fs.writeFileSync(path.join(OUT, `quran-${name}.json`), JSON.stringify(out));
  }
  fs.writeFileSync(
    path.join(OUT, "quran-madani-index.json"),
    `${JSON.stringify(madani)}\n`,
  );
  console.log(
    "written: quran-qalun.json, quran-warsh.json, quran-madani-index.json",
  );
}

main();
