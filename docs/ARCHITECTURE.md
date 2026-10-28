# Architecture

## Supported sites

Each site has its own content script, registered in `manifest.json`.

| Platform | Site | Content script |
| --- | --- | --- |
| Claude | `claude.ai` | `src/content/claude.ts` |
| ChatGPT | `chatgpt.com` / `chat.openai.com` | `src/content/chatgpt.ts` |
| Gemini | `gemini.google.com` | `src/content/gemini.ts` |
| Perplexity | `perplexity.ai` | `src/content/perplexity.ts` |

These scripts read the chat pages' DOM, so a site redesign can break saving until the selectors are updated. To add a platform, see [Contributing](../README.md#contributing).

## File layout

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

## Tech stack

- **Manifest V3**
- **TypeScript (strict)**, vanilla DOM, no UI framework
- **IndexedDB** for conversations, messages, tags and nuggets
- **Custom CSS** for the dark popup

## Building

```bash
npm install
npm run build       # compile src/ to the JS the browser loads
npm run typecheck   # type check only
```
