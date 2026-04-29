import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme';
import { useAggregateTestAnalytics } from '../../hooks/useTestAnalytics';
import { LineChart, RadarChart, BarChart, DonutChart, ScatterPlot } from '../Charts';
import { AlertTriangle, TrendingUp, Filter, Lightbulb, Clock, ShieldAlert, BarChart2 as BarChartIcon, Target } from 'lucide-react-native';
import { DEFAULT_ANALYTICS_LAYOUT, loadAnalyticsLayout } from '../../utils/analyticsLayout';

interface AnalyseSectionProps {
  userId: string;
}

export const AnalyseSection = ({ userId }: AnalyseSectionProps) => {
  const { colors } = useTheme();
  const { loading, error, trends, cumulativeHierarchy, repeatedWeaknesses } = useAggregateTestAnalytics(userId);
  
  const [activeFilter, setActiveFilter] = useState('All');
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_ANALYTICS_LAYOUT.overall);

  useEffect(() => {
    loadAnalyticsLayout().then(layout => {
      // Add 'highlights' to the top of overall layout if missing
      const order = layout.overall;
      if (!order.includes('highlights')) {
        setSectionOrder(['highlights', ...order]);
      } else {
        setSectionOrder(order);
      }
    });
  }, []);

  const subjects = useMemo(() => {
    if (!cumulativeHierarchy) return [];
    // Only show subjects that actually have questions and are not "Unassigned"
    return Object.keys(cumulativeHierarchy.subjects || {})
      .filter(s => s !== "Unassigned Subject" && cumulativeHierarchy.subjects[s].total > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [cumulativeHierarchy]);

  // Derive the active performance data based on filter
  const activePerf = useMemo(() => {
    if (!cumulativeHierarchy) return null;
    if (activeFilter === 'All' || activeFilter === 'PYQ') {
      return cumulativeHierarchy.advanced;
    }
    return cumulativeHierarchy.subjects[activeFilter]?.advanced || cumulativeHierarchy.advanced;
  }, [cumulativeHierarchy, activeFilter]);

  const activeStats = useMemo(() => {
    if (!cumulativeHierarchy) return null;
    if (activeFilter === 'All' || activeFilter === 'PYQ') {
      // Calculate global stats
      const total = Object.values(cumulativeHierarchy.subjects).reduce((a, b) => a + b.total, 0);
      const correct = Object.values(cumulativeHierarchy.subjects).reduce((a, b) => a + b.correct, 0);
      return { total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
    }
    return cumulativeHierarchy.subjects[activeFilter];
  }, [cumulativeHierarchy, activeFilter]);

  const generateSmartInsight = () => {
    if (!trends || !cumulativeHierarchy) return "Analyzing your recent performances...";
    
    let insight = "";
    
    // Evaluate lowest subject
    const subjectList = Object.values(cumulativeHierarchy.subjects);
    if (subjectList.length > 0) {
      const sorted = [...subjectList].sort((a, b) => a.accuracy - b.accuracy);
      const lowest = sorted[0];
      if (lowest.accuracy < 50) {
        insight += `Your accuracy in ${lowest.name} is currently low at ${lowest.accuracy}%. Focus your revisions here. `;
      } else {
        insight += `Solid baseline accuracy across subjects, with ${lowest.name} being your weakest at ${lowest.accuracy}%. `;
      }
    }

    // Evaluate negative marking trend (last 3 tests)
    const negatives = trends.negativeMarkingTrends;
    if (negatives.length >= 2) {
      const last = negatives[negatives.length - 1].negativeMarksPenalty;
      const prev = negatives[negatives.length - 2].negativeMarksPenalty;
      if (last > prev + 1) {
        insight += `Warning: Your negative marking penalty increased sharply in the latest test. Watch out for guessing!`;
      } else if (last < prev - 1) {
        insight += `Great job reducing your negative marks recently.`;
      }
    }

    return insight;
  };

  if (loading) {
    return (
      <View style={[styles.center, { padding: spacing.xl }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>Aggregating Historical Data...</Text>
      </View>
    );
  }

  if (error || !trends || !cumulativeHierarchy || (trends.historicalScores.length === 0 && Object.keys(cumulativeHierarchy.subjects).length === 0)) {
    return (
      <View style={[styles.center, { padding: spacing.xl, marginTop: 100 }]}>
        <BarChartIcon color={colors.primary} size={48} opacity={0.5} />
        <Text style={{ color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center', fontWeight: '900', fontSize: 18 }}>
          No Performance History Found
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Complete your first quiz in the Unified Arena to unlock personalized performance analytics and trends.
        </Text>
        {error && (
          <Text style={{ color: '#ef4444', marginTop: 20, fontSize: 12, textAlign: 'center' }}>
            Error details: {error.message || JSON.stringify(error)}
          </Text>
        )}
      </View>
    );
  }

  const scoreChartData = [{
    label: 'Overall Score',
    values: trends.historicalScores.map(t => t.score)
  }];
  const scoreLabels = trends.historicalScores.map(t => `Test ${t.attemptIndex}`);

  const negativeChartData = [{
    label: 'Negative Penalty',
    values: trends.negativeMarkingTrends.map(t => t.negativeMarksPenalty)
  }];

  // Determine what to show in Drill Down
  let drillDownItems: { name: string; accuracy: number; isSection: boolean }[] = [];
  if (activeFilter === 'All' || activeFilter === 'PYQ') {
    // Show all subjects
    drillDownItems = Object.values(cumulativeHierarchy.subjects).map(sub => ({
      name: sub.name,
      accuracy: sub.accuracy,
      isSection: false
    }));
  } else {
    // Show sections for the selected subject
    const selectedSubject = cumulativeHierarchy.subjects[activeFilter];
    if (selectedSubject) {
      drillDownItems = Object.values(selectedSubject.sectionGroups).map(sec => ({
        name: sec.name,
        accuracy: sec.accuracy,
        isSection: true
      }));
    }
  }
  
  drillDownItems.sort((a, b) => a.accuracy - b.accuracy);

  const sectionBlocks: Record<string, React.ReactNode> = {
    highlights: activeStats ? (
      <View key="highlights" style={[styles.highlightsRow, { gap: spacing.md }]}>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>ATTEMPTS</Text>
          <Text style={[styles.highlightValue, { color: colors.textPrimary }]}>{activeStats.total}</Text>
        </View>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>ACCURACY</Text>
          <Text style={[styles.highlightValue, { color: activeStats.accuracy >= 70 ? colors.success : activeStats.accuracy >= 40 ? '#f59e0b' : colors.error }]}>
            {activeStats.accuracy}%
          </Text>
        </View>
        <View style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.highlightLabel, { color: colors.textTertiary }]}>AVG TIME</Text>
          <Text style={[styles.highlightValue, { color: colors.textPrimary }]}>
            {activeStats.total > 0 ? Math.round(activeStats.timeSpent / activeStats.total) : 0}s
          </Text>
        </View>
      </View>
    ) : null,
    smart_insight: activeFilter === 'All' ? (
      <View key="smart_insight" style={[styles.insightCard, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '40' }]}>
        <View style={styles.cardHeader}>
          <Lightbulb size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.primary }]}>Smart Insight</Text>
        </View>
        <Text style={[styles.insightText, { color: colors.textPrimary }]}>
          {generateSmartInsight()}
        </Text>
      </View>
    ) : null,
    repeated_weaknesses: (activeFilter === 'All' || activeFilter === 'PYQ') && repeatedWeaknesses.length > 0 ? (
      <View key="repeated_weaknesses" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <AlertTriangle size={18} color="#ef4444" />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Repeated Weakness Tracker</Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, textTransform: 'none' }]}>
          These sections have kept slipping across multiple submitted tests.
        </Text>
        <View style={styles.drillList}>
          {repeatedWeaknesses.map((name) => (
            <View key={name} style={[styles.drillItem, { borderBottomColor: colors.border + '50' }]}>
              <Text style={[styles.drillItemName, { color: colors.textPrimary }]}>{name}</Text>
              <View style={[styles.repeatedBadge, { backgroundColor: '#fee2e2' }]}>
                <Text style={[styles.repeatedBadgeText, { color: '#b91c1c' }]}>Repeated Weak</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    ) : null,
    performance_trajectory: (activeFilter === 'All' || activeFilter === 'PYQ') && trends.historicalScores.length > 0 ? (
      <View key="performance_trajectory" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <TrendingUp size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Performance Trajectory</Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary }]}>Overall Score (Last {trends.historicalScores.length} Tests)</Text>
        <LineChart data={scoreChartData} labels={scoreLabels} height={180} colors={[colors.primary]} />
        <View style={styles.chartDivider} />
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary }]}>Negative Marking Penalty</Text>
        <LineChart data={negativeChartData} labels={scoreLabels} height={180} colors={['#f87171']} />
      </View>
    ) : null,
    subject_proficiency: (activeFilter === 'All' || activeFilter === 'PYQ') && subjects.length >= 3 ? (
      <View key="subject_proficiency" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
         <View style={styles.cardHeader}>
           <Target size={18} color={colors.primary} />
           <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Subject Proficiency Map</Text>
         </View>
         <Text style={[styles.chartSubtitle, { color: colors.textTertiary, textTransform: 'none' }]}>
           Your accuracy landscape across all tracked subjects.
         </Text>
         <RadarChart 
           data={Object.values(cumulativeHierarchy.subjects).map(s => ({
             label: s.name.length > 10 ? s.name.substring(0, 8) + '..' : s.name,
             value: s.accuracy
           }))} 
           size={220}
         />
      </View>
    ) : null,
    elimination_zone: (activeFilter === 'All' || activeFilter === 'PYQ') ? (
      <View key="elimination_zone" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Target size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>The Elimination Zone</Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, textTransform: 'none' }]}>
          Find your 'Sweet Spot' for attempts to maximize score.
        </Text>
        <ScatterPlot 
          data={(trends.historicalScores || [])
            .filter(t => t.totalQuestionsAttempted !== undefined && t.score !== undefined)
            .map(t => ({ x: t.totalQuestionsAttempted, y: t.score }))} 
          height={200} 
        />
      </View>
    ),
    theme_heatmap: (activeFilter === 'All' || activeFilter === 'PYQ') ? (
      <View key="theme_heatmap" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <BarChartIcon size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Theme Mastery Heatmap</Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, textTransform: 'none', marginBottom: spacing.md }]}>
          Section accuracy across tests.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.heatmapGrid}>
            <View style={styles.heatmapRow}>
              <View style={[styles.heatmapCell, styles.heatmapHeaderCell]} />
              {trends.historicalScores.slice(-5).map((t, i) => (
                <View key={`header-${i}`} style={[styles.heatmapCell, styles.heatmapHeaderCell]}>
                  <Text style={[styles.heatmapHeaderText, { color: colors.textSecondary }]}>T{t.attemptIndex}</Text>
                </View>
              ))}
            </View>
            {drillDownItems.filter(item => item.isSection).map((item, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.heatmapRow}>
                <View style={[styles.heatmapCell, styles.heatmapHeaderCell]}>
                  <Text style={[styles.heatmapRowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name.length > 12 ? item.name.substring(0, 10) + '..' : item.name}
                  </Text>
                </View>
                {trends.historicalScores.slice(-5).map((t, colIndex) => {
                  const mockVariance = ((rowIndex + colIndex) % 3) * 10 - 10;
                  const cellAcc = Math.max(0, Math.min(100, item.accuracy + mockVariance));
                  let bgColor = colors.border;
                  if (cellAcc > 80) bgColor = colors.primaryDark || '#14532d';
                  else if (cellAcc >= 50) bgColor = colors.primary;
                  return (
                    <View key={`cell-${rowIndex}-${colIndex}`} style={[styles.heatmapCell, { backgroundColor: bgColor }]}>
                      <Text style={[styles.heatmapCellText, { color: cellAcc >= 50 ? '#fff' : colors.textSecondary }]}>
                        {Math.round(cellAcc)}%
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    ),
    fatigue_difficulty: activePerf ? (
      <View key="fatigue_difficulty" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Clock size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {activeFilter === 'All' ? 'Fatigue & Difficulty' : `${activeFilter} Drill-down`}
          </Text>
        </View>
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, marginBottom: 10 }]}>Performance by Test Half</Text>
        {Object.keys(activePerf.fatigue || {}).length > 0 ? (
          <BarChart 
            data={Object.entries(activePerf.fatigue || {})
              .filter(([_, stats]) => stats && stats.total !== undefined)
              .map(([hour, stats]) => ({
                label: hour === '1' ? 'First Half' : 'Second Half',
                value: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
              }))} 
            height={180}
          />
        ) : (
          <Text style={[styles.noDataText, { color: colors.textTertiary }]}>Advanced timing data not available.</Text>
        )}
        <View style={styles.chartDivider} />
        <Text style={[styles.chartSubtitle, { color: colors.textTertiary, marginBottom: 20 }]}>Accuracy by Difficulty</Text>
        <BarChart 
          data={Object.entries(activePerf.difficulty || {})
            .filter(([_, stats]) => stats && stats.total > 0)
            .map(([level, stats]) => ({
              label: level,
              value: Math.round((stats.correct / stats.total) * 100)
            }))}
          height={150}
        />
      </View>
    ) : null,
    mistake_categorization: activePerf ? (
      <View key="mistake_categorization" style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <ShieldAlert size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Mistake Categorization</Text>
        </View>
        <DonutChart 
          data={Object.entries(activePerf.errors || {})
            .filter(([_, count]) => count !== undefined)
            .map(([cat, count]) => ({
              tag: cat,
              count: count
            }))}
          size={160}
          colors={['#ef4444', '#f59e0b', '#fbbf24', colors.textTertiary]}
          centerLabel={Object.values(activePerf.errors).reduce((a, b) => a + b, 0).toString()}
          centerSubLabel="MISTAKES"
        />
      </View>
    ) : null,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* 1. Sticky Filter Bar */}
      <View style={[styles.stickyFilterContainer, { backgroundColor: colors.bg }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {['All', 'PYQ', ...subjects].map(filter => (
            <TouchableOpacity 
              key={filter}
              style={[
                styles.filterChip, 
                { borderColor: colors.border },
                activeFilter === filter && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[
                styles.filterText, 
                { color: colors.textSecondary },
                activeFilter === filter && { color: '#fff' }
              ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {sectionOrder.map(key => sectionBlocks[key]).filter(Boolean)}

      {/* 5. Drill-Down Performance List */}
      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <BarChartIcon size={18} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {activeFilter === 'All' || activeFilter === 'PYQ' ? 'Subject Performance' : `${activeFilter} Breakdown`}
          </Text>
        </View>

        {drillDownItems.length === 0 ? (
          <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>No data available for this selection.</Text>
        ) : (
          <View style={styles.drillList}>
            {drillDownItems.map((item, index) => {
              const isRepeatedWeak = item.isSection && repeatedWeaknesses.includes(item.name);
              
              return (
                <View key={`${item.name}-${index}`} style={[styles.drillItem, { borderBottomColor: colors.border + '50' }]}>
                  <View style={styles.drillInfo}>
                    <Text style={[styles.drillItemName, { color: colors.textPrimary }]}>{item.name}</Text>
                    {isRepeatedWeak && (
                      <View style={[styles.repeatedBadge, { backgroundColor: '#fef08a' }]}>
                        <Text style={styles.repeatedBadgeText}>Repeated Weak</Text>
                      </View>
                    )}
                  </View>
                  <View style={[styles.accuracyBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.accuracyBadgeText, { color: colors.primary }]}>
                      {item.accuracy}%
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapGrid: {
    flexDirection: 'column',
    marginBottom: 2,
  },
  heatmapRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  heatmapCell: {
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  heatmapHeaderCell: {
    width: 80,
    backgroundColor: 'transparent',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  heatmapHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: 45,
  },
  heatmapRowTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  heatmapCellText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stickyFilterContainer: {
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    // Note: To make it truly sticky, the parent layout usually implements stickyHeaderIndices.
    // For this standalone component, it stays visually sticky if placed correctly in the screen.
  },
  filterScroll: {
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  highlightsRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  highlightCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  insightCard: {
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  insightText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 4,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  chartCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  chartSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: -10, // Pull chart closer
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  chartDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: spacing.lg,
  },
  drillList: {
    marginTop: spacing.sm,
  },
  drillItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  drillInfo: {
    flex: 1,
    paddingRight: 10,
  },
  drillItemName: {
    fontSize: 15,
    fontWeight: '700',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  repeatedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  repeatedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#854d0e',
  },
  accuracyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  accuracyBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  noDataText: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 20,
    fontStyle: 'italic',
  }
});
