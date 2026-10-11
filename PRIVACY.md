# Privacy Policy – Salaty Time

**Effective Date:** July 2, 2026  
**Last Updated:** October 9, 2026  
**App Version:** 1.1.3+

---

## 📌 Overview

Salaty Time ("App", "we", "us", "our") is a lightweight Electron-based Islamic prayer times desktop application. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.

**Our Core Commitment:** We believe privacy is a right. The App is designed to operate **offline-first** — you never *have* to share personal data with us. All prayer times, Quran content, Athkar reminders, and Qibla calculations work on your computer without sending anything to our servers.

---

## 🔐 What Data We Collect

### ✅ Data You Explicitly Control (No Collection Without Your Action)

1. **Location Information (City & Country)**
   - You manually enter your city and country in Settings to fetch accurate prayer times
   - These locations are stored **only on your device**
   - They are **never sent to us** — only to the [Aladhan API](https://aladhan.com) to calculate prayer times
   - The Qibla page sends your city and country to [Photon](https://photon.komoot.io) (OpenStreetMap) to find its coordinates (if it can't, [ipapi.co](https://ipapi.co) guesses them from your IP address), and loads [OpenStreetMap](https://www.openstreetmap.org) map tiles
   - **Auto Detect Location** (only when you press it) asks [freeipapi.com](https://freeipapi.com) to guess your city from your IP address
   - All of these requests use encrypted HTTPS connections
   - You can delete this at any time via Settings

2. **Prayer & App Preferences**
   - Theme choice, language preference (Arabic/English/French)
   - Notification settings (pre-Adhan alerts, Athkar reminders)
   - Screen size, auto-start preference
   - All stored **locally only**

3. **Audio Files & Religious Content**
   - Adhan audio (downloaded from our servers or third-party CDNs)
   - Quran text (stored locally)
   - Islamic content (Athkar, Asma ul-Husna, etc.)
   - Stored **on your device only**

### 📊 Analytics & Usage Data (Opt-In, Anonymized)

We use **Google Analytics 4 (GA4)** with offline-first queuing to understand how the App is used. This is **optional** and does not require personal information:

**What We Measure:**
- App launches and feature opens (prayer times, Quran, radio, etc.)
- Settings changes (language, theme, screen size preference)
- Page navigation flows
- Non-fatal errors (for debugging; file paths are removed from error messages before sending)
- System information (OS, CPU cores, RAM, app version) — for hardware compatibility

**What We Do NOT Collect:**
- ❌ No IP addresses (GA4 is configured to exclude them)
- ❌ No personally identifiable information (PII)
- ❌ No prayer history
- ❌ No personal location data (city/country names are not sent to GA4)
- ❌ No Quran reading habits
- ❌ No audio listening history
- ❌ No identifying cookies or device IDs (we use a random UUID, changed on each app reinstall)

**How It's Stored:**
- Analytics events are queued **on your device** first
- If you're offline, events remain locally and sync when you reconnect
- Batches are sent to GA4 only when your app is online
- Events are dropped if the queue exceeds 2,000 items (oldest first)
- Exponential backoff prevents overwhelming poor connections

**Your GA4 Client ID:**
- A random, anonymous UUID generated on first install
- Stored in your app's user data folder
- Does not identify you — it's purely for session grouping
- Resets if you reinstall the App

**Turning Analytics On or Off:**
- Settings → Privacy → "Anonymous usage statistics"
  - Off by default: nothing is recorded or sent until you turn it on
  - Turning it off deletes the events still waiting on your device and the random Client ID

### 🌐 Third-Party API Calls

The App communicates with external services **only when you interact with them:**

1. **[Aladhan API](https://aladhan.com/api)**
   - Prayer time calculations
   - Triggered when: you change city/country or the app auto-refreshes at midnight
   - Data sent: your city and country name
   - Data received: prayer times, Islamic month info
   - Aladhan's privacy: see [aladhan.com/privacy](https://aladhan.com)

2. **[Leaflet.js](https://leafletjs.com/) & [OpenStreetMap](https://www.openstreetmap.org/)**
   - Qibla direction map (interactive)
   - Triggered when: you open the Qibla feature
   - Data sent: none (map tiles are cached)
   - Leaflet and OSM have their own privacy policies

3. **[Google Analytics 4](https://policies.google.com/privacy)**
   - Optional analytics (see Analytics section above)
   - Events sent only when online
   - Google's privacy policy applies to GA4 data

4. **[GitHub Releases API](https://docs.github.com/rest)**
   - App update checks
   - Via `electron-updater` library
   - Data sent: app version, OS, architecture
   - Checked every few hours; see [electron-updater docs](https://www.electron.build/auto-update)

### 🎙️ Audio Streaming

- Radio stations and audio albums are sourced from third-party streaming CDNs
- Playback is handled locally; no data is sent to us about what you're listening to
- Those services have their own privacy policies

### 💬 Feedback: Problems and Suggestions (Only When You Ask)

- Errors and crashes are written to a log file **on your device** (main.log), so the App can recover and problems can be reported
- **Settings → About → Send feedback** opens a small window: choose "A problem" or "A suggestion" and write your message. Your email address is optional (only if you want a reply)
- For a problem, if you leave "Include technical details" ticked, the message also contains: the App version, your operating system, the language, and the last errors from the log. You can read exactly what is included before sending. File paths and your saved city, country and location names are **removed** from it. Suggestions never include technical details
- **Only when you press Send**, your message is emailed to us through [Web3Forms](https://web3forms.com), a form-to-email service (it keeps submissions for 30 days and does not share or sell them). Without internet, the message waits on your device and is sent when you are back online
- If the App closes unexpectedly, its error message offers "Report a problem": the window then opens the next time you start the App

---

## 🛡️ How We Protect Your Data

1. **Local-First Storage**
   - All app data is stored in your OS user data directory:
     - Windows: `%APPDATA%\Salaty Time`
     - macOS: `~/Library/Application Support/Salaty Time`
     - Linux: `~/.config/Salaty Time`
   - Only you and your OS user account can access it

2. **Encrypted Transport**
   - All API calls use HTTPS (TLS 1.2+)
   - GA4 payloads are encrypted in transit
   - Aladhan API calls are encrypted

3. **No Server-Side Accounts**
   - We do not run a backend server
   - No login required
   - No cloud storage of your data
   - Nothing synced to "the cloud"

4. **Open Source**
   - The App's source code is [public on GitHub](https://github.com/yassindaboussi/Salaty)
   - You can audit the code yourself
   - Build and run your own version if you wish

5. **Minimal Dependencies**
   - We use only essential libraries (Electron, Leaflet, Howler.js)
   - No invasive SDKs or tracking bloat
   - Regular dependency updates for security patches

---

## 📤 Data Sharing & Disclosure

**We do not sell, trade, or rent your personal information.**

Data is shared only in these scenarios:

1. **Third-Party Service Providers** (as listed above)
   - Aladhan API (prayer times)
   - Google Analytics (optional analytics)
   - GitHub (update checks)
   - OpenStreetMap (Qibla map)

2. **Legal Compliance**
   - If required by law, court order, or government request
   - We will attempt to notify you beforehand if permitted by law

3. **Safety & Fraud**
   - If we detect illegal activity or a genuine security threat
   - To protect our users, systems, or the App's integrity

4. **Business Transfers**
   - If the App is acquired or merged, your data will be covered by the transferee's privacy policy
   - You will be notified of any change

---

## 🔄 Data Retention

- **Settings & Preferences:** Retained indefinitely on your device (until you delete the App)
- **Adhan Audio & Quran Content:** Retained indefinitely (until you delete the App)
- **Analytics Events:** Sent to GA4 and retained per [Google's data retention policy](https://support.google.com/analytics/answer/7667196) (default: 14 months)
- **Analytics Queue (Local):** Deleted once successfully sent to GA4
- **Crash Logs:** Stored locally; not automatically uploaded

**To Delete Your Data:**
1. Uninstall the App (removes all local storage)
2. Manually delete the App's user data folder (see paths above)
3. GA4 data on Google's servers cannot be deleted by you; contact us to request deletion from our GA4 account

---

## 👤 Your Privacy Rights

### Access
- You can view all app data stored on your device by navigating to your OS user data folder (see paths above)

### Correction & Deletion
- Edit or delete any data via the App's Settings
- Fully wipe all app data by uninstalling

### Opt-In / Opt-Out of Analytics
- Analytics are off unless you turn on Settings → Privacy → "Anonymous usage statistics"
- Turning the switch off stops collection immediately and deletes unsent events and the Client ID

### Right to Know (California CCPA / EU GDPR)
- All data collected is disclosed in this policy
- You have the right to request a copy of your GA4 data
- Contact: [salatytime@gmail.com](mailto:salatytime@gmail.com)

### Deletion (GDPR Article 17)
- You can delete your local data immediately via Settings or uninstall
- To delete your GA4 analytics profile, contact: [salatytime@gmail.com](mailto:salatytime@gmail.com)

---

## 👶 Children's Privacy

The App is not directed to children under 13. If we learn that we have collected personal information from a child under 13 without parental consent, we will delete that information.

---

## 🌍 International Users

If you're in the European Union, United Kingdom, or other regions with privacy laws (GDPR, UK-GDPR, CCPA, etc.):

- **Data Processing:** We use Electron's local processing; minimal data leaves your device
- **Legal Basis:** Your consent to use the App
- **Data Controller:** Yassin Daboussi ([salatytime@gmail.com](mailto:salatytime@gmail.com))
- **Data Processor:** Google Analytics (for GA4 data only)

By using the App, you consent to this Privacy Policy and the processing described herein.

---

## 🔔 Changes to This Policy

We may update this Privacy Policy to reflect changes in the App or legal requirements. Updates will be posted here with a new "Last Updated" date.

**Material changes** will be announced via:
- In-app notification (next app launch)
- GitHub releases page
- Our website: [yassindaboussi.github.io/Salaty](https://yassindaboussi.github.io/Salaty)

Your continued use of the App after changes constitutes acceptance of the new terms.

---

## 📞 Contact Us

If you have questions, concerns, or requests related to this Privacy Policy:

📧 **Email:** [salatytime@gmail.com](mailto:salatytime@gmail.com)  
🌐 **Website:** [yassindaboussi.github.io/Salaty](https://yassindaboussi.github.io/Salaty)  
💬 **GitHub Issues:** [github.com/yassindaboussi/Salaty/issues](https://github.com/yassindaboussi/Salaty/issues)  
📝 **Discussions:** [github.com/yassindaboussi/Salaty/discussions](https://github.com/yassindaboussi/Salaty/discussions)

---

## 🙏 Additional Note

Salaty Time is built with respect for privacy and the Islamic values of trust and transparency. We strive to be honest about what data we collect and why. If anything in this policy is unclear or concerning, please reach out — we're happy to clarify.

**May this App strengthen your connection to your faith while keeping your privacy safe.**

---

*Salaty Time is licensed under the [MIT License](LICENSE). The App's source code is available at [github.com/yassindaboussi/Salaty](https://github.com/yassindaboussi/Salaty).*
