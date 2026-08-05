/**
 * create-ga4-dimensions.js  (zero-dependency version)
 *
 * Creates all the GA4 custom dimensions in one go. Uses ONLY Node's
 * built-in modules — no "npm install" step needed at all.
 *
 * USAGE:
 *   node create-ga4-dimensions.js <PROPERTY_ID>
 *
 * Example:
 *   node create-ga4-dimensions.js 383400508
 *
 * Requires a file named exactly "service-account-key.json" in the same
 * folder as this script (the JSON key you downloaded from Google Cloud).
 *
 * Safe to run more than once — dimensions that already exist are skipped,
 * not duplicated.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const https = require("https");

const PROPERTY_ID = process.argv[2];
const KEY_FILE = path.join(__dirname, "service-account-key.json");

const dimensions = [
  // Attached to EVERY event (not just app_start) — most valuable ones,
  // let you segment any report by app version or OS.
  { displayName: "App Version", parameterName: "app_version", description: "Salaty version number (e.g. 1.2.0)" },
  { displayName: "OS Platform", parameterName: "os_platform", description: "Windows / macOS / Linux" },
  { displayName: "OS Architecture", parameterName: "os_arch", description: "x64 / arm64 / ia32" },
  { displayName: "App Locale", parameterName: "app_locale", description: "System locale (e.g. en-US) — different from in-app language" },

  { displayName: "Feature Opened", parameterName: "feature_name", description: "Which app feature the user opened" },
  { displayName: "Settings Language", parameterName: "language", description: "Language set via Settings save — different param than user_language (app_start uses user_language, settings_saved uses language)" },
  { displayName: "Settings Theme", parameterName: "theme", description: "Theme set via Settings save — different param than user_theme" },
  { displayName: "User Language", parameterName: "user_language", description: "App language (en/ar/fr)" },
  { displayName: "User theme", parameterName: "user_theme", description: "App color theme" },
  { displayName: "City", parameterName: "city", description: "User's configured city" },
  { displayName: "Country", parameterName: "country", description: "User's configured country" },
  { displayName: "Screen Size", parameterName: "screen_size", description: "'big' or 'small' screen mode" },
  { displayName: "Station Name", parameterName: "station_name", description: "Radio station played" },
  { displayName: "Dhikr Name", parameterName: "dhikr_name", description: "Tasbih/dhikr used" },
  { displayName: "Athkar Category", parameterName: "category_name", description: "Athkar category opened" },
  { displayName: "Album Name", parameterName: "album_name", description: "Quran audio archive album played" },
  { displayName: "Livestream", parameterName: "stream", description: "'makkah' or 'madina' livestream" },
  { displayName: "Ramadan Tab", parameterName: "tab_name", description: "Ramadan page tab selected" },
  { displayName: "Athkar Alert Enabled", parameterName: "athkar_alert_enabled", description: "Athkar reminder on/off" },
  { displayName: "Athkar Alert Interval", parameterName: "athkar_alert_interval", description: "Athkar reminder interval (minutes)" },
  { displayName: "Pre Adhan Enabled", parameterName: "pre_adhan_enabled", description: "Pre-adhan reminder on/off" },
  { displayName: "Pre Adhan Minutes", parameterName: "pre_adhan_minutes", description: "Pre-adhan lead time (minutes)" },
  { displayName: "OS Release", parameterName: "os_release", description: "Operating system version" },
  { displayName: "Electron Version", parameterName: "electron_ver", description: "Electron runtime version" },
  { displayName: "Error Context", parameterName: "error_context", description: "Where in the app an error occurred" },
  { displayName: "From Page", parameterName: "from_page", description: "Navigation source page" },
  { displayName: "To Page", parameterName: "to_page", description: "Navigation destination page" },
  { displayName: "Location City", parameterName: "location_city", description: "City of a saved/managed location" },
  { displayName: "Location Country", parameterName: "location_country", description: "Country of a saved/managed location" },
];

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ── Step 1: build + sign a JWT with the service account's private key ──
function buildSignedJwt(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/analytics.edit",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), key.private_key);
  const signatureB64 = signature.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${unsigned}.${signatureB64}`;
}

// ── Step 2: exchange the JWT for a short-lived access token ──
function getAccessToken(jwt) {
  return new Promise((resolve, reject) => {
    const body = `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`;
    const req = https.request(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.access_token) resolve(parsed.access_token);
            else reject(new Error(`Auth failed: ${data}`));
          } catch (e) {
            reject(new Error(`Auth response parse error: ${data}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Step 3: call the Admin API to create one custom dimension ──
function createDimension(accessToken, dim) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      parameterName: dim.parameterName,
      displayName: dim.displayName,
      description: dim.description,
      scope: "EVENT",
    });
    const req = https.request(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${PROPERTY_ID}/customDimensions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ ok: true });
          } else if (/already exists|ALREADY_EXISTS/i.test(data)) {
            resolve({ ok: true, skipped: true });
          } else {
            resolve({ ok: false, error: data });
          }
        });
      },
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.write(body);
    req.end();
  });
}

async function main() {
  if (!PROPERTY_ID) {
    console.error("❌ Missing property ID.\n\nUsage:  node create-ga4-dimensions.js <PROPERTY_ID>\nExample: node create-ga4-dimensions.js 383400508");
    process.exit(1);
  }
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`❌ Can't find service-account-key.json in this folder (${__dirname}).`);
    process.exit(1);
  }

  const key = JSON.parse(fs.readFileSync(KEY_FILE, "utf8"));
  console.log(`Authenticating as ${key.client_email}...`);
  const jwt = buildSignedJwt(key);
  const accessToken = await getAccessToken(jwt);
  console.log(`✅ Authenticated.\n`);

  console.log(`Creating ${dimensions.length} custom dimensions on property ${PROPERTY_ID}...\n`);
  for (const dim of dimensions) {
    const result = await createDimension(accessToken, dim);
    if (result.ok && result.skipped) {
      console.log(`⏭️  Skipped (already exists):  ${dim.displayName}`);
    } else if (result.ok) {
      console.log(`✅ Created:  ${dim.displayName}  (${dim.parameterName})`);
    } else {
      console.log(`❌ Failed:  ${dim.displayName}  —  ${result.error}`);
    }
  }
  console.log("\nDone! Check Admin → Définitions personnalisées in GA4 to confirm.");
}

main().catch((err) => {
  console.error("Script failed:", err.message || err);
  process.exit(1);
});
