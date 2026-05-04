# Readium — PDF & eBook Reader

A premium, offline-first Progressive Web App for reading PDFs. Built with zero build tools — pure HTML, CSS, and JavaScript.

![AMOLED Dark Mode](https://img.shields.io/badge/Theme-AMOLED%20Dark-000000?style=flat-square)
![Offline Ready](https://img.shields.io/badge/Offline-Ready-6366F1?style=flat-square)
![PWA](https://img.shields.io/badge/PWA-Installable-818CF8?style=flat-square)

## Features

- **📚 Library View** — Bookshelf grid with auto-generated cover thumbnails and progress tracking
- **📖 PDF Rendering** — Powered by PDF.js with viewport-fit scaling
- **💾 Offline Storage** — PDFs stored in IndexedDB via localForage — no re-upload needed
- **📑 Table of Contents** — Parsed from PDF bookmarks with clickable navigation
- **🔄 Page Transitions** — Slide, Fade, and Page Curl (canvas 2D) effects
- **📱 Mobile Scroll Mode** — Continuous vertical scrolling on mobile with lazy page loading
- **📊 Reading Analytics** — Tracks reading speed and estimates time remaining
- **🌑 AMOLED Dark Mode** — Pure black (#000000) background with PDF color inversion
- **⚡ PWA** — Installable on desktop and mobile with full offline support

## Getting Started

### Run Locally

No build step required. Just serve the directory with any static server:

```bash
npx serve .
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Use Online

Visit the live GitHub Pages deployment: **[readium](https://gabriel-amar.github.io/readium/)**

## Tech Stack

| Layer | Technology |
|---|---|
| Core | Vanilla HTML + CSS + JS (ES Modules) |
| PDF Engine | [PDF.js](https://mozilla.github.io/pdf.js/) v4.9 |
| Storage | [localForage](https://localforage.github.io/localForage/) (IndexedDB) |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |
| PWA | Service Worker + Web App Manifest |

## Project Structure

```
├── index.html          # App shell (library + reader + TOC + settings)
├── index.css           # Full design system (light/AMOLED dark themes)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (cache-first, offline support)
├── js/
│   ├── app.js          # Entry point, boots PDF.js, wires modules
│   ├── db.js           # IndexedDB persistence layer
│   ├── library.js      # Bookshelf grid with import/delete
│   ├── reader.js       # PDF canvas renderer + mobile scroll mode
│   ├── transitions.js  # Slide, Fade, Page Curl animations
│   ├── toc.js          # PDF outline parser → sidebar nav
│   ├── analytics.js    # Reading speed + time remaining
│   └── settings.js     # Theme, transitions, PDF inversion prefs
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## License

MIT
