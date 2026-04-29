import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { supabase } from '../lib/supabase';
import { LineChart, BarChart, HorizontalBarChart } from './Charts';
import { TrendingUp, Target, Clock, Calendar, ChevronRight, BarChart2 } from 'lucide-react-native';

interface AnalyseBetaProps {
  userId: string;
}

export const AnalyseBetaSection = ({ userId }: AnalyseBetaProps) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [subjectStats, setSubjectStats] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSimpleData();
  }, [userId]);

  const fetchSimpleData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Attempts
      const { data: attemptData, error: attemptError } = await supabase
        .from('test_attempts')
        .select('id, title, score, total, accuracy, submitted_at, time_spent_seconds')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false });

      if (attemptError) throw attemptError;
      setAttempts(attemptData || []);

      // 2. Fetch Subject Stats via Manual Join (Ultra Stable)
      const { data: states, error: statesError } = await supabase
        .from('question_states')
        .select('question_id, selected_answer, is_incorrect_last_attempt')
        .eq('user_id', userId)
        .not('selected_answer', 'is', null);

      if (!statesError && states && states.length > 0) {
        const qIds = Array.from(new Set(states.map(s => s.question_id)));
        const { data: qMeta } = await supabase
          .from('questions')
          .select('id, subject, correct_answer')
          .in('id', qIds);

        if (qMeta) {
          const qMap = new Map(qMeta.map(q => [String(q.id), q]));
          const subjects = new Map<string, { total: number, correct: number }>();

          states.forEach(s => {
            const meta = qMap.get(String(s.question_id));
            if (meta) {
              const sub = meta.subject || 'General';
              const isCorrect = s.selected_answer === meta.correct_answer;
              
              if (!subjects.has(sub)) subjects.set(sub, { total: 0, correct: 0 });
              const stat = subjects.get(sub)!;
              stat.total += 1;
              if (isCorrect) stat.correct += 1;
            }
          });

          const formattedStats = Array.from(subjects.entries())
            .map(([label, val]) => ({
              label,
              value: Math.round((val.correct / val.total) * 100)
            }))
            .sort((a, b) => b.value - a.value);
          
          setSubjectStats(formattedStats);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Crunching your performance data...</Text>
      </View>
    );
  }

  const avgAccuracy = attempts.length > 0 ? Math.round(attempts.reduce((acc, a) => acc + (a.accuracy || 0), 0) / attempts.length) : 0;
  const recentTrend = attempts.slice(0, 7).reverse();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 1. Dashboard Row */}
      <View style={styles.row}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Attempts</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{attempts.length}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Aggregate Acc.</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{avgAccuracy}%</Text>
        </View>
      </View>

      {/* 2. Subject Performance */}
      {subjectStats.length > 0 && (
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <BarChart2 size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Subject Proficiency</Text>
          </View>
          <HorizontalBarChart data={subjectStats.slice(0, 5)} height={subjectStats.length * 45} />
        </View>
      )}

      {/* 3. Performance Trend */}
      {recentTrend.length >= 2 && (
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <TrendingUp size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Accuracy Momentum</Text>
          </View>
          <LineChart 
            data={[{ label: 'Accuracy', values: recentTrend.map(a => a.accuracy || 0) }]}
            labels={recentTrend.map((_, i) => `#${i+1}`)}
            height={180}
            colors={[colors.primary]}
          />
        </View>
      )}

      {/* 4. Recent History List */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Calendar size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recent History</Text>
        </View>
        {attempts.slice(0, 5).map((item, idx) => (
          <View key={item.id} style={[styles.historyItem, idx < attempts.slice(0, 5).length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border + '50' }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.historyTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.title || 'Untitled Test'}</Text>
              <Text style={[styles.historyMeta, { color: colors.textTertiary }]}>
                {new Date(item.submitted_at).toLocaleDateString()} • {Math.floor((item.time_spent_seconds || 0) / 60)}m
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.historyScore, { color: colors.primary }]}>{item.score}/{item.total}</Text>
              <Text style={[styles.historyAcc, { color: colors.textSecondary }]}>{item.accuracy}%</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Text style={[styles.infoText, { color: colors.textTertiary }]}>
          NOTE: This Beta engine performs manual data-stitching to bypass database relationship errors and ensure your insights are always visible.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  chartCard: {
    padding: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  historyMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  historyScore: {
    fontSize: 15,
    fontWeight: '800',
  },
  historyAcc: {
    fontSize: 11,
    fontWeight: '600',
  },
  infoBox: {
    marginTop: 20,
    paddingHorizontal: 10,
  },
  infoText: {
    fontSize: 10,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  }
});
