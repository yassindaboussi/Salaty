<div align="center">

# Salaty Time

A modern, lightweight **Electron.js** desktop application for Islamic prayer times, Adhan alerts, Quran, Athkar, Qibla direction, Islamic media, and daily spiritual tools.

**Made with love for the Muslim Ummah**

<p align="center">
  <img src="https://img.shields.io/badge/Electron-42.x-47848F?logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/Platform-Windows%20·%20macOS%20·%20Linux-blue" />
  <img src="https://img.shields.io/badge/Version-1.1.0-green" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

</div>

---

## Overview

**Salaty Time** is a cross-platform Islamic desktop app built with Electron, HTML, CSS, and JavaScript. It provides accurate prayer times using the Aladhan API and includes a complete Islamic feature suite such as Quran access, Athkar, Qibla finder, Ramadhan tools, Tasbih, Hijri calendar, radio, livestreams, playlists, widgets, and customizable themes.

The project has been refactored into a cleaner modular architecture with separated main-process services, IPC handlers, renderer modules, grouped pages, shared utilities, and organized CSS layers.

---

## Main Features

### Prayer Times

- Accurate prayer times powered by **Aladhan API**
- Live countdown to the next prayer
- Current and next prayer highlighting
- Hijri and Gregorian date display
- Adhan notifications with audio support
- Individual Adhan settings per prayer
- Pre-Adhan reminder notification support
- Automatic prayer data reload after location changes
- Midnight prayer data refresh
- Offline-friendly behavior after data is loaded

### Location Management

- Default location: **Tunis, Tunisia**
- Multi-location support
- Active location switching
- Favorite location support
- Add, edit, and delete saved locations
- IP-based location detection
- Travel mode setting support

### Islamic Tools

- Holy Quran page
- Daily Athkar with counters
- Athkar popup alerts
- 99 Names of Allah
- Qibla finder with map integration
- Ramadhan tracker
- Hijri calendar
- Tasbih counter

### Media Features

- Quran radio stations
- Radio station logos and multilingual descriptions
- Audio albums
- Playlist page
- Background player
- Mini player
- Livestreams page

### Desktop App Features

- Frameless custom window
- System tray support
- Close-to-tray behavior
- Single-instance app lock
- Auto-start with system login
- Auto-updater integration
- Manual update checking
- Prayer widget window
- Themed Adhan and Athkar popup windows
- Connection monitoring and recovery events

### Design and Customization

- 12 themes: Navy, Green, Brown, Gold, Pink, Purple, Emerald, Ocean, Royal, Indigo, Classic, Ramadhan
- Arabic, English, and French support
- RTL and LTR layout support
- Responsive layout and big-screen mode
- Modular CSS structure by settings, base, layout, components, pages, widgets, and utilities

---

## 📸 Gallery: Experience the Beauty of Salaty Time

### 🕌 Main Interface - Prayer Times at a Glance
| Navy Theme (Professional) | Royal Theme (Classic) | Ramadhan Theme (Spiritual) |
|:-------------------------:|:---------------------:|:--------------------------:|
| <img src="https://github.com/user-attachments/assets/21a3f9b8-fe95-4836-9ab7-54056a42fd94" width="280"/> | <img src="https://github.com/user-attachments/assets/493825df-7382-4c4f-990b-99c73557c18d" width="280"/> | <img src="https://github.com/user-attachments/assets/40c74763-3811-4a44-bd14-c3f78d2fab92" width="280"/> |

### ⚙️ Customization & Settings
| Settings Panel | Theme Selection | Language Options |
|:--------------:|:--------------:|:----------------:|
| <img src="https://github.com/user-attachments/assets/3c14a19d-df48-48b6-b232-437c324aa833" width="280"/> | <img src="https://github.com/user-attachments/assets/9e9b90d5-8008-4aaa-a567-a9f019292d5c" width="280"/> | <img src="https://github.com/user-attachments/assets/c0442e97-9758-4773-bd8e-3f2ffbf6ee1c" width="280"/> |

