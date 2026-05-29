<div align="center">

# 🕌 Salaty Time

### Modern Islamic Prayer Times Desktop Application

A beautiful, lightweight **Electron.js** desktop app for accurate prayer times, Quranic guidance, Islamic tools, and spiritual wellness.

**Crafted with ❤️ for the Muslim Ummah**

<p align="center">
  <img src="https://img.shields.io/badge/Electron-42.x-47848F?logo=electron&logoColor=white" alt="Electron Version"/>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Cross-Platform"/>
  <img src="https://img.shields.io/badge/Version-1.1.1-green" alt="App Version"/>
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT License"/>
</p>

---

## ✨ Key Features

### 🕐 Prayer Times & Notifications
- ⏱️ Accurate prayer times via **Aladhan API**
- ⏲️ Live countdown timer to next prayer
- 🔔 Customizable Adhan alerts with audio
- ⚠️ Pre-Adhan reminders (adjustable minutes)
- 📅 Hijri & Gregorian date synchronization

### 📍 Location Management
- 🗺️ Multi-location support with favorites
- 🔄 Quick location switching
- 📡 IP-based auto-detection
- ✈️ Travel mode support
- 💾 Save & manage unlimited locations

### 📖 Islamic Knowledge Hub
- 📕 Complete Quran reader with navigation
- 🌸 Daily Athkar (remembrances) with counters
- 🕋️ 99 Names of Allah (Asma ul-Husna)
- 🧭 Qibla direction finder with map
- 🌙 Ramadhan tracker & lunar calendar
- 📿 Digital Tasbih counter

### 🎵 Media & Entertainment
- 📻 Curated Quran radio stations
- 🎼 Audio albums & playlists
- 🎙️ Live religious streams
- 🎚️ Background player with mini mode
- 🎨 Station logos & descriptions

### 🖥️ Desktop Excellence
- 🎯 Frameless custom window design
- 📌 System tray integration
- 🔄 Single-instance app lock
- 🚀 Auto-start with system
- ⚡ Auto-updater with manual checking
- 🪟 Dedicated prayer widget window

### 🎨 Customization & Accessibility
- 🌈 **12 Beautiful Themes**: Navy, Green, Brown, Gold, Pink, Purple, Emerald, Ocean, Royal, Indigo, Classic, Ramadhan
- 🌍 **3 Languages**: Arabic (عربي), English, French (Français)
- 🔄 **RTL & LTR Support** for comfortable reading
- 📱 Responsive design with big-screen mode

---

## 📸 Gallery

### 🕌 Prayer Times Display
| Navy Theme | Royal Theme | Ramadhan Theme |
|:---:|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/21a3f9b8-fe95-4836-9ab7-54056a42fd94" width="250"/> | <img src="https://github.com/user-attachments/assets/493825df-7382-4c4f-990b-99c73557c18d" width="250"/> | <img src="https://github.com/user-attachments/assets/07b645f7-e90b-43b4-92f2-c14cf47c8a21" width="250"/> |

### ⚙️ Settings & Personalization
| Settings Panel | Theme Selection | Language Options |
|:---:|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/3c14a19d-df48-48b6-b232-437c324aa833" width="250"/> | <img src="https://github.com/user-attachments/assets/9e9b90d5-8008-4aaa-a567-a9f019292d5c" width="250"/> | <img src="https://github.com/user-attachments/assets/placeholder" width="250"/> |

### 📚 Islamic Features
| Quran Reader | Athkar Counter | Qibla Finder |
|:---:|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/5fa956fa-89c6-456f-911c-f6033ec1a3d2" width="250"/> | <img src="https://github.com/user-attachments/assets/847c1486-b23e-42d1-95a5-de7bee27a610" width="250"/> | <img src="https://github.com/user-attachments/assets/placeholder" width="250"/> |

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| ⚡ **Electron 42.x** | Cross-platform desktop framework |
| 🔵 **JavaScript (CommonJS)** | Application logic |
| 🎨 **HTML5 / CSS3** | User interface & styling |
| 🌐 **Aladhan API** | Accurate prayer times data |
| 🗺️ **Leaflet.js** | Interactive maps |
| 🧭 **salaty-qibla-map** | Qibla direction visualization |
| 🔊 **Howler.js** | Audio playback engine |
| 🎯 **Tom Select** | Enhanced dropdown inputs |
| 📦 **electron-updater** | Auto-update functionality |
| ✅ **ESLint 9** | Code quality assurance |

---

## 🚀 Getting Started

### 📋 Prerequisites
- **Node.js** (v16 or higher)
- **npm** (v7 or higher)

### 💻 Installation & Setup

```bash
# Clone the repository
git clone https://github.com/yassindaboussi/Salaty.git
cd Salaty

# Install dependencies
npm install

# Run the application
npm start
```

### 🔧 Development Mode
```bash
npm run dev    # Runs with verbose logging enabled
```

### 📦 Build & Distribution

```bash
# Build for current platform
npm run build

# Build specifically for Linux
npm run build:linux

# Create distributable package
npm run dist

# Clean build artifacts
npm run clean
```

