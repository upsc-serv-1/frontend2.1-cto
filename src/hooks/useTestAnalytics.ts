import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { buildDecisionMetrics, computeScore, QuestionAttempt } from '../lib/analytics-utils';
import {
  buildAggregateHierarchicalAccuracy,
  buildHierarchicalPerformanceReport,
  buildAggregateTestTrends,
  evaluateRepeatedWeaknesses,
  HierarchicalPerformance,
} from '../lib/hierarchical-analytics';
import { OfflineManager } from '../services/OfflineManager';

type AttemptPayloadQuestion = {
  question_id?: string;
  questionId?: string;
  selected_answer?: string | null;
  selectedAnswer?: string | null;
  confidence?: string | null;
  difficulty_level?: string | null;
  difficultyLevel?: string | null;
  error_category?: string | null;
  errorCategory?: string | null;
  review_tags?: string[] | null;
  reviewTags?: string[] | null;
  time_spent_seconds?: number | null;
  timeSpentSeconds?: number | null;
};

const normalizeAttemptPayload = (attempt: any): AttemptPayloadQuestion[] => {
  const rawQuestions = attempt?.attempt_payload?.questions;
  if (Array.isArray(rawQuestions)) return rawQuestions;
  if (rawQuestions && typeof rawQuestions === 'object') {
    return Object.entries(rawQuestions).map(([questionId, value]: [string, any]) => ({
      question_id: questionId,
      ...value,
    }));
  }
  return [];
};

const normalizeConfidence = (confidence: string | null | undefined) => {
  const value = String(confidence || '').toLowerCase();
  if (value === 'sure' || value === '100% sure') return '100% Sure';
  if (value === 'logical' || value === 'logical elimination') return 'Logical Elimination';
  if (value === 'guess' || value === 'pure guess') return 'Pure Guess';
  if (value === 'funda' || value === 'upsc funda') return 'UPSC Funda';
  return confidence || undefined;
};

const normalizeDifficulty = (difficulty: string | null | undefined) => {
  const value = String(difficulty || '').toLowerCase();
  if (value === 'easy') return 'Easy';
  if (value === 'medium' || value === 'moderate') return 'Medium';
  if (value === 'hard') return 'Hard';
  return undefined;
};

const buildQuestionAttempts = (rows: AttemptPayloadQuestion[], questionsMeta: Record<string, any>, fallbackTestId?: string) => {
  const totalQuestions = rows.length;
  return rows
    .filter(row => row.question_id || row.questionId)
    .map((row, index) => {
      const questionId = String(row.question_id || row.questionId);
      const meta = questionsMeta[questionId] || {};
      
      // Calculate fatigue group (1 for first half, 2 for second half)
      const attemptHour = index < totalQuestions / 2 ? 1 : 2;

      return {
        id: questionId,
        testId: fallbackTestId,
        subject: meta.subject || 'General',
        sectionGroup: meta.section_group || 'General',
        microTopic: meta.micro_topic || 'Unmapped',
        selectedAnswer: row.selected_answer ?? row.selectedAnswer ?? undefined,
        correctAnswer: meta.correct_answer,
        confidence: normalizeConfidence(row.confidence),
        difficultyLevel: normalizeDifficulty(row.difficulty_level ?? row.difficultyLevel),
        errorCategory: row.error_category ?? row.errorCategory ?? undefined,
        reviewTags: row.review_tags ?? row.reviewTags ?? [],
        timeSpentSeconds: Number(row.time_spent_seconds ?? row.timeSpentSeconds ?? 0),
        attemptHour
      } as QuestionAttempt;
    });
};

const fetchQuestionsMeta = async (questionIds: string[]) => {
  if (questionIds.length === 0) return {};
  
  const CHUNK_SIZE = 200;
  const meta: Record<string, any> = {};
  
  for (let i = 0; i < questionIds.length; i += CHUNK_SIZE) {
    const chunk = questionIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject, section_group, micro_topic, correct_answer, question_text, explanation_markdown')
      .in('id', chunk);

    if (error) throw error;
    
    (data || []).forEach(row => {
      meta[String(row.id)] = row;
    });
  }

  return meta;
};

