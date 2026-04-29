import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Alert, FlatList, ActivityIndicator, Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { AnalyseSection } from '../src/components/unified/AnalyseSection';
import { spacing, radius } from '../src/theme';
import { supabase } from '../src/lib/supabase';
import {
  TrendingUp, ChevronRight, Trash2, BarChart2,
  CheckCircle2, XCircle, MinusCircle, Clock, Target, Zap,
} from 'lucide-react-native';
import { OfflineManager } from '../src/services/OfflineManager';

/* ─── helpers ─── */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}
function fmtTime(sec: number) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function accuracyColor(acc: number, colors: any) {
  if (acc >= 70) return colors.success;
  if (acc >= 40) return '#f59e0b';
  return colors.error;
}

/* ─── attempt card ─── */
function AttemptCard({ item, colors, onDelete, onReport, onVisual }: any) {
  const qs: any[] = item.attempt_payload?.questions ?? [];
  const correct = qs.filter((q: any) => q.is_correct).length;
  const wrong = qs.filter((q: any) => q.selected_answer && !q.is_correct).length;
  const skipped = qs.filter((q: any) => !q.selected_answer).length;
  const total = item.attempt_payload?.total_questions || qs.length || 0;
  const attempted = correct + wrong;
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const duration = item.attempt_payload?.duration_seconds;
  const accColor = accuracyColor(accuracy, colors);

  return (
    <Swipeable
      friction={2}
      rightThreshold={24}
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity
          style={[styles.deleteAction]}
          onPress={() =>
            Alert.alert(
              'Delete Attempt?',
              'This attempt and its analytics will be permanently removed.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
              ]
            )
          }
        >
          <Trash2 size={18} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      )}
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {item.title || item.attempt_payload?.title || 'Practice Session'}
            </Text>
            <Text style={[styles.cardDate, { color: colors.textTertiary }]}>
              {item.submitted_at ? fmtDate(item.submitted_at) : '—'}
            </Text>
          </View>
          {/* Accuracy badge */}
          <View style={[styles.accBadge, { backgroundColor: accColor + '18', borderColor: accColor + '40' }]}>
            <Text style={[styles.accBadgeText, { color: accColor }]}>{accuracy}%</Text>
            <Text style={[styles.accBadgeLabel, { color: accColor + 'cc' }]}>ACC</Text>
          </View>
        </View>

        {/* Score strip */}
        <View style={[styles.scoreStrip, { backgroundColor: colors.bg }]}>
          <View style={styles.scoreItem}>
            <CheckCircle2 size={14} color={colors.success} />
            <Text style={[styles.scoreNum, { color: colors.textPrimary }]}>{correct}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>correct</Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreItem}>
            <XCircle size={14} color={colors.error} />
            <Text style={[styles.scoreNum, { color: colors.textPrimary }]}>{wrong}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>wrong</Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreItem}>
            <MinusCircle size={14} color={colors.textTertiary} />
            <Text style={[styles.scoreNum, { color: colors.textPrimary }]}>{skipped}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>skipped</Text>
          </View>
          <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
          <View style={styles.scoreItem}>
            <Target size={14} color={colors.primary} />
            <Text style={[styles.scoreNum, { color: colors.textPrimary }]}>{total}</Text>
            <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>total</Text>
          </View>
          {duration ? (
            <>
              <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
              <View style={styles.scoreItem}>
                <Clock size={14} color={colors.primary} />
                <Text style={[styles.scoreNum, { color: colors.textPrimary }]}>{fmtTime(duration)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.reportBtn, { backgroundColor: colors.primary, flex: 1.2 }]}
            onPress={() => onReport(item.id)}
            activeOpacity={0.85}
          >
            <Text style={styles.reportBtnText}>FULL REPORT</Text>
            <ChevronRight size={16} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.visualBtn, { borderColor: colors.primary, flex: 1 }]}
            onPress={() => onVisual(item.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.visualBtnText, { color: colors.primary }]}>VISUAL ANALYSIS</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

