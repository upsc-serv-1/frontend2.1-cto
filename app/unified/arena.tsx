import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Search,
  BookOpen,
  Target,
  Play,
  Check,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Filter,
  Tag as TagIcon,
  Zap,
  ArrowRight,
  Layout,
  ChevronLeft,
  XCircle,
} from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { GlobalSearchBar } from '../../src/components/GlobalSearchBar';
import { useQuizStore } from '../../src/store/quizStore';
import { mergeQuestions } from '../../src/utils/merger';

const { width } = Dimensions.get('window');

// --- Helper Components ---

const FilterRow = ({ title, items, selected, onSelect, multi = false, visible = true, showSelectAll = true, allowAll = true }: any) => {
  const { colors } = useTheme();
  if (!visible || items.length === 0) return null;

  const isSelected = (item: string) => {
    if (multi) return Array.isArray(selected) && selected.includes(item);
    return selected === item;
  };

  const handleSelect = (item: string) => {
    if (item === 'All') {
      onSelect(multi ? [] : 'All');
      return;
    }
    if (item === 'SELECT_ALL') {
      onSelect([...items]);
      return;
    }
    if (multi) {
      const prev = Array.isArray(selected) ? selected : [];
      if (prev.includes(item)) onSelect(prev.filter((i: string) => i !== item));
      else onSelect([...prev, item]);
    } else {
      onSelect(item);
    }
  };

  const isEverythingSelected = multi && Array.isArray(selected) && selected.length === items.length && items.length > 0;

  const isAll = !selected || (Array.isArray(selected) && selected.length === 0) || selected === 'All';

  return (
    <View style={styles.filterRowContainer}>
      <Text style={[styles.filterRowTitle, { color: colors.textTertiary }]}>{title.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {allowAll && (
          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isAll && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect('All')}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, isAll && { color: colors.buttonText }]}>
              All
            </Text>
          </TouchableOpacity>
        )}

        {multi && items.length > 1 && showSelectAll && (
          <TouchableOpacity
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isEverythingSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect('SELECT_ALL')}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, isEverythingSelected && { color: colors.buttonText }]}>
              Select All
            </Text>
          </TouchableOpacity>
        )}
        {items.map((item: string) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isSelected(item) && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect(item)}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                isSelected(item) && { color: colors.buttonText },
              ]}
            >
              {item}
            </Text>
            {multi && isSelected(item) && <Check size={12} color={colors.buttonText} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const ToggleButton = ({ options, activeValue, onSelect, style }: any) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, style]}>
      {options.map((opt: any) => {
        const isActive = activeValue === opt.value;
        const Icon = opt.icon;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.toggleBtn,
              isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            {Icon && <Icon size={16} color={isActive ? colors.buttonText : colors.textSecondary} style={{ marginRight: 6 }} />}
            <Text style={[styles.toggleText, { color: isActive ? colors.buttonText : colors.textSecondary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// --- Main Component ---

export default function UnifiedArenaSetup() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const params = useLocalSearchParams();
  const startTestStore = useQuizStore((state) => state.startTest);

  // 1. Core State
  const initialTab = params.query ? 'search' : 'topic';
  const [arenaMode, setArenaMode] = useState<'learning' | 'exam'>('learning');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [activeTab, setActiveTab] = useState<'topic' | 'paper' | 'search'>(initialTab);

  // 2. Filter Selections
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedSection, setSelectedSection] = useState<string[]>([]);
  const [selectedMicrotopic, setSelectedMicrotopic] = useState<string[]>([]);

  const [pyqMaster, setPyqMaster] = useState('All');
  const [selectedExamCategory, setSelectedExamCategory] = useState<string[]>([]);

  const [selectedInstitute, setSelectedInstitute] = useState('All');
  const [selectedProgram, setSelectedProgram] = useState('All');
  const [selectedExamStage, setSelectedExamStage] = useState('All');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [timerMode, setTimerMode] = useState<'countdown' | 'stopwatch' | 'none'>('none');
  const [showExamModal, setShowExamModal] = useState(false);

  // Search Tab Independent State
  const [searchQuery, setSearchQuery] = useState((params.query as string) || '');
  const [searchFilters, setSearchFilters] = useState<any>(() => {
    try {
      if (params.filters) return JSON.parse(params.filters as string);
    } catch (e) {}
    return {};
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showAllResultsModal, setShowAllResultsModal] = useState(false);
  const [showPYQTags, setShowPYQTags] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');

  // 3. Dynamic Data State
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [calculatingCount, setCalculatingCount] = useState(false);

  const fetchUserTags = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data: tagData } = await supabase
        .from('question_states')
        .select('review_tags')
        .eq('user_id', session.user.id)
        .not('review_tags', 'is', null);
      
      const tags = new Set<string>();
      tagData?.forEach(row => {
        if (Array.isArray(row.review_tags)) row.review_tags.forEach(t => tags.add(t));
      });
      setUserTags(Array.from(tags).sort());
    } catch (e) {
      console.error("Error fetching tags", e);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserTags();
    }, [fetchUserTags])
  );

  useEffect(() => {
    updateQuestionCount();
  }, [
    selectedSubject, 
    selectedSection, 
    selectedMicrotopic, 
    pyqMaster, 
    selectedExamCategory, 
    selectedInstitute, 
    selectedProgram, 
    selectedExamStage,
    selectedTestId,
    selectedTags,
    arenaMode,
    activeTab,
    searchQuery,
    searchFilters
  ]);

  useEffect(() => {
    if (activeTab === 'search') {
      fetchSearchResults();
    }
  }, [searchQuery, searchFilters, activeTab]);

  const fetchSearchResults = async () => {
    if (!searchQuery && Object.keys(searchFilters).length === 0) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const activeFields = searchFilters.searchFields || ['Questions'];
      let query = supabase.from('questions').select('id, question_text, explanation_markdown, subject, section_group, micro_topic, is_pyq, source, exam_group, exam_year, is_upsc_cse, is_allied, is_others, tests(institute)').limit(100);
      
      const term = searchQuery.trim();
      if (term) {
        const mode = searchFilters.searchMode || 'Matching';
        
        if (mode === 'Exact') {
          const termPattern = `%${term}%`;
          const filters = [];
          if (activeFields.includes('Questions')) filters.push(`question_text.ilike.${termPattern}`);
          if (activeFields.includes('Explanations')) filters.push(`explanation_markdown.ilike.${termPattern}`);
          if (filters.length > 0) query = query.or(filters.join(','));
        } else {
          // Smart Matching: Split words and use AND logic
          const words = term.split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
          if (words.length > 1) {
            words.forEach(word => {
              const wordFilters = [];
              if (activeFields.includes('Questions')) wordFilters.push(`question_text.ilike.%${word}%`);
              if (activeFields.includes('Explanations')) wordFilters.push(`explanation_markdown.ilike.%${word}%`);
              if (wordFilters.length > 0) query = query.or(wordFilters.join(','));
            });
          } else {
            const termPattern = `%${term}%`;
            const filters = [];
            if (activeFields.includes('Questions')) filters.push(`question_text.ilike.${termPattern}`);
            if (activeFields.includes('Explanations')) filters.push(`explanation_markdown.ilike.${termPattern}`);
            if (filters.length > 0) query = query.or(filters.join(','));
          }
        }
      }
      
      const sf = searchFilters;
      if (sf.selectedSubjects?.length > 0) query = query.in('subject', sf.selectedSubjects);
      if (sf.selectedSections?.length > 0) {
        const sections = sf.selectedSections.map((s: string) => s === "General" ? null : s);
        if (sections.includes(null)) {
          const nonNulls = sections.filter((s: any) => s !== null);
          if (nonNulls.length > 0) query = query.or(`section_group.in.(${nonNulls.join(',')}),section_group.is.null`);
          else query = query.is('section_group', null);
        } else {
          query = query.in('section_group', sections);
        }
      }
      if (sf.selectedMicrotopics?.length > 0) query = query.in('micro_topic', sf.selectedMicrotopics);
      
      let { data, error } = await query;
      if (error) throw error;

      // FUZZY FALLBACK: If 0 results found and term is long, try 1-character tolerance
      if ((!data || data.length === 0) && term.length > 3) {
        const words = term.split(/\s+/).filter(Boolean);
        if (words.length === 1) {
          const word = words[0];
          const fuzzyPatterns = [];
          for (let i = 0; i < word.length; i++) {
            const pattern = word.substring(0, i) + '%' + word.substring(i + 1);
            if (activeFields.includes('Questions')) fuzzyPatterns.push(`question_text.ilike.%${pattern}%`);
            if (activeFields.includes('Explanations')) fuzzyPatterns.push(`explanation_markdown.ilike.%${pattern}%`);
          }
          if (fuzzyPatterns.length > 0) {
            let fuzzyQry = supabase.from('questions').select('id, question_text, explanation_markdown, subject, section_group, micro_topic, is_pyq, source, exam_group, exam_year, is_upsc_cse, is_allied, is_others, tests(institute)').limit(50);
            fuzzyQry = fuzzyQry.or(fuzzyPatterns.join(','));
            const { data: fData } = await fuzzyQry;
            if (fData && fData.length > 0) data = fData;
          }
        }
      }

      // NOTE MATCHES: Also check personal notes if searching everything
      if (term && session?.user?.id) {
        const { data: noteMatches } = await supabase
          .from('question_states')
          .select('question_id, questions(id, question_text, explanation_markdown, subject, section_group, micro_topic)')
          .eq('user_id', session.user.id)
          .ilike('note', `%${term}%`);
        
        if (noteMatches) {
          const results = data || [];
          noteMatches.forEach((m: any) => {
            if (m.questions && !results.find(r => r.id === m.questions.id)) {
              results.push(m.questions);
            }
          });
          data = results;
        }
      }

      // 3. Deduplicate
      const { mergedQs } = mergeQuestions(data || []);
      
      // 4. SORT: UPSC CSE → Allied → Other PYQ → Non-PYQ. Newest year first.
      mergedQs.sort((a: any, b: any) => {
        const getRank = (q: any) => {
          const src = (q.source?.group || q.exam_group || q.title || '').toUpperCase();
          if (q.is_upsc_cse || src.includes('UPSC CSE') || src.includes('IAS') || src.includes('CIVIL SERVICES')) return 3;
          if (q.is_allied || src.includes('ALLIED')) return 2;
          if (q.is_pyq || q.is_others || src.includes('PYQ')) return 1;
          return 0;
        };
        const rA = getRank(a), rB = getRank(b);
        if (rA !== rB) return rB - rA;
        const yA = parseInt(a.exam_year || '0'), yB = parseInt(b.exam_year || '0');
        if (yA !== yB) return yB - yA;
        return (a.subject || '').localeCompare(b.subject || '');
      });

      setSearchResults(mergedQs);
      setQuestionCount(mergedQs.length);
    } catch (err) {
      console.error('Search fetch error:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const fetchMetadata = async () => {
    setLoading(true);
    try {
      // 1. Fetch all tests (usually a few hundred rows)
      const { data: allTests, error: testErr } = await supabase
        .from('tests')
        .select('id, institute, program_name, series, title');
      
      if (testErr) throw testErr;

      // 2. Fetch question metadata in large chunks to cover 20k+ questions
      // We perform multiple parallel requests to cover the full range
      const CHUNK_SIZE = 5000;
      const RANGES = [[0, 4999], [5000, 9999], [10000, 14999], [15000, 19999]];
      
      const qMetadataResults = await Promise.all(
        RANGES.map(range => 
          supabase
            .from('questions')
            .select('subject, section_group, micro_topic, test_id')
            .range(range[0], range[1])
        )
      );

      const qMetadata = qMetadataResults.flatMap(res => res.data || []);

      // 3. Merge and flatten
      const testMap = new Map();
      allTests?.forEach(t => testMap.set(t.id, t));

      const flattened = qMetadata.map(q => {
        const t = testMap.get(q.test_id);
        return {
          ...q,
          institute: t?.institute || null,
          program_name: t?.program_name || null,
          series: t?.series || null,
          title: t?.title || null
        };
      });

      // Add ghost rows for tests to ensure Paper-Wise filters are complete
      const seenTestIds = new Set(qMetadata.map(q => q.test_id));
      allTests?.forEach(t => {
        if (!seenTestIds.has(t.id)) {
          flattened.push({
            subject: null,
            section_group: null,
            micro_topic: null,
            test_id: t.id,
            institute: t.institute,
            program_name: t.program_name,
            series: t.series,
            title: t.title
          });
        }
      });
      
      setMetadata(flattened);

      if (session?.user?.id) {
        await fetchUserTags();
      }
    } catch (err) {
      console.error('Metadata fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestionCount = async () => {
    setCalculatingCount(true);
    try {
      let query = supabase.from('questions').select('*', { count: 'exact', head: true });

      if (activeTab === 'topic') {
        if (selectedSubject !== 'All') query = query.eq('subject', selectedSubject);
        if (selectedSection.length > 0) {
          const sections = selectedSection.map(s => s === "General" ? null : s);
          if (sections.includes(null)) {
            const nonNulls = sections.filter(s => s !== null);
            if (nonNulls.length > 0) query = query.or(`section_group.in.(${nonNulls.join(',')}),section_group.is.null`);
            else query = query.is('section_group', null);
          } else {
            query = query.in('section_group', sections);
          }
        }
        if (selectedMicrotopic.length > 0) query = query.in('micro_topic', selectedMicrotopic);
        
        if (pyqMaster === 'PYQ Only') {
          query = query.eq('is_pyq', true);
          if (selectedExamCategory.length > 0) {
            const orFilters = [];
            if (selectedExamCategory.includes('UPSC CSE')) orFilters.push('is_upsc_cse.eq.true');
            if (selectedExamCategory.includes('Allied Exams')) orFilters.push('is_allied.eq.true');
            if (selectedExamCategory.includes('Others')) orFilters.push('is_others.eq.true');
            if (orFilters.length > 0) query = query.or(orFilters.join(','));
          }
        } else if (pyqMaster === 'Non-PYQ') {
          query = query.eq('is_pyq', false);
        }

        if (selectedTags.length > 0 && session?.user.id) {
           const orQuery = selectedTags.map(t => `review_tags.cs.["${t}"]`).join(',');
           const { data: tagIds, error: tagErr } = await supabase.from('question_states')
             .select('question_id')
             .eq('user_id', session.user.id)
             .or(orQuery);
           
           if (!tagErr && tagIds) {
             const ids = tagIds.map(t => t.question_id);
             if (ids.length > 0) query = query.in('id', ids);
             else { setQuestionCount(0); setCalculatingCount(false); return; }
           } else {
             setQuestionCount(0); setCalculatingCount(false); return;
           }
        }

        if (selectedInstitute !== 'All' || selectedProgram !== 'All') {
          let tQuery = supabase.from('tests').select('id');
          if (selectedInstitute !== 'All') tQuery = tQuery.eq('institute', selectedInstitute);
          if (selectedProgram !== 'All') tQuery = tQuery.eq('program_name', selectedProgram);
          const { data: testRows } = await tQuery;
          const testIds = (testRows || []).map(t => t.id);
          if (testIds.length > 0) query = query.in('test_id', testIds);
        }
      } else if (activeTab === 'search') {
        if (!searchQuery && Object.keys(searchFilters).length === 0) {
          setQuestionCount(0);
          setCalculatingCount(false);
          return;
        }

        const activeFields = searchFilters.searchFields || ['Questions'];
        const term = searchQuery.trim();
        
        if (term) {
          const mode = searchFilters.searchMode || 'Matching';
          if (mode === 'Exact') {
            const termPattern = `%${term}%`;
            const filters = [];
            if (activeFields.includes('Questions')) filters.push(`question_text.ilike.${termPattern}`);
            if (activeFields.includes('Explanations')) filters.push(`explanation_markdown.ilike.${termPattern}`);
            if (filters.length > 0) query = query.or(filters.join(','));
          } else {
            const words = term.split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
            if (words.length > 1) {
              words.forEach(word => {
                const wordFilters = [];
                if (activeFields.includes('Questions')) wordFilters.push(`question_text.ilike.%${word}%`);
                if (activeFields.includes('Explanations')) wordFilters.push(`explanation_markdown.ilike.%${word}%`);
                if (wordFilters.length > 0) query = query.or(wordFilters.join(','));
              });
            } else {
              const termPattern = `%${term}%`;
              const filters = [];
              if (activeFields.includes('Questions')) filters.push(`question_text.ilike.${termPattern}`);
              if (activeFields.includes('Explanations')) filters.push(`explanation_markdown.ilike.${termPattern}`);
              if (filters.length > 0) query = query.or(filters.join(','));
            }
          }
        }
        
        const cf = searchFilters;
        if (cf.selectedSubjects?.length > 0) query = query.in('subject', cf.selectedSubjects);
        if (cf.selectedSections?.length > 0) {
          const sections = cf.selectedSections.map((s: string) => s === "General" ? null : s);
          if (sections.includes(null)) {
            const nonNulls = sections.filter((s: any) => s !== null);
            if (nonNulls.length > 0) query = query.or(`section_group.in.(${nonNulls.join(',')}),section_group.is.null`);
            else query = query.is('section_group', null);
          } else {
            query = query.in('section_group', sections);
          }
        }
        if (cf.selectedMicrotopics?.length > 0) query = query.in('micro_topic', cf.selectedMicrotopics);
        if (cf.selectedInstitutes?.length > 0) {
           const { data: testRows } = await supabase.from('tests').select('id').in('institute', cf.selectedInstitutes);
           const testIds = (testRows || []).map(t => t.id);
           if (testIds.length > 0) query = query.in('test_id', testIds);
        }

        if (term && session?.user?.id) {
            const { data: noteMatches } = await supabase
             .from('question_states')
             .select('question_id')
             .eq('user_id', session.user.id)
             .ilike('note', `%${term}%`);
            
            if (noteMatches && noteMatches.length > 0) {
               // Note matches are considered in the final display query
            }
        }
      } else if (activeTab === 'paper') {
        if (selectedTestId) {
          query = query.eq('test_id', selectedTestId);
        } else {
          let tQuery = supabase.from('tests').select('id');
          if (selectedInstitute !== 'All') tQuery = tQuery.eq('institute', selectedInstitute);
          if (selectedProgram !== 'All') tQuery = tQuery.eq('program_name', selectedProgram);
          if (selectedExamStage !== 'All') tQuery = tQuery.eq('series', selectedExamStage);
          
          const { data: testRows } = await tQuery;
          const testIds = (testRows || []).map(t => t.id);
          if (testIds.length > 0) query = query.in('test_id', testIds);
          else {
            setQuestionCount(0);
            setCalculatingCount(false);
            return;
          }
        }
      }

      const { count, error } = await query.limit(5000);
      if (error) throw error;
      setQuestionCount(count);
    } catch (err) {
      console.error('Count update error:', err);
    } finally {
      setCalculatingCount(false);
    }
  };

  // 4. Computed Filters
  const subjects = useMemo(() => {
    return Array.from(new Set(metadata.map(m => m.subject).filter(Boolean))).sort();
  }, [metadata]);

  const sections = useMemo(() => {
    if (selectedSubject === 'All') return [];
    return Array.from(new Set(
      metadata
        .filter(m => m.subject === selectedSubject)
        .map(m => m.section_group)
        .filter(Boolean)
    )).sort();
  }, [metadata, selectedSubject]);

  const microtopics = useMemo(() => {
    if (selectedSection.length === 0) return [];
    return Array.from(new Set(
      metadata
        .filter(m => m.subject === selectedSubject && selectedSection.includes(m.section_group))
        .map(m => m.micro_topic)
        .filter(Boolean)
    )).sort();
  }, [metadata, selectedSubject, selectedSection]);

  const examCategories = ['UPSC CSE', 'Allied Exams', 'Others'];

  const institutes = useMemo(() => {
    return Array.from(new Set(metadata.map(m => m.institute).filter(Boolean))).sort();
  }, [metadata]);

  const programs = useMemo(() => {
    let base = metadata;
    if (selectedInstitute !== 'All') base = base.filter(m => m.institute === selectedInstitute);
    if (selectedExamStage !== 'All') base = base.filter(m => m.series === selectedExamStage);
    return Array.from(new Set(base.map(m => m.program_name).filter(Boolean))).sort();
  }, [metadata, selectedInstitute, selectedExamStage]);

  const examStages = useMemo(() => {
    return Array.from(new Set(metadata.map(m => m.series).filter(Boolean))).sort();
  }, [metadata]);

  const testList = useMemo(() => {
    const tests = new Map();
    metadata.forEach(m => {
      if (!m.test_id) return;
      if (selectedInstitute !== 'All' && m.institute !== selectedInstitute) return;
      if (selectedProgram !== 'All' && m.program_name !== selectedProgram) return;
      if (selectedExamStage !== 'All' && m.series !== selectedExamStage) return;
      
      if (!tests.has(m.test_id)) {
        tests.set(m.test_id, {
          id: m.test_id,
          title: m.title || "Untitled Test",
          institute: m.institute,
          program: m.program_name,
          stage: m.series
        });
      }
    });
    return Array.from(tests.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [metadata, selectedInstitute, selectedProgram, selectedExamStage]);

  const [showPreFlight, setShowPreFlight] = useState(false);

  // 5. Start Logic
  const handleLaunch = (mode: 'learning' | 'exam', timer?: string) => {
    setShowPreFlight(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const baseParams = {
      mode: mode,
      view: viewMode,
      timer: mode === 'exam' ? (timer || 'none') : 'none',
      showPYQTags: showPYQTags ? 'true' : 'false',
    };

    let finalParams = {};

    if (activeTab === 'search') {
      finalParams = {
        ...baseParams,
        query: searchQuery,
        searchMode: searchFilters.searchMode,
        searchFields: searchFilters.searchFields?.join(','),
        subject: searchFilters.selectedSubjects?.[0] || 'All',
        section: searchFilters.selectedSections?.join('|') || '',
        microtopic: searchFilters.selectedMicrotopics?.join('|') || '',
        institute: searchFilters.selectedInstitutes?.[0] || 'All',
        testId: '', 
      };
    } else {
      finalParams = {
        ...baseParams,
        subject: selectedSubject,
        section: selectedSection.join('|'),
        microtopic: selectedMicrotopic.join('|'),
        pyqMaster: pyqMaster,
        examCategory: Array.isArray(selectedExamCategory) ? selectedExamCategory.join(',') : (selectedExamCategory || ''),
        institute: selectedInstitute,
        program: selectedProgram,
        tags: selectedTags.join('|'),
        testId: selectedTestId || '',
      };
    }

    router.push({
      pathname: '/unified/engine',
      params: finalParams
    });
  };

  const renderTopicModal = () => {
    
    // 1. Get all sections for current subject
    const subjectSections = Array.from(new Set(
      metadata.filter(m => m.subject === selectedSubject).map(m => m.section_group).filter(Boolean)
    )).sort();

    // 2. Get microtopics filtered by selected sections AND search
    const subjectMicrotopics = Array.from(new Set(
      metadata
        .filter(m => {
          const subjectMatch = m.subject === selectedSubject;
          const sectionMatch = selectedSection.length === 0 || selectedSection.includes(m.section_group);
          const searchMatch = !topicSearch || m.micro_topic?.toLowerCase().includes(topicSearch.toLowerCase());
          return subjectMatch && sectionMatch && searchMatch;
        })
        .map(m => m.micro_topic)
        .filter(Boolean)
    )).sort();

    return (
      <Modal
        visible={showTopicModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismisser} 
            activeOpacity={1} 
            onPress={() => setShowTopicModal(false)} 
          />
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '90%', paddingHorizontal: 0 }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            
            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: 24 }]}>Topic Browser</Text>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>{selectedSubject} • {selectedSection.length || 'All'} Sections</Text>
                </View>
                <TouchableOpacity onPress={() => setShowTopicModal(false)}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={24} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Quick Search */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 16, paddingHorizontal: 12, height: 48, marginTop: 12, borderWidth: 1, borderColor: colors.border }}>
                <Search size={18} color={colors.textTertiary} />
                <TextInput 
                  placeholder="Find a microtopic..." 
                  placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, marginLeft: 10, color: colors.textPrimary, fontWeight: '600' }}
                  value={topicSearch}
                  onChangeText={setTopicSearch}
                />
                {topicSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setTopicSearch('')}>
                    <XCircle size={18} color={colors.textTertiary} fill={colors.surfaceStrong} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Horizontal Sections */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
                <TouchableOpacity 
                  onPress={() => {
                      setSelectedSection([]);
                      setSelectedMicrotopic([]);
                  }}
                  style={[
                      styles.chip, 
                      { backgroundColor: colors.surfaceStrong, borderColor: colors.border, paddingHorizontal: 20 }, 
                      selectedSection.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary, fontSize: 13 }, selectedSection.length === 0 && { color: '#fff' }]}>All Sections</Text>
                </TouchableOpacity>
                {subjectSections.map(s => {
                  const isSelected = selectedSection.includes(s);
                  return (
                    <TouchableOpacity 
                      key={s}
                      onPress={() => {
                        let newSecs = [...selectedSection];
                        if (isSelected) newSecs = newSecs.filter(x => x !== s);
                        else newSecs.push(s);
                        setSelectedSection(newSecs);
                        setSelectedMicrotopic([]);
                      }}
                      style={[
                          styles.chip, 
                          { backgroundColor: colors.surfaceStrong, borderColor: colors.border, paddingHorizontal: 16 }, 
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                    >
                      <Text style={[styles.chipText, { color: colors.textSecondary, fontSize: 13 }, isSelected && { color: '#fff' }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1.5 }}>MICRO-TOPICS ({subjectMicrotopics.length})</Text>
                  {selectedMicrotopic.length > 0 && (
                    <TouchableOpacity onPress={() => setSelectedMicrotopic([])}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>CLEAR ({selectedMicrotopic.length})</Text>
                    </TouchableOpacity>
                  )}
               </View>

               <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {subjectMicrotopics.length === 0 ? (
                      <View style={{ flex: 1, padding: 40, alignItems: 'center' }}>
                         <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>No matching topics found.</Text>
                      </View>
                  ) : (
                      subjectMicrotopics.map((m, idx) => {
                        const isSelected = selectedMicrotopic.includes(m);
                        return (
                          <TouchableOpacity 
                            key={m}
                            onPress={() => {
                              let newMt = [...selectedMicrotopic];
                              if (isSelected) newMt = newMt.filter(x => x !== m);
                              else newMt.push(m);
                              setSelectedMicrotopic(newMt);
                            }}
                            style={{
                                width: '48%',
                                backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                                borderColor: isSelected ? colors.primary : colors.border,
                                borderWidth: 1.5,
                                borderRadius: 16,
                                padding: 12,
                                marginBottom: 12,
                                minHeight: 64,
                                justifyContent: 'center'
                            }}
                          >
                            <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: isSelected ? '800' : '600' }} numberOfLines={3}>{m}</Text>
                            {isSelected && (
                              <View style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                                <Check size={10} color="#fff" />
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })
                  )}
               </View>
            </ScrollView>

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity 
                style={[styles.launchBtn, { backgroundColor: colors.primary, height: 56, borderRadius: 18, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }]} 
                onPress={() => setShowTopicModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>SAVE SELECTION</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Preparing Arena Metadata...</Text>
      </View>
    );
  }

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { paddingBottom: 16 }]}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Unified Arena</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Setup your focus session</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          

          {/* 2. Pillars Tab */}
          <View style={[styles.tabBar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
            <TouchableOpacity 
              onPress={() => setActiveTab('topic')}
              style={[styles.tab, activeTab === 'topic' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'topic' ? colors.primary : colors.textSecondary }]}>Topic-Wise</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('paper')}
              style={[styles.tab, activeTab === 'paper' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'paper' ? colors.primary : colors.textSecondary }]}>Paper-Wise</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setActiveTab('search')}
              style={[styles.tab, activeTab === 'search' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'search' ? colors.primary : colors.textSecondary }]}>Search</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'topic' && (
            <View style={styles.filterSection}>
              
              {/* Tree A: Content Hierarchy */}
              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <Filter size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Content Hierarchy</Text>
                </View>
                <FilterRow
                  title="Subject"
                  items={subjects}
                  selected={selectedSubject}
                  onSelect={(val: string) => {
                    setSelectedSubject(val);
                    setSelectedSection([]);
                    setSelectedMicrotopic([]);
                  }}
                />

                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity 
                    onPress={() => setShowTopicModal(true)}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      backgroundColor: colors.primary + '10', 
                      padding: 16, 
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.primary + '30',
                      borderStyle: 'dashed'
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <LayoutGrid size={18} color="#fff" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>Micro-Topic Selector</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>
                          {selectedSection.length > 0 || selectedMicrotopic.length > 0 
                            ? `${selectedSection.length} Sections, ${selectedMicrotopic.length} Topics`
                            : 'Select specific chapters or topics'}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tree B: Targeting & Focus (Combined PYQ and Tags) */}
              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <Zap size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Targeting & Focus</Text>
                </View>
                <FilterRow
                  title="PYQ Mode"
                  items={['PYQ Only', 'Non-PYQ']}
                  selected={pyqMaster}
                  onSelect={(val: string) => {
                    setPyqMaster(val);
                    if (val !== 'PYQ Only') setSelectedExamCategory([]);
                  }}
                />
                <FilterRow
                  title="Exam Category"
                  items={examCategories}
                  selected={selectedExamCategory}
                  onSelect={setSelectedExamCategory}
                  multi={true}
                  showSelectAll={false}
                  visible={pyqMaster === 'PYQ Only'}
                />
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12, opacity: 0.5 }} />
                <FilterRow
                  title="Revision Tags"
                  items={userTags}
                  selected={selectedTags}
                  onSelect={setSelectedTags}
                  multi
                />
              </View>

              {/* Tree C: Source & Institute */}
              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <BookOpen size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Source & Institute</Text>
                </View>
                <FilterRow
                  title="Institute"
                  items={institutes}
                  selected={selectedInstitute}
                  onSelect={(val: string) => {
                    setSelectedInstitute(val);
                    setSelectedProgram('All');
                  }}
                />
                <FilterRow
                  title="Program"
                  items={programs}
                  selected={selectedProgram}
                  onSelect={setSelectedProgram}
                  visible={selectedInstitute !== 'All'}
                />
              </View>

            </View>
          )}

          {activeTab === 'paper' && (
             <View style={styles.paperContent}>
                <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.groupHeader}>
                    <Layout size={14} color={colors.primary} />
                    <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Paper Configuration</Text>
                  </View>
                  <FilterRow
                    title="Exam Stage"
                    items={examStages}
                    selected={selectedExamStage}
                    onSelect={setSelectedExamStage}
                  />
                  <FilterRow
                    title="Institute"
                    items={institutes}
                    selected={selectedInstitute}
                    onSelect={(val: string) => {
                      setSelectedInstitute(val);
                      setSelectedProgram('All');
                    }}
                  />
                  <FilterRow
                    title="Program"
                    items={programs}
                    selected={selectedProgram}
                    onSelect={setSelectedProgram}
                  />
                </View>

                <View style={{ marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                   <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1 }}>
                      CHOOSE TEST ({testList.length})
                   </Text>
                </View>

                {testList.map(test => (
                  <TouchableOpacity 
                    key={test.id}
                    onPress={() => {
                      setSelectedTestId(test.id === selectedTestId ? null : test.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    style={[
                      styles.testCard, 
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      selectedTestId === test.id && { borderColor: colors.primary, borderWidth: 2 }
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.testTitle, { color: colors.textPrimary }]}>{test.title}</Text>
                      <Text style={[styles.testSubtitle, { color: colors.textTertiary }]}>
                        {test.institute} • {test.program}
                      </Text>
                    </View>
                    {selectedTestId === test.id && (
                      <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 4 }}>
                         <Check size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                {testList.length === 0 && (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                     <Text style={{ color: colors.textTertiary }}>No tests found for the selected filters.</Text>
                  </View>
                )}
             </View>
          )}

          {activeTab === 'search' && (
             <View style={{ padding: 20 }}>
                <GlobalSearchBar 
                  placeholder="Search for specific keywords..."
                  initialQuery={searchQuery}
                  hideDropdown={true}
                  onSearch={(q, f) => {
                    setSearchQuery(q);
                    setSearchFilters(f);
                  }}
                />

                {loadingSearch ? (
                  <View style={{ marginTop: 40, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <View style={{ marginTop: 24 }}>
                    {searchResults.length > 0 && (
                      <View style={{ marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.textTertiary }}>
                          MATCHING QUESTIONS ({searchResults.length})
                        </Text>
                      </View>
                    )}

                    {searchResults.map((q) => (
                      <TouchableOpacity 
                        key={q.id}
                        onPress={() => {
                          // Launch single question
                          router.push({
                            pathname: '/unified/engine',
                            params: { 
                              testId: '', 
                              mode: arenaMode, 
                              view: viewMode, 
                              timer: timerMode,
                              questionId: q.id // Pass specific ID
                            }
                          });
                        }}
                        style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      >
                        <Text style={[styles.resultText, { color: colors.textPrimary }]} numberOfLines={3}>
                          {q.question_text.replace(/<[^>]*>/g, '')}
                        </Text>
                        <View style={styles.resultMeta}>
                          <Text style={[styles.resultTag, { color: colors.primary, backgroundColor: colors.primary + '15' }]}>
                            {q.subject}
                          </Text>
                          {(() => {
                            if (!q.is_pyq && !q.exam_group && !q.source?.group) return null;
                            const groupName = (q.source?.group || q.exam_group || '').toUpperCase();
                            const year = String(q.source?.year || q.exam_year || '').trim();
                            const isUPSC = q.is_upsc_cse || groupName.includes('UPSC CSE') || groupName === 'UPSC';
                            const isAllied = q.is_allied || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupName.includes(g));
                            const isOther = q.is_others || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupName.includes(g));
                            
                            const dispName = q.source?.group || q.exam_group || (isUPSC ? 'UPSC CSE' : isAllied ? 'Allied' : isOther ? 'Other' : 'PYQ');
                            
                            let bgColor = '#f59e0b15';
                            let textColor = '#f59e0b';
                            
                            if (isUPSC) { bgColor = '#dcfce7'; textColor = '#15803d'; }
                            else if (isAllied) { bgColor = '#fef9c3'; textColor = '#a16207'; }
                            else if (isOther) { bgColor = '#f1f5f9'; textColor = '#475569'; }
                            else if (q.is_pyq) { bgColor = colors.primary + '15'; textColor = colors.primary; }

                            return (
                              <Text style={[styles.resultTag, { color: textColor, backgroundColor: bgColor, marginLeft: 8 }]}>
                                {`${dispName} ${year}`.trim()}
                              </Text>
                            );
                          })()}

                          {(q._institutes && q._institutes.length > 0) ? (
                            <Text style={[styles.resultTag, { color: colors.textTertiary, backgroundColor: colors.surfaceStrong, marginLeft: 8 }]}>
                              {q._institutes.join(', ')}
                            </Text>
                          ) : q.tests?.institute ? (
                            <Text style={[styles.resultTag, { color: colors.textTertiary, backgroundColor: colors.surfaceStrong, marginLeft: 8 }]}>
                              {q.tests.institute}
                            </Text>
                          ) : null}
                          <ChevronRight size={16} color={colors.textTertiary} />

                        </View>
                      </TouchableOpacity>
                    ))}

                    {searchResults.length >= 50 && (
                      <TouchableOpacity 
                        style={[styles.seeAllBtn, { borderColor: colors.primary }]}
                        onPress={() => setShowAllResultsModal(true)}
                      >
                        <Text style={[styles.seeAllBtnText, { color: colors.primary }]}>
                          SEE ALL {questionCount} RESULTS
                        </Text>
                      </TouchableOpacity>
                    )}

                    {searchResults.length === 0 && searchQuery !== '' && (
                      <View style={{ padding: 40, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary }}>No results found for "{searchQuery}"</Text>
                      </View>
                    )}

                    {searchResults.length === 0 && searchQuery === '' && (
                      <View style={{ marginTop: 20, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontSize: 13, textAlign: 'center' }}>
                          Type keywords and use filters to find specific questions.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

          <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: 20, marginTop: 10, marginBottom: 40 }]}>
            <View style={styles.groupHeader}>
              <Layout size={14} color={colors.primary} />
              <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>General Preferences</Text>
            </View>
            
            <FilterRow
              title="View Mode"
              items={['List View', 'Card View']}
              selected={viewMode === 'list' ? 'List View' : 'Card View'}
              onSelect={(val: string) => setViewMode(val === 'List View' ? 'list' : 'card')}
              showSelectAll={false}
              allowAll={false}
            />


            <TouchableOpacity 
              onPress={() => setShowPYQTags(!showPYQTags)}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border + '30', marginTop: 8 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1 }}>SHOW PYQ CHIPS</Text>
              <View style={[styles.toggleTrack, { backgroundColor: showPYQTags ? colors.primary : colors.surfaceStrong }]}>
                <View style={[styles.toggleThumb, { left: showPYQTags ? 24 : 4, backgroundColor: '#fff' }]} />
              </View>
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* Sticky Launch Footer */}
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={{ flex: 1.2 }}>
             <Text style={[styles.countText, { color: colors.textPrimary }]}>
               {calculatingCount ? '...' : (questionCount || 0)}
             </Text>
             <Text style={[styles.countLabel, { color: colors.textTertiary }]} numberOfLines={2}>
               Targeted Questions{"\n"}(Pre-Dedupe)
             </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 8, flex: 3 }}>
            <TouchableOpacity 
              style={[styles.launchBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.primary, borderWidth: 1 }]} 
              onPress={() => { handleLaunch('learning'); }}
              disabled={calculatingCount || questionCount === 0}
            >
              <BookOpen size={16} color={colors.primary} />
              <Text style={[styles.launchBtnText, { color: colors.primary, fontSize: 14 }]}>Learn</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.launchBtn, { backgroundColor: colors.primary }]} 
              onPress={() => { setArenaMode('exam'); setShowExamModal(true); }}
              disabled={calculatingCount || questionCount === 0}
            >
              <Target size={16} color="#fff" />
              <Text style={[styles.launchBtnText, { color: '#fff', fontSize: 14 }]}>Exam</Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderTopicModal()}

        {/* Full Results Modal */}
        <Modal
          visible={showAllResultsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAllResultsModal(false)}
        >
          <View style={[styles.fullModalOverlay, { backgroundColor: colors.bg }]}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={styles.fullModalHeader}>
                 <TouchableOpacity onPress={() => setShowAllResultsModal(false)} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.textPrimary} />
                 </TouchableOpacity>
                 <Text style={[styles.fullModalTitle, { color: colors.textPrimary }]}>All Results ({questionCount})</Text>
                 <View style={{ width: 40 }} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 20 }}>
                 {searchResults.map((q) => (
                    <TouchableOpacity 
                      key={q.id + '_full'}
                      onPress={() => {
                        setShowAllResultsModal(false);
                        router.push({
                          pathname: '/unified/engine',
                          params: { testId: '', mode: arenaMode, view: viewMode, timer: timerMode, questionId: q.id }
                        });
                      }}
                      style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <Text style={[styles.resultText, { color: colors.textPrimary }]} numberOfLines={4}>
                        {q.question_text.replace(/<[^>]*>/g, '')}
                      </Text>
                      <View style={styles.resultMeta}>
                        <Text style={[styles.resultTag, { color: colors.primary, backgroundColor: colors.primary + '15' }]}>
                          {q.subject}
                        </Text>
                        <ChevronRight size={16} color={colors.textTertiary} />
                      </View>
                    </TouchableOpacity>
                 ))}
                 
                 <View style={{ height: 100 }} />
              </ScrollView>

            </SafeAreaView>
          </View>
        </Modal>

        {/* Exam Setup Modal */}
        <Modal visible={showExamModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 8 }}>Exam Mode Setup</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 24 }}>Choose your timer preference for this session.</Text>
              
              <View style={{ gap: 12 }}>
                {[
                  { id: 'stopwatch', label: 'Stopwatch', sub: 'Count upwards', icon: Clock },
                  { id: 'countdown', label: 'Default Timer', sub: '2 mins per question', icon: Target },
                  { id: 'none', label: 'No Timer', sub: 'Relaxed practice', icon: XCircle }
                ].map((opt) => (
                  <TouchableOpacity 
                    key={opt.id}
                    onPress={() => { handleLaunch('exam', opt.id); setShowExamModal(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <opt.icon size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{opt.label}</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>{opt.sub}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                onPress={() => setShowExamModal(false)}
                style={{ marginTop: 24, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PageWrapper>
  );


  };

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  scrollContent: { paddingBottom: 160 },
  sectionCard: { marginHorizontal: 20, marginBottom: 20 },
  
  // Toggles
  toggleContainer: { flexDirection: 'row', borderRadius: 16, padding: 4, borderWidth: 1 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  toggleText: { fontSize: 13, fontWeight: '700' },

  // Tabs
  tabBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '800' },

  // Filters
  filterSection: { gap: 16 },
  filterGroupCard: { marginHorizontal: 20, borderRadius: 20, padding: 16, borderWidth: 1 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  groupTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  
  filterRowContainer: { marginBottom: 12 },
  filterRowTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  filterScroll: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },

  // Footer
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderTopWidth: 1 },
  timerOptions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  timerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', gap: 6 },
  timerBtnText: { fontSize: 12, fontWeight: '700' },
  startBtn: { width: '100%', height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  startBtnText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalSub: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  modalSection: { marginBottom: 20 },
  modalLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  launchBtn: { height: 60, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
  launchBtnText: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  modalClose: { marginTop: 20, alignItems: 'center', padding: 10 },
  
  paperContent: { paddingTop: 10, paddingBottom: 40, gap: 16 },
  testCard: { 
    padding: 20, 
    borderRadius: 20, 
    borderWidth: 1, 
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  testTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  testSubtitle: { fontSize: 12, fontWeight: '600', opacity: 0.7 },

  resultCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12
  },
  resultText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500'
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  resultTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden'
  },
  seeAllBtn: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
    borderStyle: 'dashed'
  },
  seeAllBtnText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },

  // Full Modal
  fullModalOverlay: { flex: 1 },
  fullModalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 20, 
    paddingTop: Platform.OS === 'ios' ? 20 : 40 
  },
  fullModalTitle: { fontSize: 18, fontWeight: '900' },
  backBtn: { padding: 8 },
  
  // Launch Footer
  footer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, 
    borderTopWidth: 1, 
    gap: 16 
  },
  countInfo: { minWidth: 80, alignItems: 'center' },
  countText: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  countLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2, marginTop: -2, opacity: 0.6 },
  launchBtn: { 
    flex: 1, 
    height: 54, 
    borderRadius: 18, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4
  },
  launchBtnText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    position: 'absolute',
  }
});
