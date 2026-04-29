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
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        <RichEditor
          ref={editorRef}
          initialContentHTML={html}
          onChange={onChange}
          placeholder="Start writing..."
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
