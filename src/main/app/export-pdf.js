"use strict";

// Saves a page as a PDF, drawn with its print styles (@media print): the "Save as" window asks
// where, in Documents by default. The page only gives the file's name, never a path.
const fs = require("fs/promises");
const path = require("path");
const { app, dialog, BrowserWindow } = require("electron");
const log = require("../services/logger").logger("PDF");

/** Letters, digits, spaces and - _ . only (no path, no Windows-reserved character). */
const safeName = (name) =>
  (name || "Salaty")
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim()
    .slice(0, 80) || "Salaty";

/**
 * @param {Electron.WebContents} sender
 * @param {string | undefined} name  the file's name without ".pdf"
 * @returns {Promise<"saved" | "cancelled" | "failed">}
 */
async function exportPagePdf(sender, name) {
  const win = BrowserWindow.fromWebContents(sender);
  if (!win) return "failed";
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath("documents"), `${safeName(name)}.pdf`),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (canceled || !filePath) return "cancelled";
  try {
    const pdf = await sender.printToPDF({
      pageSize: "A4",
      printBackground: false,
    });
    await fs.writeFile(filePath, pdf);
    return "saved";
  } catch (err) {
    log.error("could not save the PDF:", err);
    return "failed";
  }
}

module.exports = { exportPagePdf };
