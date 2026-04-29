import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView,
  TextInput,
  Dimensions,
  Animated,
  StatusBar,
  useWindowDimensions
} from 'react-native';
import { useTheme } from '../src/context/ThemeContext';
import { spacing, radius } from '../src/theme';
import { useAuth } from '../src/context/AuthContext';
import { useTaggedVault, TaggedQuestion } from '../src/hooks/useTaggedQuestions';
import { RepoQuestionCard } from '../src/components/RepoQuestionCard';
import { PageWrapper } from '../src/components/PageWrapper';
import { 
  Search, 
  Filter, 
  LayoutGrid, 
  List, 
  ChevronRight, 
  ChevronDown,
  BookOpen, 
  Database,
  ArrowLeft,
  Layers,
  FolderOpen,
  Scale,
  Scroll,
  TrendingUp,
  Globe,
  Leaf,
  Atom,
  Hash,
  Palette,
  Shield,
  Map as MapIcon,
  Heart,
  Users,
  Settings,
  Sparkles
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

export default function TaggedRepoScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const { loading, vaultData, uniqueTags, filters, refresh } = useTaggedVault(session?.user?.id);
  
  // Recalculate column width dynamically for exactly 2 tiles per row
  const GRID_GAP = spacing.lg;
  const COLUMN_WIDTH = (windowWidth - spacing.lg * 2 - GRID_GAP) / 2;
  
  // Local UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedMicroTopics, setExpandedMicroTopics] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Fade animation
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ZEN MODE STATE
  const [isZenMode, setIsZenMode] = useState(false);
  const zenAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const toggleZenMode = () => {
    if (!isZenMode) {
      setIsZenMode(true);
      Animated.timing(zenAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    } else {
      Animated.timing(zenAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start(() => setIsZenMode(false));
    }
  };

  const zenBg = isZenMode ? '#F4ECD8' : colors.bg;
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  const toggleSection = (secName: string) => {
    setExpandedSections(prev => ({ ...prev, [secName]: !prev[secName] }));
  };

  const toggleMicroTopic = (microName: string) => {
    setExpandedMicroTopics(prev => ({ ...prev, [microName]: !prev[microName] }));
  };

  const getSubjectIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('polity')) return Scale;
    if (n.includes('history')) return Scroll;
    if (n.includes('economy')) return TrendingUp;
    if (n.includes('geography')) return Globe;
    if (n.includes('environment')) return Leaf;
    if (n.includes('science') || n.includes('tech')) return Atom;
    if (n.includes('csat')) return Hash;
    if (n.includes('art') || n.includes('culture')) return Palette;
    if (n.includes('security')) return Shield;
    if (n.includes('international') || n.includes('ir')) return MapIcon;
    if (n.includes('ethics')) return Heart;
    if (n.includes('social')) return Users;
    if (n.includes('governance')) return Settings;
    return BookOpen;
  };

  const stats = useMemo(() => {
    return [
      { label: 'Total Vault', value: vaultData.totalCount, icon: Database },
      { label: 'Subjects', value: vaultData.subjects.length, icon: BookOpen },
    ];
  }, [vaultData]);

  const renderTagFilters = (isInsideFolder = false) => (
    <View style={[styles.filterDrawer, isInsideFolder && { paddingBottom: 10, paddingTop: 10 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagScroll}>
        {['All', ...uniqueTags].map(tag => (
          <TouchableOpacity
            key={tag}
            onPress={() => filters.setSelectedTag(tag)}
            style={[
              styles.tagChip,
              { borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : 'rgba(255, 255, 255, 0.4)' },
              filters.selectedTag === tag && { backgroundColor: isZenMode ? '#433422' : colors.textPrimary, borderColor: isZenMode ? '#433422' : colors.textPrimary }
            ]}
          >
            <Text style={[
              styles.tagChipText,
              { color: isZenMode ? '#433422' : colors.textSecondary },
              filters.selectedTag === tag && { color: isZenMode ? '#F4ECD8' : colors.surface, fontWeight: '800' }
            ]}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (activeSubject) {
    const subjectData = vaultData.subjects.find(s => s.name === activeSubject);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: zenBg }}>
        <View style={[styles.detailHeader, { borderBottomColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}>
          <TouchableOpacity onPress={() => setActiveSubject(null)} style={styles.backButton}>
            <ArrowLeft size={20} color={zenTextColor} />
          </TouchableOpacity>
          <Text style={[styles.detailTitle, { color: zenTextColor, flex: 1 }]}>{activeSubject}</Text>
          <TouchableOpacity onPress={toggleZenMode} style={{ padding: 4 }}>
             <Sparkles size={22} color={isZenMode ? '#433422' : colors.primary} />
          </TouchableOpacity>
        </View>
        {!isZenMode && renderTagFilters(true)}
        <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
          {subjectData && Object.values(subjectData.sectionGroups).map(section => (
            <View key={section.name} style={styles.sectionContainer}>
              <TouchableOpacity 
                onPress={() => toggleSection(section.name)}
                style={[styles.sectionHeader, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.primary + '40', borderWidth: 1.5 }]}
              >
                <Layers size={18} color={isZenMode ? '#433422' : colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionName, { color: zenTextColor }]}>{section.name}</Text>
                  <Text style={[styles.sectionStats, { color: isZenMode ? '#43342280' : colors.textTertiary }]}>{section.totalCount} items</Text>
                </View>
                {expandedSections[section.name] ? <ChevronDown size={18} color={isZenMode ? '#433422' : colors.textTertiary} /> : <ChevronRight size={18} color={isZenMode ? '#433422' : colors.textTertiary} />}
              </TouchableOpacity>
              {expandedSections[section.name] && (
                <View style={styles.microTopicContainer}>
                  {Object.values(section.microTopics).map(topic => (
                    <View key={topic.name} style={styles.topicBlock}>
                      <TouchableOpacity onPress={() => toggleMicroTopic(`${section.name}-${topic.name}`)} style={[styles.topicAccordion, { borderBottomColor: colors.border }]}>
                         <FolderOpen size={14} color={colors.textSecondary} />
                         <Text style={[styles.topicName, { color: colors.textSecondary }]}>{topic.name}</Text>
                         <View style={[styles.countBadge, { backgroundColor: colors.surfaceStrong + '20' }]}><Text style={[styles.countText, { color: colors.textSecondary }]}>{topic.questions.length}</Text></View>
                      </TouchableOpacity>
                      {expandedMicroTopics[`${section.name}-${topic.name}`] && (
                        <View style={styles.questionsList}>{topic.questions.map(q => <RepoQuestionCard key={q.id} question={q} onUpdate={refresh} isZenMode={isZenMode} />)}</View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: zenBg }}>
      <PageWrapper>
        {isZenMode && <TouchableOpacity style={styles.floatingZenExit} onPress={() => setIsZenMode(false)} activeOpacity={0.7}><Sparkles size={24} color="#433422" /></TouchableOpacity>}
        <View style={[styles.commandBar, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surface, borderBottomWidth: isZenMode ? 0 : 1, borderBottomColor: colors.border }]}>
          <View style={[styles.searchContainer, isZenMode && { backgroundColor: 'rgba(67, 52, 34, 0.05)' }]}>
            <Search size={18} color={isZenMode ? '#433422' : colors.textTertiary} />
            <TextInput style={[styles.searchInput, { color: zenTextColor }]} placeholder="Search vault..." placeholderTextColor={isZenMode ? '#43342260' : colors.textTertiary} value={filters.searchQuery} onChangeText={filters.setSearchQuery} />
          </View>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} style={[styles.filterButton, { backgroundColor: showFilters ? colors.primary : (isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.surfaceStrong + '20') }]}><Filter size={18} color={showFilters ? '#fff' : (isZenMode ? '#433422' : colors.textSecondary)} /></TouchableOpacity>
          <TouchableOpacity onPress={toggleZenMode} style={{ padding: 10 }}><Sparkles size={20} color={isZenMode ? '#433422' : colors.primary} /></TouchableOpacity>
        </View>

        {showFilters && renderTagFilters()}

        {loading && vaultData.totalCount === 0 ? (
          <View style={styles.center}>
             <ActivityIndicator size="large" color={colors.primary} />
             <Text style={{ color: colors.textSecondary, marginTop: 16, fontWeight: '600' }}>Opening Vault...</Text>
          </View>
        ) : (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainScroll}>
              <View style={styles.statsRow}>
                {stats.map((stat, idx) => (
                  <View key={idx} style={[styles.statCard, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : 'transparent', borderWidth: isZenMode ? 1 : 0 }]}>
                    <stat.icon size={20} color={isZenMode ? '#433422' : colors.primary} />
                    <View><Text style={[styles.statValue, { color: zenTextColor }]}>{stat.value}</Text><Text style={[styles.statLabel, { color: isZenMode ? '#43342280' : colors.textTertiary }]}>{stat.label}</Text></View>
                  </View>
                ))}
              </View>
              <View style={styles.gridHeader}><Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Knowledge Vault</Text><View style={styles.viewToggle}><TouchableOpacity onPress={() => setViewMode('grid')} style={styles.iconBtn}><LayoutGrid size={18} color={viewMode === 'grid' ? colors.primary : colors.textTertiary} /></TouchableOpacity><TouchableOpacity onPress={() => setViewMode('list')} style={styles.iconBtn}><List size={18} color={viewMode === 'list' ? colors.primary : colors.textTertiary} /></TouchableOpacity></View></View>
              <View style={viewMode === 'grid' ? styles.grid : styles.list}>
                {vaultData.subjects.length === 0 ? (
                  <View style={styles.emptyState}><Database size={48} color={colors.textTertiary} opacity={0.3} /><Text style={{ color: colors.textSecondary, marginTop: 12 }}>No matching questions found.</Text></View>
                ) : (
                  vaultData.subjects.map(subject => (
                    <TouchableOpacity key={subject.name} onPress={() => setActiveSubject(subject.name)} style={[viewMode === 'grid' ? styles.subjectCard : styles.subjectListRow, { backgroundColor: colors.surface, width: viewMode === 'grid' ? COLUMN_WIDTH : '100%' }]} >
                      <View style={[styles.subjectIcon, { backgroundColor: colors.primary + '10' }]}>{React.createElement(getSubjectIcon(subject.name), { size: 20, color: colors.primary })}</View>
                      <View style={{ flex: 1 }}><Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={1}>{subject.name}</Text><Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{subject.totalCount} items</Text></View>
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </ScrollView>
          </Animated.View>
        )}
      </PageWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  commandBar: { flexDirection: 'row', alignItems: 'center', padding: 10, margin: spacing.lg, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 5 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 8 },
  filterButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  filterDrawer: { paddingBottom: spacing.md },
  tagScroll: { paddingHorizontal: spacing.lg, gap: 8 },
  tagChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
  tagChipText: { fontSize: 12, fontWeight: '700' },
  mainScroll: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.xl },
  statCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', gap: 12 },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  gridHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '900' },
  viewToggle: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  list: { gap: 10 },
  subjectCard: { padding: 24, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)', alignItems: 'center', gap: 12 },
  subjectListRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)', gap: 16 },
  subjectIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 15, fontWeight: '800' },
  subjectCount: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, gap: 16 },
  backButton: { padding: 4 },
  detailTitle: { fontSize: 18, fontWeight: '900' },
  detailScroll: { padding: spacing.lg, paddingBottom: 100 },
  sectionContainer: { marginBottom: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', gap: 16, backgroundColor: 'rgba(0, 0, 0, 0.05)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 3 },
  sectionName: { fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },
  sectionStats: { fontSize: 10, fontWeight: '600', marginTop: 2, opacity: 0.6 },
  microTopicContainer: { paddingLeft: 12, paddingRight: 4, paddingTop: spacing.sm, gap: 8 },
  topicBlock: { marginBottom: 4 },
  topicAccordion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, gap: 12, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  topicName: { fontSize: 12, fontWeight: '800', flex: 1, textTransform: 'uppercase', letterSpacing: 0.8 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' },
  countText: { fontSize: 10, fontWeight: '900' },
  questionsList: { paddingTop: spacing.md, paddingLeft: 8, gap: spacing.xs },
  emptyState: { width: '100%', padding: 60, alignItems: 'center' },
  floatingZenExit: { position: 'absolute', top: 60, right: 20, zIndex: 9999, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(67, 52, 34, 0.1)', alignItems: 'center', justifyContent: 'center' }
});