/* ─── main screen ─── */
export default function AnalyseTab() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchAttempts();
        OfflineManager.incrementalSync(session.user.id).catch(() => {});
      }
    }, [session])
  );

  const fetchAttempts = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const offline = await OfflineManager.getOfflineAttempts(session.user.id);
      if (offline?.length > 0) setAttempts(offline);

      const { data, error } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('submitted_at', { ascending: false })
        .limit(50);

      if (!error && data?.length > 0) setAttempts(data);
    } catch (err) {
      console.error('Fetch attempts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteAttempt = async (id: string) => {
    try {
      await supabase.from('test_attempts').delete().eq('id', id).eq('user_id', session?.user.id);
      await supabase.from('question_states').delete().eq('attempt_id', id).eq('user_id', session?.user.id);
      setAttempts(prev => prev.filter(a => a.id !== id));
    } catch (err: any) {
      Alert.alert('Delete failed', err?.message || 'Could not remove this attempt.');
    }
  };

  /* ── summary stats ── */
  const summaryStats = React.useMemo(() => {
    if (!attempts.length) return null;
    let totalCorrect = 0, totalAttempted = 0, totalXP = 0;
    attempts.forEach(a => {
      const qs: any[] = a.attempt_payload?.questions ?? [];
      const c = qs.filter((q: any) => q.is_correct).length;
      const w = qs.filter((q: any) => q.selected_answer && !q.is_correct).length;
      totalCorrect += c;
      totalAttempted += c + w;
      totalXP += c * 10 + (c + w) * 2;
    });
    const overallAcc = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
    return { tests: attempts.length, accuracy: overallAcc, xp: totalXP };
  }, [attempts]);

  if (!session?.user?.id) {
    return (
      <PageWrapper>
        <View style={[styles.center, { backgroundColor: colors.bg }]}>
          <Text style={{ color: colors.textSecondary }}>Please login to view analytics.</Text>
        </View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      {/* ── Header ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Performance</Text>
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Your attempt history</Text>
        </View>
        <TouchableOpacity
          style={[styles.trendsBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}
          onPress={() => setShowTrends(true)}
        >
          <BarChart2 size={16} color={colors.primary} />
          <Text style={[styles.trendsBtnText, { color: colors.primary }]}>Trends</Text>
        </TouchableOpacity>
      </View>

      {/* ── Summary strip ── */}
      {summaryStats && (
        <View style={[styles.summaryStrip, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: colors.textPrimary }]}>{summaryStats.tests}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Tests</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryNum, { color: accuracyColor(summaryStats.accuracy, colors) }]}>
              {summaryStats.accuracy}%
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Accuracy</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Zap size={14} color={colors.primary} />
              <Text style={[styles.summaryNum, { color: colors.primary }]}>{summaryStats.xp}</Text>
            </View>
            <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>XP Earned</Text>
          </View>
        </View>
      )}

      {/* ── Attempt Feed ── */}
      {loading && attempts.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Loading attempts...</Text>
        </View>
      ) : attempts.length === 0 ? (
        <View style={styles.center}>
          <BarChart2 size={48} color={colors.primary} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Attempts Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Complete a quiz in the Unified Arena to see your performance history here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={attempts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <AttemptCard
              item={item}
              colors={colors}
              onDelete={deleteAttempt}
              onReport={(id: string) =>
                router.push({ pathname: '/unified/result/[aid]', params: { aid: id } })
              }
              onVisual={(id: string) =>
                router.push({ pathname: '/unified/review/[aid]', params: { aid: id } })
              }
            />
          )}
        />
      )}

      {/* ── Trends Modal ── */}
      <Modal
        visible={showTrends}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTrends(false)}
      >
        <View style={[styles.modalWrapper, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={[styles.modalTopBar, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Overall Trends</Text>
            <Pressable onPress={() => setShowTrends(false)} style={[styles.closeBtn, { backgroundColor: colors.surface }]}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
            </Pressable>
          </View>
          <ScrollView>
            <AnalyseSection userId={session.user.id} />
          </ScrollView>
        </View>
      </Modal>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  trendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  trendsBtnText: { fontSize: 13, fontWeight: '800' },

  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 20, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  summaryDivider: { width: 1, height: 32, marginHorizontal: 8 },

  listContent: { padding: spacing.md, paddingBottom: 100, gap: 12 },

  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cardDate: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  accBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 58,
  },
  accBadgeText: { fontSize: 18, fontWeight: '900' },
  accBadgeLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  scoreStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  scoreItem: { flex: 1, alignItems: 'center', gap: 2 },
  scoreNum: { fontSize: 15, fontWeight: '900' },
  scoreLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  scoreDivider: { width: 1, height: 28, marginHorizontal: 2 },

  cardActions: {
    flexDirection: 'row',
    gap: 10,
    padding: spacing.md,
    paddingTop: 8,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  visualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  visualBtnText: { fontWeight: '900', fontSize: 11, letterSpacing: 0.5 },
  reportBtnText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

  deleteAction: {
    width: 80,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    margin: 4,
    gap: 4,
  },
  deleteText: { color: '#fff', fontWeight: '800', fontSize: 11 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginTop: spacing.lg },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  modalWrapper: { flex: 1, paddingTop: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '800' },
});
