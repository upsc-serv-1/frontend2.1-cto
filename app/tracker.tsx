import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  LayoutAnimation,
  Platform,
  UIManager
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedScrollHandler, 
  interpolate, 
  Extrapolation 
} from 'react-native-reanimated';
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  FileText, 
  Layers,
  ArrowLeft,
  Target,
  BarChart3,
  Circle,
  ToggleLeft,
  TrendingUp,
  ChevronRight
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, G, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../src/context/ThemeContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { spacing, radius } from '../src/theme';
import { MICRO_SYLLABUS, MAINS_SYLLABUS, ANTHROPOLOGY_SYLLABUS } from '../src/data/syllabus';
import { SyllabusService, SyllabusProgress } from '../src/services/SyllabusService';
import { useAuth } from '../src/context/AuthContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { useFocusEffect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const OPTIONAL_SYLLABUS: any = {
  "Paper 1": {
    "Fundamentals": [
      "Core Concepts and Theories",
      "Historical Evolution",
      "Major Thinkers and Contributors"
    ],
    "Applied Aspects": [
      "Methodology and Techniques",
      "Contemporary Issues and Applications",
      "Case Studies"
    ]
  },
  "Paper 2": {
    "Indian Context": [
      "Evolution in India",
      "Prominent Indian Thinkers",
      "Socio-cultural and Economic Dynamics"
    ],
    "Contemporary India": [
      "Current Challenges and Responses",
      "Policy Implementation and Impact",
      "Future Trajectories"
    ]
  }
};

type Mode = 'prelims' | 'mains' | 'optional';