export function useSingleTestAnalytics(testAttemptId: string | null) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [scoreData, setScoreData] = useState<{
    totalMarks: string;
    accuracy: number;
    attemptQualityScore: number;
    qualityLabel: string;
    correct: number;
    incorrect: number;
    unattempted: number;
    totalTimeSeconds: number;
    avgTimePerQuestion: number;
  } | null>(null);
  const [questions, setQuestions] = useState<QuestionAttempt[]>([]);
  const [testId, setTestId] = useState<string | null>(null);
  const [hierarchicalPerformance, setHierarchicalPerformance] = useState<HierarchicalPerformance | null>(null);
  const [confidenceMetrics, setConfidenceMetrics] = useState<any[]>([]);

  useEffect(() => {
    if (!testAttemptId) {
      setScoreData(null);
      setHierarchicalPerformance(null);
      setConfidenceMetrics([]);
      setQuestions([]);
      setTestId(null);
      return;
    }

    const fetchSingleTest = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Try Offline First
        const offlineAttempts = await OfflineManager.getOfflineAttempts(session?.user?.id || '');
        let attempt = offlineAttempts.find(a => a.id === testAttemptId);

        if (!attempt) {
          // 2. Fetch from Supabase if not found locally
          const { data, error: attemptError } = await supabase
            .from('test_attempts')
            .select('*')
            .eq('id', testAttemptId)
            .single();
          if (attemptError) throw attemptError;
          attempt = data;
        }

        setTestId(attempt.test_id);

        let payloadRows = normalizeAttemptPayload(attempt);

        // Fallback for legacy attempts that predate stored payloads.
        if (payloadRows.length === 0) {
          const { data: states, error: statesError } = await supabase
            .from('question_states')
            .select('*')
            .eq('attempt_id', attempt.id)
            .eq('user_id', attempt.user_id);
          if (statesError) throw statesError;
          payloadRows = (states || []).map((state: any) => ({
            question_id: state.question_id,
            selected_answer: state.selected_answer,
            confidence: state.confidence,
            difficulty_level: state.difficulty_level,
            error_category: state.error_category,
            review_tags: state.review_tags,
            time_spent_seconds: state.time_spent_seconds,
          }));
        }

        const questionIds = Array.from(new Set(payloadRows.map(row => String(row.question_id || row.questionId || '')).filter(Boolean)));
        const questionsMeta = await fetchQuestionsMeta(questionIds);
        const questionsData = buildQuestionAttempts(payloadRows, questionsMeta, attempt.id);

        if (questionsData.length === 0) {
          setScoreData(null);
          setHierarchicalPerformance(null);
          setConfidenceMetrics([]);
          setQuestions([]);
          return;
        }

        const totalTimeSeconds = attempt.attempt_payload?.duration_seconds ?? 
                                questionsData.reduce((sum, question) => sum + (question.timeSpentSeconds || 0), 0);
        const computedScore = computeScore(questionsData);
        const hierarchy = buildHierarchicalPerformanceReport(questionsData);
        const confidence = buildDecisionMetrics(questionsData);

        setScoreData({
          ...computedScore,
          totalTimeSeconds,
          avgTimePerQuestion: questionsData.length ? Math.round(totalTimeSeconds / questionsData.length) : 0,
        });
        setHierarchicalPerformance(hierarchy);
        setConfidenceMetrics(confidence);
        setQuestions(questionsData);
      } catch (err: any) {
        console.error('[useSingleTestAnalytics] Error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSingleTest();
  }, [testAttemptId]);

  return { loading, error, scoreData, hierarchicalPerformance, confidenceMetrics, questions, testId };
}



