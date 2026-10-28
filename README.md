<p align="center">
  <img src="assets/icon-128.png" alt="OogVault icon" width="96">
</p>

<h1 align="center">OogVault</h1>

<p align="center">A local search engine for your AI conversations.</p>

<p align="center">
  <a href="https://github.com/philippsyrov/OogVault/releases/latest"><img src="https://img.shields.io/github/v/release/philippsyrov/OogVault?style=flat&color=555" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/status-unmaintained-555?style=flat" alt="Status: unmaintained">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/philippsyrov/OogVault?style=flat&color=555" alt="MIT License"></a>
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="https://github.com/philippsyrov/OogVault-Desktop">OogVault Desktop</a> ·
  <a href="#contributing">Contributing</a>
</p>

> [!NOTE]
> **Maintenance status:** OogVault is no longer actively maintained. It was groundwork: the lessons went into newer work. The code still loads, but it hooks into the web pages of Claude, ChatGPT, Gemini and Perplexity, and those change often, so saving may break until the selectors are updated. Forks and PRs are welcome.

You ask Claude how to set up Docker, then ask ChatGPT the same thing a week later. The answer you already had is buried in a thread you can't find, and no chat app searches across the others. **OogVault** is a browser extension that saves conversations on your machine, makes them searchable, and surfaces past answers while you type. **[OogVault Desktop](https://github.com/philippsyrov/OogVault-Desktop)** is the companion app.

<p align="center">
  <img src="assets/screenshots/Extension%20tab.png" alt="OogVault popup — conversation list" width="48%" />
  <img src="assets/screenshots/Extension%20suggestion%20tab.png" alt="Autocomplete while typing" width="48%" />
</p>

<p align="center">
  <img src="assets/screenshots/Save%20extension%20button.png" alt="Save to OogVault button in Claude" width="72%" />
</p>

<table>
<tr><td><b>One-click save</b></td><td>Adds a “Save to OogVault” button to Claude, ChatGPT, Gemini and Perplexity.</td></tr>
<tr><td><b>Instant search</b></td><td>Full-text keyword search across every conversation in your vault.</td></tr>
<tr><td><b>IDE-style autocomplete</b></td><td>Start typing a question; OogVault matches past prompts and previews the answer inline.</td></tr>
<tr><td><b>Knowledge base</b></td><td>Auto-extracted Q&amp;A nuggets grouped by topic (Finance, Science, Tech, and more).</td></tr>
<tr><td><b>Export &amp; backup</b></td><td>Export chats or the knowledge base as Markdown, or dump everything as reimport-ready JSON.</td></tr>
<tr><td><b>Local-only privacy</b></td><td>IndexedDB in your browser. No accounts, no telemetry, no network calls from the extension.</td></tr>
</table>

## Supported sites

| Platform | Site |
| --- | --- |
| Claude | `claude.ai` |
| ChatGPT | `chatgpt.com` / `chat.openai.com` |
| Gemini | `gemini.google.com` |
| Perplexity | `perplexity.ai` |

## Install

There's no store listing. Load it unpacked; it takes about two minutes. The compiled JavaScript is committed, so no build step is needed.

**Chrome, Brave or Edge**

1. Download this repository (**Code → Download ZIP**) and unzip it somewhere permanent, such as Documents. The browser needs that folder to stay put.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right), then click **Load unpacked**.
4. Choose the unzipped **OogVault** folder. Pin the toolbar icon from the puzzle menu.

**Firefox**

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` inside your OogVault folder.

The add-on stays loaded until you quit Firefox.

## Settings

Open the gear icon in the popup or use **Extension options**.

| Setting | Default | What it does |
|---------|---------|----------------|
| Autocomplete | On | IDE-style suggestions while typing |
| Export data | — | Download all conversations as JSON backup |
| Clear data | — | Delete the vault (double-confirmed) |

## Privacy

- **Local only.** Data lives in your browser’s IndexedDB.
- **No network requests.** The extension never phones home.
- **No accounts, no analytics.** No sign-up, tracking or telemetry.
- **Open source.** Audit every line.
- **Your data.** Export or wipe everything from Settings.

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
└── assets/                    # Icons and screenshots
```

</details>

<details>
<summary><strong>Tech stack</strong></summary>

- **Manifest V3**
- **TypeScript (strict)**, vanilla DOM, no UI framework
- **IndexedDB** for conversations, messages, tags and nuggets
- **Custom CSS** for the dark popup

</details>

## Contributing

Pull requests welcome. To add another AI platform:

1. Add `src/content/your-platform.ts`, following `src/content/claude.ts`
2. Implement `extractMessages()` with platform-specific selectors
3. Register the URL match in `manifest.json`
4. `npm install && npm run build`, then reload the extension

Saving, search, autocomplete and nuggets work automatically.

## License

MIT, see [LICENSE](LICENSE).

Built by [Philipp Syrov](https://github.com/philippsyrov). Companion app: [OogVault Desktop](https://github.com/philippsyrov/OogVault-Desktop).

<p align="center"><em>"There are no accidents."</em> — Master Oogway</p>
