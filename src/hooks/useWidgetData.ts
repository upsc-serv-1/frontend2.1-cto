import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { OfflineManager } from '../services/OfflineManager';

export interface WidgetData {
  loading: boolean;
  todayCount: number;
  todayCorrect: number;
  todayIncorrect: number;
  todayTimeSeconds: number;
  totalAttempted: number;
  totalCorrect: number;
  weeklyActivity: { day: string; count: number }[];
  accuracyByDay: { day: string; accuracy: number }[];
  subjectAccuracy: { subject: string; correct: number; total: number; accuracy: number }[];
  avgSpeed: number;
  dueCards: number;
  totalCards: number;
  masteredCards: number;
  learningCards: number;
  taggedCount: number;
  uniqueTags: number;
  recentNotes: { id: string; title: string; updated_at: string }[];
  recentAttempts: { id: string; title: string; score: number; total: number; submitted_at: string }[];
  pyqYears: { year: number; done: boolean }[];
}

const EMPTY: WidgetData = {
  loading: true, todayCount: 0, todayCorrect: 0, todayIncorrect: 0,
  todayTimeSeconds: 0, totalAttempted: 0, totalCorrect: 0,
  weeklyActivity: [], accuracyByDay: [], subjectAccuracy: [],
  avgSpeed: 0, dueCards: 0, totalCards: 0, masteredCards: 0, learningCards: 0,
  taggedCount: 0, uniqueTags: 0, recentNotes: [], recentAttempts: [], pyqYears: [],
};

function todayStr() { return new Date().toISOString().split('T')[0]; }
function dayStr(d: Date) { return d.toISOString().split('T')[0]; }

