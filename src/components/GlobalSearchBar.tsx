import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  Keyboard,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Search, Sliders, X, Clock, Zap, Book, Layers, ChevronRight, Check, Trash2 } from 'lucide-react-native';
import { useRouter, usePathname } from 'expo-router';
import { QuestionCache } from '../services/QuestionCache';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface GlobalSearchBarProps {
  onSearch: (query: string, filters: any) => void;
  placeholder?: string;
  initialQuery?: string;
  onChangeText?: (text: string) => void;
  hideDropdown?: boolean;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ 
  onSearch, 
  placeholder = "Search questions & notes...", 
  initialQuery = "",
  onChangeText,
  hideDropdown = false
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [instantResults, setInstantResults] = useState<any[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  
  // -- Filter State (Same as Smart Search) --
  const [examStage, setExamStage] = useState('All');
  const [selectedInstitutes, setSelectedInstitutes] = useState<string[]>([]);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedMicrotopics, setSelectedMicrotopics] = useState<string[]>([]);
  const [pyqFilter, setPyqFilter] = useState('All');
  const [pyqCategory, setPyqCategory] = useState<string[]>([]);
  const [searchFields, setSearchFields] = useState<string[]>(['Questions', 'Notes']);
  const [searchMode, setSearchMode] = useState<'Matching' | 'Exact'>('Matching');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loadingInstant, setLoadingInstant] = useState(false);

  // -- Dynamic Filter Data --
  const [institutes, setInstitutes] = useState<string[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [microtopics, setMicrotopics] = useState<string[]>([]);

  // Reset search state when navigating away and back
  useEffect(() => {
    setQuery(initialQuery || '');
    setInstantResults([]);
    setIsDropdownVisible(false);
  }, [pathname]);

  // Debounced Instant Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 1) {
        setLoadingInstant(true);
        try {
          // 1. Local Search First
          let localResults = await QuestionCache.searchLocal(query, 'Matching', searchFields);
          
          // Apply filters to local results
          if (selectedSubjects.length > 0) {
            localResults = localResults.filter((r: any) => selectedSubjects.includes(r.subject));
          }
          if (selectedSections.length > 0) {
            localResults = localResults.filter((r: any) => selectedSections.includes(r.section_group));
          }
          if (selectedMicrotopics.length > 0) {
            localResults = localResults.filter((r: any) => selectedMicrotopics.includes(r.micro_topic));
          }
          
          let results = [...localResults];
          
          // 2. Remote Fallback if local is sparse
          if (results.length < 5) {
            const term = query.trim();
            const activeFields = searchFields.length > 0 ? searchFields : ['Questions', 'Notes'];
            const orConditions = [];
            if (activeFields.includes('Questions')) orConditions.push(`question_text.ilike.%${term}%`);
            if (activeFields.includes('Explanations')) orConditions.push(`explanation_markdown.ilike.%${term}%`);
            
            if (orConditions.length > 0) {
              let remoteQuery = supabase
                .from('questions')
                .select('*')
                .or(orConditions.join(','))
                .limit(10);
              
              // Apply filters to remote query
              if (selectedSubjects.length > 0) remoteQuery = remoteQuery.in('subject', selectedSubjects);
              if (selectedSections.length > 0) remoteQuery = remoteQuery.in('section_group', selectedSections);
              if (selectedMicrotopics.length > 0) remoteQuery = remoteQuery.in('micro_topic', selectedMicrotopics);
              
              let { data: remote } = await remoteQuery;
              
              // FUZZY FALLBACK: If still sparse and term is long, try 1-character tolerance
              if ((!remote || remote.length < 2) && term.length > 3) {
                const fuzzyPatterns = [];
                for (let i = 0; i < term.length; i++) {
                  const pattern = term.substring(0, i) + '%' + term.substring(i + 1);
                  if (activeFields.includes('Questions')) fuzzyPatterns.push(`question_text.ilike.%${pattern}%`);
                }
                if (fuzzyPatterns.length > 0) {
                  let fuzzyQ = supabase.from('questions').select('*').or(fuzzyPatterns.join(',')).limit(5);
                  if (selectedSubjects.length > 0) fuzzyQ = fuzzyQ.in('subject', selectedSubjects);
                  if (selectedSections.length > 0) fuzzyQ = fuzzyQ.in('section_group', selectedSections);
                  if (selectedMicrotopics.length > 0) fuzzyQ = fuzzyQ.in('micro_topic', selectedMicrotopics);
                  const { data: fData } = await fuzzyQ;
                  if (fData) remote = [...(remote || []), ...fData];
                }
              }

              if (remote) {
                // Deduplicate and merge
                const localIds = new Set(results.map(r => r.id));
                const newItems = remote.filter(r => !localIds.has(r.id));
                results = [...results, ...newItems];
              }
            }
          }

          // 3. SORT: UPSC CSE → Allied → Other PYQ → Non-PYQ. Newest year first.
          const prioritized = results.sort((a, b) => {
            const getRank = (q: any) => {
              const src = (q.source?.group || q.exam_group || q.title || q.program_name || "").toUpperCase();
              if (q.is_upsc_cse || src.includes("UPSC CSE") || src.includes("IAS") || src.includes("CIVIL SERVICES")) return 3;
              if (q.is_allied || src.includes("ALLIED")) return 2;
              if (q.is_pyq || q.is_others || src.includes("PYQ")) return 1;
              return 0;
            };

            const rankA = getRank(a);
            const rankB = getRank(b);
            if (rankA !== rankB) return rankB - rankA;

            const yearA = parseInt(a.exam_year || "0");
            const yearB = parseInt(b.exam_year || "0");
            if (yearA !== yearB) return yearB - yearA;

            return (a.subject || "").localeCompare(b.subject || "");
          });

          // Limit to 5 results for Dashboard as requested, show all 10 if button is missing
          const limit = pathname.includes('arena') ? 10 : 5;
          setInstantResults(prioritized.slice(0, limit));
          if (!hideDropdown) {
            setIsDropdownVisible(true);
          }
        } catch (e) {
          console.error("[GlobalSearch] Instant search failed:", e);
        } finally {
          setLoadingInstant(false);
        }
      } else {
        setInstantResults([]);
        setIsDropdownVisible(false);
        setLoadingInstant(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, searchFields, selectedSubjects, selectedSections, selectedMicrotopics]);

  // Calculate active filter count for badge
  const activeFilterCount = [
    examStage !== 'All',
    selectedInstitutes.length > 0,
    selectedPrograms.length > 0,
    selectedSubjects.length > 0,
    selectedSections.length > 0,
    selectedMicrotopics.length > 0,
    pyqFilter !== 'All',
    pyqCategory.length > 0,
    searchFields.length < 2,
    searchMode !== 'Matching'
  ].filter(Boolean).length;

  useEffect(() => {
    fetchFilters();
    fetchDynamicFilters();
  }, [examStage, selectedInstitutes, selectedSubjects, selectedSections]);

  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem('recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch (e) { console.error(e); }
  };

  const saveSearch = async (term: string) => {
    if (!term.trim()) return;
    try {
      const filtered = recentSearches.filter(s => s.toLowerCase() !== term.trim().toLowerCase());
      const updated = [term.trim(), ...filtered].slice(0, 5);
      setRecentSearches(updated);
      await AsyncStorage.setItem('recent_searches', JSON.stringify(updated));
    } catch (e) { console.error(e); }
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem('recent_searches');
  };

  const fetchFilters = async () => {
    try {
      let instQ = supabase.from('tests').select('institute');
      if (examStage && examStage !== 'All') instQ = instQ.ilike('series', `%${examStage}%`);
      const { data: instData } = await instQ;
      if (instData) {
        setInstitutes(Array.from(new Set(instData.map(t => t.institute).filter(Boolean))).sort());
      }

      if (selectedInstitutes.length > 0) {
        let progQ = supabase.from('tests').select('program_name').in('institute', selectedInstitutes);
        if (examStage && examStage !== 'All') progQ = progQ.ilike('series', `%${examStage}%`);
        const { data: progData } = await progQ;
        if (progData) {
          setPrograms(Array.from(new Set(progData.map(t => t.program_name).filter(Boolean))).sort());
        }
      } else {
        setPrograms([]);
      }
    } catch (err) { console.error(err); }
  };

  const fetchDynamicFilters = async () => {
    try {
      let query = supabase.from('questions').select('subject, section_group, micro_topic');
      if (selectedInstitutes.length > 0) {
        const { data: tests } = await supabase.from('tests').select('id').in('institute', selectedInstitutes);
        if (tests) query = query.in('test_id', tests.map(t => t.id));
      }
      const { data } = await query.limit(2000);
      if (data) {
        setSubjects(Array.from(new Set(data.map(q => q.subject).filter(Boolean))).sort());
        
        if (selectedSubjects.length > 0) {
          const secs = Array.from(new Set(data.filter(q => selectedSubjects.includes(q.subject)).map(q => q.section_group))).sort();
          setSections(secs.map(s => s === null ? "General" : s));
        } else {
          setSections([]);
        }

        if (selectedSections.length > 0) {
          const mTopics = Array.from(new Set(
            data.filter(q => 
              selectedSubjects.includes(q.subject) && 
              (selectedSections.includes(q.section_group) || (q.section_group === null && selectedSections.includes("General")))
            ).map(q => q.micro_topic).filter(Boolean)
          )).sort();
          setMicrotopics(mTopics);
        } else {
          setMicrotopics([]);
        }
      }
    } catch (err) { console.error(err); }
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    
    // Construct filters
    const filters = {
      examStage,
      selectedSubjects,
      selectedSections,
      selectedMicrotopics,
      selectedInstitutes,
      selectedPrograms,
      pyqFilter,
      pyqCategory,
      searchFields,
      searchMode
    };

    if (onSearch) {
      onSearch(query, filters);
      saveSearch(query);
    } else {
      router.push({
        pathname: '/unified/arena',
        params: { 
          tab: 'search',
          query: query,
          filters: JSON.stringify(filters)
        }
      } as any);
    }

    // Dismiss AFTER triggering search to ensure no event loss
    setTimeout(() => {
      setIsDropdownVisible(false);
      Keyboard.dismiss();
    }, 100);
  };

  const clearAllFilters = () => {
    setExamStage('All');
    setSelectedInstitutes([]);
    setSelectedPrograms([]);
    setSelectedSubjects([]);
    setSelectedSections([]);
    setSelectedMicrotopics([]);
    setPyqFilter('All');
    setPyqCategory([]);
    setSearchFields(['Questions']);
    setSearchMode('Matching');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const applyFilters = () => {
    setShowFilters(false);
    handleSearch();
  };

  const getPYQCategorization = (item: any) => {
    const groupName = (item.source?.group || item.exam_group || '').toUpperCase();
    const rawYear = item.source?.year || item.exam_year || item.launch_year || '';
    const year = typeof rawYear === 'string' ? rawYear.trim() : String(rawYear).trim();
    
    const isUPSC = item.is_upsc_cse || groupName.includes('UPSC CSE') || groupName === 'UPSC';
    const isAllied = item.is_allied || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupName.includes(g));
    const isOther = item.is_others || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupName.includes(g));
    
    return { 
      isUPSC, 
      isAllied, 
      isOther, 
      groupName: item.source?.group || item.exam_group || (isUPSC ? 'UPSC CSE' : isAllied ? 'Allied' : isOther ? 'Other' : 'PYQ'), 
      year 
    };
  };

  const getHighlightText = (text: string, search: string) => {
    if (!search.trim()) return <Text style={{ color: colors.textPrimary }}>{text}</Text>;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <Text style={{ color: colors.textPrimary }}>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? 
            <Text key={i} style={{ color: colors.primary, fontWeight: '800' }}>{part}</Text> : 
            part
        )}
      </Text>
    );
  };

  const renderDropdown = () => {
    if (!isDropdownVisible) return null;
    
    return (
      <View 
        style={[
          styles.dropdownContainer, 
          { 
            backgroundColor: colors.surface, 
            borderColor: colors.border,
            maxHeight: 500,
          }
        ]}
      >
        <ScrollView 
          keyboardShouldPersistTaps="always" 
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          style={{ flex: 1 }}
        >
          {loadingInstant ? (
            <View style={{ padding: 30, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={{ marginTop: 8, fontSize: 12, color: colors.textTertiary, fontWeight: '700' }}>SEARCHING...</Text>
            </View>
          ) : instantResults.length > 0 ? (
            instantResults.map((item, index) => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.dropdownItem, { borderBottomColor: colors.border, borderBottomWidth: index === instantResults.length - 1 ? 0 : 1 }]}
                onPress={() => {
                  setIsDropdownVisible(false);
                  Keyboard.dismiss();
                  router.push({
                     pathname: '/unified/engine',
                     params: { 
                       questionId: item.id,
                       source: 'instant_search'
                     }
                  } as any);
                }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                    <Text style={[styles.dropdownSubject, { color: colors.primary, backgroundColor: colors.primary + '15' }]}>
                      {item.subject}
                    </Text>
                    {(() => {
                      const pyq = getPYQCategorization(item);
                      if (!item.is_pyq && !pyq.isUPSC && !pyq.isAllied && !pyq.isOther) return null;
                      
                      let bgColor = '#f1f5f9';
                      let textColor = '#475569';
                      let bdrColor = '#94a3b8';

                      if (pyq.isUPSC) { bgColor = '#dcfce7'; textColor = '#15803d'; bdrColor = '#22c55e'; }
                      else if (pyq.isAllied) { bgColor = '#fef9c3'; textColor = '#a16207'; bdrColor = '#eab308'; }

                      return (
                        <View style={{ 
                          backgroundColor: bgColor, 
                          borderColor: bdrColor, 
                          borderWidth: 1,
                          paddingHorizontal: 6, 
                          paddingVertical: 1, 
                          borderRadius: 4 
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '900', color: textColor }}>
                            {`${pyq.groupName} ${pyq.year}`.trim()}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                  <Text numberOfLines={2} style={styles.dropdownText}>
                    {getHighlightText(item.question_text.replace(/<[^>]*>/g, ''), query)}
                  </Text>
                </View>
                <ChevronRight size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '600' }}>No instant results found.</Text>
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>Tap See All for a deeper search.</Text>
            </View>
          )}
          <View style={{ height: 60 }} />
        </ScrollView>

        {!pathname.includes('arena') && (
          <TouchableOpacity 
            style={[
              styles.seeAllBtn, 
              { 
                backgroundColor: colors.primary, 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0,
                borderBottomLeftRadius: 16, 
                borderBottomRightRadius: 16,
                zIndex: 20,
                height: 56,
              }
            ]}
            onPress={() => {
              console.log('[GlobalSearch] SEE ALL pressed, query:', query);
              const currentQuery = query;
              const filters = {
                selectedSubjects,
                selectedSections,
                selectedMicrotopics,
                selectedInstitutes,
                pyqFilter,
                pyqCategory,
                searchFields,
                searchMode
              };
              setIsDropdownVisible(false);
              Keyboard.dismiss();
              if (onSearch) {
                onSearch(currentQuery, filters);
              } else {
                router.push({
                  pathname: '/unified/arena',
                  params: { 
                    tab: 'search',
                    query: currentQuery,
                    filters: JSON.stringify(filters)
                  }
                } as any);
              }
            }}
          >
            <Text style={[styles.seeAllText, { color: '#fff' }]}>
              SEE ALL RESULTS
            </Text>
            <Search size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderRecentSearches = () => {
    if (query.trim().length > 0 || recentSearches.length === 0 || pathname !== '/unified/arena') return null;

    return (
      <View style={{ marginTop: 4 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4, paddingBottom: 8 }}
        >
          {recentSearches.map((s, idx) => (
            <TouchableOpacity 
              key={idx} 
              onPress={() => {
                setQuery(s);
                saveSearch(s); // Re-rank it
                onSearch(s, { examStage, selectedInstitutes, selectedPrograms, selectedSubjects, selectedSections, selectedMicrotopics, pyqFilter, pyqCategory, searchFields, searchMode });
              }}
              style={[
                styles.chip, 
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  height: 32,
                  borderRadius: 16,
                  borderWidth: 1,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2
                }
              ]}
            >
              <Clock size={12} color={colors.textTertiary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700' }}>{s}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            onPress={clearRecentSearches}
            style={{ padding: 8 }}
          >
            <Trash2 size={14} color={colors.error} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Header UI */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search color={colors.textTertiary} size={20} style={styles.searchIcon} />
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={query}
          onFocus={() => {
            if (query.length > 1) setIsDropdownVisible(true);
          }}
          onChangeText={(t) => {
            setQuery(t);
            if (onChangeText) onChangeText(t);
            const currentFilters = {
              examStage,
              selectedInstitutes,
              selectedPrograms,
              selectedSubjects,
              selectedSections,
              selectedMicrotopics,
              pyqFilter,
              pyqCategory,
              searchFields,
              searchMode
            };
            if (t === '') {
              setInstantResults([]);
              setIsDropdownVisible(false);
            }
          }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { 
            setQuery(''); 
            setIsDropdownVisible(false);
            setInstantResults([]);
          }} style={{ padding: 4 }}>
             <X color={colors.textTertiary} size={18} />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.filterBtn} 
          onPress={() => {
            setShowFilters(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Sliders color={activeFilterCount > 0 ? colors.primary : colors.textTertiary} size={20} />
          {activeFilterCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      
      {renderDropdown()}
      {renderRecentSearches()}
      
      {activeFilterCount > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={{ gap: 8, paddingHorizontal: 4, marginTop: 4, paddingBottom: 8 }}
        >
          {pyqFilter !== 'All' && (
            <View style={{ backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Zap size={10} color="#000" />
              <Text style={{ color: '#000', fontSize: 10, fontWeight: '900' }}>{pyqFilter.toUpperCase()}</Text>
            </View>
          )}
          {selectedSubjects.map(s => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceStrong, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>{s.toUpperCase()}</Text>
            </View>
          ))}
          {searchFields.includes('Notes') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceStrong, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>NOTES</Text>
            </View>
          )}
          {examStage !== 'All' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceStrong, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '800' }}>{examStage.toUpperCase()}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismisser} 
            activeOpacity={1} 
            onPress={() => setShowFilters(false)} 
          />
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Filters</Text>
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>CLEAR ALL</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <FilterStrip title="Search Mode" items={['Matching', 'Exact']} selected={searchMode} onSelect={setSearchMode} colors={colors} />
              <FilterStrip title="Search Across" items={['Questions', 'Explanations', 'Notes']} selected={searchFields} onSelect={setSearchFields} multi colors={colors} />
              
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <FilterStrip title="Exam Stage" items={['Prelims', 'Mains']} selected={examStage} onSelect={setExamStage} colors={colors} />
              <FilterStrip title="Institutes" items={institutes} selected={selectedInstitutes} onSelect={setSelectedInstitutes} multi colors={colors} />
              {selectedInstitutes.length > 0 && programs.length > 0 && (
                <FilterStrip title="Programs" items={programs} selected={selectedPrograms} onSelect={setSelectedPrograms} multi colors={colors} />
              )}
              
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <FilterStrip title="Subjects" items={subjects} selected={selectedSubjects} onSelect={setSelectedSubjects} multi colors={colors} />
              {sections.length > 0 && <FilterStrip title="Sections" items={sections} selected={selectedSections} onSelect={setSelectedSections} multi colors={colors} />}
              {microtopics.length > 0 && <FilterStrip title="Microtopics" items={microtopics} selected={selectedMicrotopics} onSelect={setSelectedMicrotopics} multi colors={colors} />}

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <FilterStrip title="PYQ Filter" items={['PYQ Only', 'Non-PYQ']} selected={pyqFilter} onSelect={setPyqFilter} colors={colors} />
              {pyqFilter === 'PYQ Only' && (
                <FilterStrip title="Exam Category" items={['UPSC', 'Allied', 'Others']} selected={pyqCategory} onSelect={setPyqCategory} multi colors={colors} />
              )}
            </ScrollView>

            <TouchableOpacity 
              style={[styles.applyBtn, { backgroundColor: colors.primary }]} 
              onPress={applyFilters}
            >
              <Text style={styles.applyBtnText}>Apply Filters</Text>
              <Check color="#fff" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const FilterStrip = ({ title, items, selected, onSelect, colors, multi = false }: any) => {
  const isSelected = (item: string) => {
    if (multi) return Array.isArray(selected) && selected.includes(item);
    return selected === item;
  };

  const handleSelect = (item: string) => {
    if (item === 'All') {
      onSelect(multi ? [] : 'All');
      return;
    }
    if (multi) {
      const prev = Array.isArray(selected) ? selected : [];
      if (prev.includes(item)) onSelect(prev.filter(i => i !== item));
      else onSelect([...prev, item]);
    } else {
      onSelect(item);
    }
  };

  const isAll = !selected || (Array.isArray(selected) && selected.length === 0) || selected === 'All';

  return (
    <View style={styles.stripContainer}>
      <Text style={[styles.stripTitle, { color: colors.textTertiary }]}>{title.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
        <TouchableOpacity 
          style={[
            styles.chip, 
            { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, 
            isAll && { backgroundColor: colors.primary, borderColor: colors.primary }
          ]} 
          onPress={() => handleSelect('All')}
        >
          <Text style={[styles.chipText, { color: colors.textSecondary }, isAll && { color: '#fff' }]}>All</Text>
        </TouchableOpacity>
        {items.map((item: string) => (
          <TouchableOpacity 
            key={item} 
            style={[
              styles.chip, 
              { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, 
              isSelected(item) && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]} 
            onPress={() => handleSelect(item)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, isSelected(item) && { color: '#fff' }]}>{item}</Text>
            {multi && isSelected(item) && <Check size={12} color="#fff" style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 9999,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    marginVertical: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    height: '100%',
  },
  filterBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismisser: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  modalScroll: {
    paddingBottom: 20,
  },
  stripContainer: {
    marginBottom: 20,
  },
  stripTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  chipScroll: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 12,
    marginBottom: 20,
    opacity: 0.5,
  },
  applyBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dropdownContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    zIndex: 9999,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  dropdownSubject: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    letterSpacing: 0.5,
  },
  dropdownText: {
    fontSize: 14,
    lineHeight: 18,
    color: '#666',
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
