# GA4 Custom Dimensions Setup

One-time (or as-needed) script that creates the GA4 custom dimensions Salaty's
analytics needs. Without these, GA4 collects the data but never shows it in
standard reports/Explorations — only in Realtime/DebugView. See
`create-ga4-dimensions.js`'s header comment for details.

## Usage

```bash
node create-ga4-dimensions.js <PROPERTY_ID>
```

Requires a file named exactly `service-account-key.json` in this same folder
— a Google Cloud service-account key with **Editor** access on the GA4
property (Admin → Property Access Management, or Account Access Management
if property-level access alone isn't accepted by the API).

**⚠️ Never commit `service-account-key.json` to git.** It's already covered
by `.gitignore`, but treat it like a password regardless — it grants
programmatic write access to the GA4 property's configuration.

Safe to re-run any time (e.g. after adding a new tracked event/parameter in
the app) — dimensions that already exist are skipped, not duplicated or
overwritten.

## GA4 naming rules to remember when adding new dimensions

`displayName` may only contain letters, numbers, underscores, or spaces —
**no hyphens, no parentheses, no other punctuation** (GA4 will reject the
request with `INVALID_ARGUMENT` otherwise). `parameterName` must exactly
match the event parameter name as sent by the app (see
`src/main/services/analytics-manager.js`).