export function useWidgetData(userId: string | undefined) {
  const [data, setData] = useState<WidgetData>(EMPTY);

  const refresh = useCallback(async () => {
    if (!userId) return;

    const processData = (states: any[], cards: any[], notes: any[], attempts: any[]) => {
      const today = todayStr();
      const todayStates = states.filter(s => s.updated_at?.startsWith(today));
      const todayCorrect = todayStates.filter(s => s.is_incorrect_last_attempt === false).length;
      const todayIncorrect = todayStates.filter(s => s.is_incorrect_last_attempt === true).length;

      // 1. Calculate Today's Time
      const todayAttempts = attempts.filter(a => a.submitted_at?.startsWith(today));
      const todayTimeSeconds = todayAttempts.reduce((acc, a) => acc + (a.duration_seconds || 0), 0);

      // 2. Weekly Activity
      const weeklyMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        weeklyMap[dayStr(d)] = 0;
      }
      states.forEach(s => {
        const d = s.updated_at?.split('T')[0];
        if (d && weeklyMap[d] !== undefined) weeklyMap[d]++;
      });

      // 3. Accuracy Trend
      const dayBuckets: Record<string, { c: number; t: number }> = {};
      Object.keys(weeklyMap).forEach(d => { dayBuckets[d] = { c: 0, t: 0 }; });
      states.forEach(s => {
        const d = s.updated_at?.split('T')[0];
        if (d && dayBuckets[d]) {
          dayBuckets[d].t++;
          if (s.is_incorrect_last_attempt === false) dayBuckets[d].c++;
        }
      });

      // 4. Subject Accuracy
      const subMap: Record<string, { c: number; t: number }> = {};
      states.forEach(s => {
        const sub = s.subject || 'Unknown';
        if (!subMap[sub]) subMap[sub] = { c: 0, t: 0 };
        subMap[sub].t++;
        if (s.is_incorrect_last_attempt === false) subMap[sub].c++;
      });

      // 5. Speed (Seconds per question)
      const avgSpeed = attempts.length > 0 
        ? Math.round(attempts.reduce((acc, a) => acc + (a.duration_seconds || 0), 0) / attempts.reduce((acc, a) => acc + (a.total || 1), 0))
        : 0;

      // 6. Tags
      const taggedStates = states.filter(s => s.review_tags && Array.isArray(s.review_tags) && s.review_tags.length > 0);
      const allTags = new Set<string>();
      taggedStates.forEach(s => (s.review_tags || []).forEach((t: string) => allTags.add(t)));

      const now = new Date();
      const dueCardsCount = cards.filter(c => c.status === 'active' && (!c.next_review || new Date(c.next_review) <= now)).length;

      // 7. PYQ Years Coverage (derived from attempts with UPSC titles)
      const coveredYears = new Set(
        attempts
          .filter(a => a.title?.toLowerCase().includes('upsc'))
          .map(a => {
            const match = a.title?.match(/20\d{2}/);
            return match ? parseInt(match[0]) : null;
          })
          .filter(Boolean)
      );

      return {
        loading: false,
        todayCount: todayStates.length,
        todayCorrect,
        todayIncorrect,
        todayTimeSeconds,
        totalAttempted: states.length,
        totalCorrect: states.filter(s => s.is_incorrect_last_attempt === false).length,
        weeklyActivity: Object.entries(weeklyMap).map(([day, count]) => ({ day, count })),
        accuracyByDay: Object.entries(dayBuckets).map(([day, v]) => ({ day, accuracy: v.t > 0 ? Math.round((v.c / v.t) * 100) : 0 })),
        subjectAccuracy: Object.entries(subMap).map(([subject, v]) => ({ subject, correct: v.c, total: v.t, accuracy: v.t > 0 ? Math.round((v.c / v.t) * 100) : 0 })).sort((a, b) => a.accuracy - b.accuracy),
        avgSpeed,
        dueCards: dueCardsCount,
        totalCards: cards.length,
        masteredCards: cards.filter(c => c.learning_status === 'mastered').length,
        learningCards: cards.filter(c => c.learning_status === 'learning').length,
        taggedCount: taggedStates.length,
        uniqueTags: allTags.size,
        recentNotes: notes as any,
        recentAttempts: attempts as any,
        pyqYears: Array.from({ length: 11 }, (_, i) => {
          const year = 2015 + i;
          return { year, done: coveredYears.has(year) };
        }),
      };
    };

    try {
      // 1. FAST: Load from local cache first
      let lStates: any[] = [], lCards: any[] = [], lNotes: any[] = [], lAttempts: any[] = [];
      
      try {
        if (typeof OfflineManager !== 'undefined' && OfflineManager) {
          [lStates, lCards, lNotes, lAttempts] = await Promise.all([
            OfflineManager.getOfflineUserStates(userId),
            OfflineManager.getOfflineCards(userId),
            OfflineManager.getOfflineNotes(userId),
            OfflineManager.getOfflineAttempts(userId),
          ]);
        }
      } catch (e) {
        console.warn('[WidgetData] Offline fetch failed', e);
      }

      if (lStates.length > 0 || lCards.length > 0 || lNotes.length > 0 || lAttempts.length > 0) {
        setData(processData(lStates, lCards, lNotes, lAttempts));
      }

      // 2. FRESH: Background fetch from server
      const [statesRes, cardsRes, notesRes, attemptsRes] = await Promise.all([
        supabase.from('question_states').select('question_id, is_incorrect_last_attempt, updated_at, subject, review_tags').eq('user_id', userId),
        supabase.from('user_cards').select('id, learning_status, next_review, status').eq('user_id', userId),
        supabase.from('user_notes').select('id, title, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(5),
        supabase.from('test_attempts').select('id, title, score, total, submitted_at').eq('user_id', userId).order('submitted_at', { ascending: false }).limit(5),
      ]);

      if (!statesRes.error && !cardsRes.error && !notesRes.error && !attemptsRes.error) {
        setData(processData(statesRes.data || [], cardsRes.data || [], notesRes.data || [], attemptsRes.data || []));
      }
    } catch (err) {
      console.error('[WidgetData] Main refresh error:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, refresh };
}
