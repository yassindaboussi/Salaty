# Releasing Salaty Time

## Publish a new version

1. Raise `version` in `package.json` (for example `1.1.5` → `1.1.6`), commit, push to `main`.
2. The **Release** workflow (`.github/workflows/release.yml`) then runs by itself:
   version check → lint + audit → build Windows, macOS and Linux → install-test each one on a
   clean machine → checksums + build provenance → GitHub release.
3. Installed copies find the new version within 12 hours, at their next start, or from
   Settings → Check for updates.

Nothing is published unless every step passes. A release that already exists is never rebuilt:
if the workflow says "already released", raise the version. To retry after fixing a failed run:
Actions → Release → Run workflow.

## What users download

| File | For | Updates |
| --- | --- | --- |
| `Salaty-Time-Setup.exe` | Windows 10/11 x64 | downloaded and installed by the app |
| Microsoft Store (once set up, below) | Windows 10 1809+ / 11 | by the Store |
| `Salaty-Time-mac-universal.dmg` | macOS 13+, Apple silicon and Intel | the app opens the download page |
| `Salaty-Time-linux-amd64.deb` / `-arm64.deb` | Ubuntu, Debian, Linux Mint | downloaded and installed by the app |
| `Salaty-Time-linux-x86_64.AppImage` / `-arm64` | other distributions | downloaded and installed by the app |

The names have no version number, so `https://github.com/yassindaboussi/Salaty/releases/latest/download/<file>`
always points to the newest one (the website and README use these links). How each copy updates
is decided in `src/main/windows/updater.js`.

## Windows: the SmartScreen warning

SmartScreen warns about downloads it has not seen often enough. An unsigned installer starts
again from zero with every new version, because reputation is counted per file. A signed one
builds reputation on its certificate. Since 2024 even paid EV certificates no longer remove the
warning right away.

Free options (checked October 2026):

| Option | Cost | Warning | Notes |
| --- | --- | --- | --- |
| **Microsoft Store** | free | none: Microsoft signs the package | free individual accounts since Sept 2025; the Store also updates the app. **Recommended.** |
| SignPath Foundation | free for open source | usually gone (shared certificate with reputation) | needs approval; publisher shown as "SignPath Foundation" |
| Azure Artifact Signing | about $10/month | gone once reputation builds | individuals only in the US and Canada |
| Self-signed certificate | free | still shown | Windows does not trust it |

### Microsoft Store setup (once)

1. Create a free individual developer account at <https://storedeveloper.microsoft.com>. You
   verify with an ID document and a selfie.
2. In Partner Center: **Apps and games → New product → MSIX or PWA app**, and reserve the name
   **Salaty Time**.
3. Open the app's **Product identity** page and copy three values:
   `Package/Identity/Name`, `Package/Identity/Publisher` (`CN=...`) and
   `Package/Properties/PublisherDisplayName`.
4. In GitHub: **Settings → Secrets and variables → Actions → Variables**, add
   `MSSTORE_IDENTITY_NAME`, `MSSTORE_PUBLISHER` and `MSSTORE_PUBLISHER_DISPLAY_NAME` with those
   values. They are public (every installed copy shows them), so variables, not secrets.
5. **Actions → Microsoft Store package → Run workflow**. When it finishes, download the
   `store-package-v<version>` artifact (an `.appx` file inside a zip).
6. In Partner Center, create a submission:
   - **Packages**: upload the `.appx`.
   - **Properties**: category *Lifestyle* (or *Books & reference*); privacy policy URL
     `https://github.com/yassindaboussi/Salaty/blob/main/PRIVACY.md`.
   - **Age ratings**: answer the questionnaire.
   - **Store listings**: English, Arabic and French descriptions and screenshots
     (`docs/assets` has some).
   - **Submission options → restricted capabilities**: the package declares `runFullTrust`.
     Explain: *"Desktop app (Electron) packaged as MSIX; runFullTrust is required to run it."*
   - Submit. Certification usually takes a few days.
