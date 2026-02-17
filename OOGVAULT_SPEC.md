# OogVault 🐢▬ - Complete Project Specification

![OogVault Banner](/mnt/user-data/uploads/IMG_2932.png)

## 🎯 Official Tagline

> **"Yesterday is history, tomorrow's still a mystery, your chats rest within the vault in secrecy."**
> 
> — Master Oogway (definitely not copyrighted)

---

## 🐢 Core Slogans & Selling Points

### Main Slogan:
**"Like having a search engine but ONLY for your AI conversations."**

### Official Tagline:
**"Yesterday is history, tomorrow's still a mystery, your chats rest within the vault in secrecy."**

### Killer Feature:
**"IDE-style autocomplete - your AI remembers what you already asked"**

### Market Hook:
**"Unlimited memory for free-tier users"**

### Community Pitch:
**"Claude has skills.md to remember best practices. I built the same thing for humans - except it auto-populates from every AI conversation you have."**

---

## 🎨 Brand Identity

### Name: **OogVault**

### Mascot: **Master Oogway (Censored Edition)**
- Ancient wise turtle with black bar over eyes
- "Definitely not copyrighted" aesthetic
- Represents: wisdom, memory, patience, protection

### Visual Style:
- **Colors:** Earthy greens, ancient gold, mystical blues
- **Vibe:** Wise but memey, helpful but funny, ancient but modern
- **Tone:** Calm turtle energy meets meme culture

### Banner/Hero Image:
![Master Oogway with censorship bar, meditating under peach tree](/mnt/user-data/uploads/IMG_2932.png)

### Logo Concepts:
**Simple Version (MVP):** 🐢▬ (turtle emoji + black bar)
**Icon Version:** Minimalist turtle silhouette with black bar across eyes
**Meme Version:** Actual Oogway screenshot with MS Paint black bar (intentionally janky)

### Where to Use the Banner:
- GitHub repo header
- Website hero section  
- Twitter/X profile banner
- Chrome Web Store listing
- ProductHunt thumbnail

---

## 🔥 The Problem

Free-tier AI users (ChatGPT, Claude) constantly lose valuable knowledge because:
- **Chat limits force starting new conversations** → context is lost
- Old conversations get buried and are hard to find
- No way to search across different AI platforms
- Knowledge fragmented across ChatGPT, Claude, Gemini, etc.
- When you run out of messages, all your work disappears
- **You keep re-asking the same questions** because you forgot you already got the answer

**Result:** Users waste time, tokens, and message limits re-asking questions they already got answers for.

---

## ✨ The Solution

A browser extension that:
1. **Automatically saves** all your AI conversations to a local database on your computer
2. Makes them **instantly searchable** with keywords - forever
3. **IDE-style autocomplete** - suggests past answers as you type new questions
4. Works **100% locally** - your data never leaves your computer
5. **Cross-platform** - works with ChatGPT, Claude, and more

---

## 🎬 Core User Flows

### Flow 1: Auto-Save & Search
1. User chats with Claude or ChatGPT (normal usage)
2. Extension silently captures and saves the conversation locally
3. Later, user needs something they discussed before
4. User opens extension popup, searches with a keyword
5. Extension shows all matching conversations from local database
6. User clicks to view full conversation, copies what they need
7. User continues working without re-asking the same question

### Flow 2: IDE-Style Autocomplete (KILLER FEATURE)
1. User starts typing in ChatGPT/Claude: "How do I implement a factory patt..."
2. Memory Bank detects what you're typing
3. **Dropdown appears** (like VS Code autocomplete):
   ```
   💡 You asked this before:
   
   → "How do I implement factory pattern in Python?"
      (Claude • 2 months ago)
   
   → "Factory pattern vs Strategy pattern?"
      (ChatGPT • 3 weeks ago)
   
   Press Tab to view conversation
   ```
4. User hits Tab → Popup shows the old conversation
5. User reads the answer, doesn't even need to send the message!
6. **Saves time, tokens, and message limits**

### Flow 3: Continue Conversation (Free Tier Savior)
1. User hits message limit on ChatGPT/Claude free tier
2. Forced to start new conversation → all context lost
3. User clicks "Continue Conversation" in Memory Bank
4. Extension generates summary of previous chat
5. User pastes summary into new chat
6. AI picks up right where you left off

---

## 📦 MVP Features (Phase 1 - Week 1)

### Must Have:
1. ✅ **Browser extension** (Chrome/Firefox)
2. ✅ **Auto-capture** conversations from:
   - claude.ai
   - chat.openai.com
