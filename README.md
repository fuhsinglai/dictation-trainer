# English Dictation Trainer

A browser-based tool to practice English listening and typing. Paste or load an article, then listen to one sentence at a time (using the browser’s built-in TTS) and type what you hear. Check your answer to see accuracy and a word-level diff.

Best used in **Chrome** or **Edge** for reliable speech synthesis.

---

## Features

- **Load or paste articles** — Choose from a dropdown (from `articles.json`), pick a `.txt` file, or paste text. Articles are split into sentences and optional sections (by blank lines).
- **TTS playback** — Play current sentence, replay, or play the whole section. Speed and voice selectable.
- **Check & diff** — Compare your typing to the reference. See accuracy %, and a color-coded diff (missing / extra / substitution). Tips based on error type.
- **Session stats** — Score stats (checked count, average accuracy, most wrong words) and a **History** list you can expand to review each check’s diff and tip.
- **Learning stats (localStorage)** — Scores are saved per check (timestamp, article, section, sentence index, accuracy, replay count). Sidebar shows:
  - **7-day average** accuracy  
  - **By article & section** averages  
  - **Trend** chart (last 30 checks)
- **Test mode** — “Don’t record (test)” skips saving to localStorage. “Clear records” wipes all saved scores (with confirmation).

---

## How to run

1. Open `index.html` in Chrome or Edge (double-click or drag into the browser).
2. To load articles from the dropdown, the app needs to fetch `articles.json`. If you open the file via `file://`, the dropdown may be empty due to CORS; use **“Select .txt file”** to pick a `.txt` from `materials/`, or **paste** text and click “Load & Split Sentences”.

To use the dropdown with `articles.json`, serve the folder with any static server (e.g. [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code, or `npx serve .`).

---

## Project structure

```
├── index.html       # Main app (dictation UI)
├── articles.json    # Article list (id, title, file path, etc.)
├── materials/       # .txt article files
└── README.md
```

---

## Adding articles

1. **Via JSON** — Add an entry to `articles.json` with `id`, `title`, `file` (e.g. `"materials/MyStory.txt"`). Put the `.txt` in `materials/`.
2. **Paste** — Paste any English text into the textarea and click “Load & Split Sentences”. (No article id is saved for learning stats.)

---

## Tech

- Plain **HTML / CSS / JavaScript** (no framework).
- **Web Speech API** (`speechSynthesis`) for TTS.
- **localStorage** for score history and last-selected article/section.

---

## License

Use and modify as you like. No warranty.
