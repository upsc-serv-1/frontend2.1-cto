import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../theme';
import { TaggedQuestion } from '../hooks/useTaggedQuestions';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Eye, Trash2, Zap } from 'lucide-react-native';
import { FlashcardSvc } from '../services/FlashcardService';

interface RepoQuestionCardProps {
  question: TaggedQuestion;
  onUpdate?: () => void;
  isZenMode?: boolean;
}

export const RepoQuestionCard = ({ question, onUpdate, isZenMode }: RepoQuestionCardProps) => {
  const { colors } = useTheme();
  const { session } = useAuth();
  
  const [revealStage, setRevealStage] = useState(0);
  const [loadingAction, setLoadingAction] = useState<'remove' | 'flash' | null>(null);
  
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;
  const zenSecColor = isZenMode ? '#43342295' : colors.textSecondary;
  const zenTertColor = isZenMode ? '#43342260' : colors.textTertiary;
  
  const normSelected = (question.selectedAnswer || '').trim().toUpperCase();
  const normCorrect = (question.correctAnswer || '').trim().toUpperCase();
  const isCorrect = normSelected === normCorrect;

  const handleNextStage = () => {
    if (revealStage < 2) setRevealStage(revealStage + 1);
    else setRevealStage(0); 
  };

  const handleRemoveTag = async () => {
    if (!session?.user?.id) return;
    setLoadingAction('remove');
    try {
      const { error } = await supabase
        .from('question_states')
        .update({ review_tags: null })
        .eq('user_id', session.user.id)
        .eq('question_id', question.id);
      if (error) throw error;
      if (onUpdate) onUpdate();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleAddToFlashcard = async () => {
    if (!session?.user?.id) return;
    setLoadingAction('flash');
    try {
      // Map TaggedQuestion to a shape FlashcardSvc expects
      const qData = {
        id: question.id,
        question_text: question.questionText,
        explanation_markdown: question.explanation,
        correct_answer: question.correctAnswer,
        subject: question.subject,
        section_group: question.sectionGroup,
        micro_topic: question.microTopic,
        test_id: question.testId || 'repo'
      };
      
      await FlashcardSvc.createFlashcardFromQuestion(session.user.id, qData);
      Alert.alert('Success', 'Question added to your Deck Hub!');
    } catch (err: any) {
      console.error("Flashcard add error:", err);
      Alert.alert('Error', 'Failed to add to Flashcards. ' + (err.message || ''));
    } finally {
      setLoadingAction(null);
    }
  };

  const renderOptions = () => {
    if (!question.options || revealStage === 0) return null;
    const optionsList = Array.isArray(question.options) 
      ? question.options 
      : Object.entries(question.options).map(([key, value]) => ({ key, value }));

    return (
      <View style={styles.optionsContainer}>
        {optionsList.map((opt: any, idx: number) => {
          const key = (opt.key || String.fromCharCode(65 + idx)).trim().toUpperCase();
          const value = typeof opt === 'string' ? opt : opt.value;
          const isUserChoice = normSelected === key;
          const isCorrectAns = normCorrect === key;
          const shouldHighlight = revealStage === 2;

          return (
            <View key={idx} style={[styles.optionRow, { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }, shouldHighlight && isCorrectAns && { backgroundColor: '#22c55e10', borderColor: '#22c55e' }, shouldHighlight && isUserChoice && !isCorrectAns && { backgroundColor: '#f9731610', borderColor: '#f97316' }]}>
              <View style={[styles.optionLetter, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surfaceStrong + '15' }, shouldHighlight && isCorrectAns && { backgroundColor: '#22c55e' }, shouldHighlight && isUserChoice && !isCorrectAns && { backgroundColor: '#f97316' }]}>
                <Text style={[styles.optionLetterText, { color: zenTextColor }, shouldHighlight && (isCorrectAns || isUserChoice) && { color: '#fff' }]}>{key}</Text>
              </View>
              <Text style={[styles.optionValue, { color: zenTextColor }]} numberOfLines={2}>{value}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={handleNextStage} style={[styles.card, { backgroundColor: isZenMode ? 'transparent' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'rgba(255, 255, 255, 0.4)' }]}>
      <View style={[styles.progressIndicator, { backgroundColor: revealStage === 0 ? (isZenMode ? 'rgba(67, 52, 34, 0.2)' : colors.textTertiary + '20') : revealStage === 1 ? colors.primary + '50' : '#22c55e' }]} />
      
      <View style={styles.header}>
        <View style={styles.tagRow}>
          {question.reviewTags.slice(0, 2).map((tag, idx) => (
            <View key={idx} style={[styles.tagBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surfaceStrong + '10' }]}><Text style={[styles.tagText, { color: zenSecColor }]}>{tag}</Text></View>
          ))}
        </View>
        <Text style={[styles.statusText, { color: zenTertColor }]}>{revealStage === 0 ? 'RECALL' : revealStage === 1 ? 'CHECK' : 'SAVED'}</Text>
      </View>

      <Text style={[styles.questionText, { color: zenTextColor }]} numberOfLines={revealStage === 0 ? 2 : 0}>{question.questionText}</Text>

      {revealStage === 0 && (
        <View style={[styles.hiddenPlaceholder, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.02)' : 'rgba(255, 255, 255, 0.02)', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : 'rgba(255, 255, 255, 0.3)' }]}><Eye size={10} color={zenTertColor} opacity={0.4} /><Text style={[styles.placeholderText, { color: zenTertColor }]}>REVEAL</Text></View>
      )}

      {renderOptions()}

      {revealStage === 2 && (
        <View style={[styles.revealArea, { borderTopColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'rgba(255, 255, 255, 0.05)' }]}>
          <View style={styles.answerSummary}>
             <Text style={styles.ansLine}><Text style={[styles.ansLabel, { color: zenTertColor }]}>ANS: </Text><Text style={{ color: '#22c55e', fontWeight: '900' }}>{normCorrect}</Text> <Text style={[styles.ansLabel, { color: zenTertColor }]}> | YOU: </Text><Text style={{ color: isCorrect ? '#22c55e' : '#f97316', fontWeight: '900' }}>{normSelected || 'SKP'}</Text></Text>
          </View>
          <Text style={[styles.explanationText, { color: zenSecColor }]}>{question.explanation}</Text>

          <View style={styles.actionsBar}>
            <TouchableOpacity onPress={handleRemoveTag} disabled={!!loadingAction} style={[styles.actionBtn, { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}>
              {loadingAction === 'remove' ? <ActivityIndicator size="small" color={zenTertColor} /> : <Trash2 size={10} color={zenSecColor} />}
              <Text style={[styles.actionBtnText, { color: zenSecColor }]}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAddToFlashcard} disabled={!!loadingAction} style={[styles.actionBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
              {loadingAction === 'flash' ? <ActivityIndicator size="small" color={colors.primary} /> : <Zap size={10} color={colors.primary} />}
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>Flashcard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { padding: 10, paddingLeft: 14, borderRadius: 16, borderWidth: 1, marginBottom: 6, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.01, shadowRadius: 4, elevation: 1 },
  progressIndicator: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2.5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tagRow: { flexDirection: 'row', gap: 3 },
  tagBadge: { paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5 },
  tagText: { fontSize: 6, fontWeight: '900', textTransform: 'uppercase' },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  questionText: { fontSize: 12, fontWeight: '800', lineHeight: 16, marginBottom: 6 },
  hiddenPlaceholder: { height: 32, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderWidth: 0.8, borderColor: 'rgba(255, 255, 255, 0.3)' },
  placeholderText: { fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  optionsContainer: { gap: 5, marginBottom: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 8, borderWidth: 1, gap: 6 },
  optionLetter: { width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  optionLetterText: { fontSize: 9, fontWeight: '900' },
  optionValue: { fontSize: 11, fontWeight: '600', flex: 1 },
  revealArea: { marginTop: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)' },
  answerSummary: { marginBottom: 6 },
  ansLine: { fontSize: 10, fontWeight: '700' },
  ansLabel: { fontSize: 8, fontWeight: '800' },
  explanationText: { fontSize: 11, lineHeight: 16, fontWeight: '500', marginBottom: 10 },
  actionsBar: { flexDirection: 'row', gap: 6 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionBtnText: { fontSize: 9, fontWeight: '800' }
});
