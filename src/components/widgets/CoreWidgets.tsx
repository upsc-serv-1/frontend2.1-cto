import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Target, Clock, Zap, TrendingUp, AlertTriangle, ChevronRight, Flame } from 'lucide-react-native';
import { router } from 'expo-router';
import type { WidgetData } from '../hooks/useWidgetData';

// ─── Daily Goal Ring ─────────────────────────────────────────
export function DailyGoalWidget({ data, colors, dailyGoal }: { data: WidgetData; colors: any; dailyGoal: number }) {
  const pct = Math.min(data.todayCount / (dailyGoal || 50), 1);
  const deg = pct * 360;
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ws.ringOuter}>
        <View style={[ws.ringBg, { borderColor: colors.border }]} />
        <View style={[ws.ringProgress, { borderColor: colors.primary, borderTopColor: pct >= 0.25 ? colors.primary : 'transparent', borderRightColor: pct >= 0.5 ? colors.primary : 'transparent', borderBottomColor: pct >= 0.75 ? colors.primary : 'transparent', transform: [{ rotate: `${deg}deg` }] }]} />
        <Text style={[ws.ringText, { color: colors.textPrimary }]}>{data.todayCount}</Text>
      </View>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>of {dailyGoal} goal</Text>
    </View>
  );
}

// ─── Exam Countdown ──────────────────────────────────────────
export function ExamCountdownWidget({ colors, examDate }: { colors: any; examDate: string | null }) {
  let daysLeft = 0;
  if (examDate) {
    const diff = new Date(examDate).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Target color={examDate ? '#ef4444' : colors.textTertiary} size={28} />
      <Text style={[ws.bigNum, { color: examDate ? colors.textPrimary : colors.textTertiary }]}>
        {examDate ? daysLeft : '—'}
      </Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>
        {examDate ? 'days left' : 'Set exam date'}
      </Text>
    </View>
  );
}

// ─── Questions Today ─────────────────────────────────────────
export function QuestionsTodayWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Zap color={colors.primary} size={24} fill={colors.primary} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{data.todayCount}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>questions today</Text>
    </View>
  );
}

// ─── Study Time Today ────────────────────────────────────────
export function StudyTimeWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const mins = Math.floor(data.todayTimeSeconds / 60);
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Clock color="#f97316" size={24} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{mins || data.todayCount * 2}m</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>study time</Text>
    </View>
  );
}

// ─── Weekly Activity ─────────────────────────────────────────
export function WeeklyActivityWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const maxVal = Math.max(1, ...data.weeklyActivity.map(d => d.count));
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ws.cardHeader}>
        <Flame color="#f97316" size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Weekly Activity</Text>
      </View>
      <View style={ws.barChart}>
        {data.weeklyActivity.map((d, i) => (
          <View key={d.day} style={ws.barCol}>
            <View style={[ws.barBg, { backgroundColor: colors.border }]}>
              <View style={[ws.barFill, { backgroundColor: d.count > 0 ? colors.primary : 'transparent', height: `${(d.count / maxVal) * 100}%` }]} />
            </View>
            <Text style={[ws.barLabel, { color: colors.textTertiary }]}>{DAYS[i % 7]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Accuracy Trend ──────────────────────────────────────────
export function AccuracyTrendWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ws.cardHeader}>
        <TrendingUp color="#22c55e" size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Accuracy Trend (7d)</Text>
      </View>
      <View style={ws.barChart}>
        {data.accuracyByDay.map((d, i) => (
          <View key={d.day} style={ws.barCol}>
            <View style={[ws.barBg, { backgroundColor: colors.border }]}>
              <View style={[ws.barFill, {
                backgroundColor: d.accuracy >= 70 ? '#22c55e' : d.accuracy >= 40 ? '#f59e0b' : d.accuracy > 0 ? '#ef4444' : 'transparent',
                height: `${d.accuracy}%`
              }]} />
            </View>
            <Text style={[ws.barLabel, { color: colors.textTertiary }]}>{DAYS[i % 7]}</Text>
            <Text style={[ws.barVal, { color: colors.textTertiary }]}>{d.accuracy > 0 ? `${d.accuracy}%` : ''}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Today's Score ───────────────────────────────────────────
export function TodayScoreWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const total = data.todayCorrect + data.todayIncorrect;
  const pct = total > 0 ? Math.round((data.todayCorrect / total) * 100) : 0;
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[ws.bigNum, { color: pct >= 60 ? '#22c55e' : '#ef4444' }]}>{pct}%</Text>
      <Text style={[ws.tinyText, { color: colors.textSecondary }]}>
        ✓{data.todayCorrect}  ✗{data.todayIncorrect}
      </Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>today's score</Text>
    </View>
  );
}

// ─── Weakest Subject ─────────────────────────────────────────
export function WeakestSubjectWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const weakest = data.subjectAccuracy.length > 0 ? data.subjectAccuracy[0] : null;
  return (
    <TouchableOpacity
      style={[ws.card, ws.full, { backgroundColor: '#fef2f210', borderColor: '#fecaca40' }]}
      onPress={() => weakest && router.push({ pathname: '/arena', params: { subject: weakest.subject } })}
    >
      <View style={ws.cardHeader}>
        <AlertTriangle color="#ef4444" size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Needs Attention</Text>
        <ChevronRight color={colors.textTertiary} size={16} />
      </View>
      {weakest ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={[ws.subjectName, { color: colors.textPrimary }]}>{weakest.subject}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text style={[ws.bigNum, { color: '#ef4444', fontSize: 24 }]}>{weakest.accuracy}%</Text>
            <Text style={[ws.tinyText, { color: colors.textTertiary }]}>({weakest.correct}/{weakest.total})</Text>
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.textTertiary, marginTop: 8 }}>No data yet — start practicing!</Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Speed Meter ─────────────────────────────────────────────
export function SpeedMeterWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const avg = data.totalAttempted > 0 ? Math.round((data.todayCount > 0 ? data.todayTimeSeconds / data.todayCount : 120)) : 0;
  const display = avg > 0 ? `${avg}s` : '—';
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Clock color="#8b5cf6" size={24} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{display}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>avg/question</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────
export const ws = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, padding: 16, alignItems: 'center', justifyContent: 'center', height: '100%' },
  half: { flex: 1 },
  full: { width: '100%', alignItems: 'stretch' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  bigNum: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  widgetLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  tinyText: { fontSize: 11, fontWeight: '600' },
  subjectName: { fontSize: 16, fontWeight: '800', flex: 1 },
  ringOuter: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  ringBg: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 5 },
  ringProgress: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 5 },
  ringText: { fontSize: 20, fontWeight: '900' },
  barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 80, marginTop: 12, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barBg: { width: '100%', height: 60, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9, fontWeight: '800' },
  barVal: { fontSize: 8, fontWeight: '700' },
});
