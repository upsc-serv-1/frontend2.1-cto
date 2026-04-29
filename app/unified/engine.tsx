import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  Modal,
  Platform,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  StatusBar,
  Animated,
  BackHandler
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Target,
  Check, 
  X, 
  XCircle,
  Info, 
  HelpCircle, 
  Save, 
  Trash2,
  BookOpen,
  Tag as TagIcon,
  Zap,
  LayoutGrid,
  List as ListIcon,
  Flag,
  Lightbulb,
  MoreVertical,
  ArrowRight,
  ArrowLeft,
  Plus,
  Bookmark,
  Book,
  Scissors,
  Layout,
  Filter,
  Share2,
  Maximize2,
  Trash,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Sparkles
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useQuizStore } from '../../src/store/quizStore';
import { mergeQuestions } from '../../src/utils/merger';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';
import { StudentSync } from '../../src/services/StudentSync';
import { uuidv4 } from '../../src/utils/uuid';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { OfflineManager } from '../../src/services/OfflineManager';

const ThemeSwitcher = require('../../src/components/ThemeSwitcher').ThemeSwitcher;

const { width } = Dimensions.get('window');

// --- Types ---
interface Question {
  id: string;
  question_text: string;
  statement_line?: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_markdown?: string;
  subject?: string;
  section_group?: string;
  micro_topic?: string;
  tests?: {
    id: string;
    title: string;
    institute?: string;
    program_name?: string;
  };
  is_pyq?: boolean;
  is_ncert?: boolean;
  is_upsc_cse?: boolean;
  is_allied?: boolean;
  is_others?: boolean;
  exam_year?: string;
  launch_year?: string;
  exam_category?: string;
  exam_group?: string;
  exam_info?: string;
  source?: any;
  _explanations?: any[];
  question_number?: number;
}

const CONFIDENCE_LEVELS = [
  { label: '100% Sure', value: 'sure' },
  { label: 'Logical Elimination', value: 'logical' },
  { label: 'Guess', value: 'guess' },
  { label: 'UPSC Funda', value: 'funda' }
];

const DIFFICULTIES = [
  { label: 'Easy', value: 'easy', color: '#22c55e' },
  { label: 'Medium', value: 'medium', color: '#f59e0b' },
  { label: 'Hard', value: 'hard', color: '#ef4444' }
];

const ERROR_TYPES = [
  'Fact Mistake',
  'Concept Gap',
  'Silly Mistake',
  'Overthinking',
  'Skipped'
];
const DEFAULT_STUDY_TAGS = [
  'Imp. Fact', 
  'Imp. Concept', 
  'Trap Question',
  'Must Revise',
  'Memorize'
];

// --- Sub-Components ---

const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled }: any) => {
  const { colors } = useTheme();
  
  let borderColor = colors.border;
  let backgroundColor = colors.surface;
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;

  if (isSelected) {
    borderColor = colors.primary;
    backgroundColor = colors.primary + '10';
    letterBg = colors.primary;
    letterColor = colors.buttonText;
  }

  if (showResult) {
    if (isCorrect) {
      borderColor = '#22c55e';
      backgroundColor = '#dcfce7';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
    } else if (isWrong) {
      borderColor = '#ef4444';
      backgroundColor = '#fee2e2';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
    }
  }

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      style={[
        styles.optionBtn,
        { backgroundColor, borderColor, borderWidth: isSelected || showResult ? 2 : 1 },
      ]}
    >
      <View style={[styles.optionLabel, { backgroundColor: letterBg }]}>
        <Text style={[styles.optionLabelText, { color: letterColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.optionText, { color: textColor, fontWeight: (isCorrect && showResult) || isSelected ? '700' : '500' }]}>{text}</Text>
      {showResult && isCorrect && <Check size={18} color="#22c55e" style={{ marginLeft: 'auto' }} />}
      {showResult && isWrong && <X size={18} color="#ef4444" style={{ marginLeft: 'auto' }} />}
    </TouchableOpacity>
  );
};

// --- Main Screen ---

export const getPYQCategorization = (item: any) => {
  const groupName = (item.source?.group || item.exam_group || '').toUpperCase();
  const rawYear = item.source?.year || item.exam_year || item.launch_year || '';
  const year = typeof rawYear === 'string' ? rawYear.trim() : String(rawYear).trim();
  
  const isUPSC = item.is_upsc_cse || groupName.includes('UPSC CSE') || groupName === 'UPSC';
  const isAllied = item.is_allied || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupName.includes(g));
  const isOther = item.is_others || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupName.includes(g));
  
  const hasPYQData = item.is_pyq || isUPSC || isAllied || isOther || groupName.length > 0;
  const isGenericPYQ = hasPYQData && !isUPSC && !isAllied && !isOther;

  return { 
    hasPYQData, 
    isUPSC, 
    isAllied, 
    isOther, 
    isGenericPYQ, 
    groupName: item.source?.group || item.exam_group || (isUPSC ? 'UPSC CSE' : isAllied ? 'Allied' : isOther ? 'Other' : 'PYQ'), 
    year 
  };
};

