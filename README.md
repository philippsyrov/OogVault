<p align="center">
  <img src="assets/banner.PNG" alt="OogVault — Master Oogway guards your AI conversations" width="100%" />
</p>

<h1 align="center">OogVault 🐢</h1>

<p align="center">
  <strong>"Yesterday is history, tomorrow's still a mystery, chats rest within the vault in secrecy."</strong>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/Status-Beta-gold?style=flat-square" alt="Status: Beta" /></a>
  <a href="#-privacy"><img src="https://img.shields.io/badge/Privacy-100%25_Local-2d6a4f?style=flat-square" alt="100% Local" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Manifest-V3-3a6ea5?style=flat-square" alt="Manifest V3" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-d4a843?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Version-0.2.0-40916c?style=flat-square" alt="Version 0.2.0" />
</p>

<p align="center">
  <em>A local search engine for your AI conversations. Never re-ask the same question twice.</em>
</p>

---

## The Problem

You ask Claude how to set up a Docker container. A week later, you ask ChatGPT the same thing. You've already gotten the perfect answer — but it's buried in a conversation you can't find.

Free-tier users lose conversations after limits. Pro users have thousands of chats with no way to search across them. Everyone wastes tokens re-asking questions they've already answered.

## The Solution

**OogVault** is a browser extension that saves your AI conversations locally, makes them instantly searchable, and reminds you when you've already asked something — right before you hit send.

---

## 📸 Screenshots

### Your Vault
> All saved conversations in one place, grouped by date and searchable instantly.

<img src="assets/screenshots/Extension%20tab.png" alt="OogVault popup — conversation list" width="480" />

---

### Smart Autocomplete
> Start typing a question you've asked before — OogVault catches it and shows the answer preview before you hit send.

<img src="assets/screenshots/Extension%20suggestion%20tab.png" alt="Autocomplete suggestion while typing" width="680" />

---

### One-Click Save
> A "Save to OogVault" button is injected directly into Claude, ChatGPT, Gemini, and Perplexity. No copy-pasting, no manual work.

<img src="assets/screenshots/Save%20extension%20button.png" alt="Save to OogVault button in Claude" width="680" />

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **One-Click Save** | Save any conversation from Claude, ChatGPT, Gemini, or Perplexity with a single click |
| **Instant Search** | Full-text keyword search across all your saved conversations |
| **IDE-Style Autocomplete** | Start typing a question and OogVault shows matching past questions with answer previews — like VS Code autocomplete, but for your brain |
| **Knowledge Base** | Every saved conversation is automatically distilled into Q&A nuggets, auto-categorized by topic (Finance, Science, Tech, and more) |
| **Export as Markdown** | Export individual conversations or your entire knowledge base as `.md` files |
| **Full Backup** | Export everything as a `.json` backup from the Settings page — reimport-ready |

---

## 🖥️ Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| Claude | `claude.ai` | ✅ Supported |
| ChatGPT | `chatgpt.com` / `chat.openai.com` | ✅ Supported |
| Gemini | `gemini.google.com` | ✅ Supported |
| Perplexity | `perplexity.ai` | ✅ Supported |

---

## 🚀 Installation

> Chrome Web Store listing coming soon. Until then, install it manually — it takes 2 minutes, we promise.

### Chrome / Brave / Edge

**Step 1** — Download this repo as a ZIP

> Click the green **Code** button at the top of this page → **Download ZIP**

**Step 2** — Unzip it somewhere permanent

> Like your Desktop or Documents folder. Don't delete it later — Chrome needs it to stay there.

**Step 3** — Open Chrome and go to `chrome://extensions`

> Paste that in your address bar.

**Step 4** — Turn on Developer Mode

> There's a toggle in the top-right corner. Flip it on.

**Step 5** — Click "Load unpacked"

> A file picker appears. Navigate to the unzipped **OogVault** folder and select it.

**Step 6** — Done. The 🐢 appears in your toolbar.

> Pin it for easy access: click the puzzle piece icon in Chrome's toolbar → pin OogVault.

---

### Firefox

```
1. Open about:debugging#/runtime/this-firefox
2. Click "Load Temporary Add-on"
3. Select manifest.json from the OogVault folder
```

> Note: Firefox temporary add-ons are removed when the browser restarts. A permanent Firefox listing is on the roadmap.

---

## 🔒 Privacy

This is non-negotiable.

- **100% local** — All data stored in your browser's IndexedDB
- **Zero network requests** — The extension never phones home
- **No accounts** — No sign-up, no login, no tracking
- **No analytics** — Zero telemetry, zero fingerprinting
- **Open source** — Audit every line yourself
- **Your data, your rules** — Export or nuke everything anytime

---

## ⚙️ Settings

Access via the gear icon in the popup or right-click → Options.

| Setting | Default | Description |
|---------|---------|-------------|
| Autocomplete | ✅ On | Toggle IDE-style suggestions while typing on/off |
| Export data | — | Download all conversations as a `.json` backup |
| Clear data | — | Delete all vault contents (double-confirmed) |

---

## 🏗️ Architecture

```
OogVault/
├── manifest.json              # Extension config (Manifest V3)
├── background.js              # Service worker: message hub + DB orchestration
├── content/
│   ├── autocomplete.js        # IDE-style autocomplete dropdown
│   ├── claude.js              # Claude.ai content script
│   ├── chatgpt.js             # ChatGPT content script
│   ├── gemini.js              # Google Gemini content script
│   ├── perplexity.js          # Perplexity.ai content script
│   └── inject.css             # Injected UI styles
├── lib/
│   ├── db.js                  # IndexedDB layer (conversations, messages, tags, nuggets)
│   └── search.js              # Search engine, fuzzy matching, nugget extraction + topic classification
├── popup/
│   ├── popup.html             # Popup UI with Conversations + Knowledge tabs
│   ├── popup.js               # Popup logic
│   └── popup.css              # Dark theme styles
├── options/
│   ├── options.html           # Settings page
│   ├── options.js             # Settings logic
│   └── options.css            # Settings styles
└── assets/
    └── icon-*.png             # Extension icons
```

---

## 🛠️ Tech Stack

- **Manifest V3** — Chrome extension standard
- **Vanilla JavaScript** — No frameworks, no build step, no dependencies
- **IndexedDB** — Local persistent storage (conversations, messages, tags, nuggets)
- **Custom CSS** — Apple Liquid Glass aesthetic with frosted glass effects

---

## 🗺️ Roadmap

- [x] One-click save (Claude, ChatGPT, Gemini, Perplexity)
- [x] Local storage & keyword search
- [x] IDE-style autocomplete with answer previews
- [x] Knowledge Nuggets (auto-extracted Q&A pairs)
- [x] Knowledge Base tab with auto topic categorization
- [x] Per-category and full knowledge export
- [x] Tags & organization
- [x] Full JSON backup from Settings
- [ ] Chrome Web Store listing
- [ ] Firefox Add-on Store listing

---

## 🤝 Contributing

Pull requests welcome! To add support for a new AI platform:

1. Create `content/your-platform.js` following the pattern in `claude.js`
2. Add the URL match pattern to `manifest.json`
3. Implement `extractMessages()` with platform-specific DOM selectors
4. The rest (saving, search, autocomplete, nuggets) works automatically

---

## 📄 License

MIT — free to use, modify, and distribute.

---

<p align="center">
  <em>"There are no accidents."</em> — Master Oogway <em>(probably)</em>
</p>

<p align="center">
  <strong>🐢 Search your vault first. Save the tokens.</strong>
</p>
