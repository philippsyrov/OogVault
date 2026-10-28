<p align="center">
  <img src="assets/banner.svg" alt="OogVault — Section 9 HUD banner" width="100%">
</p>

# OogVault

<p align="center">
  <a href="https://github.com/philippsyrov/OogVault">OogVault</a> | <a href="https://github.com/philippsyrov/OogVault-Desktop">OogVault Desktop</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Unmaintained-FFD400?style=for-the-badge&labelColor=0a0a08" alt="Status: Unmaintained">
  <a href="#install"><img src="https://img.shields.io/badge/Install-Load_Unpacked-FFD400?style=for-the-badge&labelColor=0a0a08" alt="Install"></a>
  <a href="#privacy"><img src="https://img.shields.io/badge/Privacy-100%25_Local-FFD400?style=for-the-badge&labelColor=0a0a08" alt="Privacy: 100% Local"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-FFD400?style=for-the-badge&labelColor=0a0a08" alt="License: MIT"></a>
  <a href="https://github.com/philippsyrov/OogVault-Desktop"><img src="https://img.shields.io/badge/Companion-OogVault_Desktop-FFD400?style=for-the-badge&labelColor=0a0a08" alt="OogVault Desktop"></a>
  <img src="https://img.shields.io/badge/Version-0.2.0-FFD400?style=for-the-badge&labelColor=0a0a08" alt="Version 0.2.0" />
  <img src="https://img.shields.io/badge/Manifest-V3-FFD400?style=for-the-badge&labelColor=0a0a08" alt="Manifest V3" />
</p>

> [!NOTE]
> **Maintenance status:** OogVault is no longer actively maintained. It was groundwork: the lessons went into newer work. The code still loads, but it hooks into the web pages of Claude, ChatGPT, Gemini and Perplexity, and those change often, so saving may break until the selectors are updated. Forks and PRs are welcome.

**A local search engine for your AI conversations. Stop asking the same question twice.**

You ask Claude how to set up Docker, then ask ChatGPT the same thing a week later. The answer you already had is buried in a thread you can't find, and no chat app searches across the others. **OogVault** is a browser extension that saves conversations on your machine, makes them searchable, and surfaces past answers while you type. **[OogVault Desktop](https://github.com/philippsyrov/OogVault-Desktop)** is the companion app.

<table>
<tr><td><b>One-click save</b></td><td>Adds a “Save to OogVault” button to Claude, ChatGPT, Gemini and Perplexity.</td></tr>
<tr><td><b>Instant search</b></td><td>Full-text keyword search across every conversation in your vault.</td></tr>
<tr><td><b>IDE-style autocomplete</b></td><td>Start typing a question; OogVault matches past prompts and previews the answer inline.</td></tr>
<tr><td><b>Knowledge base</b></td><td>Auto-extracted Q&amp;A nuggets grouped by topic (Finance, Science, Tech, and more).</td></tr>
<tr><td><b>Export &amp; backup</b></td><td>Export chats or the knowledge base as Markdown, or dump everything as reimport-ready JSON.</td></tr>
<tr><td><b>Local-only privacy</b></td><td>IndexedDB in your browser. No accounts, no telemetry, no network calls from the extension.</td></tr>
</table>

---

## Install

> There's no store listing. Load it unpacked; it takes about two minutes. The compiled JavaScript is committed, so no build step is needed.

### Chrome, Brave, or Edge

**Step 1 — Get the code**

Download this repository (**Code → Download ZIP**) and unzip it somewhere permanent (Desktop or Documents). Chrome needs that folder to stay put.

**Step 2 — Open the extensions page**

Paste `chrome://extensions` into the address bar.

**Step 3 — Enable developer mode**

Turn on **Developer mode** (top-right), then click **Load unpacked**.

**Step 4 — Select the folder**

Choose the unzipped **OogVault** folder. Pin the toolbar icon from the puzzle menu when it appears.