export default function UnifiedQuizEngine() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ 
    subject?: string, 
    mode?: string, 
    view?: string, 
    timer?: string,
    showPYQTags?: string,
    questionId?: string,
    institute?: string,
    program?: string,
    section?: string,
    microtopic?: string,
    pyqMaster?: string,
    examCategory?: string,
    query?: string,
    searchMode?: string,
    searchFields?: string,
    testId?: string,
    tags?: string,
    institutes?: string,
    programs?: string,
    microTopics?: string,
    pyqFilter?: string,
    pyqCategory?: string
    specificYear?: string
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const store = useQuizStore();
  const navigation = useNavigation();
  const isNavigatingAway = useRef(false);
  const sessionStartRef = useRef<number>(Date.now()); // Wall-clock start for accurate duration

  // 🆕 Declare arenaMode FIRST — fixes TDZ crash
  const arenaMode = (params.mode as 'learning' | 'exam') || 'learning';

  // Prevent accidental exit during formal exams (gesture/back button)
  usePreventRemove(
    !isNavigatingAway.current && arenaMode === 'exam',
    ({ data }) => {
      // data.action = the navigation action the OS wants to perform
      Alert.alert(
        'Exit Exam?',
        'Your attempt is in progress. What would you like to do?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {}, // Stay on screen
          },
          {
            text: 'Exit without saving',
            style: 'destructive',
            onPress: () => {
              isNavigatingAway.current = true;
              navigation.dispatch(data.action);
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              try {
                // reuse your existing save function
                await handleFinalSubmit();
              } catch (e) {
                console.warn('Save on exit failed', e);
              } finally {
                isNavigatingAway.current = true;
                navigation.dispatch(data.action);
              }
            },
          },
        ],
        { cancelable: false } // ⚠️ prevents outside-tap-to-dismiss on Android
      );
    }
  );

  useEffect(() => {
    if (arenaMode !== 'exam') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Returning true = we've "handled" back; navigation.dispatch in the Alert will actually do the exit
      if (!isNavigatingAway.current) {
        // Manually trigger the same flow
        navigation.dispatch({ type: 'GO_BACK' } as any);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [arenaMode]);

  // 1. Config from Params
  const showPYQTagsParam = params.showPYQTags === 'true';
  const [viewMode, setViewMode] = useState<'list' | 'card'>((params.view as 'list' | 'card') || 'list');
  const timerType = (params.timer as 'countdown' | 'stopwatch' | 'none') || 'none';

  // 2. State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReady, setIsReady] = useState(false); // New: track when index is loaded
  const [seconds, setSeconds] = useState(timerType === 'countdown' ? 3600 : 0);
  const [isTimerActive, setIsTimerActive] = useState(timerType !== 'none');
  const [showExitModal, setShowExitModal] = useState(false);
  const [customTestName, setCustomTestName] = useState(`Custom Practice - ${new Date().toLocaleDateString()}`);
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});
  const [hasJumped, setHasJumped] = useState(false);

  // Notebook System State
  const [notebookModalVisible, setNotebookModalVisible] = useState(false);
  const [noteDraftBullets, setNoteDraftBullets] = useState(['']);
  const [activeInputIndex, setActiveInputIndex] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [folders, setFolders] = useState<any[]>([]);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [subheadings, setSubheadings] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<any>(null);
  const [selectedSubheading, setSelectedSubheading] = useState('');
  const [isSavingToNotebook, setIsSavingToNotebook] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewNotebookInput, setShowNewNotebookInput] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [showCustomSubheadingInput, setShowCustomSubheadingInput] = useState(false);
  const [customSubheading, setCustomSubheading] = useState('');
  const [showPYQTags, setShowPYQTags] = useState(showPYQTagsParam);
  const [activeExplIndex, setActiveExplIndex] = useState<Record<string, number>>({});
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [savingFlashcard, setSavingFlashcard] = useState<Record<string, boolean>>({});
  const [lastNoteTap, setLastNoteTap] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showFontSlider, setShowFontSlider] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showIndex, setShowIndex] = useState(arenaMode === 'learning');
  const [currentPage, setCurrentPage] = useState(0);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showClockControl, setShowClockControl] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [showSaveSessionModal, setShowSaveSessionModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [userStudyTags, setUserStudyTags] = useState(DEFAULT_STUDY_TAGS);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [summary, setSummary] = useState<null | {
    totalQuestions: number;
    attempted: number;
    skipped: number;
    durationSec: number;
    attemptId?: string;
  }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastUsedSubheading, setLastUsedSubheading] = useState('');

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  // ZEN MODE STATE
  const [isZenMode, setIsZenMode] = useState(false);
  const zenAnim = useRef(new Animated.Value(0)).current;

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
  const zenPaperColor = isZenMode ? '#F4ECD8' : colors.surface;

  // 0. Persistence: Load and Save currentIndex
  const INDEX_PERSIST_KEY = useMemo(() => `quiz_index_${sessionTestId}`, [sessionTestId]);

  useEffect(() => {
    const loadIndex = async () => {
      try {
        const saved = await AsyncStorage.getItem(INDEX_PERSIST_KEY);
        if (saved !== null) {
          const idx = parseInt(saved, 10);
          if (!isNaN(idx)) setCurrentIndex(idx);
        }
      } catch (e) {
        console.warn("Failed to load index", e);
      } finally {
        setIsReady(true);
      }
    };
    loadIndex();
  }, [INDEX_PERSIST_KEY]);

  useEffect(() => {
    if (isReady && currentIndex >= 0) {
      AsyncStorage.setItem(INDEX_PERSIST_KEY, currentIndex.toString());
    }
  }, [currentIndex, isReady, INDEX_PERSIST_KEY]);

  // Notebook Subheading Initialization
  useEffect(() => {
    if (notebookModalVisible) {
      fetchHierarchy();
    }
  }, [notebookModalVisible]);

  // Fetch unique tags from previous sessions
  useEffect(() => {
    const fetchExistingTags = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('question_states')
        .select('review_tags')
        .eq('user_id', session.user.id)
        .not('review_tags', 'is', null);
      
      if (data) {
        const allTags = new Set(DEFAULT_STUDY_TAGS);
        data.forEach(row => {
          if (Array.isArray(row.review_tags)) {
            row.review_tags.forEach(t => allTags.add(t));
          }
        });
        setUserStudyTags(Array.from(allTags));
      }
    };
    fetchExistingTags();
  }, [session?.user?.id]);

  const toggleStudyTag = (qId: string, currentTags: string[], tag: string) => {
    const tags = currentTags || [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    store.setMetadata(qId, { studyTags: newTags }, false);
    // Explicitly trigger sync with the *newest* data to prevent the "one step behind" race condition
    if (session?.user?.id) {
       StudentSync.enqueue('question_state', {
         userId: session.user.id,
         questionId: qId,
         testId: questions.find(q => q.id === qId)?.tests?.id || 'manual',
         patch: { review_tags: newTags }
       });
    }
  };

  const NOTE_PREFS_KEY = 'notebook_save_prefs';
  const listRef = useRef<FlatList>(null);

  // 3. Store Selectors
  const currentAnswers = store.answers;

  // 4. Fetch Questions
  const sessionTestId = useMemo(() => {
    return params.testId || `custom_${params.subject || 'all'}_${new Date().toISOString().split('T')[0]}`;
  }, [params.testId, params.subject]);
  const sessionAttemptId = useMemo(() => `${sessionTestId}__${Date.now()}`, [sessionTestId]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchQuestions();
      store.startTest(sessionTestId, session.user.id, sessionAttemptId);
    }
    // We only want to run this once per sessionTestId
  }, [sessionTestId, sessionAttemptId, session?.user?.id]);

  useEffect(() => {
    if (!showIndex && viewMode === 'list' && currentIndex >= 0) {
      const scrollTimer = setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ 
            index: currentIndex, 
            animated: true,
            viewPosition: 0 
          });
        } catch (e) {
          console.warn("Scroll to index failed", e);
        }
      }, 300); // Increased delay for stability
      return () => clearTimeout(scrollTimer);
    }
  }, [showIndex, viewMode]);

  const fetchQuestions = async () => {
    setLoading(true);
    let tagList: string[] = [];
    
    // Helper to process results
    const processResults = (data: any[]) => {
      const { mergedQs, idToMergedId } = mergeQuestions(data || []);
      
      let finalQs = mergedQs;
      const resIds = typeof params.resultIds === 'string' ? params.resultIds.split(',').filter(id => id.trim().length > 0) : null;
      
      if (resIds && resIds.length > 0) {
        const orderedMergedIds = resIds.map(id => idToMergedId.get(id) || id);
        const uniqueOrderedIds = Array.from(new Set(orderedMergedIds));
        finalQs = uniqueOrderedIds.map(id => mergedQs.find(q => q.id === id)).filter(Boolean);
      }
      
      setQuestions(finalQs);
      
      if (params.questionId && !hasJumped) {
        const jumpId = params.questionId;
        const targetId = idToMergedId.get(jumpId) || jumpId;
        const index = finalQs.findIndex(item => item.id === targetId);
        if (index !== -1) {
          setCurrentIndex(index);
          setShowIndex(false);
          setHasJumped(true);
        }
      }
      
      if (session?.user?.id && finalQs.length > 0) {
        const shouldLoadAnswers = arenaMode === 'learning' && params.testId && !params.testId.startsWith('custom_');
        store.loadStates(mergedQs.map(q => q.id), !!shouldLoadAnswers);
      }
    };

    try {
      // ──────── 1. FAST: Load from Local Cache First ────────
      let localFound = false;
      if (params.testId) {
        const cached = await OfflineManager.getOfflineQuestions(params.testId);
        if (cached && cached.length > 0) {
          processResults(cached);
          localFound = true;
          setLoading(false);
        }
      } else if (params.resultIds) {
        const ids = params.resultIds.split(',').filter(Boolean);
        const cached = await OfflineManager.getOfflineQuestionsByIds(ids);
        if (cached && cached.length > 0) {
          processResults(cached);
          localFound = true;
          setLoading(false);
        }
      }

      // ──────── 2. FRESH: Background fetch from Server (Chunked to bypass limits) ────────
      let allFreshData: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      const MAX_TOTAL = 10000; // Safety cap to prevent memory issues
      
      while (from < MAX_TOTAL) {
        let query = supabase.from('questions').select('*, tests(*)');
        const resIds = typeof params.resultIds === 'string' ? params.resultIds.split(',').filter(id => id.trim().length > 0) : null;
        
        if (resIds && resIds.length > 0) {
          // If we have specific IDs, chunk those IDs specifically
          const idChunk = resIds.slice(from, from + CHUNK);
          if (idChunk.length === 0) break;
          query = query.in('id', idChunk);
        } else if (params.questionId) {
          if (from > 0) break; // Only one question
          query = query.eq('id', params.questionId);
        } else {
          // General filters
          const term = typeof params.query === 'string' ? params.query.trim() : '';
          if (term) {
            const fields = typeof params.searchFields === 'string' ? params.searchFields.split(',') : ['Questions'];
            const words = term.split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
            if (words.length > 1) {
              words.forEach(word => {
                const wordFilters = [];
                if (fields.includes('Questions') || fields.includes('question_text')) wordFilters.push(`question_text.ilike.%${word}%`);
                if (fields.includes('Explanations') || fields.includes('explanation_markdown')) wordFilters.push(`explanation_markdown.ilike.%${word}%`);
                if (wordFilters.length > 0) query = query.or(wordFilters.join(','));
              });
            } else {
              const termPattern = `%${term}%`;
              const filters = [];
              if (fields.includes('Questions') || fields.includes('question_text')) filters.push(`question_text.ilike.${termPattern}`);
              if (fields.includes('Explanations') || fields.includes('explanation_markdown')) filters.push(`explanation_markdown.ilike.${termPattern}`);
              if (filters.length > 0) query = query.or(filters.join(','));
            }
          }

          if (params.testId) {
            query = query.eq('test_id', params.testId);
          } else {
            const insts = params.institutes || params.institute;
            const progs = params.programs || params.program;
            if (insts && insts !== 'All' && insts !== '' && insts !== '[]') {
              const instList = typeof insts === 'string' ? insts.split(',').filter(Boolean) : [];
              if (instList.length > 0) {
                // Pre-fetch test IDs to simplify query
                const { data: testRows } = await supabase.from('tests').select('id').in('institute', instList);
                const tIds = (testRows || []).map(t => t.id);
                if (tIds.length > 0) query = query.in('test_id', tIds);
                else break;
              }
            }
            if (progs && progs !== 'All' && progs !== '' && progs !== '[]') {
              const progList = typeof progs === 'string' ? progs.split(',').filter(Boolean) : [];
              if (progList.length > 0) {
                const { data: testRows } = await supabase.from('tests').select('id').in('program_name', progList);
                const tIds = (testRows || []).map(t => t.id);
                if (tIds.length > 0) query = query.in('test_id', tIds);
                else break;
              }
            }
          }

          if (params.subject && params.subject !== 'All') query = query.eq('subject', params.subject);
          const sectionVal = params.section;
          if (sectionVal && sectionVal !== 'All' && sectionVal !== '' && sectionVal !== '[]') {
            const sectionList = typeof sectionVal === 'string' ? sectionVal.split('|').filter(Boolean) : [];
            if (sectionList.length > 0) query = query.in('section_group', sectionList);
          }
          const mt = params.microTopics || params.microtopic;
          if (mt && mt !== 'All' && mt !== '' && mt !== '[]') {
            const mtList = typeof mt === 'string' ? mt.split('|').filter(Boolean) : [];
            if (mtList.length > 0) query = query.in('micro_topic', mtList);
          }

          const pyqM = params.pyqMaster || params.pyqFilter;
          if (pyqM === 'PYQ Only') {
            query = query.eq('is_pyq', true);
            const pyqCat = params.examCategory || params.pyqCategory;
            if (pyqCat && pyqCat !== 'All' && pyqCat !== '' && pyqCat !== '[]') {
              const cats = typeof pyqCat === 'string' ? pyqCat.split(',').filter(Boolean) : [];
              if (cats.length > 0) {
                const orFilters = [];
                if (cats.includes('UPSC CSE') || cats.includes('UPSC')) orFilters.push('is_upsc_cse.eq.true');
                if (cats.includes('Allied Exams') || cats.includes('Allied')) orFilters.push('is_allied.eq.true');
                if (cats.includes('Others')) orFilters.push('is_others.eq.true');
                if (orFilters.length > 0) query = query.or(orFilters.join(','));
              }
            }
          } else if (pyqM === 'Non-PYQ' || pyqM === 'Non PYQ') {
            query = query.eq('is_pyq', false);
          }

          const tagsRaw = params.tags;
          if (tagsRaw && tagsRaw !== 'All' && tagsRaw !== '' && tagsRaw !== '[]' && session?.user?.id) {
            // Tag filtering requires separate fetch of IDs
            const tagList = typeof tagsRaw === 'string' ? tagsRaw.split('|').filter(Boolean) : [];
            const orQuery = tagList.map(t => `review_tags.cs.["${t}"]`).join(',');
            const { data: tagIds } = await supabase.from('question_states').select('question_id').eq('user_id', session.user.id).or(orQuery);
            if (tagIds && tagIds.length > 0) {
               const slicedTagIds = tagIds.map(t => t.question_id).slice(from, from + CHUNK);
               if (slicedTagIds.length === 0) break;
               query = query.in('id', slicedTagIds);
            } else break;
          } else {
             // If no specific IDs/tags, use standard range pagination
             query = query.range(from, from + CHUNK - 1);
          }
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allFreshData.push(...data);
        if (data.length < CHUNK) break;
        from += CHUNK;
      }

      processResults(allFreshData);
    } catch (err) {
      console.error('Fetch error:', err);
      // If we didn't find local data and server failed, show empty
      if (!localFound) setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  // 5. Timer Logic
  useEffect(() => {
    if (timerType === 'countdown' && questions.length > 0 && seconds === 3600) {
      setSeconds(questions.length * 120); // 2 mins per question default
    }
  }, [questions.length, timerType]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive) {
      interval = setInterval(() => {
        setSeconds(prev => {
          if (timerType === 'countdown') {
            if (prev <= 1) {
              setIsTimerActive(false);
              Alert.alert('Time Up!', 'Your session timer has ended.', [{ text: 'OK' }]);
              return 0;
            }
            return prev - 1;
          }
          return prev + 1;
        });
        if (questions[currentIndex]) {
          store.incrementTime(questions[currentIndex].id);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, currentIndex, questions, viewMode, timerType]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 6. Notebook Hierarchy Logic
  const fetchFolders = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase.from('user_note_nodes').select('*').eq('user_id', session.user.id).eq('type', 'folder');
    setFolders(data || []);
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim() || !session?.user?.id) return;
    const { data, error } = await supabase.from('user_note_nodes').insert({
      user_id: session.user.id,
      title: newFolderName.trim(),
      type: 'folder'
    }).select().single();
    if (!error && data) {
      setFolders(prev => [...prev, data]);
      setNewFolderName('');
      setShowNewFolderInput(false);
      setSelectedFolder(data);
    }
  };

  const createNewNotebook = async () => {
    if (!newNotebookName.trim() || !selectedFolder || !session?.user?.id) return;
    
    // First, create the actual note document
    const { data: noteData, error: noteError } = await supabase.from('user_notes').insert({
      user_id: session.user.id,
      title: newNotebookName.trim(),
      subject: selectedFolder.title || "General",
      items: []
    }).select().single();

    if (noteError || !noteData) return;

    // Then create the node reference
    const { data, error } = await supabase.from('user_note_nodes').insert({
      user_id: session.user.id,
      title: newNotebookName.trim(),
      type: 'note',
      parent_id: selectedFolder.id,
      note_id: noteData.id
    }).select().single();

    if (!error && data) {
      setNotebooks(prev => [...prev, data]);
      setNewNotebookName('');
      setShowNewNotebookInput(false);
      setSelectedNotebook(data);
    }
  };

  const fetchHierarchy = async () => {
    if (!session?.user?.id) return;
    
    // 1. Load Folders
    const { data: folderData } = await supabase.from('user_note_nodes').select('*').eq('user_id', session.user.id).eq('type', 'folder');
    setFolders(folderData || []);

    // 2. Load Prefs
    const rawPrefs = await AsyncStorage.getItem(NOTE_PREFS_KEY);
    const prefs = rawPrefs ? JSON.parse(rawPrefs) : null;

    if (prefs) {
      // 3. Restore Folder
      if (prefs.folderId) {
        const lastFolder = folderData?.find((f: any) => f.id === prefs.folderId);
        if (lastFolder) {
          setSelectedFolder(lastFolder);
          
          // 4. Load Notebooks for this folder
          const { data: notebookData } = await supabase.from('user_note_nodes').select('*').eq('parent_id', lastFolder.id).eq('type', 'note');
          setNotebooks(notebookData || []);

          // 5. Restore Notebook
          if (prefs.notebookId) {
            const lastNotebook = notebookData?.find((n: any) => n.id === prefs.notebookId || n.note_id === prefs.notebookId);
            if (lastNotebook) {
              setSelectedNotebook(lastNotebook);
              // 6. Fetch existing subheadings in this notebook
              fetchSubheadings(lastNotebook.note_id);
            }
          }
        }
      }

      // 7. Restore Subheading
      if (prefs.subheading) {
        setLastUsedSubheading(prefs.subheading);
        setSelectedSubheading(prefs.subheading);
        setCustomSubheading('');
      } else {
        setSelectedSubheading('');
        setCustomSubheading(questions[currentIndex]?.micro_topic || '');
      }
    } else {
      // Default to microtopic if no prefs
      setSelectedSubheading('');
      setCustomSubheading(questions[currentIndex]?.micro_topic || '');
    }
  };

  const fetchSubheadings = async (noteId: string) => {
    if (!noteId) return;
    const { data } = await supabase.from('user_notes').select('items').eq('id', noteId).single();
    if (data?.items && Array.isArray(data.items)) {
      const headings = data.items.filter((i: any) => i.type === 'microTopicHeading').map((i: any) => i.text);
      const unique = Array.from(new Set(headings));
      setSubheadings(unique as string[]);
    } else {
      setSubheadings([]);
    }
  };

  const updateBullet = (idx: number, text: string) => {
    const next = [...noteDraftBullets];
    next[idx] = text;
    setNoteDraftBullets(next);
  };

  const addBullet = (idx: number) => {
    const next = [...noteDraftBullets];
    next.splice(idx + 1, 0, '');
    setNoteDraftBullets(next);
  };

  const removeBullet = (idx: number) => {
    if (noteDraftBullets.length === 1) return;
    const next = [...noteDraftBullets];
    next.splice(idx, 1);
    setNoteDraftBullets(next);
  };

  const splitBullet = (idx: number) => {
    const content = noteDraftBullets[idx];
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.start);
    const next = [...noteDraftBullets];
    next[idx] = before;
    next.splice(idx + 1, 0, after);
    setNoteDraftBullets(next);
  };

  const applyFormatting = (type: 'bold' | 'italic' | 'highlight') => {
    const idx = activeInputIndex;
    const content = noteDraftBullets[idx] || '';
    const { start, end } = selection;
    
    const before = content.slice(0, start);
    const selected = content.slice(start, end);
    const after = content.slice(end);
    
    if (!selected) return; // Only apply if text is selected

    let formatted = selected;
    switch(type) {
      case 'bold': formatted = `**${selected}**`; break;
      case 'italic': formatted = `*${selected}*`; break;
      case 'highlight': formatted = `<mark>${selected}</mark>`; break;
    }
    
    const next = [...noteDraftBullets];
    next[idx] = before + formatted + after;
    setNoteDraftBullets(next);
  };

  const commitToNotebook = async () => {
    if (!selectedNotebook || !selectedNotebook.note_id || isSavingToNotebook) return;
    setIsSavingToNotebook(true);
    try {
      const finalSub = showCustomSubheadingInput ? customSubheading : selectedSubheading;
      
      const { data: noteData, error: fetchError } = await supabase.from('user_notes').select('items').eq('id', selectedNotebook.note_id).single();
      if (fetchError) throw fetchError;
      
      const currentItems = Array.isArray(noteData?.items) ? noteData.items : [];
      const newItemsToAdd = [];
      
      if (finalSub && finalSub !== 'General') {
        const headingExists = currentItems.some((i: any) => i.type === 'microTopicHeading' && i.text === finalSub);
        if (!headingExists) {
           newItemsToAdd.push({
             id: Date.now().toString() + '-h',
             type: 'microTopicHeading',
             text: finalSub,
             addedAt: new Date().toISOString()
           });
        }
      }
      
      const bullets = noteDraftBullets.filter(b => b.trim()).map((b, i) => ({
        id: (Date.now() + i).toString(),
        type: 'highlight',
        text: b.trim(),
        color: '#FFB74D',
        source: `Q${currentIndex + 1} / ${questions[currentIndex]?.source?.group || questions[currentIndex]?.exam_group || (questions[currentIndex]?.is_pyq ? 'PYQ' : 'Practice')} ${questions[currentIndex]?.source?.year || questions[currentIndex]?.exam_year || ''}`.trim(),
        addedAt: new Date().toISOString()
      }));

      newItemsToAdd.push(...bullets);
      
      const { error } = await supabase.from('user_notes').update({
        items: [...currentItems, ...newItemsToAdd],
        updated_at: new Date().toISOString()
      }).eq('id', selectedNotebook.note_id);

      if (!error) {
        await AsyncStorage.setItem(NOTE_PREFS_KEY, JSON.stringify({
          folderId: selectedFolder?.id,
          notebookId: selectedNotebook?.note_id, // Save the real UUID for Quick Save compatibility
          subheading: finalSub
        }));
        setNotebookModalVisible(false);
        setNoteDraftBullets(['']);
      }
    } finally {
      setIsSavingToNotebook(false);
    }
  };

  // 7. Action Handlers
  const handleOptionSelect = (qId: string, label: string) => {
    store.setAnswer(qId, label);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // REDUNDANT: store.setAnswer already triggers sync via store.syncAnswer
    // Removing the direct StudentSync.enqueue here to prevent double-processing
    // and potential session-refresh loops.
  };

  const toggleBookmark = (qId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const current = currentAnswers[qId]?.isBookmarked || false;
    store.setMetadata(qId, { isBookmarked: !current });
  };

  const handleQuickSave = async (q: Question) => {
    if (!session?.user?.id) return;
    const rawPrefs = await AsyncStorage.getItem(NOTE_PREFS_KEY);
    if (!rawPrefs) {
      Alert.alert("Setup Required", "Please use 'Notebook' once to set save preferences.");
      return;
    }
    const prefs = JSON.parse(rawPrefs);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1. Fetch current items from user_notes
      const { data: noteData, error: fetchError } = await supabase
        .from('user_notes')
        .select('items')
        .eq('id', prefs.notebookId)
        .single();
      
      if (fetchError) throw fetchError;

      const currentItems = Array.isArray(noteData?.items) ? noteData.items : [];
      const heading = prefs.subheading || 'Quick Saves';
      
      // 2. Ensure heading exists
      const newItems = [...currentItems];
      const headingExists = newItems.some((i: any) => i.type === 'microTopicHeading' && i.text === heading);
      if (!headingExists) {
        newItems.push({
          id: Date.now().toString() + '-h',
          type: 'microTopicHeading',
          text: heading,
          addedAt: new Date().toISOString()
        });
      }

      // 3. Add the quick save point
      newItems.push({
        id: (Date.now() + 1).toString(),
        type: 'highlight',
        text: q.explanation_markdown || 'No explanation available',
        color: '#4FC3F7',
        source: `Quick Save: Q${currentIndex + 1} / ${q.source?.group || q.exam_group || (q.is_pyq ? 'PYQ' : 'Practice')} ${q.source?.year || q.exam_year || ''}`.trim(),
        addedAt: new Date().toISOString()
      });

      // 4. Update the table
      const { error: updateError } = await supabase
        .from('user_notes')
        .update({ items: newItems, updated_at: new Date().toISOString() })
        .eq('id', prefs.notebookId);

      if (updateError) throw updateError;

      Alert.alert("Saved", "Quickly added to your last notebook.");
    } catch (err) {
      console.error("Quick save failed details:", err);
      Alert.alert("Error", "Failed to save to notebook. Please try opening the Notebook manually once to reset preferences.");
    }
  };

  const handleAddToFlashcards = async (q: Question) => {
    if (!session?.user?.id) return;
    setSavingFlashcard(prev => ({ ...prev, [q.id]: true }));
    try {
      await FlashcardSvc.createFlashcardFromQuestion(session.user.id, q);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        'Added to Flashcards',
        `Front: question + 4 options\nBack: correct answer + explanation\n\nDeck: ${q.subject || 'General'} → ${q.micro_topic || 'General'}`,
      );
    } catch (err: any) {
      console.error("Flashcard Error:", err);
      Alert.alert("Error", "Failed to add to Flashcards. " + (err.message || ''));
    } finally {
      setSavingFlashcard(prev => ({ ...prev, [q.id]: false }));
    }
  };





  const handleCommitToMemory = async (qId: string) => {
    store.syncAnswer(qId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Note saved successfully.");
    if (currentIndex < questions.length - 1) {
       setCurrentIndex(currentIndex + 1);
       setRevealedExplanations({});
    } else {
        setShowExitModal(true);
    }
  };

  const buildAttemptQuestions = () => {
    return questions.map(q => {
      const answerData = store.answers[q.id] || {};
      const selected = answerData.selectedAnswer;
      return {
        question_id: q.id,
        selected_answer: selected || null,
        confidence: answerData.confidence || null,
        difficulty_level: answerData.difficulty || null,
        error_category: answerData.errorCategory || null,
        review_tags: answerData.studyTags || [],
        time_spent_seconds: answerData.timeSpentSeconds || 0,
        is_correct: selected ? selected === q.correct_answer : false,
      };
    });
  };

  const getSessionDurationSeconds = () => {
    // Always use wall-clock elapsed time as primary source — state ticks can lag or be 0
    const wallClockElapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    if (timerType === 'countdown') {
      // For countdown: cap at original duration
      const maxDuration = questions.length * 120;
      return Math.min(wallClockElapsed, maxDuration);
    }
    // Stopwatch or no-timer: use wall clock, fall back to seconds state
    return wallClockElapsed > 0 ? wallClockElapsed : (seconds || 1);
  };

  const handleFinalSubmit = async () => {
    setShowExitModal(false);
    if (submitting) return;
    setSubmitting(true);
    
    // Auto-save test attempt for Quiz Mode
    if (session?.user?.id && sessionTestId) {
       try {
         // 1. Prepare Version 2 attempt_payload
         const attemptQuestions = buildAttemptQuestions();
         const attempted = attemptQuestions.filter(row => row.selected_answer !== null).length;
         const skipped = questions.length - attempted;
         const correct = attemptQuestions.filter(row => row.is_correct).length;
         const durationSec = getSessionDurationSeconds();
         
         const attempt_payload = {
           version: 2,
           test_id: sessionTestId,
           title: customTestName || 'Practice Session',
           total_questions: questions.length,
           attempted,
           skipped,
           score: correct,
           duration_seconds: durationSec,
           questions: questions.map(q => {
             const answerData = store.answers[q.id] || {};
             return {
               question_id: q.id,
               selected_answer: answerData.selectedAnswer || null,
               correct_answer: q.correct_answer,
               is_correct: answerData.selectedAnswer === q.correct_answer,
               time_spent_seconds: answerData.timeSpentSeconds || 0,
               subject: q.subject || null,
               micro_topic: q.micro_topic || null,
               is_pyq: !!q.is_pyq,
               confidence: answerData.confidence || null,
               error_category: answerData.errorCategory || null,
               review_tags: answerData.studyTags || [],
             };
           }),
         };

         // 2. Synchronous submission to get the real attemptId
         const attemptId = await StudentSync.submitAttemptNow({
           userId: session.user.id,
           testId: sessionTestId,
           attempt: { 
             score: correct,
             attempt_payload, 
             started_at: new Date(sessionStartRef.current).toISOString(),
             submitted_at: new Date().toISOString(),
           }
         });

         // 3. Per-question question_state writes (with real attemptId)
         questions.forEach(q => {
           const answerData = store.answers[q.id] || {};
           StudentSync.enqueue('question_state', {
             userId: session.user.id,
             questionId: q.id,
             testId: sessionTestId,
             attemptId: attemptId,
             patch: {
               selected_answer: answerData.selectedAnswer || null,
               time_spent_seconds: answerData.timeSpentSeconds || 0,
               confidence: answerData.confidence || null,
               review_tags: answerData.studyTags || [],
               error_category: answerData.errorCategory || null,
               status: answerData.selectedAnswer === q.correct_answer ? 'Correct' : 'Incorrect',
             },
           });
         });

         // Clear persistence
         await AsyncStorage.removeItem(INDEX_PERSIST_KEY);

         setSummary({
           totalQuestions: questions.length,
           attempted,
           skipped,
           durationSec,
           attemptId: attemptId
         });
       } catch (err) {
         console.error('Final submit error:', err);
         Alert.alert("Error", "Failed to submit attempt.");
       } finally {
         setSubmitting(false);
       }
    } else {
      isNavigatingAway.current = true;
      router.replace('/(tabs)/analyse');
    }
  };

  const handleDiscard = () => {
    setShowExitModal(false);
    isNavigatingAway.current = true;
    router.back();
  };

  const handleCreateTag = () => {
    if (!newTagText.trim()) return;
    if (userStudyTags.includes(newTagText.trim())) {
      setIsAddingTag(false);
      setNewTagText('');
      return;
    }
    const updated = [...userStudyTags, newTagText.trim()];
    setUserStudyTags(updated);
    setIsAddingTag(false);
    setNewTagText('');
  };

  const handleStartCountdown = (customMins?: string) => {
    const mins = customMins || customTimeInput;
    router.setParams({ timer: 'countdown' });
    if (mins && !isNaN(parseInt(mins))) {
      setSeconds(parseInt(mins) * 60);
    } else if (questions.length > 0) {
      setSeconds(questions.length * 120); 
    }
    setIsTimerActive(true);
    setShowTimerPicker(false);
    Keyboard.dismiss();
  };

  const handleExit = () => {
    if (params.mode === 'exam') {
      setShowSaveSessionModal(true);
    } else {
      isNavigatingAway.current = true;
      router.back();
    }
  };

  const commitManualSave = async (customName: string) => {
    if (isSavingAttempt) return;
    setIsSavingAttempt(true);
    
    try {
      questions.forEach(q => store.syncAnswer(q.id));
      const submissionTime = new Date().toISOString();
      const testId = params.testId || (questions[0]?.test_id) || `unified_${Date.now()}`;
      
      // Build V2 payload (same as handleFinalSubmit)
      const attemptQuestions = buildAttemptQuestions();
      const attempted = attemptQuestions.filter(row => row.selected_answer !== null).length;
      const skipped = questions.length - attempted;
      const correct = attemptQuestions.filter(row => row.is_correct).length;
      const durationSec = getSessionDurationSeconds();

      // Ensure test row exists for custom IDs
      if (testId && testId.startsWith('unified_')) {
        await supabase.from('tests').upsert({
          id: testId,
          title: customName || params.subject || 'Unified Arena Test',
          provider: 'Unified Arena'
        }, { onConflict: 'id' });
      }

      // Use StudentSync for a real UUID (same as exam submit)
      const newAttemptId = uuidv4();
      const attemptId = await StudentSync.submitAttemptNow({
        userId: session!.user.id,
        testId: testId,
        attempt: {
          id: newAttemptId,
          score: correct,
          attempt_payload: {
            version: 2,
            test_id: testId,
            title: customName || 'Arena Attempt',
            total_questions: questions.length,
            attempted,
            skipped,
            score: correct,
            duration_seconds: durationSec,
            questions: attemptQuestions,
          },
          started_at: new Date(sessionStartRef.current).toISOString(),
          submitted_at: submissionTime,
        }
      });

      // Per-question state sync (with real attemptId)
      questions.forEach(q => {
        const answerData = store.answers[q.id] || {};
        StudentSync.enqueue('question_state', {
          userId: session!.user.id,
          questionId: q.id,
          testId: testId,
          attemptId: attemptId,
          patch: {
            selected_answer: answerData.selectedAnswer || null,
            time_spent_seconds: answerData.timeSpentSeconds || 0,
            confidence: answerData.confidence || null,
            review_tags: answerData.studyTags || [],
            error_category: answerData.errorCategory || null,
            status: answerData.selectedAnswer === q.correct_answer ? 'Correct' : 'Incorrect',
          },
        });
      });

      setIsTimerActive(false);
      setShowSaveSessionModal(false);
      setShowSaveNameModal(false);
      setCustomTestName('');
      
      // Clear persisted index
      await AsyncStorage.removeItem(INDEX_PERSIST_KEY);
      
      // Show summary modal (same as exam submit) — navigation happens from the modal
      setSummary({
        totalQuestions: questions.length,
        attempted,
        skipped,
        durationSec,
        attemptId: attemptId
      });
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert("Error", "Failed to save session.");
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const handleSaveAndExit = async () => {
    await commitManualSave(sessionName || 'Exam Session');
    await AsyncStorage.removeItem(INDEX_PERSIST_KEY);
    router.back();
  };

  // --- Renderers ---

  const renderQuestionIndex = () => {
    const pageSize = 100;
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const pageQuestions = questions.slice(start, end);
    const totalPages = Math.ceil(questions.length / pageSize);

    return (
      <View style={{ flex: 1, backgroundColor: zenBg }}>
        <View style={[styles.indexHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.indexTitle, { color: colors.textPrimary }]}>Question Index</Text>
          <Text style={[styles.indexSubtitle, { color: colors.textTertiary }]}>{questions.length} Questions Targeted</Text>
        </View>

        <FlatList
          data={pageQuestions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item, index }) => {
            const actualIndex = start + index;
            const snippet = (item.statement_line || item.question_text || '').replace(/<[^>]*>/g, '').slice(0, 80) + '...';
            const isAnswered = !!store.answers[item.id];
            
            return (
              <TouchableOpacity 
                onPress={() => { 
                  setCurrentIndex(actualIndex); 
                  setShowIndex(false); 
                }}
                style={[styles.indexItem, { backgroundColor: colors.surface, borderColor: colors.border }, isAnswered && { borderColor: colors.primary + '40' }]}
              >
                <View style={[styles.indexNum, { backgroundColor: isAnswered ? colors.primary : colors.surfaceStrong }]}>
                  <Text style={{ color: isAnswered ? colors.buttonText : colors.textSecondary, fontWeight: '900', fontSize: 12 }}>{actualIndex + 1}</Text>
                </View>
                
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.indexSnippet, { color: colors.textPrimary }]} numberOfLines={2}>{snippet}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    {(() => {
                      if (!showPYQTags) return null;
                      const pyq = getPYQCategorization(item);
                      if (!pyq.hasPYQData) return null;
                      return (
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {pyq.isUPSC && (
                            <View style={[styles.inlineBadge, { backgroundColor: '#dcfce7', borderColor: '#22c55e' }]}>
                              <Text style={{ color: '#15803d', fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                            </View>
                          )}
                          {pyq.isAllied && (
                            <View style={[styles.inlineBadge, { backgroundColor: '#fef9c3', borderColor: '#eab308' }]}>
                              <Text style={{ color: '#a16207', fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                            </View>
                          )}
                          {pyq.isOther && (
                            <View style={[styles.inlineBadge, { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' }]}>
                              <Text style={{ color: '#475569', fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                            </View>
                          )}
                          {pyq.isGenericPYQ && (
                             <View style={[styles.inlineBadge, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                               <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                             </View>
                          )}
                        </View>
                      );
                    })()}
                    {item.is_ncert && (
                      <View style={[styles.inlineBadge, { backgroundColor: '#e0f2fe', borderColor: '#0ea5e9' }]}>
                        <Text style={{ color: '#0369a1', fontWeight: '900', fontSize: 9 }}>NCERT</Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            );
          }}
        />

        {totalPages > 1 && (
          <View style={[styles.pagination, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity 
              disabled={currentPage === 0} 
              onPress={() => setCurrentPage(p => p - 1)}
              style={[styles.pageBtn, currentPage === 0 && { opacity: 0.3 }]}
            >
              <ArrowLeft size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            
            <Text style={{ color: colors.textPrimary, fontWeight: '900' }}>Page {currentPage + 1} of {totalPages}</Text>

            <TouchableOpacity 
              disabled={currentPage >= totalPages - 1} 
              onPress={() => setCurrentPage(p => p + 1)}
              style={[styles.pageBtn, currentPage >= totalPages - 1 && { opacity: 0.3 }]}
            >
              <ArrowRight size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderQuestionBlock = ({ item, index }: { item: Question, index: number }) => {
    if (!item) return null;
    const answerData = currentAnswers[item.id] || { selectedAnswer: null, confidence: null, difficulty: null, errorCategory: null, note: '' };
    const showExplanation = arenaMode === 'learning' && revealedExplanations[item.id];
    
    return (
      <View style={[styles.questionCard, { backgroundColor: isZenMode ? 'transparent' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border, borderWidth: isZenMode ? 0 : 1 }]}>
        <View style={styles.qHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <View style={[styles.qNumberBadge, { backgroundColor: isZenMode ? '#433422' : colors.primary }]}>
                <Text style={[styles.qNumberText, { color: isZenMode ? '#F4ECD8' : colors.buttonText }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.qMetaText, { color: isZenMode ? '#43342280' : colors.textTertiary }]}>{item.subject?.toUpperCase()}</Text>
            </View>
            
            {(() => {
              const pyq = getPYQCategorization(item);
              const hasTags = showPYQTags && (pyq.hasPYQData || item.is_ncert);
              if (!hasTags) return null;
              
              return (
                <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 6 }}>
                  {pyq.isUPSC && (
                    <View style={[styles.inlineBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#dcfce7', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#22c55e' }]}>
                      <Text style={{ color: isZenMode ? '#433422' : '#15803d', fontWeight: '900', fontSize: 10 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                    </View>
                  )}
                  {pyq.isAllied && (
                    <View style={[styles.inlineBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#fef9c3', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#eab308' }]}>
                      <Text style={{ color: isZenMode ? '#433422' : '#a16207', fontWeight: '900', fontSize: 10 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                    </View>
                  )}
                  {pyq.isOther && (
                    <View style={[styles.inlineBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#f1f5f9', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#94a3b8' }]}>
                      <Text style={{ color: isZenMode ? '#433422' : '#475569', fontWeight: '900', fontSize: 10 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                    </View>
                  )}
                  {pyq.isGenericPYQ && (
                     <View style={[styles.inlineBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.primary + '10', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : colors.primary }]}>
                       <Text style={{ color: isZenMode ? '#433422' : colors.primary, fontWeight: '900', fontSize: 10 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                     </View>
                  )}
                  {item.is_ncert && (
                    <View style={[styles.inlineBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#e0f2fe', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#0ea5e9' }]}>
                      <Text style={{ color: isZenMode ? '#433422' : '#0369a1', fontWeight: '900', fontSize: 10 }}>NCERT</Text>
                    </View>
                  )}
                </View>
              );
            })()}
            {(item.is_ncert || item.micro_topic === 'NCERT') && (
              <View style={{ position: 'absolute', top: 12, right: 12 }}>
                <View style={[styles.inlineBadge, { backgroundColor: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#e0f2fe', borderColor: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#0ea5e9' }]}>
                  <Text style={{ color: isZenMode ? '#433422' : '#0369a1', fontWeight: '900', fontSize: 10 }}>NCERT</Text>
                </View>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              onPress={() => store.setMetadata(item.id, { isReview: !answerData.isReview })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: answerData.isReview ? (isZenMode ? '#43342220' : '#fef9c3') : 'transparent' }}
            >
               <Flag size={18} color={answerData.isReview ? (isZenMode ? '#433422' : '#eab308') : (isZenMode ? '#43342240' : colors.textTertiary)} fill={answerData.isReview ? (isZenMode ? '#433422' : '#eab308') : 'transparent'} />
               {answerData.isReview && <Text style={{ fontSize: 10, fontWeight: '900', color: isZenMode ? '#433422' : '#a16207' }}>REVIEW</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleBookmark(item.id)}>
               <Bookmark size={20} color={answerData.isBookmarked ? (isZenMode ? '#433422' : colors.primary) : (isZenMode ? '#43342240' : colors.textTertiary)} fill={answerData.isBookmarked ? (isZenMode ? '#433422' : colors.primary) : 'transparent'} />
            </TouchableOpacity>
          </View>
        </View>

        <Markdown style={{ body: { color: zenTextColor, fontSize: fontSize, lineHeight: fontSize * 1.5, fontWeight: '700' } }}>
          {item.statement_line || item.question_text}
        </Markdown>


        <View style={styles.optionsContainer}>
          {Object.entries(item.options || {}).map(([label, text]) => {
            const isSelected = answerData.selectedAnswer === label;
            const isCorrect = label.toLowerCase() === item.correct_answer?.toLowerCase();
            const isWrong = isSelected && !isCorrect;
            return (
              <OptionButton
                key={label}
                label={label}
                text={text}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isWrong={isWrong}
                showResult={arenaMode === 'learning' && !!answerData.selectedAnswer}
                onSelect={() => handleOptionSelect(item.id, label)}
                disabled={arenaMode === 'learning' && showExplanation}
              />
            );
          })}
        </View>

        {arenaMode === 'learning' && !showExplanation && (
          <TouchableOpacity 
            style={[styles.revealBtn, { borderColor: colors.primary }]}
            onPress={() => { setRevealedExplanations(prev => ({ ...prev, [item.id]: true })); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Lightbulb size={16} color={colors.primary} />
            <Text style={[styles.revealBtnText, { color: colors.primary }]}>Show Answer & Explanation</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.controls, { borderTopColor: colors.border }]}>
          {arenaMode === 'exam' && (
            <>
              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>CONFIDENCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {CONFIDENCE_LEVELS.map(level => (
                    <TouchableOpacity
                      key={level.value}
                      onPress={() => store.setAnswer(item.id, answerData.selectedAnswer, level.value)}
                      style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }, answerData.confidence === level.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.chipText, { color: answerData.confidence === level.value ? colors.buttonText : colors.textSecondary }]}>{level.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>DIFFICULTY</Text>
                <View style={styles.difficultyRow}>
                  {DIFFICULTIES.map(diff => (
                    <TouchableOpacity
                      key={diff.value}
                      onPress={() => store.setMetadata(item.id, { difficulty: diff.value })}
                      style={[styles.difficultyBtn, { borderColor: colors.border }, answerData.difficulty === diff.value && { backgroundColor: diff.color + '20', borderColor: diff.color }]}
                    >
                      <Text style={[styles.difficultyText, { color: answerData.difficulty === diff.value ? diff.color : colors.textSecondary }]}>{diff.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>STUDY TAGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {[...userStudyTags].sort((a, b) => {
                const aSelected = (answerData.studyTags || []).includes(a);
                const bSelected = (answerData.studyTags || []).includes(b);
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                return 0;
              }).map(tag => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleStudyTag(item.id, answerData.studyTags || [], tag)}
                  style={[styles.chip, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, (answerData.studyTags || []).includes(tag) && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                >
                  <Text style={[styles.chipText, { color: (answerData.studyTags || []).includes(tag) ? colors.primary : colors.textSecondary }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                onPress={() => setIsAddingTag(true)}
                style={[styles.chip, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderStyle: 'dashed' }]}
              >
                <Plus size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          {arenaMode === 'learning' && showExplanation && (
            <>
              <View style={[styles.explanationBox, { backgroundColor: colors.bg, marginBottom: 16 }]}>
                <View style={styles.explanationHeader}>
                   <Info size={16} color={colors.primary} />
                   <Text style={[styles.explanationTitle, { color: colors.primary }]}>EXPLANATION</Text>
                </View>

                {item._explanations && item._explanations.length > 1 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '30' }}>
                    <TouchableOpacity 
                      onPress={() => setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }))}
                      style={{ 
                        paddingHorizontal: 12, 
                        paddingVertical: 6, 
                        borderRadius: 20, 
                        backgroundColor: (activeExplIndex[item.id] ?? -1) === -1 ? colors.primary : colors.surfaceStrong,
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: (activeExplIndex[item.id] ?? -1) === -1 ? '#fff' : colors.textTertiary }}>
                        Combined
                      </Text>
                    </TouchableOpacity>
                    {item._explanations.map((expl: any, idx: number) => (
                      <TouchableOpacity 
                        key={idx}
                        onPress={() => setActiveExplIndex(prev => ({ ...prev, [item.id]: idx }))}
                        style={{ 
                          paddingHorizontal: 12, 
                          paddingVertical: 6, 
                          borderRadius: 20, 
                          backgroundColor: activeExplIndex[item.id] === idx ? colors.primary : colors.surfaceStrong,
                          borderWidth: 1,
                          borderColor: colors.border
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: activeExplIndex[item.id] === idx ? '#fff' : colors.textTertiary }}>
                          {expl.source || `Source ${idx + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Markdown style={{ body: { color: colors.textSecondary, fontSize: fontSize - 2 } }}>
                  {(activeExplIndex[item.id] ?? -1) === -1 
                    ? item.explanation_markdown 
                    : item._explanations?.[activeExplIndex[item.id]]?.text || item.explanation_markdown || 'No explanation available.'}
                </Markdown>
              </View>

              <View style={styles.actionRow}>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => { 
                     const activeText = item._explanations?.[activeExplIndex[item.id] || 0]?.text || item.explanation_markdown || '';
                     setNoteDraftBullets([activeText]); 
                     setCustomSubheading(item.micro_topic || '');
                     setNotebookModalVisible(true); 
                     fetchHierarchy(); 
                   }}
                 >
                    <BookOpen size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Notebook</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => handleAddToFlashcards(item)}
                   disabled={savingFlashcard[item.id]}
                 >
                    {savingFlashcard[item.id] ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Zap size={16} color={colors.primary} />
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>Flashcard</Text>
                      </>
                    )}
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.surfaceStrong }]}
                   onPress={() => handleQuickSave(item)}
                 >
                    <Save size={16} color={colors.textPrimary} />
                    <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Save</Text>
                 </TouchableOpacity>
              </View>

              <View style={[styles.noteSection, { marginTop: 24, padding: 20, borderRadius: 24, backgroundColor: colors.surfaceStrong + '50', borderWidth: 1, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 3, height: 16, backgroundColor: colors.primary, marginRight: 8, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>YOUR INSIGHTS</Text>
                  </View>

                  <View style={[styles.controlRow, { marginBottom: 16 }]}>
                    <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>MISTAKE TYPE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                      {ERROR_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => store.setMetadata(item.id, { errorCategory: type })}
                          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, answerData.errorCategory === type && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                        >
                          <Text style={[styles.chipText, { color: answerData.errorCategory === type ? colors.primary : colors.textSecondary }]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={[styles.noteInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderStyle: 'dashed' }]}>
                      <TextInput
                        style={[styles.noteInput, { color: colors.textPrimary, padding: 16, minHeight: 80 }]}
                        placeholder="Double-tap to record your strategy..."
                        multiline
                        placeholderTextColor={colors.textSecondary || '#6B7280'}
                        value={answerData.note || ''}
                        onChangeText={(val) => store.setMetadata(item.id, { note: val }, false)}
                      />
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleCommitToMemory(item.id)}
                    style={{ marginTop: 16 }}
                  >
                    <LinearGradient 
                      colors={['#FF6B6B', '#7B2CBF']} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 0 }} 
                      style={{ height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: '#7B2CBF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
                    >
                       <Save size={20} color="#fff" />
                       <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Commit to Memory</Text>
                    </LinearGradient>
                  </TouchableOpacity>
              </View>

              <View style={{ marginTop: 32, padding: 16, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                 <Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', lineHeight: 16 }}>
                    {item.tests?.institute?.toUpperCase() || 'UPSC'} • {item.tests?.program_name?.toUpperCase() || 'GENERAL'} • {item.tests?.title?.toUpperCase() || 'MOCK'} • Q#{item.question_number || 'NA'}
                 </Text>
                 <Text style={{ fontSize: 8, color: colors.textTertiary, textAlign: 'center', marginTop: 4, opacity: 0.5 }}>
                    ID: {item.id}
                 </Text>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderNotebookModal = () => {
    return (
      <NotebookModal
        visible={notebookModalVisible}
        onClose={() => setNotebookModalVisible(false)}
        onSave={commitToNotebook}
        folders={folders}
        notebooks={notebooks}
        subheadings={subheadings}
        selectedFolder={selectedFolder}
        setSelectedFolder={(f: any) => {
          setSelectedFolder(f);
          supabase.from('user_note_nodes').select('*').eq('parent_id', f.id).eq('type', 'note').then(({ data }) => setNotebooks(data || []));
        }}
        selectedNotebook={selectedNotebook}
        setSelectedNotebook={(n: any) => {
          setSelectedNotebook(n);
          fetchSubheadings(n.note_id);
        }}
        selectedSubheading={selectedSubheading}
        setSelectedSubheading={setSelectedSubheading}
        isSaving={isSavingToNotebook}
        colors={colors}
        noteDraftBullets={noteDraftBullets}
        updateBullet={updateBullet}
        splitBullet={splitBullet}
        addBullet={addBullet}
        removeBullet={removeBullet}
        setSelection={setSelection}
        setActiveInputIndex={setActiveInputIndex}
        activeInputIndex={activeInputIndex}
        showNewFolderInput={showNewFolderInput}
        setShowNewFolderInput={setShowNewFolderInput}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        createNewFolder={createNewFolder}
        showNewNotebookInput={showNewNotebookInput}
        setShowNewNotebookInput={setShowNewNotebookInput}
        newNotebookName={newNotebookName}
        setNewNotebookName={setNewNotebookName}
        createNewNotebook={createNewNotebook}
        showCustomSubheadingInput={showCustomSubheadingInput}
        setShowCustomSubheadingInput={setShowCustomSubheadingInput}
        customSubheading={customSubheading}
        setCustomSubheading={setCustomSubheading}
        microtopic={questions[currentIndex]?.micro_topic}
        applyFormatting={applyFormatting}
      />
    );
  };

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: zenBg }]}>
        <StatusBar hidden={isZenMode} barStyle={isZenMode ? 'dark-content' : 'default'} />
        {isZenMode && (
          <TouchableOpacity 
            style={styles.floatingZenExit} 
            onPress={() => setIsZenMode(false)}
            activeOpacity={0.7}
          >
            <Minimize2 size={24} color="#433422" />
          </TouchableOpacity>
        )}
        <View style={[styles.header, { borderBottomColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}>
          <TouchableOpacity onPress={handleExit} style={styles.headerBtn}>
            <ChevronLeft size={24} color={isZenMode ? '#433422' : colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {showIndex ? 'Arena Index' : `Q${currentIndex + 1}/${questions.length}`}
              </Text>

              <TouchableOpacity 
                onPress={() => setShowSaveNameModal(true)}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 6, 
                  backgroundColor: colors.primary + '15',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  marginLeft: 8
                }}
              >
                <Save size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>SAVE</Text>
              </TouchableOpacity>
              
              {timerType !== 'none' && (
                <TouchableOpacity 
                  onPress={() => setShowClockControl(true)}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    gap: 6, 
                    backgroundColor: isTimerActive ? colors.primary + '10' : colors.surfaceStrong,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isTimerActive ? colors.primary + '30' : colors.border
                  }}
                >
                  <Clock size={14} color={isTimerActive ? colors.primary : colors.textTertiary} />
                  <Text style={{ 
                    color: isTimerActive ? colors.primary : colors.textTertiary, 
                    fontWeight: '900', 
                    fontSize: 13,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' 
                  }}>
                    {formatTime(seconds)}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>



          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleZenMode} style={styles.headerBtn}>
              <Sparkles size={20} color={isZenMode ? '#433422' : colors.primary} />
            </TouchableOpacity>
            {!showIndex && (
              <TouchableOpacity onPress={() => setShowIndex(true)} style={styles.headerBtn}>
                <ListIcon size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowQuickMenu(!showQuickMenu)} style={styles.headerBtn}>
              <MoreVertical size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Syncing Arena...</Text>
          </View>
        ) : (
          <>
            {/* Quick Menu Modal */}
            <Modal visible={showQuickMenu} transparent animationType="none" onRequestClose={() => setShowQuickMenu(false)}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowQuickMenu(false)}>
                <View style={[styles.verticalMenu, { backgroundColor: colors.surface, borderColor: colors.border, top: Platform.OS === 'ios' ? 100 : 80 }]}>
                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { setShowFontSlider(true); setShowQuickMenu(false); }}
                  >
                    <Text style={{ fontWeight: '900', color: colors.textPrimary, fontSize: 16 }}>Aa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { setShowNavigator(true); setShowQuickMenu(false); }}
                  >
                    <LayoutGrid size={24} color={colors.textPrimary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { setShowPYQTags(!showPYQTags); setShowQuickMenu(false); }}
                  >
                    <Text style={{ fontWeight: '900', color: showPYQTags ? colors.primary : colors.textTertiary, fontSize: 10 }}>PYQ</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { setShowTimerPicker(true); setShowQuickMenu(false); }}
                  >
                    <Clock size={24} color={timerType !== 'none' ? colors.primary : colors.textTertiary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { toggleZenMode(); setShowQuickMenu(false); }}
                  >
                    <Sparkles size={24} color={isZenMode ? colors.primary : colors.textTertiary} />
                  </TouchableOpacity>
                  
                  <View style={{ height: 1, backgroundColor: colors.border, width: '100%', marginVertical: 4 }} />
                  
                  <ThemeSwitcher />
                </View>
              </Pressable>
            </Modal>

            {/* Font Slider Modal */}
            <Modal visible={showFontSlider} transparent animationType="slide" onRequestClose={() => setShowFontSlider(false)}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFontSlider(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <View style={[styles.fontPanel, { backgroundColor: colors.surface, paddingBottom: Platform.OS === 'ios' ? 40 : 20 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, textAlign: 'center', marginBottom: 16 }}>ADJUST FONT SIZE</Text>
                    <View style={styles.sliderRow}>
                      {[10, 12, 14, 16, 18, 20, 22, 24, 28].map(s => (
                        <TouchableOpacity key={s} onPress={() => setFontSize(s)} style={[styles.sizeBubble, fontSize === s && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          <Text style={{ color: fontSize === s ? '#fff' : colors.textPrimary, fontWeight: '800' }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </Pressable>
            </Modal>

            <Modal visible={showNavigator} animationType="slide" transparent>
              <View style={[styles.modalOverlay, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '85%' }]}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Navigator</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>Jump to any question</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => setShowNavigator(false)}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                   <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Answered</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Missed</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Review</Text>
                    </View>
                  </View>

                  <ScrollView 
                    contentContainerStyle={[styles.paletteGrid, { paddingBottom: 40 }]}
                    showsVerticalScrollIndicator={true}
                  >
                    {questions.map((q, idx) => {
                      const answerData = store.answers[q.id];
                      const isAnswered = !!answerData?.selectedAnswer;
                      const isReview = !!answerData?.isReview;
                      const isMissed = !isAnswered && !isReview && currentIndex > idx;
                      const isActive = currentIndex === idx;

                      let itemBg = colors.surface;
                      let itemBorder = colors.border;
                      let itemText = colors.textPrimary;

                      if (isAnswered) { itemBg = '#22c55e'; itemBorder = '#22c55e'; itemText = '#fff'; }
                      else if (isReview) { itemBg = '#f59e0b'; itemBorder = '#f59e0b'; itemText = '#fff'; }
                      else if (isMissed) { itemBg = '#ef4444'; itemBorder = '#ef4444'; itemText = '#fff'; }

                      return (
                        <TouchableOpacity 
                          key={q.id} 
                          onPress={() => { 
                            setShowNavigator(false); 
                            setTimeout(() => {
                              if (viewMode === 'card') { 
                                setCurrentIndex(idx); 
                              } else { 
                                listRef.current?.scrollToIndex({ index: idx, animated: true }); 
                              }
                            }, 100);
                          }}
                          style={[
                            styles.paletteItem, 
                            { backgroundColor: itemBg, borderColor: itemBorder },
                            isActive && { borderWidth: 3, borderColor: colors.primary }
                          ]}
                        >
                          <Text style={{ color: itemText, fontWeight: '900' }}>{idx + 1}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* Timer Picker Modal */}
            <Modal visible={showTimerPicker} transparent animationType="fade" onRequestClose={() => setShowTimerPicker(false)}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()}>
                <View style={styles.modalOverlay}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>Timer Setup</Text>
                      <Text style={{ color: colors.textTertiary, marginBottom: 24, fontSize: 13 }}>Choose how you want to track your time.</Text>
                      
                      <View style={{ gap: 12 }}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                          onPress={() => { 
                            router.setParams({ timer: 'stopwatch' });
                            setIsTimerActive(true);
                            setShowTimerPicker(false);
                          }}
                        >
                           <Clock size={20} color={colors.primary} style={{ marginRight: 12 }} />
                           <View>
                             <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Stopwatch</Text>
                             <Text style={{ fontSize: 11, color: colors.textTertiary }}>Count upwards from zero</Text>
                           </View>
                        </TouchableOpacity>

                        <View 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                        >
                           <Target size={20} color={colors.primary} style={{ marginRight: 12 }} />
                           <View style={{ flex: 1 }}>
                             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Exam Timer</Text>
                                <TextInput 
                                  style={{ width: 80, height: 36, backgroundColor: colors.bg, borderRadius: 8, textAlign: 'center', fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                                  placeholder="Mins"
                                  keyboardType="number-pad"
                                  value={customTimeInput}
                                  onChangeText={setCustomTimeInput}
                                  placeholderTextColor={colors.textTertiary}
                                  returnKeyType="done"
                                  onSubmitEditing={(e) => handleStartCountdown(e.nativeEvent.text)}
                                />
                             </View>
                             <Text style={{ fontSize: 11, color: colors.textTertiary }}>{customTimeInput ? `${customTimeInput} mins total` : '2 mins per question (Default)'}</Text>
                           </View>
                        </View>

                        <TouchableOpacity 
                          style={{ flex: 1, height: 50, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
                          onPress={() => handleStartCountdown()}
                        >
                          <Text style={{ color: '#fff', fontWeight: '900' }}>START TIMER</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                          onPress={() => { 
                            router.setParams({ timer: 'none' });
                            setIsTimerActive(false);
                            setShowTimerPicker(false);
                          }}
                        >
                           <XCircle size={20} color={colors.textTertiary} style={{ marginRight: 12 }} />
                           <View>
                             <Text style={{ fontWeight: '800', color: colors.textPrimary }}>No Timer</Text>
                             <Text style={{ fontSize: 11, color: colors.textTertiary }}>Hide all time tracking</Text>
                           </View>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity onPress={() => setShowTimerPicker(false)} style={{ marginTop: 24, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </KeyboardAvoidingView>
                </View>
              </Pressable>
            </Modal>

            {showIndex ? renderQuestionIndex() : (
              viewMode === 'list' ? (
                <FlatList
                  ref={listRef}
                  data={questions}
                  renderItem={renderQuestionBlock}
                  keyExtractor={(item) => item.id}
                  initialScrollIndex={currentIndex >= 0 ? currentIndex : undefined}
                  contentContainerStyle={styles.listContent}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  initialNumToRender={10}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                      listRef.current?.scrollToIndex({ index: info.index, animated: false });
                    });
                  }}
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <ScrollView>{renderQuestionBlock({ item: questions[currentIndex], index: currentIndex })}</ScrollView>
                  <View style={[styles.cardNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))} style={[styles.navBtn, { backgroundColor: colors.surfaceStrong }]} disabled={currentIndex === 0}>
                      <ArrowLeft size={20} color={colors.textPrimary} />
                      <Text style={{ color: colors.textPrimary }}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))} style={[styles.navBtn, { backgroundColor: colors.primary }]} disabled={currentIndex === questions.length - 1}>
                      <Text style={{ color: colors.buttonText }}>Next</Text>
                      <ArrowRight size={20} color={colors.buttonText} />
                    </TouchableOpacity>
                  </View>
                </View>
              )
            )}
          </>
        )}

        {/* Clock Control Modal */}
        <Modal visible={showClockControl} transparent animationType="fade" onRequestClose={() => setShowClockControl(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 20 }]}>Timer Controls</Text>
              
              <View style={{ gap: 12 }}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong }}
                  onPress={() => { setIsTimerActive(!isTimerActive); setShowClockControl(false); }}
                >
                   {isTimerActive ? <XCircle size={20} color={colors.primary} /> : <Target size={20} color={colors.primary} />}
                   <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 12 }}>{isTimerActive ? 'Pause Timer' : 'Resume Timer'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong }}
                  onPress={() => { 
                    if (timerType === 'countdown') {
                      if (customTimeInput) setSeconds(parseInt(customTimeInput) * 60);
                      else setSeconds(questions.length * 120);
                    } else setSeconds(0);
                    setIsTimerActive(true);
                    setShowClockControl(false);
                  }}
                >
                   <Clock size={20} color={colors.primary} />
                   <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 12 }}>Reset Timer</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong }}
                  onPress={() => { setShowClockControl(false); setShowTimerPicker(true); }}
                >
                   <Target size={20} color={colors.primary} />
                   <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 12 }}>Change Setup</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setShowClockControl(false)} style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Save Session Modal */}
        <Modal visible={showSaveSessionModal} transparent animationType="slide" onRequestClose={() => setShowSaveSessionModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>Finish Session</Text>
              <Text style={{ color: colors.textTertiary, marginBottom: 20, fontSize: 13 }}>Give your session a name to save your progress.</Text>
              
              <TextInput 
                style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 16, fontSize: 16, color: colors.textPrimary, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                placeholder="e.g. Agriculture Practice #1"
                placeholderTextColor={colors.textTertiary}
                value={sessionName}
                onChangeText={setSessionName}
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => { setShowSaveSessionModal(false); router.back(); }}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => setShowSaveSessionModal(false)}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1.2, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                  onPress={handleSaveAndExit}
                >
                  <Text style={{ fontWeight: '800', color: '#fff' }}>Save & Exit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* New Tag Modal */}
        <Modal visible={isAddingTag} transparent animationType="fade" onRequestClose={() => setIsAddingTag(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>New Study Tag</Text>
              <TextInput 
                style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 16, fontSize: 16, color: colors.textPrimary, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                placeholder="e.g. TRAP"
                autoFocus
                placeholderTextColor={colors.textTertiary}
                value={newTagText}
                onChangeText={setNewTagText}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => setIsAddingTag(false)}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 2, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                  onPress={handleCreateTag}
                >
                  <Text style={{ fontWeight: '800', color: '#fff' }}>Create Tag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {renderNotebookModal()}
        <SaveNameModal 
          visible={showSaveNameModal}
          onClose={() => setShowSaveNameModal(false)}
          onSave={commitManualSave}
          value={customTestName}
          setValue={setCustomTestName}
          isSaving={isSavingAttempt}
        />

        {/* POST-SUBMISSION SUMMARY MODAL */}
        <Modal visible={!!summary} transparent animationType="fade" onRequestClose={() => {}}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, padding: 30 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Clock color={colors.primary} size={32} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: 24 }]}>Session Completed</Text>
              </View>
              
              <View style={{ gap: 16, marginBottom: 32 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Questions</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>{summary?.totalQuestions}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Attempted</Text>
                  <Text style={{ color: '#22c55e', fontWeight: '800', fontSize: 18 }}>{summary?.attempted}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Skipped</Text>
                  <Text style={{ color: colors.textTertiary, fontWeight: '800', fontSize: 18 }}>{summary?.skipped}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Duration</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>
                    {Math.floor((summary?.durationSec ?? 0) / 60)}m {((summary?.durationSec ?? 0) % 60)}s
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={{ backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center' }}
                onPress={() => {
                  isNavigatingAway.current = true;
                  if (summary?.attemptId) {
                    router.replace({
                      pathname: '/unified/result/[aid]',
                      params: { aid: summary.attemptId }
                    });
                  } else {
                    router.replace('/(tabs)/analyse');
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>VIEW ANALYTICS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PageWrapper>
  );
}

const NotebookModal = (props: any) => {
  const { colors } = props;
  return (
    <Modal visible={props.visible} transparent animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: 60, padding: 0 }}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary }}>Notebook Editor</Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary }}>Capture insights instantly</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                 <TouchableOpacity 
                   onPress={() => props.splitBullet(props.activeInputIndex)}
                   style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceStrong, borderRadius: 14 }}
                 >
                    <Scissors size={20} color={colors.primary} />
                 </TouchableOpacity>
                 <TouchableOpacity 
                   onPress={() => props.addBullet(props.activeInputIndex)}
                   style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceStrong, borderRadius: 14 }}
                 >
                    <Plus size={20} color={colors.primary} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={props.onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                   <X size={26} color={colors.textPrimary} />
                 </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border + '50' }}>
                <TouchableOpacity 
                  onPress={() => props.applyFormatting('bold')}
                  style={{ flex: 1, height: 44, backgroundColor: colors.surfaceStrong, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  <Bold size={18} color={colors.textPrimary} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary }}>BOLD</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => props.applyFormatting('italic')}
                  style={{ flex: 1, height: 44, backgroundColor: colors.surfaceStrong, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  <Italic size={18} color={colors.textPrimary} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary }}>ITALIC</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => props.applyFormatting('highlight')}
                  style={{ flex: 1, height: 44, backgroundColor: colors.primary + '15', borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  <Highlighter size={18} color={colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>MARK</Text>
                </TouchableOpacity>
              </View>

              {props.noteDraftBullets.map((bullet: string, idx: number) => (
                <View key={idx} style={{ marginBottom: 16, backgroundColor: colors.bg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border }}>
                  <TextInput
                    style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}
                    multiline
                    value={bullet}
                    placeholder="Capture your thought..."
                    placeholderTextColor={colors.textTertiary}
                    onChangeText={(t) => props.updateBullet(idx, t)}
                    onSelectionChange={(e) => {
                      props.setSelection(e.nativeEvent.selection);
                      props.setActiveInputIndex(idx);
                    }}
                  />
                </View>
              ))}

              <View style={{ height: 40 }} />
              <Text style={[styles.modalLabel, { color: colors.textTertiary, letterSpacing: 1 }]}>SAVE TO LOCATION</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 12 }}>Select a folder and notebook below</Text>
              <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 12 }}>Keyboard must be closed to select folder.</Text>
              <ScrollView horizontal style={{ marginBottom: 16 }}>
                {props.folders.map((f: any) => (
                  <TouchableOpacity key={f.id} onPress={() => props.setSelectedFolder(f)} style={[styles.modalChip, { borderColor: colors.border }, props.selectedFolder?.id === f.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={{ color: props.selectedFolder?.id === f.id ? '#fff' : colors.textPrimary }}>{f.title}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => props.setShowNewFolderInput(true)} style={[styles.modalChip, { borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 12, justifyContent: 'center' }]}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>+ New Folder</Text>
                </TouchableOpacity>
              </ScrollView>

              {props.showNewFolderInput && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TextInput 
                    style={{ flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, color: colors.textPrimary }}
                    placeholder="Folder Name"
                    placeholderTextColor={colors.textTertiary}
                    value={props.newFolderName}
                    onChangeText={props.setNewFolderName}
                  />
                  <TouchableOpacity onPress={props.createNewFolder} style={{ width: 40, height: 40, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {props.selectedFolder && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>NOTEBOOK</Text>
                  <ScrollView horizontal style={{ marginBottom: 16 }}>
                    {props.notebooks.map((n: any) => (
                      <TouchableOpacity key={n.id} onPress={() => props.setSelectedNotebook(n)} style={[styles.modalChip, { borderColor: colors.border }, props.selectedNotebook?.id === n.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        <Text style={{ color: props.selectedNotebook?.id === n.id ? '#fff' : colors.textPrimary }}>{n.title}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => props.setShowNewNotebookInput(true)} style={[styles.modalChip, { borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 12, justifyContent: 'center' }]}>
                      <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>+ New Notebook</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {props.showNewNotebookInput && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                      <TextInput 
                        style={{ flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, color: colors.textPrimary }}
                        placeholder="Notebook Name"
                        placeholderTextColor={colors.textTertiary}
                        value={props.newNotebookName}
                        onChangeText={props.setNewNotebookName}
                      />
                      <TouchableOpacity onPress={props.createNewNotebook} style={{ width: 40, height: 40, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {props.selectedNotebook && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>SUBHEADING</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {(() => {
                      const micro = props.microtopic;
                      const last = props.selectedSubheading;
                      const others = (props.subheadings || []).filter((s: string) => s !== micro && s !== last);
                      
                      const list = [];
                      if (micro) list.push(micro);
                      if (last && last !== micro) list.push(last);
                      list.push(...others);
                      
                      return list.map((s: string) => (
                        <TouchableOpacity 
                          key={s} 
                          onPress={() => { props.setSelectedSubheading(s); props.setCustomSubheading(''); }} 
                          style={[
                            styles.modalChip, 
                            { borderColor: colors.border }, 
                            props.selectedSubheading === s && { backgroundColor: colors.primary, borderColor: colors.primary },
                            s === props.microtopic && props.selectedSubheading !== s && { borderColor: colors.primary + '50', borderStyle: 'dashed' }
                          ]}
                        >
                          <Text style={{ color: props.selectedSubheading === s ? '#fff' : colors.textPrimary, fontWeight: s === props.microtopic ? '900' : '500' }}>
                            {s} {s === props.microtopic ? '(Topic)' : ''}
                          </Text>
                        </TouchableOpacity>
                      ));
                    })()}
                    <TouchableOpacity onPress={() => props.setShowCustomSubheadingInput(true)} style={[styles.modalChip, { borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 12, justifyContent: 'center' }]}>
                      <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>+ Custom</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {(props.showCustomSubheadingInput || props.customSubheading || props.subheadings.length === 0) && (
                    <View style={{ marginBottom: 16 }}>
                      <TextInput 
                        style={{ flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, color: colors.textPrimary }}
                        placeholder="Custom Subheading (e.g. Microtopic)"
                        placeholderTextColor={colors.textTertiary}
                        value={props.customSubheading}
                        onChangeText={(t) => { props.setCustomSubheading(t); props.setSelectedSubheading(''); }}
                      />
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity onPress={props.onSave} style={[styles.launchBtn, { backgroundColor: colors.primary }]}>
                {props.isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>SAVE</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  progressText: { fontSize: 12, fontWeight: '800' },
  menuBtn: { padding: 8, borderRadius: 10 },
  exitBtn: { padding: 8 },
  listContent: { padding: 16 },
  questionCard: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 16 },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  qNumberBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qNumberText: { fontWeight: '900' },
  qMetaText: { fontSize: 10, fontWeight: '800' },
  inlineBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  optionsContainer: { marginVertical: 20, gap: 12 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  optionLabel: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionLabelText: { fontSize: 14, fontWeight: '900' },
  optionText: { fontSize: 15, flex: 1 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginBottom: 20, gap: 8 },
  revealBtnText: { fontWeight: '800' },
  controls: { borderTopWidth: 1, paddingTop: 16 },
  controlRow: { marginBottom: 16 },
  controlLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  chipScroll: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
  difficultyRow: { flexDirection: 'row', gap: 10 },
  difficultyBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  difficultyText: { fontSize: 11, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  noteSection: { marginBottom: 20 },
  noteInputWrapper: { padding: 12, borderRadius: 12, borderWidth: 1, minHeight: 60 },
  noteInput: { fontSize: 14 },
  commitBtnContainer: { height: 50, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  commitBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  commitBtnText: { color: '#fff', fontWeight: '900' },
  explanationBox: { padding: 16, borderRadius: 16, gap: 8 },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explanationTitle: { fontSize: 11, fontWeight: '900' },
  verticalMenu: { position: 'absolute', top: 70, right: 16, width: 50, borderRadius: 20, padding: 10, gap: 16, alignItems: 'center', elevation: 15, zIndex: 9999 },
  utilBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fontPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  sliderRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  sizeBubble: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  paletteItem: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardNav: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 30, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalLabel: { fontSize: 10, fontWeight: '900', marginBottom: 8 },
  modalInput: { borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 16 },
  modalChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  launchBtn: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  indexHeader: { padding: 20, borderBottomWidth: 1 },
  indexTitle: { fontSize: 20, fontWeight: '900' },
  indexSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  indexItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  indexNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  indexSnippet: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1 },
  pageBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  headerBtn: { padding: 8, borderRadius: 12 },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 4 },
  floatingZenExit: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 9999,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(67, 52, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  }
});

const SaveNameModal = ({ visible, onClose, onSave, value, setValue, isSaving }: any) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, width: '85%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Save Session</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          
          <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 13 }}>Give this attempt a name to find it in your history later.</Text>
          
          <TextInput 
            style={{ backgroundColor: colors.surfaceStrong, color: colors.textPrimary, borderColor: colors.border, height: 50, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1 }}
            placeholder="e.g. Modern History Revision"
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={setValue}
            autoFocus
          />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity 
              style={{ flex: 1, padding: 14, alignItems: 'center' }} 
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={{ color: colors.textTertiary, fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 2, padding: 14, backgroundColor: isSaving ? colors.primary + '80' : colors.primary, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }} 
              onPress={() => onSave(value)}
              disabled={isSaving}
            >
              {isSaving && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '900' }}>{isSaving ? 'Saving...' : 'Save Attempt'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
