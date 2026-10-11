"use strict";
/**
 * make-store-assets.js: the Microsoft Store tile images (src/assets/appx/, read by electron-builder
 * for the `appx` target) made from the app icon. Run after changing the icon:
 *   npm run assets:store
 *
 * Square icons fill the tile; the larger tiles keep the icon at 60% so it is not cropped. The
 * background is transparent: Windows shows the manifest's backgroundColor behind it. Scale
 * variants (scale-100/200) and the target sizes Windows uses on the taskbar and Start keep the
 * icon sharp on high-DPI screens.
 * https://learn.microsoft.com/windows/apps/design/style/iconography/app-icon-construction
 */

const fs = require("fs");
const path = require("path");
const { app, BrowserWindow } = require("electron");

const ICON = path.join(__dirname, "../src/assets/icons/app_icon_512.png");
const OUT = path.join(__dirname, "../src/assets/appx");

// [file name, width, height, share of the tile the icon takes]
const TILES = [
  ["StoreLogo", 50, 50, 1],
  ["Square44x44Logo", 44, 44, 1],
  ["SmallTile", 71, 71, 0.8],
  ["Square150x150Logo", 150, 150, 0.6],
  ["Wide310x150Logo", 310, 150, 0.6],
  ["LargeTile", 310, 310, 0.6],
];
const SCALES = [1, 2]; // scale-100, scale-200
const TARGET_SIZES = [16, 24, 32, 48, 256]; // Square44x44Logo.targetsize-N

/**
 * Draws the icon centred on a transparent w x h canvas; returns PNG bytes.
 * @param {import("electron").BrowserWindow} win
 * @param {string} iconUrl
 * @param {number} w
 * @param {number} h
 * @param {number} share
 * @returns {Promise<Buffer>}
 */
async function render(win, iconUrl, w, h, share) {
  const dataUrl = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(iconUrl)};
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = ${w};
    canvas.height = ${h};
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    const size = Math.round(Math.min(${w}, ${h}) * ${share});
    ctx.drawImage(img, Math.round((${w} - size) / 2), Math.round((${h} - size) / 2), size, size);
    return canvas.toDataURL("image/png");
  })()`);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL("about:blank");
  const iconUrl = `data:image/png;base64,${fs.readFileSync(ICON).toString("base64")}`;
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const files = [];
  for (const [name, w, h, share] of TILES) {
    for (const scale of SCALES) {
      const file = `${name}.scale-${scale * 100}.png`;
      fs.writeFileSync(
        path.join(OUT, file),
        await render(win, iconUrl, w * scale, h * scale, share),
      );
      files.push(file);
    }
  }
  for (const size of TARGET_SIZES) {
    const file = `Square44x44Logo.targetsize-${size}.png`;
    fs.writeFileSync(
      path.join(OUT, file),
      await render(win, iconUrl, size, size, 1),
    );
    files.push(file);
  }
  console.log(`${files.length} images in ${path.relative(process.cwd(), OUT)}`);
  app.exit(0);
});
