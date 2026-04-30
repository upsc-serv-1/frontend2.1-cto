import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  SafeAreaView, 
  ActivityIndicator,
  Dimensions,
  Platform,
  TextInput,
  Modal,
  ScrollView
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Play, 
  Plus, 
  Filter, 
  Search, 
  ChevronDown, 
  MoreVertical, 
  Clock, 
  CheckCircle2, 
  BookOpen,
  SortAsc,
  SortDesc,
  Edit2,
  Trash2,
  MoreHorizontal,
  X
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';

const { width } = Dimensions.get('window');

interface CardItem {
  id: string;
  front_text: string;
  back_text: string;
  status: 'active' | 'frozen';
  learning_status: 'not_studied' | 'learning' | 'mastered';
  next_review?: string;
  updated_at: string;
}

export default function MicrotopicModal() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { subject, section, microtopic } = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [stats, setStats] = useState({ due: 0, new: 0, learning: 0, mastered: 0 });
  const [sortBy, setSortBy] = useState<'next' | 'newest' | 'oldest' | 'az'>('next');
  const [filterBy, setFilterBy] = useState<string>('all');
  
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  useEffect(() => {
    if (session?.user.id) loadCards();
  }, [session, microtopic]);

  const loadCards = async () => {
    setLoading(true);
    try {
      // 1. Get cards in this microtopic
      const { data: baseCards, error: bErr } = await supabase
        .from('cards')
        .select('*')
        .eq('subject', subject)
        .eq('section_group', section === "General" ? null : section)
        .eq('microtopic', microtopic);
      
      if (bErr) throw bErr;

      // 2. Get user's progress for these cards
      const cardIds = (baseCards || []).map(c => c.id);
      const { data: progress, error: pErr } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', session?.user.id)
        .in('card_id', cardIds);
      
      if (pErr) throw pErr;

      const progressMap = new Map();
      progress?.forEach(p => progressMap.set(p.card_id, p));

      const merged: CardItem[] = (baseCards || []).map(bc => {
        const p = progressMap.get(bc.id);
        return {
          id: bc.id,
          front_text: bc.front_text || bc.question_text || bc.question || '',
          back_text: bc.back_text || bc.answer_text || bc.answer || '',
          status: p?.status || 'active',
          learning_status: p?.learning_status || 'not_studied',
          next_review: p?.next_review,
          updated_at: p?.updated_at || bc.created_at
        };
      });

      setCards(merged);
      
      // Calculate Stats
      const now = new Date();
      setStats({
        due: merged.filter(c => c.status === 'active' && (!c.next_review || new Date(c.next_review) <= now)).length,
        new: merged.filter(c => c.learning_status === 'not_studied').length,
        learning: merged.filter(c => c.learning_status === 'learning').length,
        mastered: merged.filter(c => c.learning_status === 'mastered').length
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedCards = useMemo(() => {
    let result = [...cards];
    
    // Filter
    if (filterBy !== 'all') {
      if (filterBy === 'frozen') result = result.filter(c => c.status === 'frozen');
      else if (filterBy === 'not_studied') result = result.filter(c => c.learning_status === 'not_studied');
      else result = result.filter(c => c.learning_status === filterBy);
    } else {
      result = result.filter(c => c.status === 'active');
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'next') {
        const ad = a.next_review ? new Date(a.next_review).getTime() : 0;
        const bd = b.next_review ? new Date(b.next_review).getTime() : 0;
        return ad - bd;
      }
      if (sortBy === 'newest') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sortBy === 'az') return a.front_text.localeCompare(b.front_text);
      return 0;
    });

    return result;
  }, [cards, sortBy, filterBy]);

  const renderCardItem = ({ item }: { item: CardItem }) => (
    <TouchableOpacity 
      style={[styles.cardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push({ 
        pathname: '/flashcards/review', 
        params: { microtopic, subject, section, cardId: item.id } 
      })}
    >
      <View style={styles.cardTop}>
        <View style={[styles.statusDot, { backgroundColor: item.learning_status === 'mastered' ? '#34c759' : item.learning_status === 'learning' ? '#3b82f6' : '#94a3b8' }]} />
        <Text style={[styles.cardPreview, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.front_text}
        </Text>
        <TouchableOpacity>
          <MoreHorizontal size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardBottom}>
        <Text style={[styles.cardMeta, { color: colors.textTertiary }]}>
          {item.learning_status.toUpperCase()} • Next: {item.next_review ? new Date(item.next_review).toLocaleDateString() : 'New'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* HEADER */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{microtopic}</Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>{subject} • {section}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsAddModalVisible(true)}>
            <Plus size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* STATS & PROGRESS */}
          <View style={styles.statsPanel}>
            <View style={styles.statsRow}>
              <StatItem label="Due" value={stats.due} color={colors.primary} />
              <StatItem label="New" value={stats.new} color={colors.textTertiary} />
              <StatItem label="Learning" value={stats.learning} color="#3b82f6" />
              <StatItem label="Mastered" value={stats.mastered} color="#34c759" />
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(stats.mastered / (cards.length || 1)) * 100}%`, backgroundColor: '#34c759' }]} />
                <View style={[styles.progressFill, { width: `${(stats.learning / (cards.length || 1)) * 100}%`, backgroundColor: '#3b82f6' }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.textTertiary }]}>
                {stats.mastered} of {cards.length} cards mastered
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.studyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push({ pathname: '/flashcards/review', params: { microtopic, subject, section } })}
            >
              <Play size={20} color="#fff" fill="#fff" />
              <Text style={styles.studyBtnText}>Study Cards</Text>
            </TouchableOpacity>
          </View>

          {/* FILTERS & LIST */}
          <View style={styles.listSection}>
            <View style={styles.listHeader}>
              <View style={styles.filterRow}>
                <TouchableOpacity style={[styles.filterChip, filterBy === 'all' && { backgroundColor: colors.primary }]} onPress={() => setFilterBy('all')}>
                  <Text style={[styles.filterText, filterBy === 'all' && { color: '#fff' }]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, filterBy === 'not_studied' && { backgroundColor: '#94a3b8' }]} onPress={() => setFilterBy('not_studied')}>
                  <Text style={[styles.filterText, filterBy === 'not_studied' && { color: '#fff' }]}>New</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, filterBy === 'mastered' && { backgroundColor: '#34c759' }]} onPress={() => setFilterBy('mastered')}>
                  <Text style={[styles.filterText, filterBy === 'mastered' && { color: '#fff' }]}>Mastered</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterChip, filterBy === 'frozen' && { backgroundColor: '#ef4444' }]} onPress={() => setFilterBy('frozen')}>
                  <Text style={[styles.filterText, filterBy === 'frozen' && { color: '#fff' }]}>Frozen</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.sortBtn} onPress={() => setSortBy(sortBy === 'next' ? 'newest' : 'next')}>
                {sortBy === 'next' ? <SortAsc size={18} color={colors.textTertiary} /> : <SortDesc size={18} color={colors.textTertiary} />}
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={filteredAndSortedCards}
                keyExtractor={item => item.id}
                renderItem={renderCardItem}
                scrollEnabled={false}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <BookOpen size={48} color={colors.border} />
                    <Text style={{ color: colors.textTertiary, marginTop: 12 }}>No cards match your filter</Text>
                  </View>
                }
              />
            )}
          </View>
        </ScrollView>

        {/* ADD CARDS MODAL */}
        <Modal visible={isAddModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, height: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add to {microtopic}</Text>
                <TouchableOpacity onPress={() => setIsAddModalVisible(false)}><X size={24} color={colors.textPrimary} /></TouchableOpacity>
              </View>
              
              <Text style={{ color: colors.textTertiary, marginBottom: 20 }}>Select questions to convert into flashcards.</Text>
              
              <FlatList
                data={cards.filter(c => c.learning_status === 'not_studied')} // Placeholder for provider filtering
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.selectableItem, { borderColor: colors.border }]}>
                    <Text style={[styles.selectableText, { color: colors.textPrimary }]} numberOfLines={2}>{item.question}</Text>
                    <View style={[styles.checkbox, { borderColor: colors.primary }]} />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: colors.textTertiary }}>No new questions available in this topic.</Text>}
              />
              
              <TouchableOpacity style={[styles.studyBtn, { backgroundColor: colors.primary, marginTop: 20 }]} onPress={() => setIsAddModalVisible(false)}>
                <Text style={styles.studyBtnText}>Add Selected Cards</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PageWrapper>
  );
}

function StatItem({ label, value, color }: any) {
  const { colors } = useTheme();
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={[styles.statLab, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  statsPanel: { padding: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statItem: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLab: { fontSize: 10, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
  progressContainer: { marginBottom: 24 },
  progressBar: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, flexDirection: 'row', overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressText: { fontSize: 12, marginTop: 8, fontWeight: '600', textAlign: 'center' },
  studyBtn: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 4 },
  studyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  listSection: { flex: 1, paddingHorizontal: 20 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f1f5f9' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  sortBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  cardItem: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  cardPreview: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  cardBottom: { marginTop: 10, paddingLeft: 20 },
  cardMeta: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', marginTop: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  selectableItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10, gap: 12 },
  selectableText: { flex: 1, fontSize: 14, fontWeight: '600' },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 }
});
