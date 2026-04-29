"# 🧭 UPSC Study App — Fix Guide (Master Index)

Hi! This is a **teacher-style walkthrough** for every bug and feature you listed. Read each part top-to-bottom. I will explain **what**, **why**, and **how** — with exact code, exact lines, exact SQL.

---

## 📦 Stack I assumed (from your repo)
- **Frontend:** Expo SDK 54, React Native 0.81.5, Expo Router 6, TypeScript
- **Animation:** `react-native-reanimated@~4.1.1`, `react-native-gesture-handler@~2.28.0`
- **Database:** **Supabase (PostgreSQL)** — `@supabase/supabase-js@^2`
- **Tables already in your DB:** `questions`, `tests`, `question_states`, `user_notes`, `user_note_nodes`, `cards`, `user_cards`, `attempts`

## 🧰 New libraries you must install (ONE time)

Run this in the **project root** (where `package.json` lives):

```bash
# Rich text editor for notes (pell — works with Expo Go, supports highlight)
npx expo install react-native-pell-rich-editor

# Drag & drop for dashboard widgets + notes folders
npx expo install react-native-draggable-flatlist

# Image picker (for flashcards) + expo-image-manipulator — ALREADY in package.json
# (No install needed — you already have expo-image-picker 17.0.11 + image-manipulator 14.0.8)

# File system helper (needed for base64 upload to Supabase Storage)
npx expo install expo-file-system
```

> ⚠️ Do **NOT** hand-edit `package.json`. Always use `npx expo install` so Expo picks the version that matches SDK 54.

---

## 📚 Files in this guide (read in this order)

| # | File | Topic | Severity |
|---|---|---|---|
| 1 | [`01-exam-mode-protection.md`](./01-exam-mode-protection.md) | **CRITICAL** — TDZ bug in `usePreventRemove`, add 3-button prompt | 🔴 Blocker |
| 2 | [`02-notes-drag-drop-folder-move.md`](./02-notes-drag-drop-folder-move.md) | Confirm-Move button, destination picker for folders | 🟠 High |
| 3 | [`03-notes-editor-rich-text.md`](./03-notes-editor-rich-text.md) | Rich text editor, keyboard toolbar, highlighter color | 🟠 High |
| 4 | [`04-dashboard-widgets.md`](./04-dashboard-widgets.md) | Draggable widgets + archive + infinite scroll bug | 🟠 High |
| 5 | [`05-analyze-section.md`](./05-analyze-section.md) | Fix filter buttons + show questions + per-Q error tag | 🟡 Medium |
| 6 | [`06-trends-filtering.md`](./06-trends-filtering.md) | Fix chart overlap + apply subject filter to ALL trends | 🟡 Medium |
| 7 | [`07-pyq-heatmap.md`](./07-pyq-heatmap.md) | Remove Paper-Totals table, sort years DESC, sticky header/column | 🟡 Medium |
| 8 | [`08-flashcards.md`](./08-flashcards.md) | PGRST116, `sectionMap.get` crash, image upload, options clipping | 🟠 High |
| 9 | [`09-animations-transitions.md`](./09-animations-transitions.md) | Slide-from-right for Notes screens | 🟢 Polish |

---

## 🏁 Quick-start checklist (do these in order)

1. Install the new libraries (block above).
2. Open **#1** — fix the exam guard. This is a silent JS crash in your current build.
3. Run the SQL in **`supabase/PATCH_v1.sql`** (I give you the full file in Part #4).
4. Apply parts 2–9 in any order (they're independent).
5. `npx expo start -c` to clear Metro cache after ALL changes.

---

## 📖 How to read each part

Every part follows this exact structure so you never get lost:

```
## 🔍 Diagnosis          — what I actually found in your code
## 🎯 Goal               — what \"fixed\" looks like
## 🗄️  SQL changes        — run these in Supabase SQL Editor first
## 📁 Files to change    — exact path + exact lines
## 💻 Code                — snippets (for edits) / full file (for new files)
## 🧪 How to test         — step-by-step verification
## ⚠️ Common pitfalls     — things that break for everyone
```

---

## 🆘 If something breaks

1. `npx expo start -c` (the `-c` clears Metro cache — fixes 60% of \"it doesn't work\" issues).
2. Check the **Metro terminal** output for red errors — copy the **first line** of the error.
3. Check **Supabase → Logs → Postgres** for SQL errors.
4. If a screen is blank, the TDZ fix in Part #1 is likely needed elsewhere — search your code for `usePreventRemove` or any hook that references a `const` declared later.

Good luck! You've got this. 🚀
"