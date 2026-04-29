import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Layers, Tag, BookOpen, Play, ChevronRight, CheckCircle, Trophy } from 'lucide-react-native';
import { router } from 'expo-router';
import type { WidgetData } from '../hooks/useWidgetData';
import { ws } from './widgets/CoreWidgets';

// ─── Due Flashcards ──────────────────────────────────────────
export function DueCardsWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <TouchableOpacity
      style={[ws.card, ws.half, { backgroundColor: data.dueCards > 0 ? '#fef3c720' : colors.surface, borderColor: data.dueCards > 0 ? '#fbbf2440' : colors.border }]}
      onPress={() => router.push({ pathname: '/flashcards/review', params: { mode: 'due' } })}
    >
      <Layers color={data.dueCards > 0 ? '#f59e0b' : colors.textTertiary} size={24} />
      <Text style={[ws.bigNum, { color: data.dueCards > 0 ? '#f59e0b' : colors.textPrimary }]}>{data.dueCards}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>cards due</Text>
    </TouchableOpacity>
  );
}

// ─── Card Mastery ────────────────────────────────────────────
export function MasteryRingWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const total = data.totalCards || 1;
  const mPct = Math.round((data.masteredCards / total) * 100);
  return (
    <View style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <CheckCircle color="#22c55e" size={24} />
      <Text style={[ws.bigNum, { color: '#22c55e' }]}>{mPct}%</Text>
      <Text style={[ws.tinyText, { color: colors.textSecondary }]}>
        {data.masteredCards} mastered · {data.learningCards} learning
      </Text>
      <Text style={[ws.widgetLabel, { color: colors.textTertiary }]}>of {data.totalCards} cards</Text>
    </View>
  );
}

// ─── PYQ Year Coverage ───────────────────────────────────────
export function PYQCoverageWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <TouchableOpacity
      style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push('/study/pyq_analysis')}
    >
      <View style={ws.cardHeader}>
        <Trophy color="#8b5cf6" size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>PYQ Year Coverage</Text>
        <ChevronRight color={colors.textTertiary} size={16} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {data.pyqYears.map(y => (
          <View key={y.year} style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
            backgroundColor: y.done ? '#22c55e20' : colors.border + '40',
            borderWidth: 1, borderColor: y.done ? '#22c55e40' : colors.border,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: y.done ? '#22c55e' : colors.textTertiary }}>{y.year}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ─── Recent Notes ────────────────────────────────────────────
export function RecentNotesWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ws.cardHeader}>
        <BookOpen color={colors.primary} size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Recent Notes</Text>
      </View>
      {data.recentNotes.length > 0 ? data.recentNotes.slice(0, 3).map(n => (
        <TouchableOpacity key={n.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border + '30' }}
          onPress={() => router.push({ pathname: '/study/editor', params: { noteId: n.id } })}
        >
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>{n.title || 'Untitled'}</Text>
          <Text style={{ fontSize: 10, color: colors.textTertiary }}>{timeAgo(n.updated_at)}</Text>
        </TouchableOpacity>
      )) : <Text style={{ color: colors.textTertiary, marginTop: 8, fontSize: 12 }}>No notebooks yet</Text>}
    </View>
  );
}

// ─── Tagged Questions ────────────────────────────────────────
export function TaggedCountWidget({ data, colors }: { data: WidgetData; colors: any }) {
  return (
    <TouchableOpacity
      style={[ws.card, ws.half, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push('/(tabs)/tags')}
    >
      <Tag color="#ec4899" size={24} />
      <Text style={[ws.bigNum, { color: colors.textPrimary }]}>{data.taggedCount}</Text>
      <Text style={[ws.widgetLabel, { color: colors.textSecondary }]}>{data.uniqueTags} tags</Text>
    </TouchableOpacity>
  );
}

// ─── Quick Practice ──────────────────────────────────────────
export function QuickPracticeWidget({ colors }: { colors: any }) {
  const items = [
    { label: 'Random 10', icon: '🎲', params: { mode: 'learning', subject: 'All', view: 'list' } },
    { label: 'PYQ Only', icon: '📜', params: { mode: 'learning', subject: 'All', pyqMaster: 'PYQ Only', view: 'list' } },
    { label: 'Polity', icon: '🏛️', params: { mode: 'learning', subject: 'Polity', view: 'list' } },
  ];
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ws.cardHeader}>
        <Play color={colors.primary} size={18} fill={colors.primary} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Quick Practice</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {items.map(it => (
          <TouchableOpacity
            key={it.label}
            style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14, backgroundColor: colors.primary + '10', alignItems: 'center' }}
            onPress={() => router.push({ pathname: '/unified/engine', params: it.params as any })}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>{it.icon}</Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>{it.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Last Test ───────────────────────────────────────────────
export function LastTestWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const last = data.recentAttempts[0];
  if (!last) return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.textTertiary, fontSize: 13 }}>No tests attempted yet</Text>
    </View>
  );
  const pct = last.total > 0 ? Math.round((last.score / last.total) * 100) : 0;
  return (
    <TouchableOpacity
      style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: '/analyse', params: { mode: 'review' } })}
    >
      <View style={ws.cardHeader}>
        <Trophy color={pct >= 60 ? '#22c55e' : '#f59e0b'} size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Last Test</Text>
        <ChevronRight color={colors.textTertiary} size={16} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }} numberOfLines={1}>{last.title || 'Untitled'}</Text>
          <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{timeAgo(last.submitted_at)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: pct >= 60 ? '#22c55e' : '#f59e0b' }}>{last.score}/{last.total}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>{pct}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Test Score Timeline ─────────────────────────────────────
export function TestScoresWidget({ data, colors }: { data: WidgetData; colors: any }) {
  const attempts = data.recentAttempts.slice(0, 5).reverse();
  if (attempts.length === 0) return null;
  const maxScore = Math.max(1, ...attempts.map(a => a.total || 1));
  return (
    <View style={[ws.card, ws.full, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={ws.cardHeader}>
        <Layers color={colors.primary} size={18} />
        <Text style={[ws.cardTitle, { color: colors.textPrimary }]}>Score Timeline</Text>
      </View>
      <View style={ws.barChart}>
        {attempts.map((a, i) => {
          const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
          return (
            <View key={a.id} style={ws.barCol}>
              <View style={[ws.barBg, { backgroundColor: colors.border }]}>
                <View style={[ws.barFill, { backgroundColor: pct >= 60 ? '#22c55e' : '#f59e0b', height: `${pct}%` }]} />
              </View>
              <Text style={[ws.barLabel, { color: colors.textTertiary }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Helper ──────────────────────────────────────────────────
function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