7. Once it is published, add the Store link as the repository variable `MSSTORE_URL`: release
   notes then offer it. Also add the Store link to the README and the website.

**Every release after that:** the Release workflow also builds the Store package (job
*Microsoft Store*). Download its artifact, create a new submission in Partner Center, upload it
and submit. The Store only accepts a higher version than the last one.

What is different in the Store version (no code change needed; the app detects it):

- it does not look for updates itself; Settings says updates come from the Microsoft Store;
- it starts at login through the package's startup task, which the user can turn off in
  Windows Settings → Apps → Startup;
- the Store build is install-tested in CI (`store.yml`): signed with a throwaway certificate,
  installed, started, checked not to look for updates, then removed.

### SignPath Foundation (optional: signs the GitHub installer too)

Free code signing for open source projects. Requirements (signpath.org): an OSI license (MIT,
yes), no proprietary components, actively maintained and already released, built by an
automated pipeline from the public repository (GitHub Actions, yes), and a code signing policy
published on the project's home page. Team members need multi-factor authentication.

1. Apply at <https://signpath.org/apply>.
2. Publish the policy page (for example on the website):

   > **Code signing policy.** Free code signing provided by [SignPath.io](https://about.signpath.io),
   > certificate by [SignPath Foundation](https://signpath.org).
   > Committers and reviewers: [members of this repository](https://github.com/yassindaboussi/Salaty/graphs/contributors).
   > Approvers: Yassin Daboussi.
   > Privacy: this program does not transfer any information to other networked systems unless
   > requested by the user or the person installing or operating it (see PRIVACY.md).

3. After approval, the Windows build job changes: the app's `.exe` and the installer are sent to
   SignPath (their GitHub action) and `latest.yml` is rebuilt afterwards, because signing changes
   the file's checksum that the updater verifies.

## macOS

Apple notarization needs the Apple Developer Program ($99/year), and there is no free option.
The app is **ad-hoc signed** (`"identity": "-"`): Apple silicon only runs signed code, and an
unsigned build shows "damaged and can't be opened". Users click **Open Anyway** once in
System Settings → Privacy & Security. Updates: the app finds them and opens the download page,
because macOS lets only Developer ID-signed apps replace themselves.

## Linux

- **.deb** (recommended for Ubuntu, Debian, Mint): its install script adds the AppArmor profile
  that Ubuntu 24.04+ needs for Electron's sandbox. The app installs updates itself and asks for
  the password.
- **AppImage**: for other distributions. Needs `libfuse2`. On Ubuntu 24.04+, AppArmor blocks
  Electron's sandbox for AppImages, so point Ubuntu users to the .deb.

## "Send feedback" emails

The app's "Send feedback" window (problems and suggestions) emails them to
salatytime@gmail.com through [Web3Forms](https://web3forms.com) (free: 250 messages a month).

The access key is `feedbackAccessKey` in `package.json`. It is public by design: it only lets
someone send email to that address, and Web3Forms filters spam. To change it, create a new key on
<https://web3forms.com> with the same email address and replace the value. The environment
variable `WEB3FORMS_ACCESS_KEY` overrides it (e.g. to test with another key).

## Verify a release

```bash
sha256sum -c SHA256SUMS.txt --ignore-missing
gh attestation verify Salaty-Time-Setup.exe --repo yassindaboussi/Salaty
```

The attestation proves the file was built by the Release workflow from this repository.

## Later

- **Signed update files (Ed25519):** coming in electron-builder 27 (alpha in October 2026).
  Add it when it is stable.
- **winget:** once the app is in the Microsoft Store, `winget install "Salaty Time" --source msstore`
  works with no extra setup.
- **Automatic Store submissions:** the Partner Center API (`msstore` CLI) can upload each
  release. It needs a Microsoft Entra app registration.