export function useAggregateTestAnalytics(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [trends, setTrends] = useState<{ historicalScores: any[]; negativeMarkingTrends: any[] } | null>(null);
  const [cumulativeHierarchy, setCumulativeHierarchy] = useState<HierarchicalPerformance | null>(null);
  const [repeatedWeaknesses, setRepeatedWeaknesses] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchAggregate = async () => {
      // 0. Load from Cache First for instant UI
      const cacheKey = `analytics_cache_${userId}`;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setTrends(parsed.trends);
          setCumulativeHierarchy(parsed.cumulativeHierarchy);
          setRepeatedWeaknesses(parsed.repeatedWeaknesses);
          // If we have cache, we don't show the big loading spinner
          // but we still fetch in background to stay fresh
        } else {
          setLoading(true);
        }
      } catch (e) {
        setLoading(true);
      }

      setError(null);
      try {
        // 1. Fetch attempts (Offline + Remote)
        let attempts = await OfflineManager.getOfflineAttempts(userId);
        const { data: remoteData } = await supabase
          .from('test_attempts')
          .select('id, submitted_at, attempt_payload, score')
          .eq('user_id', userId)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: true });

        if (remoteData) {
          attempts = remoteData;
        }

        if (!attempts || attempts.length === 0) {
          setLoading(false);
          return;
        }

        // Check if data actually changed before doing heavy recomputation
        const lastAttemptId = attempts[attempts.length - 1]?.id;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.lastAttemptId === lastAttemptId && parsed.attemptsCount === attempts.length) {
            setLoading(false);
            return; // Cache is still valid and up-to-date
          }
        }

        const questionIds = Array.from(
          new Set(
            attempts
              .flatMap((attempt: any) => normalizeAttemptPayload(attempt))
              .map(row => String(row.question_id || row.questionId || ''))
              .filter(Boolean)
          )
        );
        const questionsMeta = await fetchQuestionsMeta(questionIds);

        const allQuestions: QuestionAttempt[] = [];
        const attemptRowsForTrend: any[] = [];

        attempts.forEach((attempt: any) => {
          const rows = normalizeAttemptPayload(attempt);
          const questions = buildQuestionAttempts(rows, questionsMeta, attempt.id);
          allQuestions.push(...questions);

          const computed = questions.length > 0 ? computeScore(questions) : null;
          const totalDuration = attempt.attempt_payload?.duration_seconds ?? 
                                questions.reduce((sum, q) => sum + (q.timeSpentSeconds || 0), 0);

          attemptRowsForTrend.push({
            test_id: attempt.id,
            submitted_at: attempt.submitted_at,
            score: computed ? Number(computed.totalMarks) : (attempt.score || 0),
            accuracy: computed ? computed.accuracy : 0,
            correct_count: computed ? computed.correct : 0,
            incorrect_count: computed ? computed.incorrect : 0,
            unattempted_count: computed ? computed.unattempted : 0,
            totalTimeSeconds: totalDuration,
          });
        });

        const newTrends = buildAggregateTestTrends(attemptRowsForTrend);
        const cumulative = buildAggregateHierarchicalAccuracy(allQuestions);
        const newRepeated = evaluateRepeatedWeaknesses(attemptRowsForTrend, allQuestions);

        setTrends(newTrends);
        setCumulativeHierarchy(cumulative);
        setRepeatedWeaknesses(newRepeated);

        // Save to cache
        await AsyncStorage.setItem(cacheKey, JSON.stringify({
          trends: newTrends,
          cumulativeHierarchy: cumulative,
          repeatedWeaknesses: newRepeated,
          lastAttemptId,
          attemptsCount: attempts.length
        }));

      } catch (err: any) {
        console.error('[useAggregateTestAnalytics] Error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAggregate();
  }, [userId]);

  return { loading, error, trends, cumulativeHierarchy, repeatedWeaknesses };
}
