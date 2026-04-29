import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  Animated, 
  Dimensions,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  X, 
  RotateCcw, 
  Check, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Snowflake, 
  ExternalLink,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { FlashcardSvc, CardState } from '../../src/services/FlashcardService';
import { PageWrapper } from '../../src/components/PageWrapper';

const { width } = Dimensions.get('window');

export default function ReviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { microtopic, subject, section, mode } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [states, setStates] = useState<Record<string, Partial<CardState>>>({});
  
  // Card Actions
  const [showEditModal, setShowEditModal] = useState(false);
  const [personalNote, setPersonalNote] = useState("");
  const [nextDueLabel, setNextDueLabel] = useState<string | null>(null);

  const flipAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (session?.user.id) loadQueue();
  }, [session]);

  const loadQueue = async () => {
    setLoading(true);
    try {
      let query = supabase.from('cards').select('*');
      
      if (microtopic) {
        query = query.eq('subject', subject).eq('microtopic', microtopic);
        if (section && section !== 'General') query = query.eq('section_group', section);
        else query = query.is('section_group', null);
      }

      const { data: baseCards } = await query;
      const baseIds = (baseCards || []).map(c => c.id);

      // Fetch states
      const { data: userStates } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', session?.user.id)
        .in('card_id', baseIds);
      
      const stateMap: Record<string, Partial<CardState>> = {};
      userStates?.forEach(s => stateMap[s.card_id] = s);
      setStates(stateMap);

      const now = new Date();
      let filtered = (baseCards || []).map(c => ({ ...c, state: stateMap[c.id] || {} }));

      if (mode === 'due') {
        filtered = filtered.filter(c => c.state.status !== 'frozen' && (!c.state.next_review || new Date(c.state.next_review) <= now));
      } else {
        filtered = filtered.filter(c => c.state.status !== 'frozen');
      }

      // Shuffle queue
      setQueue(filtered.sort(() => Math.random() - 0.5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFlip = () => {
    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true
    }).start();
    setIsFlipped(!isFlipped);
  };

  const nextCard = () => {
    if (currentIndex < queue.length - 1) {
      flipAnim.setValue(0);
      setIsFlipped(false);
      setCurrentIndex(currentIndex + 1);
    } else {
      Alert.alert("Session Complete", "You've finished all cards in this session!", [
        { text: "Done", onPress: () => router.back() }
      ]);
    }
  };

  const rate = async (quality: number) => {
    const card = queue[currentIndex];
    if (!card || !session?.user.id) return;

    try {
      const sm = await FlashcardSvc.reviewCard(session.user.id, card.id, quality);
      setNextDueLabel(`+${sm.interval_days}d`);
      setIsFlipped(false);
      flipAnim.setValue(0);
      // Move to next AFTER await resolves (prevents blank card flash)
      nextCard();
    } catch (err) {
      Alert.alert('Error', 'Could not save review.');
      console.error(err);
    }
  };

  const freezeCard = async () => {
    const card = queue[currentIndex];
    if (!card || !session?.user.id) return;
    try {
      await FlashcardSvc.freezeCard(session.user.id, card.id);
      // Remove from current queue and move to next
      const nextQueue = queue.filter((_, i) => i !== currentIndex);
      setQueue(nextQueue);
      if (currentIndex >= nextQueue.length) {
        if (nextQueue.length === 0) router.back();
        else setCurrentIndex(0);
      }
      setIsFlipped(false);
      flipAnim.setValue(0);
    } catch (err) {
      console.error(err);
    }
  };

  const savePersonalNote = async () => {
    const card = queue[currentIndex];
    if (!card || !session?.user.id) return;
    try {
      await FlashcardSvc.saveNote(session.user.id, card.id, personalNote);
      setShowEditModal(false);
      // Update local state
      const nextQueue = [...queue];
      nextQueue[currentIndex].state.user_note = personalNote;
      setQueue(nextQueue);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (queue.length === 0) {
    return (
      <View style={styles.center}>
        <Check size={64} color={colors.primary} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Deck Clear!</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>No cards due for review in this topic.</Text>
        <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.doneBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentCard = queue[currentIndex];
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg']
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg']
  });

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <X size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.progressText, { color: colors.textTertiary }]}>
              {currentIndex + 1} of {queue.length}
            </Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${((currentIndex + 1) / queue.length) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
          <TouchableOpacity style={styles.headerBtn} onPress={() => {
            setPersonalNote(currentCard.state?.user_note || "");
            setShowEditModal(true);
          }}>
            <MoreVertical size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* CARD CONTAINER */}
        <View style={styles.cardSection}>
          <TouchableOpacity activeOpacity={1} onPress={handleFlip} style={styles.cardTouch}>
            <Animated.View style={[styles.card, { transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }], opacity: flipAnim.interpolate({ inputRange: [89, 90], outputRange: [1, 0] }), backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardSideLabel, { color: colors.primary }]}>QUESTION</Text>
              <ScrollView style={{ maxHeight: 480, flexGrow: 0 }} contentContainerStyle={[styles.cardScroll, { padding: 16 }]}>
                <Text style={[styles.cardText, { color: colors.textPrimary, fontSize: 16, lineHeight: 24 }]}>
                  {currentCard.front_text || currentCard.question_text || currentCard.question}
                </Text>
                {currentCard.front_options && Object.entries(currentCard.front_options).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
                    <Text style={{ fontWeight: '900', color: colors.primary }}>{k}.</Text>
                    <Text style={{ flex: 1, color: colors.textPrimary }}>{v as string}</Text>
                  </View>
                ))}
                {currentCard.front_image_url && (
                  <Image source={{ uri: currentCard.front_image_url }} resizeMode="contain" style={{ width: '100%', height: 200, marginTop: 12, borderRadius: 8 }} />
                )}
              </ScrollView>
              <View style={styles.flipHint}>
                <RotateCcw size={14} color={colors.textTertiary} />
                <Text style={[styles.flipHintText, { color: colors.textTertiary }]}>Tap to flip</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.card, styles.cardBack, { transform: [{ perspective: 1000 }, { rotateY: backInterpolate }], opacity: flipAnim.interpolate({ inputRange: [89, 90], outputRange: [0, 1] }), backgroundColor: colors.surface, borderColor: colors.primary + '40' }]}>
              <Text style={[styles.cardSideLabel, { color: '#34c759' }]}>ANSWER</Text>
              <ScrollView contentContainerStyle={styles.cardScroll}>
                <Text style={[styles.answerText, { color: colors.textPrimary }]}>{currentCard.back_text || currentCard.answer_text || currentCard.answer}</Text>
                {currentCard.back_image_url && (
                  <Image source={{ uri: currentCard.back_image_url }} style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 12 }} resizeMode="contain" />
                )}
                {currentCard.state?.user_note && (
                  <View style={[styles.noteBox, { backgroundColor: colors.primary + '10' }]}>
                    <Text style={[styles.noteLabel, { color: colors.primary }]}>PERSONAL NOTE</Text>
                    <Text style={[styles.noteText, { color: colors.textSecondary }]}>{currentCard.state.user_note}</Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* ACTIONS */}
        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {isFlipped ? (
            <View style={styles.qualityRow}>
              {[
                { q: 0, label: 'Again', color: colors.error },
                { q: 2, label: 'Hard',  color: '#f59e0b' },
                { q: 3, label: 'Good',  color: colors.primary },
                { q: 4, label: 'Easy',  color: '#3b82f6' },
                { q: 5, label: 'Perfect', color: colors.success },
              ].map(({ q, label, color }) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.qBtn, { borderColor: color }]}
                  onPress={() => rate(q)}
                >
                  <Text style={[styles.qBtnLabel, { color }]}>{label}</Text>
                  <Text style={styles.qBtnSub}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TouchableOpacity style={[styles.showBtn, { backgroundColor: colors.primary }]} onPress={handleFlip}>
              <Text style={styles.showBtnText}>Show Answer</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* EDIT MODAL */}
        <Modal visible={showEditModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Card</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}><X size={24} color={colors.textPrimary} /></TouchableOpacity>
              </View>
              
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Personal Notes / Tricks</Text>
              <TextInput 
                style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                multiline
                placeholder="Add your own memory aids..."
                placeholderTextColor={colors.textTertiary}
                value={personalNote}
                onChangeText={setPersonalNote}
              />
              
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef444420' }]} onPress={freezeCard}>
                  <Snowflake size={20} color="#ef4444" />
                  <Text style={{ color: '#ef4444', fontWeight: '700' }}>Freeze Card</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={savePersonalNote}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </PageWrapper>
  );
}

