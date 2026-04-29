import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  FlatList,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  Layers, 
  Play, 
  ChevronRight, 
  ChevronDown, 
  MoreVertical, 
  Filter, 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  BookOpen, 
  Calendar,
  MoreHorizontal,
  Flame,
  TrendingUp,
  Snowflake,
  Search as SearchIcon,
  X
} from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { PageWrapper } from '../src/components/PageWrapper';
import { FlashcardSvc } from '../src/services/FlashcardService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

interface TreeItem {
  id: string;
  name: string;
  type: 'subject' | 'section' | 'microtopic';
  parentId: string | null;
  cardCount: number;
  dueCount: number;
  isOpen: boolean;
  level: number;
}

export default function FlashcardsDashboard() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, due: 0, mastered: 0, streak: 0, accuracy: 0 });
  const [treeData, setTreeData] = useState<TreeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [weakTopics, setWeakTopics] = useState<string[]>([]);

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (userId) loadData();
    }, [userId])
  );

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const loadData = async (bypassCache = false) => {
    const cacheKey = `flashcards_dashboard_cache_${userId}`;
    
    if (!bypassCache) {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setStats(parsed.stats);
          setHeatmapData(parsed.heatmapData);
          setTreeData(parsed.treeData);
          (global as any).rawHierarchy = parsed.rawHierarchy;
          // If we have cache, don't show the initial loading spinner
        } else {
          setLoading(true);
        }
      } catch (e) {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    try {
      const { data: states, error: sErr } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userId);
      
      if (sErr) throw sErr;

      const now = new Date();
      const total = states?.length || 0;
      const due = states?.filter(c => c.status === 'active' && (!c.next_review || new Date(c.next_review) <= now)).length || 0;
      const mastered = states?.filter(c => c.learning_status === 'mastered').length || 0;
      const accuracy = total > 0 ? Math.round((mastered / total) * 100) : 0;

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(30);
      
      const heatmap: Record<string, number> = {};
      sessions?.forEach(s => heatmap[s.date] = s.cards_reviewed);
      setHeatmapData(heatmap);
      
      const { data: cards, error: cErr } = await supabase
        .from('cards')
        .select('subject, section_group, microtopic');
      
      if (cErr) throw cErr;

      const subjects = new Set<string>();
      const sectionsMap = new Map<string, Set<string>>();
      const microtopicsMap = new Map<string, Set<string>>();
      const cardCounts: Record<string, number> = {};
      
      cards?.forEach(c => {
        subjects.add(c.subject);
        const sec = c.section_group || "General";
        if (!sectionsMap.has(c.subject)) sectionsMap.set(c.subject, new Set());
        sectionsMap.get(c.subject)!.add(sec);
        const mKey = `${c.subject}|${sec}`;
        if (!microtopicsMap.has(mKey)) microtopicsMap.set(mKey, new Set());
        microtopicsMap.get(mKey)!.add(c.microtopic);
        const cKey = `${c.subject}|${sec}|${c.microtopic}`;
        cardCounts[cKey] = (cardCounts[cKey] || 0) + 1;
      });

      const initialTree: TreeItem[] = Array.from(subjects).sort().map(s => ({
        id: s,
        name: s,
        type: 'subject',
        parentId: null,
        cardCount: 0,
        dueCount: 0,
        isOpen: false,
        level: 0
      }));

      const newStats = { total, due, mastered, streak: sessions?.length || 0, accuracy };
      setStats(newStats);
      setTreeData(initialTree);
      const rawHierarchy = { 
        sectionsMap: Object.fromEntries(Array.from(sectionsMap.entries()).map(([k, v]) => [k, Array.from(v)])), 
        microtopicsMap: Object.fromEntries(Array.from(microtopicsMap.entries()).map(([k, v]) => [k, Array.from(v)])), 
        cardCounts 
      };
      (global as any).rawHierarchy = rawHierarchy;

      // Save to cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        stats: newStats,
        heatmapData: heatmap,
        treeData: initialTree,
        rawHierarchy
      }));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (item: TreeItem) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (item.type === 'microtopic') {
      router.push({ 
        pathname: '/flashcards/microtopic', 
        params: { subject: item.id.split('|')[0], section: item.id.split('|')[1], microtopic: item.name } 
      });
      return;
    }

    if (item.isOpen) {
      setTreeData(prev => prev.filter(n => n.parentId !== item.id && !n.id.startsWith(item.id + '|')).map(n => n.id === item.id ? { ...n, isOpen: false } : n));
    } else {
      const { sectionsMap, microtopicsMap, cardCounts } = (global as any).rawHierarchy;
      let children: TreeItem[] = [];
      if (item.type === 'subject') {
        const sections = (sectionsMap[item.id] || []).sort();
        children = sections.map((s: string) => ({ id: `${item.id}|${s}`, name: s, type: 'section', parentId: item.id, cardCount: 0, dueCount: 0, isOpen: false, level: 1 }));
      } else if (item.type === 'section') {
        const micros = (microtopicsMap[item.id] || []).sort();
        children = micros.map((m: string) => ({ id: `${item.id}|${m}`, name: m, type: 'microtopic', parentId: item.id, cardCount: cardCounts[`${item.id}|${m}`] || 0, dueCount: 0, isOpen: false, level: 2 }));
      }
      const index = treeData.findIndex(n => n.id === item.id);
      const next = [...treeData];
      next[index] = { ...item, isOpen: true };
      next.splice(index + 1, 0, ...children);
      setTreeData(next);
    }
  };

  const renderHeatmap = () => {
    const days = Array.from({ length: 21 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (20 - i));
      const key = d.toISOString().split('T')[0];
      const val = heatmapData[key] || 0;
      return { key, val };
    });

    return (
      <View style={styles.heatmapBox}>
        <View style={styles.heatmapHeader}>
          <Flame size={16} color="#f97316" />
          <Text style={[styles.heatmapTitle, { color: colors.textPrimary }]}>Activity Heatmap</Text>
        </View>
        <View style={styles.heatmapGrid}>
          {days.map(d => (
            <View 
              key={d.key} 
              style={[
                styles.heatmapCell, 
                { backgroundColor: d.val > 50 ? '#166534' : d.val > 20 ? '#22c55e' : d.val > 0 ? '#bbf7d0' : '#f1f5f9' }
              ]} 
            />
          ))}
        </View>
      </View>
    );
  };

  const renderTreeItem = ({ item }: { item: TreeItem }) => {
    const isSubject = item.type === 'subject';
    const paddingLeft = item.level * 24 + 16;
    return (
      <View key={item.id} style={styles.treeRowContainer}>
        {item.level > 0 && <View style={[styles.vLine, { left: (item.level - 1) * 24 + 26, backgroundColor: colors.border }]} />}
        <TouchableOpacity 
          style={[styles.treeRow, { paddingLeft, backgroundColor: isSubject ? colors.surface : 'transparent' }, isSubject && styles.subjectRow]}
          onPress={() => toggleNode(item)}
        >
          {item.type !== 'microtopic' ? (
            item.isOpen ? <ChevronDown size={18} color={colors.textPrimary} /> : <ChevronRight size={18} color={colors.textPrimary} />
          ) : <View style={{ width: 18 }} />}
          <View style={styles.treeNodeInfo}>
            <Text style={[styles.nodeName, { color: isSubject ? colors.textPrimary : colors.textPrimary }]}>{item.name}</Text>
            {item.cardCount > 0 && <Text style={[styles.nodeCount, { color: isSubject ? colors.textTertiary : colors.textTertiary }]}>{item.cardCount} cards</Text>}
          </View>
          {item.type === 'microtopic' && <Play size={14} color={colors.primary} style={{ marginRight: 8 }} />}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
          {/* HEADER ALWAYS VISIBLE */}
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.headerTop}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Deck Hub</Text>
              <View style={styles.headerBtns}>
                <TouchableOpacity onPress={() => router.push('/flashcards/new')} style={styles.iconBtn}><Plus size={22} color={colors.textPrimary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setIsSearchVisible(!isSearchVisible)} style={styles.iconBtn}><SearchIcon size={22} color={colors.textPrimary} /></TouchableOpacity>
                <ThemeSwitcher />
              </View>
            </View>
            
            {isSearchVisible && (
              <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                <SearchIcon size={18} color={colors.textTertiary} />
                <TextInput style={[styles.searchInput, { color: colors.textPrimary }]} placeholder="Search subjects, microtopics..." placeholderTextColor={colors.textTertiary} autoFocus value={searchQuery} onChangeText={setSearchQuery} />
                <TouchableOpacity onPress={() => setIsSearchVisible(false)}><X size={18} color={colors.textTertiary} /></TouchableOpacity>
              </View>
            )}
          </View>

          {loading && treeData.length === 0 ? (
            <View style={{ flex: 1, padding: 100, alignItems: 'center' }}>
               <ActivityIndicator size="large" color={colors.primary} />
               <Text style={{ color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>Preparing Decks...</Text>
            </View>
          ) : (
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
              <View style={styles.statsPanel}>
                <View style={[styles.statsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.primary }]}>{stats.due}</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Due</Text></View>
                  <View style={styles.statItem}><Text style={[styles.statValue, { color: '#34c759' }]}>{stats.accuracy}%</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Accuracy</Text></View>
                  <View style={styles.statItem}><Text style={[styles.statValue, { color: '#f97316' }]}>{stats.streak}d</Text><Text style={[styles.statLabel, { color: colors.textTertiary }]}>Streak</Text></View>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: '/flashcards/review', params: { mode: 'due' } })}>
                    <Clock size={16} color="#fff" /><Text style={styles.actionBtnText}>Revise Due</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }]} onPress={() => router.push({ pathname: '/flashcards/review', params: { mode: 'all' } })}>
                    <Layers size={16} color={colors.textPrimary} /><Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Revise All</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.insightsSection}>
                {renderHeatmap()}
                <TouchableOpacity style={[styles.frozenBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]} onPress={() => router.push('/flashcards/frozen')}>
                  <Snowflake size={18} color={colors.primary} />
                  <Text style={[styles.frozenBtnText, { color: colors.primary }]}>View Frozen Cards</Text>
                  <ChevronRight size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={[styles.treeHeader, { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={[styles.treeHeaderTitle, { color: colors.textTertiary }]}>SUBJECT HIERARCHY</Text>
                <TouchableOpacity><Filter size={16} color={colors.textTertiary} /></TouchableOpacity>
              </View>

              <View style={{ paddingBottom: 100 }}>
                {treeData.map(item => renderTreeItem({ item }))}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  statsPanel: { paddingHorizontal: 20, paddingVertical: 20 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, padding: 16, borderRadius: 20, borderWidth: 1 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 2, letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  insightsSection: { padding: 20, gap: 16 },
  heatmapBox: { padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  heatmapHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heatmapTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  heatmapGrid: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  heatmapCell: { width: 14, height: 14, borderRadius: 3 },
  frozenBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  frozenBtnText: { flex: 1, fontSize: 15, fontWeight: '700' },
  treeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  treeHeaderTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  treeRowContainer: { position: 'relative' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1.5, zIndex: -1 },
  treeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 20 },
  subjectRow: { borderTopWidth: 1, borderBottomWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', borderBottomColor: 'rgba(0,0,0,0.05)', marginVertical: 4 },
  treeNodeInfo: { flex: 1, marginLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nodeName: { fontSize: 16, fontWeight: '700' },
  nodeCount: { fontSize: 12, fontWeight: '600' }
});
