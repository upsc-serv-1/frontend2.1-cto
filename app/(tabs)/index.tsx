import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, FlatList, Vibration, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { TrendingUp, Target, Flame, BookOpen, BarChart3, ChevronRight, Layout, Play, Clock, RotateCcw, Zap, History, Plus, GripVertical, Sliders } from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { radius, spacing } from '../../src/theme';
import { cacheGet, cacheSet } from '../../src/lib/cache';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { SyllabusService } from '../../src/services/SyllabusService';
import { MICRO_SYLLABUS, OPTIONAL_SUBJECTS } from '../../src/data/syllabus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, X, Settings } from 'lucide-react-native';
import { Alert } from 'react-native';
import { WidgetService, Widget } from '../../src/services/WidgetService';
import { useWidgetData } from '../../src/hooks/useWidgetData';
import { WidgetRenderer } from '../../src/components/widgets/WidgetRenderer';
import { GlobalSearchBar } from '../../src/components/GlobalSearchBar';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

type Stats = { 
  attempts: number; 
  accuracy: number; 
  dueCards: number; 
  totalNotes: number; 
  streak: number; 
  syllabusPercent: number;
  subjectProgress: { label: string; progress: number; color: string }[];
};

export default function Home() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const userId = session?.user.id;
  console.log("[Route: (tabs)/index] Dashboard Mounting. User ID:", userId);
  const name = (session?.user.user_metadata as any)?.display_name || session?.user.email?.split('@')[0] || 'Aspirant';

  // Calculate grid width for 2 columns
  const CARD_GAP = 12;
  const CARD_WIDTH = (windowWidth - spacing.lg * 2 - CARD_GAP) / 2;
  const [stats, setStats] = useState<Stats>({ 
    attempts: 0, 
    accuracy: 0, 
    dueCards: 0, 
    totalNotes: 0, 
    streak: 5, 
    syllabusPercent: 0,
    subjectProgress: []
  });
  const [refreshing, setRefreshing] = useState(false);

  // Widget Configuration
  const [configVisible, setConfigVisible] = useState(false);
  const [widgetCategory, setWidgetCategory] = useState<'Prelims' | 'Mains' | 'Optional'>('Prelims');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [optionalChoice, setOptionalChoice] = useState('Anthropology');

  // ── Widget System ──
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const longPressTimer = useRef<any>(null);
  const { data: widgetData, refresh: refreshWidgets } = useWidgetData(userId);

  const activeWidgets = useMemo(() => widgets.filter(w => !w.is_archived), [widgets]);
  const archivedWidgets = useMemo(() => widgets.filter(w => w.is_archived), [widgets]);
  
  useEffect(() => {
    AsyncStorage.getItem('dashboard_widget_config').then(val => {
      if (val) {
        const parsed = JSON.parse(val);
        setWidgetCategory(parsed.category || 'Prelims');
        setSelectedSubjects(parsed.subjects || []);
      }
    });
    AsyncStorage.getItem('optional_choice').then(val => {
      if (val) setOptionalChoice(val);
    });
    if (userId) WidgetService.list(userId).then(setWidgets);
  }, [userId]);

  const saveConfig = async (category: any, subjects: string[]) => {
    const newConfig = { category, subjects };
    await AsyncStorage.setItem('dashboard_widget_config', JSON.stringify(newConfig));
    load(); // Reload data with new config
  };

  const load = useCallback(async () => {
    if (!userId) return;
    const cached = await cacheGet<Stats>(`home:${userId}`);
    if (cached) setStats(cached);

    try {
      const [{ data: qs }, { count: notesCount }, { count: cardsCount }] = await Promise.all([
        supabase.from('question_states').select('is_incorrect_last_attempt').eq('user_id', userId),
        supabase.from('user_notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_cards').select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .lte('next_review_at', new Date().toISOString()),
      ]);

      const total = qs?.length || 0;
      const correct = qs?.filter(x => x.is_incorrect_last_attempt === false)?.length || 0;
      let syllabusPercent = 0;
      let subjectProgress: { label: string; progress: number; color: string }[] = [];
      
      try {
        const progress = await SyllabusService.getProgress(userId);
        let totalItems = 0;
        let completedItems = 0;
        
        const subjectStats: Record<string, { total: number; completed: number; color: string }> = {};
        
        const COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#5856D6', '#FFCC00'];
        let colorIdx = 0;

        let dataPool = {};
        if (widgetCategory === 'Optional') {
          const sourceSyllabus = (optionalChoice === 'Anthropology') ? require('../../src/data/syllabus').ANTHROPOLOGY_SYLLABUS : { "Paper 1": { "Fundamentals": [] }, "Paper 2": { "Indian Context": [] } };
          dataPool = {
            [`${optionalChoice} Paper 1`]: sourceSyllabus["Paper 1"],
            [`${optionalChoice} Paper 2`]: sourceSyllabus["Paper 2"],
          };
        } else if (widgetCategory === 'Mains') {
          dataPool = require('../../src/data/syllabus').MAINS_SYLLABUS;
        } else {
          dataPool = MICRO_SYLLABUS;
        }

        Object.entries(dataPool).forEach(([sub, groups]) => {
          if (selectedSubjects.length > 0 && !selectedSubjects.includes(sub)) return;
          
          if (!subjectStats[sub]) {
            subjectStats[sub] = { total: 0, completed: 0, color: COLORS[colorIdx % COLORS.length] };
            colorIdx++;
          }

          Object.entries(groups as any).forEach(([group, topics]) => {
            (topics as string[]).forEach(topic => {
              totalItems++;
              const path = `${sub}.${group}.${topic}`;
              const isMastered = progress[path]?.mastered;
              if (isMastered) completedItems++;
              
              subjectStats[sub].total++;
              if (isMastered) subjectStats[sub].completed++;
            });
          });
        });
        
        syllabusPercent = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;
        subjectProgress = Object.entries(subjectStats).map(([label, s]) => ({
          label,
          progress: s.total ? s.completed / s.total : 0,
          color: s.color
        })).sort((a, b) => b.progress - a.progress);

      } catch (e) {
        console.error("Syllabus Load Error:", e);
      }

      const next: Stats = {
        attempts: total,
        accuracy: total ? Math.round((correct / total) * 100) : 0,
        dueCards: cardsCount || 0,
        totalNotes: notesCount || 0,
        streak: 5, 
        syllabusPercent,
        subjectProgress
      };
      setStats(next);
      await cacheSet(`home:${userId}`, next);
    } catch (err) {
      console.error("Home Load Error:", err);
    }
  }, [userId, widgetCategory, selectedSubjects, optionalChoice]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); refreshWidgets(); setRefreshing(false); };

  const handleLongPressIn = () => {
    longPressTimer.current = setTimeout(() => {
      Vibration.vibrate(50);
      setIsEditMode(true);
    }, 4000);
  };
  const handleLongPressOut = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const handleArchive = async (id: string) => {
    await WidgetService.archive(userId!, id);
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, is_archived: true } : w));
  };

  const handleReorder = async ({ data }: { data: Widget[] }) => {
    setWidgets(prev => [...data, ...prev.filter(w => w.is_archived)]);
    await WidgetService.reorder(userId!, data.map(d => d.id));
  };

  return (
    <PageWrapper>
      <DraggableFlatList
        data={activeWidgets}
        keyExtractor={(item) => item.id}
        onDragEnd={handleReorder}
        activationDistance={10}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={() => (
          <>
            <Pressable onPressIn={handleLongPressIn} onPressOut={handleLongPressOut} style={styles.topRow}>
              <View>
                <Text style={[styles.small, { color: colors.textTertiary }]}>{isEditMode ? 'EDITING WIDGETS' : 'DASHBOARD'}</Text>
                <Text style={[styles.h1, { color: colors.textPrimary }]}>{name}.</Text>
              </View>
              {isEditMode ? (
                <TouchableOpacity onPress={() => setIsEditMode(false)} style={[styles.doneBtn, { backgroundColor: colors.primary }]}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Done</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.avatarBtn}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>{(name[0] || 'A').toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              )}
            </Pressable>
            
            <View style={{ marginBottom: spacing.lg }}>
              <GlobalSearchBar 
                placeholder="Search questions, notes, topics..." 
                onSearch={(q, f) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: "/unified/arena",
                    params: { 
                      tab: 'search',
                      query: q,
                      filters: JSON.stringify(f)
                    }
                  } as any);
                }}
              />
            </View>

            <View style={styles.dashboardRow}>
               <View style={[styles.streakCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]}>
                  <Flame color={colors.primary} size={24} fill={colors.primary} />
                  <View style={{ marginLeft: 12 }}>
                     <Text style={[styles.streakVal, { color: colors.textPrimary }]}>{stats.streak} Days</Text>
                     <Text style={[styles.streakLab, { color: colors.textSecondary }]}>Daily Streak</Text>
                  </View>
               </View>
               <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Target color={colors.primary} size={24} />
                  <View style={{ marginLeft: 12 }}>
                     <Text style={[styles.streakVal, { color: colors.textPrimary }]}>{stats.accuracy}%</Text>
                     <Text style={[styles.streakLab, { color: colors.textSecondary }]}>Accuracy</Text>
                  </View>
               </View>
            </View>

            <TouchableOpacity 
              style={[styles.arenaCard, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              onPress={() => router.push('/arena')}
            >
               <View style={styles.arenaContent}>
                  <View style={styles.arenaLeft}>
                    <Zap color="#FFF" size={32} fill="#FFF" />
                    <View style={{ marginLeft: 16 }}>
                       <Text style={styles.arenaTitle}>Enter Unified Arena</Text>
                       <Text style={styles.arenaSub}>Advanced Quiz Engine • All Modes</Text>
                    </View>
                  </View>
                  <View style={styles.arenaRight}>
                     <ChevronRight color="#FFF" size={24} />
                  </View>
               </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.9}
              onPress={() => router.push('/tracker')}
              onLongPress={() => setConfigVisible(true)}
            >
              <View style={styles.progressHeader}>
                <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                  <Layout color={colors.primary} size={22} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Syllabus Tracker</Text>
                    <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.primary + '10' }}>
                       <Text style={{ fontSize: 9, fontWeight: '900', color: colors.primary }}>{widgetCategory.toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>Long press to edit subjects</Text>
                </View>
                <View style={[styles.percentBox, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.percentText, { color: colors.primary }]}>{stats.syllabusPercent}%</Text>
                </View>
              </View>
              
              <View style={{ maxHeight: 180 }}>
                <ScrollView showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                  <View style={styles.progressList}>
                     {stats.subjectProgress.length > 0 ? (
                       stats.subjectProgress.map((sp) => (
                         <SubjectProgress key={sp.label} label={sp.label} progress={sp.progress} color={sp.color} colors={colors} />
                       ))
                     ) : (
                       <View style={{ alignItems: 'center', justifyContent: 'center', height: 120 }}>
                          <Layout color={colors.textTertiary} size={32} opacity={0.3} />
                          <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 12, textAlign: 'center' }}>No subjects selected for {widgetCategory}</Text>
                       </View>
                     )}
                  </View>
                </ScrollView>
              </View>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>RESUME ACTIONS</Text>
            
            <View style={styles.resumeGrid}>
               <ResumeCard icon={<Layout color="#007AFF" size={20} />} label="Syllabus" sub="Track progress" onPress={() => router.push('/tracker')} colors={colors} width={CARD_WIDTH} />
               <ResumeCard icon={<RotateCcw color="#FF2D55" size={20} />} label="Flashcards" sub="Daily review" onPress={() => router.push('/flashcards')} colors={colors} width={CARD_WIDTH} />
               <ResumeCard icon={<History color="#8E8E93" size={20} />} label="Review" sub="Past attempts" onPress={() => router.push({ pathname: '/analyse', params: { mode: 'review' } })} colors={colors} width={CARD_WIDTH} />
               <ResumeCard icon={<BarChart3 color="#34C759" size={20} />} label="Analyse" sub="Performance" onPress={() => router.push({ pathname: '/analyse', params: { mode: 'overall' } })} colors={colors} width={CARD_WIDTH} />
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>MY WIDGETS</Text>
          </>
        )}
        renderItem={({ item, drag, isActive }) => (
          <ScaleDecorator>
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={250}
              disabled={isActive}
              style={{ marginBottom: 12 }}
            >
              <WidgetRenderer
                widgetKey={item.widget_key}
                data={widgetData}
                onArchive={() => handleArchive(item.id)}
              />
            </TouchableOpacity>
          </ScaleDecorator>
        )}
        ListFooterComponent={() => (
          <>
            <TouchableOpacity onPress={() => setShowManage(true)} style={{ padding: 12, alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                Manage Widgets ({archivedWidgets.length} archived)
              </Text>
            </TouchableOpacity>

            <View style={[styles.analyticsPromo, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 24 }]}>
               <View style={{ flex: 1 }}>
                  <Text style={[styles.promoTitle, { color: colors.textPrimary }]}>Detailed Analysis</Text>
                  <Text style={[styles.promoSub, { color: colors.textSecondary }]}>Check your weak areas and subject trends in the Analyse tab.</Text>
               </View>
               <TouchableOpacity 
                 style={[styles.promoBtn, { backgroundColor: colors.primary }]}
                 onPress={() => router.push('/(tabs)/analyse')}
               >
                  <BarChart3 color="#FFF" size={20} />
               </TouchableOpacity>
            </View>

            <Modal visible={showManage} transparent animationType="slide" onRequestClose={() => setShowManage(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 16 }}>Archived Widgets</Text>
                  <ScrollView nestedScrollEnabled>
                    {archivedWidgets.length === 0 ? (
                      <Text style={{ color: colors.textTertiary, textAlign: 'center', padding: 24 }}>No archived widgets.</Text>
                    ) : (
                      archivedWidgets.map(w => (
                        <TouchableOpacity
                          key={w.id}
                          style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                          onPress={async () => {
                            await WidgetService.restore(userId!, w.id);
                            setWidgets(prev => prev.map(x => x.id === w.id ? { ...x, is_archived: false } : x));
                          }}
                        >
                          <Text style={{ color: colors.textPrimary }}>{w.widget_key}</Text>
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>RESTORE</Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                  <TouchableOpacity onPress={() => setShowManage(false)} style={{ padding: 16, alignItems: 'center' }}>
                    <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>CLOSE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </>
        )}
      />
      <WidgetConfigModal 
        visible={configVisible} 
        onClose={() => setConfigVisible(false)}
        onSave={saveConfig}
        category={widgetCategory}
        setCategory={setWidgetCategory}
        selectedSubjects={selectedSubjects}
        setSelectedSubjects={setSelectedSubjects}
        optionalChoice={optionalChoice}
        colors={colors}
      />
    </PageWrapper>
  );
}

function SubjectProgress({ label, progress, color, colors }: any) {
  return (
    <View style={styles.subProg}>
      <View style={styles.subProgLabels}>
        <Text style={[styles.subLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.subValue, { color: colors.textSecondary }]}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={[styles.barBg, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { backgroundColor: color, width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function WidgetConfigModal({ visible, onClose, onSave, category, setCategory, selectedSubjects, setSelectedSubjects, optionalChoice, colors }: any) {
  const categories = ['Prelims', 'Mains', 'Optional'];
  const subjects = useMemo(() => {
    if (category === 'Optional') {
      return [`${optionalChoice} Paper 1`, `${optionalChoice} Paper 2`];
    }
    if (category === 'Mains') return Object.keys(require('../../src/data/syllabus').MAINS_SYLLABUS);
    return Object.keys(MICRO_SYLLABUS);
  }, [category, optionalChoice]);

  const toggleSubject = (s: string) => {
    if (selectedSubjects.includes(s)) setSelectedSubjects(selectedSubjects.filter((x: string) => x !== s));
    else setSelectedSubjects([...selectedSubjects, s]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Widget Settings</Text>
            <TouchableOpacity onPress={onClose}><X color={colors.textPrimary} size={24} /></TouchableOpacity>
          </View>

          <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>SYLLABUS CATEGORY</Text>
          <View style={styles.catRow}>
            {categories.map(c => (
              <TouchableOpacity 
                key={c} 
                style={[styles.catBtn, { backgroundColor: category === c ? colors.primary : colors.surfaceStrong }]}
                onPress={() => setCategory(c)}
              >
                <Text 
                  style={[styles.catText, { color: category === c ? '#fff' : colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 24 }]}>VISIBLE SUBJECTS</Text>
          <ScrollView contentContainerStyle={styles.subGrid}>
            <TouchableOpacity 
              style={[styles.subItem, selectedSubjects.length === 0 && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
              onPress={() => setSelectedSubjects([])}
            >
              <Text style={[styles.subText, { color: colors.textPrimary }, selectedSubjects.length === 0 && { color: colors.primary, fontWeight: '800' }]}>All Subjects</Text>
            </TouchableOpacity>
            {subjects.map((s: any) => (
              <TouchableOpacity 
                key={s} 
                style={[styles.subItem, selectedSubjects.includes(s) && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                onPress={() => toggleSubject(s)}
              >
                <Text style={[styles.subText, { color: colors.textPrimary }, selectedSubjects.includes(s) && { color: colors.primary, fontWeight: '800' }]}>{s}</Text>
                {selectedSubjects.includes(s) && <Check size={14} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity 
            style={[styles.applyBtn, { backgroundColor: colors.primary }]} 
            onPress={() => {
              onSave(category, selectedSubjects);
              onClose();
            }}
          >
            <Text style={styles.applyText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

function ResumeCard({ icon, label, sub, onPress, colors, width }: any) {
  return (
    <TouchableOpacity 
      style={[styles.resumeCard, { backgroundColor: colors.surface, borderColor: colors.border, width }]} 
      onPress={onPress}
    >
      <View style={styles.resumeIcon}>{icon}</View>
      <Text style={[styles.resumeLabel, { color: colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.resumeSub, { color: colors.textSecondary }]}>{sub}</Text>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  small: { fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  h1: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  avatarBtn: { elevation: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 20 },
  dashboardRow: { flexDirection: 'row', gap: 12 },
  streakCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1 },
  summaryCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1 },
  streakVal: { fontSize: 18, fontWeight: '900' },
  streakLab: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' },
  resumeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  resumeCard: { padding: 16, borderRadius: 20, borderWidth: 1 },
  resumeIcon: { marginBottom: 12 },
  resumeLabel: { fontSize: 15, fontWeight: '800' },
  resumeSub: { fontSize: 12, marginTop: 2 },

  analyticsPromo: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, borderWidth: 1, marginTop: 20 },
  promoTitle: { fontSize: 18, fontWeight: '800' },
  promoSub: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  promoBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 16 },
  arenaCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  arenaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arenaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  arenaTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  arenaSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  arenaRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginTop: 20 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardDesc: { fontSize: 13, marginTop: 2 },
  percentBox: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  percentText: { fontWeight: '900', fontSize: 16 },
  progressList: { gap: 12 },
  subProg: { gap: 6 },
  subProgLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  subLabel: { fontSize: 13, fontWeight: '700' },
  subValue: { fontSize: 12, fontWeight: '600' },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  catRow: { flexDirection: 'row', gap: 10 },
  catBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catText: { fontSize: 14, fontWeight: '700' },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 20 },
  subItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  subText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  // Widget system styles
  doneBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  addWidgetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', marginTop: 8, marginBottom: 12 },
  addModalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '70%' },
  addModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  addModalTitle: { fontSize: 22, fontWeight: '900' },
  addWidgetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, gap: 12 },
  addWidgetName: { fontSize: 15, fontWeight: '700' },
  addWidgetCategory: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