function RatingBtn({ label, sub, color, onPress }: any) {
  return (
    <TouchableOpacity style={[styles.rateBtn, { backgroundColor: color + '15', borderColor: color }]} onPress={onPress}>
      <Text style={[styles.rateLabel, { color }]}>{label}</Text>
      <Text style={[styles.rateSub, { color }]}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between' },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  progressText: { fontSize: 12, fontWeight: '800', marginBottom: 4 },
  progressBarBg: { width: 120, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%' },
  cardSection: { flex: 1, padding: 20, justifyContent: 'center' },
  cardTouch: { flex: 1 },
  card: { flex: 1, borderRadius: 32, padding: 32, borderWidth: 2, backfaceVisibility: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  cardBack: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  cardSideLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 20, textAlign: 'center' },
  cardScroll: { flexGrow: 1, justifyContent: 'center' },
  cardText: { fontSize: 24, fontWeight: '700', textAlign: 'center', lineHeight: 36 },
  answerText: { fontSize: 20, fontWeight: '600', textAlign: 'center', lineHeight: 30 },
  flipHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  flipHintText: { fontSize: 13, fontWeight: '600' },
  noteBox: { marginTop: 30, padding: 16, borderRadius: 16 },
  noteLabel: { fontSize: 10, fontWeight: '900', marginBottom: 8 },
  noteText: { fontSize: 14, fontWeight: '500', lineHeight: 22 },
  actions: { padding: 24, borderTopWidth: 1 },
  showBtn: { height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  showBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  ratingRow: { flexDirection: 'row', gap: 10 },
  rateBtn: { flex: 1, height: 72, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  rateLabel: { fontSize: 14, fontWeight: '900' },
  rateSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  noteInput: { height: 150, borderRadius: 20, borderWidth: 1, padding: 16, textAlignVertical: 'top', fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 24, fontWeight: '900', marginTop: 20 },
  emptySub: { fontSize: 16, textAlign: 'center', marginTop: 8 },
  doneBtn: { marginTop: 32, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 20 },
  doneBtnText: { color: '#fff', fontWeight: '800' },
  qualityRow: { flexDirection: 'row', gap: 6, padding: 16 },
  qBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 2, alignItems: 'center', backgroundColor: '#fff' },
  qBtnLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  qBtnSub: { color: '#64748b', fontSize: 10, marginTop: 2 },
});