### Firefox

**Step 1 — Open the debugging page**

Go to `about:debugging#/runtime/this-firefox`.

**Step 2 — Load the add-on**

Click **Load Temporary Add-on…**

**Step 3 — Pick the manifest**

Select `manifest.json` inside your OogVault folder.

**Step 4 — Use it**

The extension stays loaded until you quit Firefox.

---

## Screenshots

<p align="center">
  <img src="assets/screenshots/Extension%20tab.png" alt="OogVault popup — conversation list" width="48%" />
  <img src="assets/screenshots/Extension%20suggestion%20tab.png" alt="Autocomplete while typing" width="48%" />
</p>

<p align="center">
  <img src="assets/screenshots/Save%20extension%20button.png" alt="Save to OogVault button in Claude" width="72%" />
</p>

---

## Supported platforms

| Platform | Site | Status |
|----------|------|--------|
| Claude | `claude.ai` | Supported |
| ChatGPT | `chatgpt.com` / `chat.openai.com` | Supported |
| Gemini | `gemini.google.com` | Supported |
| Perplexity | `perplexity.ai` | Supported |

---

## Privacy

- **Local only.** Data lives in your browser’s IndexedDB.
- **No network requests.** The extension never phones home.
- **No accounts, no analytics.** No sign-up, tracking or telemetry.
- **Open source.** Audit every line.
- **Your data.** Export or wipe everything from Settings.

---

## Settings

Open the gear icon in the popup or use **Extension options**.

| Setting | Default | What it does |
|---------|---------|----------------|
| Autocomplete | On | IDE-style suggestions while typing |
| Export data | — | Download all conversations as JSON backup |
| Clear data | — | Delete the vault (double-confirmed) |

---

<details>
<summary><strong>Architecture</strong></summary>

```
OogVault/
├── manifest.json              # Extension config (Manifest V3)
├── src/                       # TypeScript source (edit here)
│   ├── background.ts          # Service worker: message hub + DB orchestration
│   ├── content/
│   │   ├── autocomplete.ts    # IDE-style autocomplete dropdown
│   │   ├── claude.ts          # Claude.ai content script
│   │   ├── chatgpt.ts         # ChatGPT content script
│   │   ├── gemini.ts          # Google Gemini content script
│   │   └── perplexity.ts      # Perplexity.ai content script
│   ├── lib/
│   │   ├── db.ts              # IndexedDB layer (conversations, messages, tags, nuggets)
│   │   └── search.ts          # Search engine, fuzzy matching, nugget extraction
│   ├── popup/popup.ts         # Popup logic
│   ├── options/options.ts     # Settings logic
│   └── types/                 # Shared type declarations
├── background.js, content/, lib/, popup/, options/
│                              # Compiled JS (npm run build) plus HTML/CSS; what the browser loads
└── assets/                    # Icons and README artwork
```

</details>

<details>
<summary><strong>Tech stack</strong></summary>

- **Manifest V3** — Current Chrome extension standard
- **TypeScript (strict)** — Vanilla DOM; no UI framework
- **IndexedDB** — Local persistence for conversations, messages, tags, and nuggets
- **Custom CSS** — Dark “liquid glass” popup styling

</details>

---

## Contributing

Pull requests welcome. To add another AI platform:

1. Add `src/content/your-platform.ts`, following `src/content/claude.ts`
2. Implement `extractMessages()` with platform-specific selectors
3. Register the URL match in `manifest.json`
4. `npm install && npm run build`, then reload the extension

Saving, search, autocomplete and nuggets work automatically.

---

## License

MIT, see [LICENSE](LICENSE).

---

## Credits

Built by **[Philipp Syrov](https://github.com/philippsyrov)**. Companion desktop app: **[OogVault Desktop](https://github.com/philippsyrov/OogVault-Desktop)**.

<p align="center">
  <em>"There are no accidents."</em> — Master Oogway
</p>
