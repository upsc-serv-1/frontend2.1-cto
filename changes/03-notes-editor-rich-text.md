"# 🟠 Part 3 — Notes Editor Rich Text + Keyboard Toolbar

## 🔍 Diagnosis

Open `app/notes/editor.tsx`:

- The **formatting bar** (`floatingBar` around **line 1086**) is inside a `View` positioned `bottom: isKeyboardVisible ? 0 : 20`. That's a manual offset and it doesn't work on iOS because `KeyboardAvoidingView` wraps the **ScrollView**, not the toolbar. The toolbar ends up **behind the keyboard**.
- `applyFormat()` (~line 373) only manipulates **markdown text** inside a plain `TextInput`. A plain `TextInput` in React Native cannot render bold/italic/highlight at the selection level. That's why the buttons \"don't visually work\".
- `insertPointData` modal (~line 1285) is a `Modal` wrapping a `TextInput` but no formatting toolbar at all → \"formatting points not even visible\".
- There's no **highlight color picker** that applies a *chosen color* to a selection.

## 🎯 Goal
1. Wrap the main editor with a **rich text editor** (WebView-based — fully stylable).
2. Toolbar that **sticks above the keyboard** on iOS *and* Android.
3. Toolbar options: **Bold, Italic, Underline, Bullet, Numbered, Highlight (color-chooser)**.
4. Same toolbar appears in the **insert-point modal** popup.
5. A **Settings → Highlighter Color** preference (user picks default color, saved in AsyncStorage).

## 🗄️ SQL changes
Add a `content_html` column to store rich HTML (keeps your existing `content` plain-text for fallback):

```sql
ALTER TABLE user_notes ADD COLUMN IF NOT EXISTS content_html text;
```

## 📁 Files to change / create
- `app/notes/editor.tsx` — edit
- `src/components/RichNoteEditor.tsx` — **new file**

## 💻 Code

### STEP 1 — Install (you already did it in INDEX)
```bash
npx expo install react-native-pell-rich-editor
```

### STEP 2 — Create `src/components/RichNoteEditor.tsx` (NEW FILE — full)

```tsx
import React, { useRef, useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Highlighter } from 'lucide-react-native';

const HIGHLIGHT_COLORS = ['#FFF59D', '#FFB74D', '#81C784', '#4FC3F7', '#BA68C8', '#FF6A88'];
const DEFAULT_COLOR_KEY = 'notes_editor_highlight_color';

type Props = {
  html: string;
  onChange: (html: string) => void;
  themeColors: { bg: string; surface: string; textPrimary: string; border: string; primary: string };
};

export default function RichNoteEditor({ html, onChange, themeColors }: Props) {
  const editorRef = useRef<RichEditor>(null);
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEFAULT_COLOR_KEY).then(v => { if (v) setHighlightColor(v); });
  }, []);

  const applyHighlight = () => {
    // Calls execCommand('backColor', color) inside the WebView
    editorRef.current?.commandDOM(
      `document.execCommand('backColor', false, '${highlightColor}')`
    );
  };

  const pickColor = async (c: string) => {
    setHighlightColor(c);
    await AsyncStorage.setItem(DEFAULT_COLOR_KEY, c);
    setShowPicker(false);
    applyHighlight();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: themeColors.bg }}
    >
      <ScrollView keyboardShouldPersistTaps=\"handled\" style={{ flex: 1 }}>
        <RichEditor
          ref={editorRef}
          initialContentHTML={html}
          onChange={onChange}
          placeholder=\"Start writing...\"
          style={{ minHeight: 500, backgroundColor: themeColors.bg }}
          editorStyle={{
            backgroundColor: themeColors.bg,
            color: themeColors.textPrimary,
            contentCSSText: 'font-size:16px;line-height:1.5;padding:12px;',
          }}
        />
      </ScrollView>

      {showPicker && (
        <View style={[s.picker, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {HIGHLIGHT_COLORS.map(c => (
            <TouchableOpacity key={c} onPress={() => pickColor(c)}
              style={[s.swatch, { backgroundColor: c, borderColor: c === highlightColor ? themeColors.primary : 'transparent' }]} />
          ))}
        </View>
      )}

      <RichToolbar
        editor={editorRef}
        selectedIconTint={themeColors.primary}
        iconTint={themeColors.textPrimary}
        style={{ backgroundColor: themeColors.surface, borderTopWidth: 1, borderTopColor: themeColors.border }}
        actions={[
          actions.setBold,
          actions.setItalic,
          actions.setUnderline,
          actions.insertBulletsList,
          actions.insertOrderedList,
          actions.heading1,
          'highlight',          // custom
        ]}
        iconMap={{
          [actions.heading1]: ({ tintColor }: any) => <View style={{ padding: 4 }}><Highlighter size={0} color={tintColor} /></View>,
          highlight: ({ tintColor }: any) => (
            <TouchableOpacity onLongPress={() => setShowPicker(v => !v)} onPress={applyHighlight}>
              <View style={[s.hlIcon, { backgroundColor: highlightColor }]}>
                <Highlighter size={16} color={tintColor} />
              </View>
            </TouchableOpacity>
          ),
        }}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  picker: { flexDirection: 'row', gap: 8, padding: 8, borderTopWidth: 1, justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  hlIcon: { padding: 6, borderRadius: 6 },
});
```

