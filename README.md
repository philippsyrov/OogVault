<p align="center">
  <img src="assets/banner.PNG" alt="OogVault — Master Oogway guards your AI conversations" width="100%" />
</p>

<h1 align="center">OogVault 🐢▬</h1>

<p align="center">
  <strong>"Yesterday is history, tomorrow's still a mystery, your chats rest within the vault in secrecy."</strong>
</p>

<p align="center">
  <a href="#-features"><img src="https://img.shields.io/badge/Status-Beta-gold?style=flat-square" alt="Status: Beta" /></a>
  <a href="#-privacy"><img src="https://img.shields.io/badge/Privacy-100%25_Local-2d6a4f?style=flat-square" alt="100% Local" /></a>
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Manifest-V3-3a6ea5?style=flat-square" alt="Manifest V3" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-d4a843?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Version-0.2.0-40916c?style=flat-square" alt="Version 0.2.0" />
</p>

<p align="center">
  <em>Like having a search engine but ONLY for your AI conversations.</em>
</p>

---

## The Problem

You ask Claude how to set up a Docker container. A week later, you ask ChatGPT the same thing. You've already gotten the perfect answer — but it's buried in a conversation you can't find.

**Free-tier users lose conversations after limits.** Pro users have thousands of chats with no way to search across them. Everyone wastes tokens re-asking questions they've already answered.

## The Solution

**OogVault** is a browser extension that automatically saves your AI conversations locally, makes them searchable, and reminds you when you've already asked something — before you hit send.

> *"Claude has `skills.md` to remember best practices. I built the same thing for humans — except it auto-populates from every AI conversation you have."*

---

## ✨ Features

### Core
| Feature | Description |
|---------|-------------|
| **Auto-Capture** | Silently saves conversations from Claude and ChatGPT as you chat |
| **Instant Search** | Full-text keyword search across all your saved conversations |
| **Knowledge Nuggets** | Automatically extracts Q&A pairs from your conversations into distilled knowledge |
| **Export** | Export conversations as Markdown, or your entire knowledge base as `knowledge.md` |

### The Killer Feature: IDE-Style Autocomplete

Start typing a question and OogVault checks if you've asked something similar before. A dropdown appears — like VS Code autocomplete — showing your past questions **with answer previews**.

> No API call needed. No tokens burned. Just instant recall from your own vault.

### Continue Conversation

Hit your message limit? One click generates a summary of the conversation you can paste into a new chat. The AI picks up right where you left off — no manual re-explaining.

### Knowledge Base

Every conversation you save is automatically distilled into **Q&A nuggets** — compact question-answer pairs you can browse, search, and export as a portable `knowledge.md` file.

---

## 🚀 Quick Start

### Chrome

```
1. Clone or download this repo
2. Open chrome://extensions/
3. Enable Developer mode (top right toggle)
4. Click Load unpacked → select the OogVault folder
5. Visit claude.ai or chatgpt.com and start chatting
```

### Firefox

```
1. Open about:debugging#/runtime/this-firefox
2. Click Load Temporary Add-on
3. Select manifest.json from the OogVault folder
```

**That's it.** OogVault works in the background. Click the extension icon to search, browse, and manage your vault.

---

## 🖥️ Supported Platforms

| Platform | URL | Status |
|----------|-----|--------|
| Claude | `claude.ai` | ✅ Supported |
| ChatGPT | `chatgpt.com` / `chat.openai.com` | ✅ Supported |
| Gemini | `gemini.google.com` | 🔜 Planned |
| Perplexity | `perplexity.ai` | 🔜 Planned |

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

## 🏗️ Architecture

```
OogVault/
├── manifest.json              # Extension config (Manifest V3)
├── background.js              # Service worker: message hub + DB orchestration
├── content/
│   ├── autocomplete.js        # IDE-style autocomplete dropdown
│   ├── claude.js              # Claude.ai content script
│   ├── chatgpt.js             # ChatGPT content script
│   └── inject.css             # Injected UI styles
├── lib/
│   ├── db.js                  # IndexedDB layer (conversations, messages, tags, nuggets)
│   └── search.js              # Search engine, fuzzy matching, nugget extraction
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

### Data Flow

```
User chats on Claude/ChatGPT
        ↓
Content script captures messages (MutationObserver)
        ↓
Background service worker saves to IndexedDB
        ↓
    ┌───┴───────────────────┐
    ↓                       ↓
Conversations           Knowledge Nuggets
(full message history)  (distilled Q&A pairs)
    ↓                       ↓
Popup search            Autocomplete previews
Export as .md           Export as knowledge.md
Tags & organization     Knowledge Base tab
Continue conversation
```

---

## ⚙️ Settings

Access via the gear icon in the popup or right-click > Options.

| Setting | Default | Description |
|---------|---------|-------------|
| Auto-save | ✅ On | Automatically capture conversations |
| Autocomplete | ✅ On | Show IDE-style suggestions while typing |
| Trigger length | 20 chars | Minimum characters before autocomplete activates |
| Export data | — | Download everything as JSON |
| Clear data | — | Delete all vault contents |

---

## 🛠️ Tech Stack

- **Manifest V3** — Chrome extension standard
- **Vanilla JavaScript** — No frameworks, no build step, no dependencies
- **IndexedDB** — Local persistent storage (conversations, messages, tags, nuggets)
- **Custom CSS** — Earthy greens, ancient gold, mystical blues

---

## 🗺️ Roadmap

- [x] Auto-capture (Claude + ChatGPT)
- [x] Local storage & keyword search
- [x] IDE-style autocomplete with answer previews
- [x] Knowledge Nuggets (auto-extracted Q&A pairs)
- [x] Knowledge Base tab + knowledge.md export
- [x] Continue Conversation summaries
- [x] Tags & organization
- [ ] Gemini support
- [ ] Perplexity support
- [ ] Smart topic clustering
- [ ] Knowledge graph visualization
- [ ] Firefox Add-on Store listing
- [ ] Chrome Web Store listing

---

## 🤝 Contributing

Pull requests welcome! To add support for a new AI platform:

1. Create `content/your-platform.js` following the pattern in `claude.js`
2. Add the URL match pattern to `manifest.json`
3. Implement `extractMessages()` with platform-specific DOM selectors
4. The rest (saving, search, autocomplete, nuggets) works automatically

---

## 📄 License

MIT — do whatever you want with it.

---

<p align="center">
  <em>"There are no accidents."</em> — Master Oogway <em>(definitely not copyrighted)</em>
</p>

<p align="center">
  <strong>🐢 Save tokens. Save water. Save electricity. Search your vault first.</strong>
</p>
