import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ScrollView, Alert } from 'react-native';
import { X, Image as ImageIcon, Save, Type } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { FlashcardSvc } from '../services/FlashcardService';
import { pickAndCompress, uploadCompressedImage } from '../services/ImageUpload';

export function AddBlockToFlashcardSheet({
  visible, onClose, userId, noteId, blockId, suggestedText, subject, sectionGroup, microtopic,
}: {
  visible: boolean; onClose: () => void;
  userId: string; noteId: string; blockId?: string;
  suggestedText: string;
  subject?: string; sectionGroup?: string; microtopic?: string;
}) {
  const [front, setFront] = useState(suggestedText);
  const [back, setBack]   = useState('');
  const [frontImg, setFrontImg] = useState<string | null>(null);
  const [backImg,  setBackImg]  = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickImage = async (which: 'front' | 'back') => {
    const local = await pickAndCompress();
    if (!local) return;
    try {
      const url = await uploadCompressedImage(local);
      if (which === 'front') setFrontImg(url); else setBackImg(url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message || 'Try again.');
    }
  };

  const save = async () => {
    if (!front.trim() || !back.trim()) { Alert.alert('Both sides required'); return; }
    setBusy(true);
    try {
      await FlashcardSvc.createFromNoteBlock(userId, {
        note_id: noteId, block_id: blockId,
        front_text: front, back_text: back,
        front_image_url: frontImg, back_image_url: backImg,
        subject, section_group: sectionGroup, microtopic,
      });
      onClose();
      Alert.alert('Added', 'Block added to your flashcards.');
    } catch (e: any) { Alert.alert('Failed', e.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.head}>
            <Type color={colors.primary} size={20} />
            <Text style={s.title}>Add to Flashcard</Text>
            <TouchableOpacity onPress={onClose}><X color={colors.textPrimary} size={22} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }}>
            <Text style={s.lbl}>FRONT</Text>
            <TextInput multiline value={front} onChangeText={setFront} style={s.input} placeholder="Question / prompt" placeholderTextColor={colors.textTertiary} />
            <TouchableOpacity style={s.imgBtn} onPress={() => pickImage('front')}>
              <ImageIcon size={16} color={colors.primary} />
              <Text style={s.imgBtnText}>{frontImg ? 'Replace front image' : 'Add front image (auto-compress)'}</Text>
            </TouchableOpacity>
            {frontImg && <Text style={s.thumb}>✓ {frontImg.slice(0, 40)}…</Text>}

            <Text style={s.lbl}>BACK</Text>
            <TextInput multiline value={back} onChangeText={setBack} style={s.input} placeholder="Answer / explanation" placeholderTextColor={colors.textTertiary} />
            <TouchableOpacity style={s.imgBtn} onPress={() => pickImage('back')}>
              <ImageIcon size={16} color={colors.primary} />
              <Text style={s.imgBtnText}>{backImg ? 'Replace back image' : 'Add back image'}</Text>
            </TouchableOpacity>
            {backImg && <Text style={s.thumb}>✓ {backImg.slice(0, 40)}…</Text>}

            <TouchableOpacity disabled={busy} onPress={save} style={s.cta}>
              <Save color={colors.primaryFg} size={18} />
              <Text style={s.ctaText}>{busy ? 'SAVING…' : 'SAVE FLASHCARD'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '900', flex: 1 },
  lbl: { color: colors.textTertiary, fontSize: 11, letterSpacing: 2, fontWeight: '900' },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, minHeight: 90, fontSize: 15, textAlignVertical: 'top' },
  imgBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, borderStyle: 'dashed' },
  imgBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  thumb: { color: colors.success, fontSize: 11 },
  cta: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  ctaText: { color: colors.primaryFg, fontWeight: '900', letterSpacing: 1 },
});