### 📖 Islamic Features Suite
| Holy Quran Reader | Athkar Counter | Qibla Finder |
|:-----------------:|:--------------:|:------------:|
| <img src="https://github.com/user-attachments/assets/5fa956fa-89c6-456f-911c-f6033ec1a3d2" width="280"/> | <img src="https://github.com/user-attachments/assets/847c1486-b23e-42d1-95a5-de7bee27a610" width="280"/> | <img src="https://github.com/user-attachments/assets/0b24c087-9856-48d4-b7b4-47bd907b1576" width="280"/> |

### 🌙 Ramadhan & Special Features
| Ramadhan Tracker | 99 Names of Allah | Features Hub |
|:----------------:|:-----------------:|:------------:|
| <img src="https://github.com/user-attachments/assets/07b645f7-e90b-43b4-92f2-c14cf47c8a21" width="280"/> | <img src="https://github.com/user-attachments/assets/6d431d97-e9e2-42b9-9b78-e8610bdce132" width="280"/> | <img src="https://github.com/user-attachments/assets/c76807fc-301f-47ce-963a-299fb635b707" width="280"/> |

*🎨 12 Stunning Themes - Each carefully crafted to enhance your spiritual experience*

---

## Tech Stack

- **Electron 42.x**
- **JavaScript CommonJS**
- **HTML5 / CSS3**
- **Aladhan API** for prayer times
- **Leaflet** for map features
- **salaty-qibla-map** for Qibla direction
- **Howler.js** for audio playback
- **Tom Select** for enhanced select inputs
- **electron-updater** for app updates
- **ESLint 9** for code quality

---

## Installation

### Prerequisites

- Node.js
- npm

### Run locally

```bash
git clone https://github.com/yassindaboussi/Salaty.git
cd Salaty
npm install
npm start
```

### Development mode

```bash
npm run dev
```

### Build

```bash
npm run build
npm run dist
```

### Linux build

```bash
npm run build:linux
```

---

## Available Scripts

```bash
npm start              # Run the Electron app
npm run dev            # Run with Electron logging enabled
npm run build          # Build for the current platform
npm run build:linux    # Build for Linux
npm run dist           # Create distributable package
npm run clean          # Remove dist folder
npm run lint           # Lint all source files
npm run lint:main      # Lint main process files
npm run lint:renderer  # Lint renderer files
npm run format         # Format source files
npm run format:check   # Check formatting
```

---

## Project Structure

```text
Salaty/
├── .github/workflows/          # CI and release workflows
├── docs/                       # GitHub Pages / documentation website
├── src/
│   ├── assets/                 # Icons, images, audio, installer resources
│   ├── main/                   # Electron main process
│   │   ├── app/                # Application bootstrap
│   │   ├── config/             # Paths and window options
│   │   ├── ipc/                # IPC orchestration
│   │   │   └── handlers/       # Focused IPC handler modules
│   │   ├── services/           # Main-process services
│   │   ├── windows/            # Main window, tray, updater
│   │   └── index.js            # Main entry point
│   ├── preload/                # Preload entry
│   ├── renderer/               # Frontend application
│   │   ├── css/                # Layered CSS architecture
│   │   ├── data/               # Static JSON data
│   │   ├── js/                 # Renderer modules
│   │   │   ├── core/           # Global UI, theme, renderer logic
│   │   │   ├── features/       # Islamic feature modules
│   │   │   ├── media/          # Audio, radio, playlist, livestream modules
│   │   │   ├── services/       # Renderer services
│   │   │   ├── ui/             # Reusable UI logic
│   │   │   ├── utils/          # Utility helpers
│   │   │   └── widgets/        # Widget scripts
│   │   ├── locales/            # ar, en, fr translations
│   │   └── pages/              # Grouped HTML pages
│   │       ├── app/            # Home, features, settings
│   │       ├── media/          # Albums, playlist, radio, livestreams
│   │       ├── widgets/        # Prayer widget, popups, offline page
│   │       └── worship/        # Quran, Athkar, Qibla, Ramadhan, etc.
│   └── shared/                 # Shared utilities used by main and renderer
├── settings.json               # Default app settings
├── package.json                # Dependencies, scripts, and build config
└── README.md
```