### 📝 Code Quality

```bash
# Lint all source files
npm run lint

# Lint specific areas
npm run lint:main       # Main process only
npm run lint:renderer   # Renderer process only

# Format code
npm run format          # Auto-format files
npm run format:check    # Check formatting without changes
```

---

## 📁 Project Structure

```
Salaty/
│
├── 📋 .github/workflows/          ⚙️  CI/CD & automated release workflows
├── 📖 docs/                       📚 Documentation website (GitHub Pages)
│
├── 📦 src/
│   │
│   ├── 🎨 assets/                 🖼️  Icons, images, audio, installer resources
│   │
│   ├── ⚙️ main/                    🖥️  Electron main process (backend)
│   │   ├── 🚀 app/                Bootstrap & application initialization
│   │   ├── ⚡ config/             Window options & app paths
│   │   ├── 📡 ipc/                IPC orchestration & handlers
│   │   │   └── 🔗 handlers/       Modular IPC handler modules
│   │   ├── 🔧 services/           Business logic & data services
│   │   ├── 🪟 windows/            Main window, system tray, updater
│   │   └── 📌 index.js            Entry point
│   │
│   ├── 🔐 preload/                🛡️  Secure context bridge setup
│   │
│   ├── 🎯 renderer/               💻 Frontend application
│   │   ├── 🎨 css/                Layered CSS architecture
│   │   │   ├── 🌍 settings/      User preferences & themes
│   │   │   ├── 📐 base/          Global styles & reset
│   │   │   ├── 📏 layout/        Page layouts & structure
│   │   │   ├── 🧩 components/    Reusable UI components
│   │   │   ├── 📄 pages/         Page-specific styles
│   │   │   ├── 🪟 widgets/       Widget-specific styling
│   │   │   └── 🛠️ utilities/     Helper classes & utilities
│   │   │
│   │   ├── 💾 data/               📊 Static JSON data & configurations
│   │   │
│   │   ├── 🔨 js/                 ✨ Renderer modules & logic
│   │   │   ├── 🌐 core/          Global UI state & theme engine
│   │   │   ├── 🌸 features/      Islamic feature modules
│   │   │   ├── 🎵 media/         Audio, radio, playlist handlers
│   │   │   ├── 🔌 services/      Renderer-side services
│   │   │   ├── 🎮 ui/            Reusable UI interaction logic
│   │   │   ├── 🧰 utils/         Helper functions & utilities
│   │   │   └── 🪟 widgets/       Prayer widget & popup scripts
│   │   │
│   │   ├── 🌍 locales/            🗣️  Translations
│   │   │   ├── 🇸🇦 ar/           Arabic translations
│   │   │   ├── 🇬🇧 en/           English translations
│   │   │   └── 🇫🇷 fr/           French translations
│   │   │
│   │   └── 📄 pages/              📑 HTML templates (grouped by feature)
│   │       ├── 🏠 app/            Home, features, settings pages
│   │       ├── 🎵 media/          Albums, playlists, radio, livestreams
│   │       ├── 🪟 widgets/        Prayer widget, popups, offline page
│   │       └── 🕌 worship/        Quran, Athkar, Qibla, Ramadhan, etc.
│   │
│   └── 🔗 shared/                 🤝 Shared utilities for main & renderer
│
├── ⚙️ settings.json               🔧 Default application settings
├── 📦 package.json                📚 Dependencies & build configuration
└── 📖 README.md                   📝 Project documentation
```

---

## 🎯 How It Works

### 🔄 Application Flow

1. **Startup**: Electron main process initializes, reads settings, and creates the main window
2. **IPC Bridge**: Secure communication between main process (backend) and renderer (frontend)
3. **Prayer Data**: Fetches prayer times from Aladhan API based on user location
4. **UI Rendering**: Renderer displays prayer times, countdown, and Islamic features
5. **Notifications**: Main process handles Adhan alerts, reminders, and system tray updates
6. **Persistence**: Settings and user data saved locally for offline use

### 🔐 Architecture Highlights

- **Modular Design**: Separated concerns (services, handlers, UI modules)
- **Secure IPC**: Preload script sandboxes main-renderer communication
- **Responsive UI**: Adapts to different screen sizes and orientations
- **Multi-language**: Centralized translation system with RTL support
- **Theme Engine**: Dynamic theme switching without restart
- **Offline Support**: Works seamlessly after initial data load

---

## 🤝 Contributing

We welcome contributions! Please feel free to:
- 🐛 Report bugs via GitHub Issues
- 💡 Suggest features and improvements
- 🔀 Submit pull requests
- 📝 Improve documentation

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 📧 Contact & Support

- 📧 **Email**: salatytime@gmail.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/yassindaboussi/Salaty/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yassindaboussi/Salaty/discussions)

---

<p align="center">
  <strong>Made with ❤️ for the Muslim community</strong><br/>
  <sub>May Allah (سُبْحَانَهُ وَتَعَالَىٰ) accept from us all</sub>
</p>

</div>
