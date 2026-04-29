import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Layers, StickyNote, Tag, Layout, ChevronRight, Book, Database, BarChart3 } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { radius, spacing } from '../src/theme';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { PageWrapper } from '../src/components/PageWrapper';
import { SyllabusService } from '../src/services/SyllabusService';
import { MICRO_SYLLABUS } from '../src/data/syllabus';

const { width } = Dimensions.get('window');

export default function ReviseTab() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  
  const [stats, setStats] = useState({
    syllabusPercent: 0,
    subjectProgress: [] as { label: string; progress: number; color: string }[]
  });

  const loadProgress = useCallback(async () => {
    if (!userId) return;
    try {
      // 1. Load from cache first
      const cached = await SyllabusService.getCachedProgress(userId);
      if (cached) processProgress(cached);
      
      // 2. Refresh from network
      const fresh = await SyllabusService.getProgress(userId);
      processProgress(fresh);
    } catch (e) {
      console.error("Revise Progress Load Error:", e);
    }
  }, [userId]);

  const processProgress = (progress: any) => {
    let totalItems = 0;
    let completedItems = 0;
    
    const subjectStats: Record<string, { total: number; completed: number; color: string }> = {
      'Polity': { total: 0, completed: 0, color: '#007AFF' },
      'History': { total: 0, completed: 0, color: '#FF9500' },
      'Geography': { total: 0, completed: 0, color: '#34C759' }
    };

    Object.entries(MICRO_SYLLABUS).forEach(([sub, groups]) => {
      Object.entries(groups).forEach(([group, topics]) => {
        (topics as string[]).forEach(topic => {
          totalItems++;
          const path = `${sub}.${group}.${topic}`;
          const isMastered = progress[path]?.mastered;
          if (isMastered) completedItems++;
          
          if (subjectStats[sub]) {
            subjectStats[sub].total++;
            if (isMastered) subjectStats[sub].completed++;
          }
        });
      });
    });
    
    setStats({
      syllabusPercent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0,
      subjectProgress: Object.entries(subjectStats).map(([label, s]) => ({
        label,
        progress: s.total ? s.completed / s.total : 0,
        color: s.color
      }))
    });
  };

  useFocusEffect(useCallback(() => { loadProgress(); }, [loadProgress]));

  const REVISE_SECTIONS = [
    {
      id: 'flashcards',
      title: 'Flashcards',
      desc: 'Active recall with spaced repetition.',
      icon: Layers,
      color: '#FF9500',
      route: '/flashcards'
    },
    {
      id: 'tags',
      title: 'Tags',
      desc: 'Grouped questions by your custom tags.',
      icon: Tag,
      color: '#FF2D55',
      route: '/tags'
    },
    {
      id: 'pyq',
      title: 'PYQ Analysis',
      desc: 'Breakdown of previous year questions.',
      icon: BarChart3,
      color: '#AF52DE',
      route: '/pyq'
    },
    {
      id: 'repo',
      title: 'Repo Hub',
      desc: 'Books, PDFs, and Question Banks.',
      icon: Database,
      color: '#34C759',
      route: '/repo'
    }
  ];

  return (
    <PageWrapper>
      <View style={s.head}>
        <Text style={[s.h1, { color: colors.textPrimary }]}>Revise</Text>
        <ThemeSwitcher />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>

        <View style={s.grid}>
          {REVISE_SECTIONS.map((item) => (
            <TouchableOpacity 
              key={item.id}
              style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[s.cardIcon, { backgroundColor: item.color + '15' }]}>
                <item.icon color={item.color} size={24} />
              </View>
              <View style={s.cardContent}>
                <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                <Text style={[s.cardDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
              </View>
              <ChevronRight color={colors.textTertiary} size={18} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Entry points for content that will be added later */}
        <View style={[s.repoSection, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
           <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>CONTENT REPO</Text>
           <RepoItem icon={<Book color={colors.primary} size={20} />} label="Books (PDFs)" colors={colors} />
           <RepoItem icon={<BarChart3 color={colors.primary} size={20} />} label="Question Banks" colors={colors} isLast />
        </View>
      </ScrollView>
    </PageWrapper>
  );
}

function SubjectProgress({ label, progress, color, colors }: any) {
  return (
    <View style={s.subProg}>
      <View style={s.subProgLabels}>
        <Text style={[s.subLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[s.subValue, { color: colors.textSecondary }]}>{Math.round(progress * 100)}%</Text>
      </View>
      <View style={[s.barBg, { backgroundColor: colors.border }]}>
        <View style={[s.barFill, { backgroundColor: color, width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function RepoItem({ icon, label, colors, isLast }: any) {
  return (
    <TouchableOpacity style={[s.repoItem, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      {icon}
      <Text style={[s.repoLabel, { color: colors.textPrimary }]}>{label}</Text>
      <ChevronRight color={colors.textTertiary} size={16} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  head: { padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h1: { fontSize: 24, fontWeight: '900' },
  progressCard: { padding: 20, borderRadius: 24, borderWidth: 1, marginBottom: 20 },
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
  grid: { gap: 16 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1 },
  cardIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  cardContent: { flex: 1 },
  repoSection: { marginTop: 24, borderRadius: 24, borderWidth: 1, padding: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginLeft: 12, marginTop: 12, marginBottom: 8 },
  repoItem: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  repoLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
});
