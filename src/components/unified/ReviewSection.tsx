import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useSingleTestAnalytics } from '../../hooks/useTestAnalytics';
import { DonutChart, BarChart, HorizontalBarChart } from '../Charts';
import { AlertTriangle, Target, Activity, Clock, ShieldAlert, TrendingUp, Award, ChevronRight, CheckCircle2, XCircle, HelpCircle } from 'lucide-react-native';
import { DEFAULT_ANALYTICS_LAYOUT, loadAnalyticsLayout } from '../../utils/analyticsLayout';
import { useQuizStore } from '../../store/quizStore';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface ReviewSectionProps {
  testAttemptId: string;
}

export const ReviewSection = ({ testAttemptId }: ReviewSectionProps) => {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { loading, error, scoreData, hierarchicalPerformance, confidenceMetrics, questions, testId } = useSingleTestAnalytics(testAttemptId);
  const [sectionOrder, setSectionOrder] = useState<string[]>(['advanced_link', ...DEFAULT_ANALYTICS_LAYOUT.review]);
  const [localTags, setLocalTags] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAnalyticsLayout().then(layout => {
      const order = layout.review || DEFAULT_ANALYTICS_LAYOUT.review;
      if (!order.includes('advanced_link')) {
        setSectionOrder(['advanced_link', ...order]);
      } else {
        setSectionOrder(order);
      }
    });
  }, []);

  const handleReviewIncorrect = () => {
    if (!questions || questions.length === 0) return;
    const incorrectIds = questions
      .filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer)
      .map(q => q.id);
    
    if (incorrectIds.length === 0) {
      alert("No incorrect questions to review!");
      return;
    }
    
    router.push({
      pathname: '/unified/engine',
      params: { 
        testId: testId || 'manual',
        resultIds: incorrectIds.join(','),
        mode: 'learning',
        view: 'card'
      }
    });
  };

  const handleTagError = async (questionId: string, errorType: string) => {
    // Optimistic UI update
    setLocalTags(prev => ({ ...prev, [questionId]: errorType }));

    try {
      // Persist to attempts table (jsonb update via RPC)
      await supabase.rpc('update_attempt_error_category', {
        attempt_id: testAttemptId,
        q_id: questionId,
        new_cat: errorType,
      });

      // Persist to question_states
      if (session?.user?.id) {
        await supabase.from('question_states').upsert({
          user_id: session.user.id,
          question_id: questionId,
          attempt_id: testAttemptId,
          error_category: errorType,
        }, { onConflict: 'user_id,question_id,attempt_id' });
      }
    } catch (err) {
      console.error('Failed to save tag', err);
    }
  };

  const generateInsightStory = () => {
    if (!scoreData) return "";
    const accuracy = scoreData.accuracy;
    let story = "";
    if (accuracy > 80) story = "Exceptional performance! Your concept clarity is elite.";
    else if (accuracy > 60) story = "Solid effort. You have a strong grasp of core concepts but some gaps remain.";
    else story = "Keep pushing. Focusing on 'Sure' areas and analyzing 'Guess' patterns will yield fast improvements.";
    
    return story;
  };

  if (loading) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Analyzing Test Results...</Text>
      </View>
    );
  }

  if (error || !scoreData || !hierarchicalPerformance || Object.keys(hierarchicalPerformance.subjects).length === 0) {
    return (
      <View style={[styles.center, { padding: spacing.xl, marginTop: 100 }]}>
        <AlertTriangle color={'#f59e0b'} size={48} opacity={0.8} />
        <Text style={{ color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center', fontWeight: '900', fontSize: 18 }}>
          Analysis Partially Available
        </Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          We could fetch the score, but detailed subject breakdown is missing. This usually happens for very old tests or tests with unmapped questions.
        </Text>
        {scoreData && (
          <View style={{ marginTop: 24, padding: 20, backgroundColor: colors.surfaceStrong, borderRadius: 16, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '800' }}>TOTAL SCORE</Text>
            <Text style={{ color: colors.primary, fontSize: 32, fontWeight: '900' }}>{scoreData.totalMarks}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 4 }}>Accuracy: {scoreData.accuracy}%</Text>
          </View>
        )}

      </View>
    );
  }

  // Calculate Donut Chart Data
  const donutData = [
    { tag: 'Correct', count: scoreData.correct },
    { tag: 'Incorrect', count: scoreData.incorrect },
    { tag: 'Skipped', count: scoreData.unattempted }
  ];

  // Specific colors per user request: Green, Soft Red/Orange, Grey
  const donutColors = [colors.primary, '#f87171', colors.textTertiary];

  // Prepare Bar Chart Data (Subjects sorted from lowest to highest accuracy)
  const subjectList = Object.values(hierarchicalPerformance.subjects);
  const sortedSubjects = subjectList.sort((a, b) => a.accuracy - b.accuracy);
  
  const barChartData = sortedSubjects.map(sub => ({
    label: sub.name,
    value: sub.accuracy
  }));

  // Identify Weak Areas (Accuracy < 50%) across Subjects and Section Groups
  const weakAreas: { name: string; type: string; accuracy: number }[] = [];
  
  subjectList.forEach(subject => {
    if (subject.total > 0 && subject.accuracy < 50) {
      weakAreas.push({ name: subject.name, type: 'Subject', accuracy: subject.accuracy });
    }
    
    Object.values(subject.sectionGroups).forEach(section => {
      // Only include sections with at least 2 questions to avoid noise
      if (section.total > 1 && section.accuracy < 50) {
        weakAreas.push({ name: section.name, type: 'Section', accuracy: section.accuracy });
      }
    });
  });

  const sectionBlocks: Record<string, React.ReactNode> = {

    summary: (
      <React.Fragment key="summary">
        <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Score</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{scoreData.totalMarks}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Accuracy</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{scoreData.accuracy}%</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Avg Time</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{scoreData.avgTimePerQuestion}s</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Attempts</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>
            {scoreData.correct + scoreData.incorrect} / {scoreData.correct + scoreData.incorrect + scoreData.unattempted}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Total Time</Text>
          <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{Math.round(scoreData.totalTimeSeconds / 60)}m</Text>
        </View>
        </View>
      </React.Fragment>
    ),
    outcomes: (
      <View key="outcomes" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Question Outcomes</Text>
        </View>
        <DonutChart 
          data={donutData} 
          size={230} 
          colors={donutColors} 
          centerLabel={scoreData.totalMarks.toString()} 
          centerSubLabel="FINAL SCORE"
          legendMode="arc"
          strokeWidth={26}
        />
      </View>
    ),
    subject_accuracy: barChartData.length > 0 ? (
      <View key="subject_accuracy" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Activity size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Subject Accuracy</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Sorted by lowest accuracy</Text>
          <HorizontalBarChart data={barChartData} />
          
          <View style={styles.chartDivider} />

          <View style={styles.cardHeader}>
            <Clock size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Time Distribution</Text>
          </View>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Total seconds spent per subject</Text>
          <HorizontalBarChart 
            data={sortedSubjects
              .filter(s => s.timeSpent !== undefined)
              .map(sub => ({
                label: sub.name,
                value: Math.round(sub.timeSpent)
              }))} 
            max={Math.max(...sortedSubjects.map(s => s.timeSpent || 0), 1)}
            color={colors.primary + '80'}
          />
        </View>
      ) : null,
    fatigue: (
      <View key="fatigue" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Fatigue Analysis</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Accuracy by test progress</Text>
        {Object.keys(hierarchicalPerformance.advanced.fatigue).length > 0 ? (
          <View>
            <BarChart 
              data={Object.entries(hierarchicalPerformance.advanced.fatigue || {})
                .filter(([_, stats]) => stats && stats.total !== undefined)
                .map(([hour, stats]) => ({
                  label: hour === '1' ? 'First Half' : 'Second Half',
                  value: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
                }))} 
              height={180}
            />
            {Object.keys(hierarchicalPerformance.advanced.fatigue).length >= 2 && (() => {
              const h1 = hierarchicalPerformance.advanced.fatigue[1];
              const h2 = hierarchicalPerformance.advanced.fatigue[2];
              if (h1 && h2) {
                const h1Acc = h1.correct / h1.total;
                const h2Acc = h2.correct / h2.total;
                let insight = 'Your focus is stable throughout the test.';
                if (h2Acc < h1Acc - 0.1) insight = 'You make more errors in the Second Half due to fatigue.';
                else if (h2Acc > h1Acc + 0.1) insight = 'Your focus improves in the Second Half.';
                return (
                  <Text style={[styles.cardSubtitle, { color: colors.textSecondary, textAlign: 'center', marginTop: 10 }]}>
                    {insight}
                  </Text>
                );
              }
              return null;
            })()}
          </View>
        ) : (
          <Text style={[styles.noDataText, { color: colors.textTertiary }]}>Advanced timing data not available for this older test attempt.</Text>
        )}
      </View>
    ),
    difficulty: (
      <View key="difficulty" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <TrendingUp size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Difficulty vs. Accuracy</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary, marginBottom: 20 }]}>Performance by Question Difficulty</Text>
        <BarChart 
          data={Object.entries(hierarchicalPerformance.advanced.difficulty || {})
            .filter(([_, stats]) => stats && stats.total > 0)
            .map(([level, stats]) => ({
              label: level,
              value: Math.round((stats.correct / stats.total) * 100)
            }))}
          height={180}
        />
      </View>
    ),
    insights: (
      <View key="insights" style={[styles.insightCard, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
        <Text style={[styles.insightTitle, { color: colors.primary }]}>Attempt Insights</Text>
        <Text style={[styles.insightText, { color: colors.textPrimary }]}>{generateInsightStory()}</Text>
      </View>
    ),
    mistake_types: (
      <View key="mistake_types" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <ShieldAlert size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Mistake Types</Text>
        </View>
        <DonutChart 
          data={Object.entries(hierarchicalPerformance.advanced.errors || {})
            .filter(([_, count]) => count !== undefined)
            .map(([cat, count]) => ({
              tag: cat,
              count: count
            }))}
          size={160}
          colors={['#ef4444', '#f59e0b', '#fbbf24', colors.textTertiary]}
        />
      </View>
    ),
    confidence: (
      <View key="confidence" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Confidence vs. Accuracy</Text>
        </View>
        <View style={styles.confidenceGrid}>
          {confidenceMetrics.map(metric => (
            <ConfidenceStat key={metric.label} metric={metric} colors={colors} />
          ))}
        </View>
      </View>
    ),
    weak_areas: (
      <View key="weak_areas" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={24} color={'#ef4444'} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Weak Areas (&lt;50% Accuracy)</Text>
        </View>
        
        {weakAreas.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Great job! You don't have any major weak areas in this test.
          </Text>
        ) : (
          <View style={styles.weakList}>
            {weakAreas.map((area, index) => (
              <View key={`${area.name}-${index}`} style={[styles.weakItem, { borderBottomColor: colors.border + '50' }]}>
                <View>
                  <Text style={[styles.weakItemName, { color: colors.textPrimary }]}>{area.name}</Text>
                  <Text style={[styles.weakItemType, { color: colors.textTertiary }]}>{area.type}</Text>
                </View>
                <View style={[styles.weakBadge, { backgroundColor: '#ef444415' }]}>
                  <Text style={[styles.weakBadgeText, { color: '#ef4444' }]}>
                    {area.accuracy}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    ),
    mistake_analysis: questions.filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer).length > 0 ? (
      <View key="mistake_analysis" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <ShieldAlert size={18} color={'#ef4444'} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Mistake Categorization</Text>
        </View>
        <Text style={[styles.cardSubtitle, { color: colors.textTertiary, marginBottom: 16 }]}>
          Tag your incorrect questions to identify your 'Error DNA'.
        </Text>
        
        {questions
          .filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer)
          .map((q, idx) => {
            const currentCat = localTags[q.id] || q.errorCategory;
            return (
              <View key={q.id} style={[styles.mistakeItem, { borderBottomColor: colors.border + '30' }]}>
                <View style={styles.mistakeQHeader}>
                   <Text style={[styles.mistakeQIndex, { color: colors.textTertiary }]}>Q{idx + 1}</Text>
                   <Text style={[styles.mistakeQSubject, { color: colors.primary }]}>{q.subject}</Text>
                </View>
                <View style={styles.errorChipRow}>
                  {['Silly Mistake', 'Conceptual', 'Reading', 'Elimination', 'Overthinking'].map(cat => (
                    <TouchableOpacity 
                      key={cat} 
                      onPress={() => handleTagError(q.id, cat)}
                      style={[
                        styles.errorChip, 
                        { borderColor: colors.border },
                        currentCat === cat && { backgroundColor: colors.error + '15', borderColor: colors.error }
                      ]}
                    >
                      <Text style={[
                        styles.errorChipText, 
                        { color: colors.textSecondary },
                        currentCat === cat && { color: colors.error, fontWeight: '800' }
                      ]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
      </View>
    ) : null,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {sectionOrder.map(key => sectionBlocks[key]).filter(Boolean)}
      

    </ScrollView>
  );
};

const ConfidenceStat = ({ metric, colors }: any) => (
  <View style={[styles.confItem, { borderColor: colors.border }]}>
    <Text style={[styles.confLabel, { color: colors.textSecondary }]}>{metric.label}</Text>
    <Text style={[styles.confValue, { color: colors.textPrimary }]}>{metric.accuracy}%</Text>
    <Text style={[styles.confSub, { color: colors.textTertiary }]}>
      {metric.correct}/{metric.total} correct
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: 150,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  chartCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  chartDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  mistakeItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mistakeQHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  mistakeQIndex: {
    fontSize: 11,
    fontWeight: '900',
  },
  mistakeQSubject: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  errorChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  errorChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: spacing.lg,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  insightCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  confidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  },
  confItem: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  confLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  confValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  confSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  viewQuestionsText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xl,
  },
  reviewBtn: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  weakList: {
    marginTop: spacing.sm,
  },
  weakItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  weakItemName: {
    fontSize: 15,
    fontWeight: '700',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  weakItemType: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  weakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  weakBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noDataText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.md,
  }
});