3. ✅ **Local storage** (SQLite database on user's computer)
4. ✅ **Keyword search** (simple text matching)
5. ✅ **View conversations** (popup shows full chat history)
6. ✅ **Manual save button** (appears on chat interface - "💾 Save to Memory Bank")

### Technical Stack:
- **Extension:** Manifest V3, vanilla JavaScript (keep it simple)
- **Database:** SQLite (via sql.js for browser compatibility)
- **Storage:** Chrome/Firefox local storage API
- **UI:** Simple HTML/CSS popup

---

## 🚀 Killer Features (Phase 2 - Week 2)

### IDE-Style Autocomplete:
**THE feature that makes this go viral**

#### How it works:
```javascript
// In content script
const inputBox = document.querySelector('textarea');

inputBox.addEventListener('input', (e) => {
  const query = e.target.value;
  
  if (query.length > 20) { // Only trigger for substantial queries
    // Search local database for similar past questions
    const matches = searchPastQuestions(query);
    
    if (matches.length > 0) {
      // Show floating suggestion dropdown
      showAutocompleteSuggestion(matches);
    }
  }
});
```

#### Why this is INSANE:
- ✅ **Saves time** - Don't wait for AI response (you already got it!)
- ✅ **Saves tokens/message limits** - No need to send duplicate questions
- ✅ **Feels like magic** - Like your brain remembering automatically
- ✅ **Familiar UX** - Developers already love IDE autocomplete
- ✅ **No other tool does this** - Unique market differentiation

#### Advanced version (Phase 3):
- Fuzzy matching (detects similar questions with different wording)
- Semantic similarity (using embeddings)
- Learn what you tend to re-ask
- Smart ranking (most recent + most relevant)

---

## 🎨 User Interface

### Extension Popup (click extension icon):
```
┌─────────────────────────────────────┐
│  🧠 AI Memory Bank                  │
├─────────────────────────────────────┤
│  Search: [_________________] 🔍     │
├─────────────────────────────────────┤
│  📅 Today                            │
│  • Python decorators explanation    │
│    (Claude - 2:34 PM)               │
│                                      │
│  📅 Yesterday                        │
│  • Meera recommendation system       │
│    (ChatGPT - 10:22 AM)             │
│                                      │
│  • React hooks debugging             │
│    (Claude - 3:15 PM)               │
├─────────────────────────────────────┤
│  💾 Saved: 47 conversations          │
│  ⚙️ Settings                         │
└─────────────────────────────────────┘
```

### Conversation View (click to expand):
```
┌─────────────────────────────────────┐
│  ← Back to Search                   │
├─────────────────────────────────────┤
│  Meera recommendation system         │
│  ChatGPT • Yesterday 10:22 AM       │
├─────────────────────────────────────┤
│                                      │
│  You: How do I build a              │
│  recommendation system for a        │
│  geo-social network?                │
│                                      │
│  Assistant: Great question! For a   │
│  geo-social network like Meera...   │
│                                      │
│  [Full conversation here]           │
│                                      │
├─────────────────────────────────────┤
│  📋 Copy   🗑️ Delete   🏷️ Add Tag   │
└─────────────────────────────────────┘
```

### Autocomplete Dropdown (appears while typing):
```
┌─────────────────────────────────────┐
│  💡 You asked this before:          │
├─────────────────────────────────────┤
│  → How do I implement factory       │
│    pattern in Python?               │
│    Claude • 2 months ago            │
│                                      │
│  → Factory pattern vs Strategy      │
│    ChatGPT • 3 weeks ago            │
├─────────────────────────────────────┤
│  Press Tab to view • Esc to dismiss │
└─────────────────────────────────────┘
```

### In-Page Save Button (injected into Claude/ChatGPT):
- Small "💾 Save" button appears next to each conversation
- Clicking it highlights green briefly ("✓ Saved!")
- Already-saved conversations show "✓ Saved"

---

## 💾 Data Structure

### Conversation Object:
```javascript
{
  id: "uuid-here",
  platform: "claude" | "chatgpt",
  title: "Auto-generated from first message",
  messages: [
    {
      role: "user" | "assistant",
      content: "message text",
      timestamp: "ISO-8601 timestamp"
    }
  ],
  created_at: "ISO-8601 timestamp",
  updated_at: "ISO-8601 timestamp",
  tags: ["python", "work"],
  is_auto_saved: true | false
}
```

### SQLite Schema:
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_auto_saved INTEGER DEFAULT 1
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Full-text search index
CREATE VIRTUAL TABLE messages_fts USING fts5(
  conversation_id,
  content
);
```

---

## 🔧 Technical Implementation Details

### Content Script (runs on claude.ai, chat.openai.com):
- Detects when page loads
- Monitors DOM for new messages
- Extracts conversation data using platform-specific selectors
- Injects "💾 Save" button into UI
- **Monitors textarea input for autocomplete**
- Sends data to background script for storage

### Background Script:
- Receives conversation data from content script
- Manages SQLite database
- Handles search queries
- Stores data in Chrome/Firefox local storage
- **Processes autocomplete queries**

### Popup Script:
- Displays search interface
- Queries background script for conversations
- Renders results
- Handles user interactions (view, delete, tag)

---

## 🎯 Platform-Specific Selectors

### Claude.ai:
```javascript
// Example selectors (need to verify actual DOM)
const messageSelector = '[data-testid="message"]';
const userMessageClass = '.user-message';
const assistantMessageClass = '.assistant-message';
const inputTextarea = 'textarea[placeholder*="Reply"]';
```

### ChatGPT:
```javascript
// Example selectors (need to verify actual DOM)
const messageSelector = '[data-message-author-role]';
const messageContent = '.markdown';
const inputTextarea = '#prompt-textarea';
```

---

## 📅 Development Roadmap

### Week 1: MVP (Core Functionality)
- [x] Extension manifest setup
- [x] Content script for claude.ai
- [x] Content script for chat.openai.com
- [x] SQLite database setup
- [x] Background script for data storage
- [x] Popup UI with search
- [x] Manual save button injection
- [x] Basic keyword search

### Week 2: Killer Feature (Autocomplete)
- [x] **IDE-style autocomplete implementation**
- [x] Input monitoring in content script
- [x] Autocomplete dropdown UI
- [x] Fuzzy matching for questions
- [x] Keyboard navigation (Tab, Esc)
- [x] Polish autocomplete UX

### Week 3: Polish & Features
- [x] Auto-save toggle
- [x] Better UI/UX
- [x] Delete conversations
- [x] Basic tagging
- [x] Export single conversation (markdown)
- [x] "Continue Conversation" feature
- [x] Settings page

### Week 4: Test & Prepare Launch
- [x] Use it yourself daily
- [x] Fix bugs
- [x] Add missing features based on usage
- [x] Share with 2-3 friends for feedback
- [x] Write documentation
- [x] Create demo video
- [x] Set up GitHub repo
- [x] Prepare blog post/tweets

---

## 📈 Success Metrics

### Week 1 (MVP):
- ✅ Extension successfully captures conversations
- ✅ Search returns accurate results
- ✅ You personally use it 3+ times per week

### Week 2 (Autocomplete):
- ✅ Autocomplete triggers correctly
- ✅ Suggestions are relevant
- ✅ You stop re-asking duplicate questions

### Month 1:
- ✅ 10+ conversations saved
- ✅ You stop re-asking questions you already got answers for
- ✅ 1-2 friends start using it and love it

### Month 3:
- ✅ 100+ conversations saved
- ✅ Database becomes genuinely valuable
- ✅ Ready to share publicly (Reddit, Twitter, ProductHunt)

---

## 🔒 Privacy & Security

- **100% local** - No data leaves your computer
- **No analytics** - Zero tracking
- **Open source** - Users can audit the code
- **Easy export** - Users own their data, can export anytime
- **No accounts** - No sign-up, no login, just install and use
- **Encrypted storage** (optional for Phase 3)

---

## 🚀 Go-to-Market Strategy

### Phase 1: Personal use + close friends
- Build for yourself
- Share with CS student friends
- Get feedback, iterate

### Phase 2: Soft launch (Reddit/Twitter)
- Post on r/ChatGPT, r/ClaudeAI with demo video featuring OogVault branding
- Share on Twitter/X with the official tagline
- Blog post: "I built OogVault - Master Oogway but for your AI conversations"
- Focus on **autocomplete feature** and **privacy angle** (secrecy) in demos

### Phase 3: Public launch
- ProductHunt launch (emphasize autocomplete + privacy!)
- HackerNews post: "OogVault – A local search engine for AI conversations"
- YouTube demo video showing autocomplete in action with Oogway theming
- Medium article: "Yesterday is history, tomorrow's still a mystery - building OogVault"

### Viral Demo Video Structure:
1. Open with banner + tagline voiceover
2. Show typing a question in ChatGPT
3. Autocomplete pops up: "You asked this 2 months ago"
4. Hit Tab, see old answer instantly with OogVault interface
5. "Your chats rest within the vault in secrecy"
6. Show searching through 100+ saved conversations
7. End with censored Oogway + "Free, local, open source"
8. **Boom. Viral.**

### Key Marketing Angles:

**The Launch Tweet:**
> "Claude has skills.md to remember best practices.
> 
> I built the same thing for humans - except it auto-populates from every AI conversation you have.
> 
> Your own personal knowledge base that grows with every ChatGPT/Claude chat. Free, local, open source.
> 
> Meet OogVault 🐢▬
> 
> [Demo video]"

**Alternative Launch Tweet (Privacy Focus):**
> Yesterday is history, tomorrow's still a mystery, your chats rest within the vault in secrecy.
> 
> I built OogVault 🐢▬ - saves every ChatGPT/Claude conversation locally. Search them instantly. 100% private. 100% free.
> 
> Your AI memory bank that never forgets (and never snitches).
> 
> [Demo video]

**Reddit Post Titles:**
- "I built OogVault - Master Oogway but for your ChatGPT history (definitely not copyrighted)"
- "[Tool] Never lose an AI conversation again - OogVault saves everything locally"
- "Free ChatGPT/Claude memory bank for students on free tier"

**Student-Focused Posts:**
- r/college: "I built a free tool that saves all your ChatGPT study sessions - OogVault"
- r/AskProgramming: "Never lose that perfect code explanation again"
- r/EngineeringStudents: "Free tier ChatGPT + OogVault = unlimited study notes"
- r/GetStudying: "Your AI tutor + a perfect memory"

### Oogway Quote Meme Marketing:

**Meme 1:**
```
Oogway: "Yesterday is history, tomorrow is a mystery..."

OogVault: "Yesterday is searchable, tomorrow is also searchable, 
because I auto-save everything in secrecy"
```

**Meme 2:**
```
Oogway: "There are no accidents"

OogVault: "Except you asking the same question 5 times 
before installing me"
```

**Meme 3:**
```
Po: "Master Oogway, I forgot what you taught me!"

Oogway: "Should've used OogVault 🐢▬"
```

**Meme 4:**
```
Oogway: "One often meets his destiny on the road he takes to avoid it"

OogVault: "One often finds the answer in the conversation 
he forgot he already had"
```

---

## 💪 Competitive Advantages

### vs. Built-in chat history:
- ✅ Works across all AI platforms
- ✅ Better search (full-text + autocomplete)
- ✅ Local/private
- ✅ Never disappears
- ✅ **IDE-style autocomplete (unique!)**

### vs. Manual copy-paste to Notion:
- ✅ Automatic capture
- ✅ Preserves full context
- ✅ Searchable across all conversations
- ✅ **Autocomplete suggests relevant past conversations**

### vs. Paid tools:
- ✅ Completely free
- ✅ No account needed
- ✅ Open source
- ✅ More features than most paid alternatives

---

## 💰 Future Monetization (Optional - Month 6+)

### Keep free tier VERY generous:
- Unlimited local storage
- All core features including autocomplete
- Basic search and tagging
- Export functionality

### Pro tier ($3-5/month):
**Only for convenience features, not core functionality**
- Cloud sync across devices (encrypted)
- AI-powered conversation summaries
- Advanced semantic search (better autocomplete)
- Export to Notion/Obsidian integration
- Bulk operations
- Priority support

**Philosophy:** Free tier should be genuinely useful (not a trial). Pro is for power users who want convenience.

---

## 📁 File Structure

```
oogvault/
├── manifest.json              # Extension config (Manifest V3)
├── background.js             # Background service worker
├── popup/
│   ├── popup.html           # Popup UI
│   ├── popup.js             # Popup logic
│   └── popup.css            # Popup styles (earthy greens, gold accents)
├── content/
│   ├── claude.js            # Claude.ai content script
│   ├── chatgpt.js           # ChatGPT content script
│   ├── autocomplete.js      # Autocomplete logic
│   └── inject.css           # Injected styles (save button, autocomplete)
├── lib/
│   ├── sql.js               # SQLite for browser
│   ├── db.js                # Database helpers
│   └── search.js            # Search & autocomplete algorithms
├── assets/
│   ├── oogway-banner.png    # Hero banner (censored Oogway)
│   ├── icon-16.png          # 🐢▬ style
│   ├── icon-48.png
│   ├── icon-128.png
│   └── oogway-memes/        # Meme assets for marketing
├── options/
│   ├── options.html         # Settings page
│   ├── options.js
│   └── options.css
└── README.md                # Includes tagline and Oogway imagery
```

---

## 🎯 Core Principles

1. **Simple first** - MVP should work in 1 week
2. **User owns data** - Everything stored locally
3. **Privacy first** - No tracking, no cloud (initially)
4. **Actually useful** - Build what YOU need
5. **Ship fast** - Don't overthink, iterate based on usage
6. **Autocomplete is the hook** - This feature makes it viral
7. **Free tier stays free** - Monetization is optional, not required

---

## 🔮 Phase 3+ Features (Future)

### If it takes off, consider adding:

1. **Semantic search** - Find by meaning, not just keywords (using local embeddings)
2. **Desktop companion app** - Tauri-based app for better UX
3. **Timeline view** - See how your knowledge evolved over time
4. **Smart summaries** - AI generates TL;DR for long conversations
5. **Knowledge graphs** - Visualize connections between topics
6. **Collaboration** - Share specific conversations with friends
7. **Mobile app** - iOS/Android for on-the-go access
8. **API** - Let developers build on top of Memory Bank
9. **Integrations** - Notion, Obsidian, Roam Research
10. **Multi-model support** - Gemini, Perplexity, local LLMs

---

## 🎬 Getting Started with Development

### Setup:
1. Clone repo (or create new folder)
2. Create `manifest.json` with basic extension config
3. Load extension in Chrome (developer mode)
4. Visit claude.ai or chat.openai.com
5. Start building!

### First prompts for Cursor + Opus:

**Day 1:**
- "Build the manifest.json and basic extension structure based on this spec"
- "Create the content script for claude.ai that captures conversations"
- "Build the SQLite database layer with the schema from the spec"

**Day 2:**
- "Create the popup UI for searching conversations"
- "Implement keyword search functionality"
- "Add the manual save button that injects into Claude/ChatGPT UI"

**Day 3:**
- "Implement the autocomplete feature that monitors textarea input"
- "Create the autocomplete dropdown UI with keyboard navigation"
- "Add fuzzy matching for finding similar past questions"

**Day 4-7:**
- "Polish the UI and fix bugs"
- "Add export functionality"
- "Implement settings page"
- "Test everything end-to-end"

---

## 🎯 Why This Will Work

### Problem is REAL:
- Every CS student using ChatGPT free feels this pain daily
- Every indie dev building with Claude free loses context constantly
- Millions of people re-ask the same questions every week

### Solution is SIMPLE:
- "A search engine for your AI conversations" - instantly understandable
- No complex onboarding, just install and it works
- Solves an immediate, obvious pain point

### Autocomplete is MAGIC:
- No other tool has this
- Feels futuristic but familiar (IDE users already love autocomplete)
- Saves actual time and money (tokens/message limits)
- Perfect for viral demo videos

### Market timing is PERFECT:
- AI adoption exploding
- Free tier users frustrated with limits
- People realizing they're losing valuable knowledge
- OpenClaw proved personal AI agents work

### You're the right person:
- You USE these tools daily (own dogfood)
- You understand the pain (CS student, working on ML)
- You can build it (know programming)
- You can ship fast (vibe coding mindset)

---

## 💡 Final Thoughts

**This isn't just a cool project - it solves a REAL problem that millions of people have RIGHT NOW.**

The autocomplete feature alone could make this go viral. Imagine the tweet:

> "I built IDE autocomplete for ChatGPT/Claude. Now when I start typing a question, it shows me I already asked it 2 months ago. Never waste tokens on duplicate questions again. 100% free, 100% local, 100% private."
> 
> [Demo video showing autocomplete in action]

That would hit 10k+ likes easy.

**LET'S BUILD THIS! 🚀**

---

## 📝 Notes & Reminders

- Keep it simple - MVP in 1 week
- Autocomplete is THE killer feature - prioritize it
- Use it yourself daily - if you're not using it, it's not solving a real problem
- Ship messy and iterate - don't wait for perfection
- Open source from day 1 - builds trust and community
- Free tier stays generous forever - this is about impact, not extraction
- Privacy is core - "your chats rest within the vault in secrecy" is a PROMISE
- Embrace the Oogway meme energy - it's what makes OogVault unique

**Remember the slogans:**
- "Like having a search engine but ONLY for your AI conversations."
- "Yesterday is history, tomorrow's still a mystery, your chats rest within the vault in secrecy."
- "Claude has skills.md to remember best practices. I built the same thing for humans."

**The vibe:** Wise turtle energy meets meme culture. Ancient wisdom, modern memory. 🐢▬

Now go build it! 💪