export default function SyllabusTracker() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('prelims');
  const [progress, setProgress] = useState<Record<string, SyllabusProgress>>({});
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [trackingMethod, setTrackingMethod] = useState<'single' | 'multi'>('multi');
  const [optionalChoice, setOptionalChoice] = useState<string>('Anthropology');

  useFocusEffect(
    React.useCallback(() => {
      AsyncStorage.getItem('optional_choice').then(val => {
        if (val) {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setOptionalChoice(val);
        }
      });
    }, [])
  );

  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 200],
      [0, -200],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }],
      opacity: interpolate(scrollY.value, [0, 150], [1, 0], Extrapolation.CLAMP),
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingTop: insets.top > 0 ? insets.top : 20, // Shift down to avoid Island/Notch
    };
  });

  useEffect(() => {
    if (session?.user.id) {
      // 1. Instant Cache Load
      SyllabusService.getCachedProgress(session.user.id).then(setProgress);
      // 2. Background Network Sync
      SyllabusService.getProgress(session.user.id).then(setProgress);
    }
  }, [session]);

  const toggleStatus = async (path: string, stage: keyof SyllabusProgress) => {
    if (!session?.user.id) return;
    
    const current = progress[path] || { ncert: false, pyqs: false, books: false, test: false, mastered: false };
    const updated = { ...current, [stage]: !current[stage] };
    
    const newProgress = { ...progress, [path]: updated };
    setProgress(newProgress);
    
    await SyllabusService.updateProgress(session.user.id, path, updated);
  };

  const activeOptionalSyllabus = useMemo(() => {
    const sourceSyllabus = optionalChoice === 'Anthropology' ? ANTHROPOLOGY_SYLLABUS : OPTIONAL_SYLLABUS;
    return {
      [`${optionalChoice} Paper 1`]: sourceSyllabus["Paper 1"],
      [`${optionalChoice} Paper 2`]: sourceSyllabus["Paper 2"],
    };
  }, [optionalChoice]);

  const activeSyllabus = mode === 'prelims' ? MICRO_SYLLABUS : mode === 'mains' ? MAINS_SYLLABUS : activeOptionalSyllabus;

  const getOverallStats = () => {
    let totalItems = 0;
    let completedItems = 0;

    Object.entries(activeSyllabus).forEach(([sub, groups]) => {
      Object.entries(groups).forEach(([group, topics]) => {
        (topics as string[]).forEach(topic => {
          const path = `${sub}.${group}.${topic}`;
          const item = progress[path] || {};
          
          if (trackingMethod === 'single') {
             totalItems += 1;
             if (item.mastered) completedItems += 1;
          } else {
             totalItems += 4; // mastered, ncert, pyqs, books
             if (item.mastered) completedItems += 1;
             if (item.ncert) completedItems += 1;
             if (item.pyqs) completedItems += 1;
             if (item.books) completedItems += 1;
          }
        });
      });
    });

    return { totalItems, completedItems, percent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0 };
  };

  const getSubjectStats = (subject: string) => {
    let totalItems = 0;
    let completedItems = 0;
    const groups = activeSyllabus[subject];
    if (groups) {
      Object.entries(groups).forEach(([group, topics]) => {
        (topics as string[]).forEach(topic => {
          const path = `${subject}.${group}.${topic}`;
          const item = progress[path] || {};

          if (trackingMethod === 'single') {
             totalItems += 1;
             if (item.mastered) completedItems += 1;
          } else {
             totalItems += 4;
             if (item.mastered) completedItems += 1;
             if (item.ncert) completedItems += 1;
             if (item.pyqs) completedItems += 1;
             if (item.books) completedItems += 1;
          }
        });
      });
    }
    return { totalItems, completedItems, percent: totalItems ? Math.round((completedItems / totalItems) * 100) : 0 };
  };

  const stats = useMemo(getOverallStats, [mode, progress, activeSyllabus, trackingMethod]);

  // View: Overview Dashboard
  const renderOverview = () => (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      
      {mode === 'optional' && (
        <View style={{ marginBottom: 24, padding: 16, backgroundColor: colors.surfaceStrong, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
             <View>
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>SELECTED OPTIONAL</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginTop: 4 }}>{optionalChoice}</Text>
             </View>
             <TouchableOpacity 
               onPress={() => router.push('/profile')}
               style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.primary + '15', borderRadius: 8 }}
             >
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>CHANGE IN SETTINGS</Text>
             </TouchableOpacity>
           </View>
        </View>
      )}

      <View style={[s.intelCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: mode === 'optional' ? 0 : 8 }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <Target color={colors.primary} size={20} />
            <Text style={[s.intelTitle, { color: colors.textPrimary, marginLeft: 8 }]}>Preparation Intelligence</Text>
         </View>
         <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[s.intelMetric, { backgroundColor: colors.bg, borderColor: colors.border }]}>
               <Text style={[s.intelMetricLabel, { color: colors.textSecondary }]}>TOTAL {trackingMethod === 'single' ? 'TOPICS' : 'CHECKPOINTS'}</Text>
               <Text style={[s.intelMetricVal, { color: colors.textPrimary }]}>{stats.totalItems}</Text>
            </View>
            <View style={[s.intelMetric, { backgroundColor: '#14532d', borderColor: '#166534' }]}>
               <Text style={[s.intelMetricLabel, { color: 'rgba(255,255,255,0.7)' }]}>COMPLETED</Text>
               <Text style={[s.intelMetricVal, { color: '#fff' }]}>{stats.completedItems}</Text>
            </View>
         </View>
         <View style={[s.intelEfficiency, { backgroundColor: '#1c1917' }]}>
            <View>
               <Text style={[s.intelMetricLabel, { color: 'rgba(255,255,255,0.6)' }]}>AGGREGATE EFFICIENCY</Text>
               <Text style={[s.intelMetricVal, { color: '#fff' }]}>{stats.percent}%</Text>
            </View>
            <TouchableOpacity 
              onPress={() => router.push('/analyseBeta')}
              style={s.efficiencyIcon}
            >
               <TrendingUp color="#a8a29e" size={24} />
            </TouchableOpacity>
         </View>
         
         <TouchableOpacity 
           onPress={() => router.push('/analyseBeta')}
           style={[s.betaBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
         >
           <TrendingUp size={16} color={colors.primary} />
           <Text style={[s.betaBannerText, { color: colors.primary }]}>Try new Analyse Beta (Ultra Stable)</Text>
           <ChevronRight size={16} color={colors.primary} />
         </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
         <DoughnutChart percentage={stats.percent} size={160} strokeWidth={20} color="#8a795d" />
      </View>

      <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Subject Progress Summary</Text>
      <View style={s.subjectGrid}>
        {Object.keys(activeSyllabus).map(subject => {
          const subStats = getSubjectStats(subject);
          return (
            <TouchableOpacity 
              key={subject}
              style={[s.subjectGridCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSelectedSubject(subject);
                setExpandedGroup(null);
              }}
            >
              <Text style={[s.subjectGridName, { color: colors.textSecondary }]} numberOfLines={1}>{subject}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
                 <Text style={[s.subjectGridPercent, { color: colors.textPrimary }]}>{subStats.percent}%</Text>
                 <Text style={[s.subjectGridRatio, { color: colors.textTertiary }]}>{subStats.completedItems}/{subStats.totalItems}</Text>
              </View>
              <View style={[s.progressBarBg, { backgroundColor: colors.bg, marginTop: 8 }]}>
                 <View style={[s.progressBarFill, { width: `${subStats.percent}%`, backgroundColor: colors.primary }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[s.sectionTitle, { color: colors.textPrimary, marginTop: 40 }]}>Comparative Analysis</Text>
      <View style={[s.compCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={{ marginBottom: 20 }}>
           <Text style={[s.compCardTitle, { color: colors.textPrimary }]}>Performance Across Subjects</Text>
           <Text style={[s.compCardSub, { color: colors.textSecondary }]}>Compare your syllabus completion</Text>
        </View>
        {Object.keys(activeSyllabus)
          .map(subj => ({ name: subj, stats: getSubjectStats(subj) }))
          .sort((a, b) => b.stats.percent - a.stats.percent) // Sort highest to lowest
          .map(({ name, stats }, idx) => (
            <View key={name} style={{ marginBottom: 16 }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                 <Text style={[s.compSubjectName, { color: colors.textPrimary }]}>{name}</Text>
                 <Text style={[s.compSubjectPercent, { color: colors.primary }]}>{stats.percent}%</Text>
               </View>
               <View style={[s.progressBarBg, { backgroundColor: colors.bg, height: 10 }]}>
                 <View style={[s.progressBarFill, { width: `${stats.percent}%`, backgroundColor: idx < 2 ? '#22c55e' : stats.percent < 30 ? '#ef4444' : colors.primary }]} />
               </View>
            </View>
        ))}
      </View>

      <View style={[s.compCard, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
        <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
           <Target color="#ef4444" size={20} />
           <Text style={[s.compCardTitle, { color: colors.textPrimary, marginLeft: 8 }]}>Weak Area Radar</Text>
        </View>
        {Object.keys(activeSyllabus)
          .map(subj => ({ name: subj, stats: getSubjectStats(subj) }))
          .filter(s => s.stats.percent < 40)
          .sort((a, b) => a.stats.percent - b.stats.percent)
          .map(({ name, stats }) => (
            <View key={name} style={[s.weakRow, { borderBottomColor: colors.border }]}>
               <Text style={[s.weakName, { color: colors.textSecondary }]}>{name}</Text>
               <Text style={[s.weakAction, { color: '#ef4444' }]}>Needs Attention ({stats.percent}%)</Text>
            </View>
        ))}
        {Object.keys(activeSyllabus).map(subj => ({ name: subj, stats: getSubjectStats(subj) })).filter(s => s.stats.percent < 40).length === 0 && (
           <Text style={[s.weakAction, { color: '#22c55e', marginTop: 8 }]}>No critical weak areas identified! All subjects >40%.</Text>
        )}
      </View>
    </Animated.View>
  );

  // View: Subject Details
  const renderSubjectDetail = () => {
    if (!selectedSubject) return null;
    const subStats = getSubjectStats(selectedSubject);
    const groups = activeSyllabus[selectedSubject];

    return (
      <Animated.View entering={FadeInDown.duration(400).springify()} style={s.detailContainer}>
        <TouchableOpacity 
          style={s.backBtn}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedSubject(null);
          }}
        >
          <ArrowLeft size={20} color={colors.textSecondary} />
          <Text style={[s.backText, { color: colors.textSecondary }]}>Back to Overview</Text>
        </TouchableOpacity>

        <View style={[s.detailHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <View style={{ flex: 1 }}>
              <Text style={[s.detailSubjectName, { color: colors.textPrimary }]}>{selectedSubject}</Text>
              <Text style={[s.detailSubtitle, { color: colors.textSecondary }]}>Syllabus checkpoints</Text>
           </View>
           <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.detailPercent, { color: colors.primary }]}>{subStats.percent}%</Text>
              <Text style={[s.detailRatio, { color: colors.textTertiary }]}>COMPLETION</Text>
           </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
           <DoughnutChart percentage={subStats.percent} size={140} strokeWidth={16} color={colors.primary} />
        </View>

        <View style={[s.linearProgressBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={[s.linearProgressTitle, { color: colors.textPrimary }]}>Linear Progress</Text>
              <Text style={[s.linearProgressRatio, { color: colors.textPrimary }]}>{subStats.completedItems}/{subStats.totalItems} {trackingMethod === 'single' ? 'Topics' : 'Checkpoints'}</Text>
           </View>
           <View style={[s.progressBarBg, { backgroundColor: colors.bg, height: 6 }]}>
              <View style={[s.progressBarFill, { width: `${subStats.percent}%`, backgroundColor: colors.primary }]} />
           </View>
        </View>

        <View style={s.groupsContainer}>
          {Object.entries(groups).map(([group, topics]) => (
            <View key={group} style={[s.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity 
                style={s.groupHeader}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setExpandedGroup(expandedGroup === group ? null : group);
                }}
              >
                <Text style={[s.groupName, { color: colors.textPrimary }]}>{group}</Text>
                {expandedGroup === group ? <ChevronUp size={20} color={colors.textTertiary} /> : <ChevronDown size={20} color={colors.textTertiary} />}
              </TouchableOpacity>

              {expandedGroup === group && (
                <View style={s.topicsList}>
                  {(topics as string[]).map(topic => {
                    const path = `${selectedSubject}.${group}.${topic}`;
                    const itemProgress = progress[path] || { ncert: false, pyqs: false, books: false, test: false, mastered: false };
                    
                    return (
                      <View key={topic} style={[s.topicRow, { borderBottomColor: colors.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
                           <TouchableOpacity onPress={() => toggleStatus(path, 'mastered')} style={s.checkBtn}>
                              {itemProgress.mastered ? (
                                <CheckCircle2 size={24} color={colors.primary} fill={colors.primary + '20'} />
                              ) : (
                                <Circle size={24} color={colors.textTertiary} />
                              )}
                           </TouchableOpacity>
                           <Text style={[s.topicText, { color: itemProgress.mastered ? colors.textSecondary : colors.textPrimary, textDecorationLine: itemProgress.mastered ? 'line-through' : 'none' }]}>
                             {topic}
                           </Text>
                        </View>
                        
                        {trackingMethod === 'multi' && (
                          <View style={s.statusGrid}>
                            <StatusBtn active={itemProgress.ncert} onPress={() => toggleStatus(path, 'ncert')} label="NCERT" colors={colors} />
                            <StatusBtn active={itemProgress.pyqs} onPress={() => toggleStatus(path, 'pyqs')} label="PYQ" colors={colors} />
                            <StatusBtn active={itemProgress.books} onPress={() => toggleStatus(path, 'books')} label="Book" colors={colors} />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>
      </Animated.View>
    );
  };

  return (
    <PageWrapper>
      {!selectedSubject && (
        <Animated.View style={[headerAnimatedStyle, { backgroundColor: colors.bg }]}>
          <View style={s.header}>
            <View>
              <Text style={[s.h1, { color: colors.textPrimary }]}>Syllabus Progress</Text>
              <Text style={[s.subhead, { color: colors.textSecondary }]}>Track your completion, identify weak areas, and master the UPSC syllabus.</Text>
            </View>
          </View>

          <View style={[s.tabBar, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
            <TouchableOpacity 
              style={[s.tab, trackingMethod === 'single' && { backgroundColor: colors.primary }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setTrackingMethod('single');
              }}
            >
                <Text 
                  style={[s.tabText, { color: trackingMethod === 'single' ? '#fff' : colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Single-Stage
                </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.tab, trackingMethod === 'multi' && { backgroundColor: colors.primary }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setTrackingMethod('multi');
              }}
            >
                <Text 
                  style={[s.tabText, { color: trackingMethod === 'multi' ? '#fff' : colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Multi-Stage
                </Text>
            </TouchableOpacity>
          </View>

          <View style={[s.tabBar, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 8 }]}>
            <TouchableOpacity 
              style={[s.tab, mode === 'prelims' && { backgroundColor: colors.primary }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMode('prelims');
              }}
            >
                <Text 
                  style={[s.tabText, { color: mode === 'prelims' ? '#fff' : colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Prelims Tracker
                </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.tab, mode === 'mains' && { backgroundColor: colors.primary }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMode('mains');
              }}
            >
                <Text 
                  style={[s.tabText, { color: mode === 'mains' ? '#fff' : colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Mains Tracker
                </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.tab, mode === 'optional' && { backgroundColor: colors.primary }]}
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setMode('optional');
              }}
            >
                <Text 
                  style={[s.tabText, { color: mode === 'optional' ? '#fff' : colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Optional
                </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {selectedSubject && (
        <View style={s.header}>
          <View>
            <Text style={[s.h1, { color: colors.textPrimary }]}>Syllabus Progress</Text>
            <Text style={[s.subhead, { color: colors.textSecondary }]}>Track your completion, identify weak areas, and master the UPSC syllabus.</Text>
          </View>
        </View>
      )}

      <Animated.ScrollView 
        contentContainerStyle={[s.content, !selectedSubject && { paddingTop: 240 + (insets.top > 0 ? insets.top : 20) }]} 
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {selectedSubject ? renderSubjectDetail() : renderOverview()}
      </Animated.ScrollView>
    </PageWrapper>
  );
}

function DoughnutChart({ percentage, size = 120, strokeWidth = 12, color = '#8a795d' }: any) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <SvgCircle
            stroke="rgba(150,150,150,0.15)"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <SvgCircle
            stroke={color}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
         <Text style={{ fontSize: size * 0.22, fontWeight: '900', color }}>{percentage}%</Text>
      </View>
    </View>
  );
}

function StatusBtn({ active, onPress, label, colors }: any) {
  return (
    <TouchableOpacity 
      style={[s.statusBtn, { backgroundColor: active ? colors.primary + '15' : colors.bg, borderColor: active ? colors.primary + '30' : colors.border }]} 
      onPress={onPress}
    >
      <Text style={[s.statusLabel, { color: active ? colors.primary : colors.textTertiary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  header: { padding: spacing.lg, paddingBottom: 12 },
  h1: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  subhead: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  
  tabBar: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: 16, padding: 4, borderWidth: 1, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center', borderRadius: 12, justifyContent: 'center' },
  tabText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  
  // Overview Styles
  intelCard: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 32 },
  intelTitle: { fontSize: 18, fontWeight: '900' },
  intelMetric: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  intelMetricLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  intelMetricVal: { fontSize: 24, fontWeight: '900' },
  intelEfficiency: { marginTop: 12, padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  efficiencyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  
  sectionTitle: { fontSize: 20, fontWeight: '900', marginBottom: 16 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  subjectGridCard: { width: '48%', padding: 16, borderRadius: 20, borderWidth: 1 },
  subjectGridName: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  subjectGridPercent: { fontSize: 24, fontWeight: '900' },
  subjectGridRatio: { fontSize: 10, fontWeight: '700', paddingBottom: 4 },
  progressBarBg: { height: 4, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  
  compCard: { padding: 24, borderRadius: 24, borderWidth: 1 },
  compCardTitle: { fontSize: 18, fontWeight: '900' },
  compCardSub: { fontSize: 12, marginTop: 4 },
  compSubjectName: { fontSize: 13, fontWeight: '800' },
  betaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  betaBannerText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  compSubjectPercent: { fontSize: 13, fontWeight: '900' },
  
  weakRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  weakName: { fontSize: 14, fontWeight: '700' },
  weakAction: { fontSize: 12, fontWeight: '800' },
  
  // Detail Styles
  detailContainer: { flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backText: { fontSize: 14, fontWeight: '600', marginLeft: 8 },
  detailHeader: { padding: 24, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  detailSubjectName: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  detailSubtitle: { fontSize: 14, marginTop: 4 },
  detailPercent: { fontSize: 32, fontWeight: '900' },
  detailRatio: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  
  linearProgressBox: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  linearProgressTitle: { fontSize: 14, fontWeight: '700' },
  linearProgressRatio: { fontSize: 14, fontWeight: '800' },
  
  groupsContainer: { gap: 16 },
  groupCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  groupHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  groupName: { fontSize: 16, fontWeight: '800' },
  
  topicsList: { paddingHorizontal: 20, paddingBottom: 12 },
  topicRow: { paddingVertical: 16, borderTopWidth: 1, gap: 12 },
  checkBtn: { marginRight: 12, marginTop: 2 },
  topicText: { fontSize: 15, fontWeight: '600', lineHeight: 22, flexShrink: 1 },
  statusGrid: { flexDirection: 'row', gap: 8, paddingLeft: 36, flexWrap: 'wrap' },
  statusBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  statusLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }
});
