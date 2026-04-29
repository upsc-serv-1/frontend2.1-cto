import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Alert, 
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { spacing, radius } from '../../src/theme';
import { ChevronLeft, Save, Info, BookOpen, Layers, Target } from 'lucide-react-native';
import { PageWrapper } from '../../src/components/PageWrapper';
import { pickAndUploadFlashcardImage } from '../../src/services/ImageUpload';

export default function NewCard() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [microtopic, setMicrotopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);

  const save = async () => {
    if (!uid) return;
    if (!front.trim() || !back.trim() || !subject.trim() || !section.trim()) {
      return Alert.alert('Missing Fields', 'Front, Back, Subject, and Section are required.');
    }

    setSaving(true);
    try {
      // 1. Create the card entry in 'cards' table
      const { data: card, error: cardError } = await supabase
        .from('cards')
        .insert({
          question_id: `manual_${Date.now()}`,
          test_id: 'manual',
          question_text: front.trim(),
          answer_text: back.trim(),
          subject: subject.trim(),
          section_group: section.trim(),
          microtopic: microtopic.trim() || 'General',
          provider: 'User',
          explanation_markdown: back.trim(),
          front_image_url: frontImageUrl ?? null,
          back_image_url: backImageUrl ?? null,
        })
        .select('id')
        .single();

      if (cardError) throw cardError;

      // 2. Link to user_cards for tracking
      const { error: userCardError } = await supabase
        .from('user_cards')
        .insert({
          user_id: uid,
          card_id: card.id,
          status: 'active',
          learning_status: 'not_studied',
          next_review: new Date().toISOString()
        });

      if (userCardError) throw userCardError;

      Alert.alert("Success", "Card added to your Deck Hub!");
      router.back();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (label: string, value: string, setter: (t: string) => void, placeholder: string, multiline = false, icon: any) => {
    const Icon = icon;
    return (
      <View style={s.inputGroup}>
        <View style={s.labelRow}>
          <Icon size={14} color={colors.textTertiary} />
          <Text style={[s.label, { color: colors.textTertiary }]}>{label}</Text>
        </View>
        <TextInput
          value={value}
          onChangeText={setter}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary + '80'}
          style={[
            s.input, 
            { 
              backgroundColor: colors.surfaceStrong + '10', 
              borderColor: colors.border, 
              color: colors.textPrimary,
              minHeight: multiline ? 100 : 50
            }
          ]}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    );
  };

  return (
    <PageWrapper>
      <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <ChevronLeft size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[s.title, { color: colors.textPrimary }]}>Create Flashcard</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={s.infoBox}>
                <Info size={16} color={colors.primary} />
                <Text style={[s.infoText, { color: colors.textSecondary }]}>
                  Manual cards will appear in your Deck Hub under the specified subject and section.
                </Text>
              </View>

              {renderInput('SUBJECT', subject, setSubject, 'e.g. Indian Polity', false, BookOpen)}
              {renderInput('SECTION GROUP', section, setSection, 'e.g. Preamble', false, Layers)}
              {renderInput('MICRO TOPIC (OPTIONAL)', microtopic, setMicrotopic, 'e.g. Key Terms', false, Target)}
              
              <View style={[s.divider, { backgroundColor: colors.border }]} />

              {renderInput('FRONT (QUESTION)', front, setFront, 'The question or prompt...', true, Info)}

              <TouchableOpacity
                onPress={async () => {
                  const url = await pickAndUploadFlashcardImage(uid!);
                  if (url) setFrontImageUrl(url);
                }}
                style={[s.saveBtn, { backgroundColor: colors.primary, marginBottom: 12 }]}
              >
                <Text style={[s.saveBtnText, { color: colors.buttonText }]}>
                  {frontImageUrl ? 'Change Front Image' : 'Add Front Image'}
                </Text>
              </TouchableOpacity>
              {frontImageUrl && (
                <Image source={{ uri: frontImageUrl }} style={{ width: 120, height: 120, borderRadius: 8, marginBottom: 12 }} />
              )}

              {renderInput('BACK (ANSWER)', back, setBack, 'The answer or explanation...', true, Info)}

              <TouchableOpacity
                onPress={async () => {
                  const url = await pickAndUploadFlashcardImage(uid!);
                  if (url) setBackImageUrl(url);
                }}
                style={[s.saveBtn, { backgroundColor: colors.primary, marginBottom: 12 }]}
              >
                <Text style={[s.saveBtnText, { color: colors.buttonText }]}>
                  {backImageUrl ? 'Change Back Image' : 'Add Back Image'}
                </Text>
              </TouchableOpacity>
              {backImageUrl && (
                <Image source={{ uri: backImageUrl }} style={{ width: 120, height: 120, borderRadius: 8, marginBottom: 12 }} />
              )}

              <TouchableOpacity 
                onPress={save} 
                style={[s.saveBtn, { backgroundColor: colors.primary }]} 
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <>
                    <Save size={20} color={colors.buttonText} />
                    <Text style={[s.saveBtnText, { color: colors.buttonText }]}>Add to Deck Hub</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PageWrapper>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  scrollContent: { padding: spacing.lg, paddingBottom: 100 },
  card: {
    padding: spacing.xl,
    borderRadius: 32,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xl,
  },
  infoText: { fontSize: 12, flex: 1, lineHeight: 18 },
  inputGroup: { marginBottom: spacing.lg },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  divider: { height: 1, marginVertical: spacing.xl, opacity: 0.5 },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 60,
    borderRadius: 20,
    marginTop: spacing.md,
  },
  saveBtnText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 }
});