> **Why `pell-rich-editor`?** It uses a tiny WebView with `document.execCommand`. It works inside Expo Go (no native rebuild), supports **background color** (our highlight), bullets, bold, italic, underline, links — and the toolbar already auto-sticks to the keyboard on iOS via `InputAccessoryView`.

### STEP 3 — Wire it into `app/notes/editor.tsx`

At the top, add:

```tsx
import RichNoteEditor from '../../src/components/RichNoteEditor';
```

Replace the main `<TextInput>` for content (~line 1014) — currently:

```tsx
<TextInput 
  style={[styles.mainEditor, { color: colors.textPrimary, fontSize: editorFontSize + 2 }]} 
  placeholder=\"Start writing...\" 
  multiline 
  value={content} 
  onChangeText={setContent} 
  ...
/>
```

with:

```tsx
<RichNoteEditor
  html={content}
  onChange={setContent}
  themeColors={{
    bg: colors.bg,
    surface: colors.surface,
    textPrimary: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  }}
/>
```

Now **remove** the old toolbar `<View style={[styles.bottomBarContainer...]}>` block (~line 1054–1100) — the `RichToolbar` replaces it entirely. Keep the speed-point bar only if you still want bullet/check/num quick-insert for the **insert-point modal**.

### STEP 4 — Update `handleSave` to persist HTML
Around **line 336** change `updateData` to:

```tsx
const updateData = {
  title,
  content,                    // now this is HTML
  content_html: content,      // 🆕 keep both for safety
  subject,
  items,
  checklist_notes: JSON.stringify(checklist),
  updated_at: new Date().toISOString(),
};
```

### STEP 5 — Fix the insert-point popup modal
Inside the `Modal` (~line 1285) replace the inner `<TextInput>` (~line 1340) with the same `RichNoteEditor`:

```tsx
<RichNoteEditor
  html={insertPointData.text}
  onChange={(h) => setInsertPointData({ ...insertPointData, text: h })}
  themeColors={{ bg: colors.bg, surface: colors.surface, textPrimary: colors.textPrimary, border: colors.border, primary: colors.primary }}
/>
```

Also in `commitInsertion` (~line 173) change `type: 'highlight'` → keep as is, but **trim HTML**:

```tsx
const newPoint = {
  id: `new-${Date.now()}`,
  type: 'highlight',
  text: insertPointData.text.trim(),     // now HTML
  color: HIGHLIGHT_COLORS[0],
};
```

### STEP 6 — Render HTML in preview mode
Where you currently show `<Text>{item.text}</Text>` in `renderHighlights` (preview mode), swap to `react-native-render-html`:

```bash
npx expo install react-native-render-html
```

Then:

```tsx
import RenderHtml from 'react-native-render-html';
// ...
<RenderHtml source={{ html: item.text }} contentWidth={width - 80} />
```

## 🧪 How to test
1. Open any note → tap **+ POINT** to add a highlight block.
2. Type text, select a word, tap **Bold** → word becomes bold.
3. Tap **Highlight** → selection gets yellow background.
4. **Long-press** Highlight icon → color swatches appear → pick orange → now Highlight applies orange.
5. Close and reopen the note → formatting persists (HTML is in `content_html`).
6. On **Android**, tap in editor → keyboard pops up → toolbar floats **above** keyboard.
7. On **iOS**, same — InputAccessoryView keeps the toolbar glued to the keyboard.
8. Open the insert-point modal (`+` between blocks) → same formatting options available.

## ⚠️ Common pitfalls
- `RichEditor` uses a WebView — make sure **`react-native-webview`** is installed (Expo SDK 54 includes it by default; if not: `npx expo install react-native-webview`).
- If the toolbar still hides behind keyboard on Android, add this to `app.json`:
  ```json
  \"android\": { \"softwareKeyboardLayoutMode\": \"pan\" }
  ```
- HTML saved to DB is *not* sanitized — if you share notes across users, add `dompurify` on write.
"