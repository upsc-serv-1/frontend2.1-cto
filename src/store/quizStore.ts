import { create } from 'zustand';
import { StudentSync } from '../services/StudentSync';
import { supabase } from '../lib/supabase';
import { uuidv4 } from '../utils/uuid';


interface QuizState {
  activeTestId: string | null;
  activeAttemptId: string | null;
  userId: string | null;
  // questionId -> { selectedAnswer, confidence, timeSpentSeconds, difficulty, errorCategory, note, isReview, isBookmarked }
  answers: Record<string, {
    selectedAnswer: string | null;
    confidence: string | null;
    timeSpentSeconds: number;
    difficulty: string | null;
    errorCategory: string | null;
    note: string | null;
    isReview?: boolean;
    isBookmarked?: boolean;
    studyTags?: string[];
  }>;
  isSyncing: boolean;

  // Actions
  startTest: (testId: string, userId: string, attemptId?: string) => void;
  setAnswer: (questionId: string, answer: string | null, confidence?: string | null) => void;
  setMetadata: (questionId: string, patch: { difficulty?: string | null; errorCategory?: string | null; note?: string | null; isReview?: boolean; isBookmarked?: boolean; studyTags?: string[] }, autoSync?: boolean) => void;
  incrementTime: (questionId: string) => void;
  syncAnswer: (questionId: string) => void;
  loadStates: (questionIds: string[], loadAnswers?: boolean) => Promise<void>;
}

// Map to track debounced sync timeouts per question
const syncTimeouts: Record<string, NodeJS.Timeout> = {};

export const useQuizStore = create<QuizState>((set, get) => ({
  activeTestId: null,
  activeAttemptId: null,
  userId: null,
  answers: {},
  isSyncing: false,

  startTest: (testId, userId, attemptId) => {
    const current = get();
    if (current.activeTestId === testId && current.userId === userId && current.activeAttemptId === attemptId) return;
    set({
      activeTestId: testId,
      activeAttemptId: attemptId || uuidv4(),
      userId,
      answers: {},
    });
  },

  setAnswer: (questionId, answer, confidence) => {
    set((state) => {
      const current = state.answers[questionId] || { 
        selectedAnswer: null, 
        confidence: null, 
        timeSpentSeconds: 0,
        difficulty: null,
        errorCategory: null,
        note: null,
        isReview: false,
        isBookmarked: false
      };
      const newAnswers = {
        ...state.answers,
        [questionId]: {
          ...current,
          selectedAnswer: answer !== undefined ? answer : current.selectedAnswer,
          confidence: confidence !== undefined ? confidence : current.confidence,
        },
      };

      return { answers: newAnswers };
    });

    // Trigger debounced sync outside set() so it reads the new state
    get().syncAnswer(questionId);
  },

  setMetadata: (questionId, patch, autoSync = true) => {
    set((state) => {
      const current = state.answers[questionId] || { 
        selectedAnswer: null, 
        confidence: null, 
        timeSpentSeconds: 0,
        difficulty: null,
        errorCategory: null,
        note: null,
        isReview: false,
        isBookmarked: false,
        studyTags: []
      };
      const newAnswers = {
        ...state.answers,
        [questionId]: {
          ...current,
          ...patch
        },
      };

      return { answers: newAnswers };
    });
    
    // Trigger sync outside set() so it reads the new state
    if (autoSync) {
      get().syncAnswer(questionId);
    }
  },

  incrementTime: (questionId) => {
    set((state) => {
      const current = state.answers[questionId] || { 
        selectedAnswer: null, 
        confidence: null, 
        timeSpentSeconds: 0,
        difficulty: null,
        errorCategory: null,
        note: null
      };
      return {
        answers: {
          ...state.answers,
          [questionId]: {
            ...current,
            timeSpentSeconds: current.timeSpentSeconds + 1,
          },
        },
      };
    });
  },

  syncAnswer: (questionId) => {
    const state = get();
    const { activeTestId, activeAttemptId, userId, answers } = state;
    const answerData = answers[questionId];

    if (!activeTestId || !activeAttemptId || !userId || !answerData) return;

    if (syncTimeouts[questionId]) {
      clearTimeout(syncTimeouts[questionId]);
    }

    syncTimeouts[questionId] = setTimeout(async () => {
      set({ isSyncing: true });
      try {
        // Ensure the test exists first to avoid FK violation
        await supabase.from('tests').upsert({
          id: activeTestId,
          title: activeTestId.startsWith('custom_') ? 'Custom Practice' : 'Mock Test',
          provider: 'App'
        }, { onConflict: 'id' });

        await StudentSync.enqueue('question_state', {
          userId,
          attemptId: activeAttemptId,
          questionId,
          testId: activeTestId,
          patch: {
            selected_answer: answerData.selectedAnswer,
            confidence: answerData.confidence,
            time_spent_seconds: answerData.timeSpentSeconds,
            review_difficulty: answerData.difficulty,
            error_category: answerData.errorCategory,
            note: answerData.note, // Will map to highlight_text in StudentSync
            is_review: answerData.isReview,
            is_bookmarked: answerData.isBookmarked,
            review_tags: answerData.studyTags || []
          }
        });
      } catch (err) {
        console.error('[Sync] Pre-sync upsert failed', err);
      } finally {
        set({ isSyncing: false });
        delete syncTimeouts[questionId];
      }
    }, 500);
  },
  
  loadStates: async (questionIds, loadAnswers = true) => {
    const { userId } = get();
    if (!userId || !questionIds || questionIds.length === 0) return;

    // Filter and unique
    const validIds = Array.from(new Set(questionIds.filter(id => id && typeof id === 'string'))).filter(Boolean);
    if (validIds.length === 0) return;

    const CHUNK_SIZE = 100;
    const allStates: any[] = [];

    try {
      for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
        const chunk = validIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabase
          .from('question_states')
          .select('*')
          .eq('user_id', userId)
          .in('question_id', chunk);

        if (error) {
          console.error(`[QuizStore] Failed to load states chunk ${i}`, error);
          continue;
        }
        if (data) allStates.push(...data);
      }
    } catch (err) {
      console.error('[QuizStore] Exception in loadStates', err);
    }

    if (allStates.length > 0) {
      set((state) => {
        const newAnswers = { ...state.answers };
        allStates.forEach(s => {
          const current = newAnswers[s.question_id] || {
            selectedAnswer: null,
            confidence: null,
            timeSpentSeconds: 0,
            difficulty: null,
            errorCategory: null,
            note: null,
            isReview: false,
            isBookmarked: false,
            studyTags: []
          };

          newAnswers[s.question_id] = {
            ...current,
            selectedAnswer: loadAnswers ? (s.selected_answer || null) : current.selectedAnswer,
            confidence: loadAnswers ? (s.confidence || null) : current.confidence,
            timeSpentSeconds: loadAnswers ? (s.time_spent_seconds || 0) : current.timeSpentSeconds,
            difficulty: s.difficulty_level || current.difficulty,
            errorCategory: s.error_category || current.errorCategory,
            note: s.note || s.highlight_text || current.note,
            isReview: s.is_review || current.isReview,
            isBookmarked: s.is_bookmarked || current.isBookmarked,
            studyTags: s.review_tags || current.studyTags
          };
        });
        return { answers: newAnswers };
      });
    }
  },
}));
