import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import {
  CheckCircle2, XCircle, MinusCircle, Clock, Zap, Target,
  RefreshCw, Filter, BookOpen, Award, ChevronRight,
} from 'lucide-react-native';
import { supabase } from '../../../src/lib/supabase';
import { colors as defaultColors, radius, spacing } from '../../../src/theme';
import { useTheme } from '../../../src/context/ThemeContext';
import { useAuth } from '../../../src/context/AuthContext';
import { PageWrapper } from '../../../src/components/PageWrapper';
import { FlashcardSvc } from '../../../src/services/FlashcardService';
import { StudentSync } from '../../../src/services/StudentSync';
import { Alert } from 'react-native';

type AttemptRow = {
  id: string;
  user_id: string;
  test_id: string;
  score: number;
  attempt_payload: any;
  started_at: string | null;
  submitted_at: string;
  tests?: { title: string; question_count: number };
};

type QuestionStateRow = {
  id: string;
  question_id: string;
  selected_answer: string | null;
  time_spent_seconds: number | null;
  review_tags: string[] | null;
  error_category: string | null;
  confidence: string | null;
};

type QuestionRow = {
  id: string;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_markdown: string | null;
  subject: string | null;
  micro_topic: string | null;
  is_pyq: boolean | null;
};

type FilterKey = 'all' | 'incorrect' | 'not_attempted' | 'pyq' | 'imp_fact' | 'must_revise' | 'tricky';

const LEARNING_TAGS: { key: FilterKey; label: string }[] = [
  { key: 'imp_fact', label: 'Imp. Fact' },
  { key: 'must_revise', label: 'Must Revise' },
  { key: 'tricky', label: 'Tricky' },
];

const ERROR_TYPES = ['Fact Mistake', 'Concept Gap', 'Silly Mistake', 'Overthinking', 'Skipped'];
const REVIEW_TAGS = ['Imp. Fact', 'Imp. Concept', 'Trap Question', 'Must Revise', 'Memorize'];

export default function ResultScreen() {
  const { aid } = useLocalSearchParams<{ aid: string }>();
  const { colors } = useTheme();
  const { session } = useAuth();
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [states, setStates] = useState<QuestionStateRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    (async () => {
      try {
        // 1. Try fetching from Supabase (without fragile tests join)
        const { data: a, error: attemptError } = await supabase
          .from('test_attempts')
          .select('*')
          .eq('id', aid)
          .single();

        if (attemptError || !a) {
          console.warn('[Result] Attempt not found in DB, trying local cache');
          // 2. Fallback: Try OfflineManager local cache
          const { OfflineManager } = require('../../../src/services/OfflineManager');
          const localAttempts = await OfflineManager.getOfflineAttempts(session?.user?.id || '');
          const localAttempt = localAttempts.find((la: any) => la.id === aid);
          if (localAttempt) {
            setAttempt(localAttempt as any);
          } else {
            console.error('[Result] Attempt not found locally either');
            setLoading(false);
            return;
          }
        } else {
          // Optionally fetch test title (non-blocking)
          if (a.test_id) {
            const { data: testInfo } = await supabase
              .from('tests')
              .select('title, question_count')
              .eq('id', a.test_id)
              .maybeSingle();
            if (testInfo) {
              (a as any).tests = testInfo;
            }
          }
          setAttempt(a as any);
        }

        const currentAttempt = a || attempt;
        const payloadQs: any[] = currentAttempt?.attempt_payload?.questions ?? [];
        const ids = payloadQs.map((p: any) => p.question_id).filter(Boolean);

        if (ids.length) {
          const [{ data: qs }, { data: qstates }] = await Promise.all([
            supabase
              .from('questions')
              .select('id, question_text, options, correct_answer, explanation_markdown, subject, micro_topic, is_pyq')
              .in('id', ids),
            supabase
              .from('question_states')
              .select('id, question_id, selected_answer, time_spent_seconds, review_tags, error_category, confidence')
              .eq('attempt_id', aid)
              .eq('user_id', session?.user.id ?? currentAttempt?.user_id),
          ]);
          setQuestions((qs ?? []) as any);
          setStates((qstates ?? []) as any);
        }
      } catch (err) {
        console.error('[Result] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [aid, session?.user.id]);

  const handleTagError = async (questionId: string, errorType: string) => {
    if (!attempt || !session?.user?.id) return;
    
    // 1. Update local state
    setAttempt(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const payloadQs = next.attempt_payload?.questions || [];
      const q = payloadQs.find((x: any) => x.question_id === questionId);
      if (q) q.error_category = errorType;
      return next;
    });

    try {
      // 2. Persist to attempts table (using RPC)
      await supabase.rpc('update_attempt_error_category', {
        attempt_id: attempt.id,
        q_id: questionId,
        new_cat: errorType,
      });

      // 3. Persist to question_states via StudentSync for reliable syncing
      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: questionId,
        testId: attempt.test_id,
        attemptId: attempt.id,
        patch: {
          error_category: errorType
        }
      });
      
      // Update states to trigger filteredQuestions recalculation
      setStates(prev => {
        const next = [...prev];
        const s = next.find(x => x.question_id === questionId);
        if (s) {
          s.error_category = errorType;
        } else {
          next.push({ 
            id: '', 
            question_id: questionId, 
            error_category: errorType,
            selected_answer: null,
            time_spent_seconds: null,
            review_tags: null,
            confidence: null
          });
        }
        return next;
      });
    } catch (err) {
      console.error('[Result] Tag error:', err);
    }
  };

  const toggleReviewTag = async (questionId: string, tag: string) => {
    if (!attempt || !session?.user?.id) return;
    
    const payloadQs = attempt.attempt_payload?.questions || [];
    const qPayload = payloadQs.find((x: any) => x.question_id === questionId);
    const existingTags = Array.isArray(qPayload?.review_tags) ? qPayload.review_tags : [];
    const newTags = existingTags.includes(tag) 
      ? existingTags.filter((t: string) => t !== tag)
      : [...existingTags, tag];

    setAttempt(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const target = next.attempt_payload.questions.find((x: any) => x.question_id === questionId);
      if (target) target.review_tags = newTags;
      return next;
    });

    try {
      await supabase.rpc('update_attempt_review_tags', {
        attempt_id: attempt.id,
        q_id: questionId,
        new_tags: newTags,
      });

      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: questionId,
        testId: attempt.test_id,
        attemptId: attempt.id,
        patch: {
          review_tags: newTags
        }
      });
      
      setStates(prev => {
        const next = [...prev];
        const s = next.find(x => x.question_id === questionId);
        if (s) {
          s.review_tags = newTags;
        } else {
          next.push({ id: '', question_id: questionId, review_tags: newTags, selected_answer: null, time_spent_seconds: null, error_category: null, confidence: null });
        }
        return next;
      });
    } catch (err) {
      console.error('[Result] Tag toggle error:', err);
    }
  };

  const handleAddToFlashcard = async (q: QuestionRow) => {
    if (!attempt || !session?.user?.id) return;
    try {
      await FlashcardSvc.createCard(session.user.id, {
        question_id: q.id,
        test_id: attempt.test_id,
        front_text: q.question_text,
        back_text: `Correct Answer: ${q.correct_answer}\n\n${q.explanation_markdown || ''}`,
        correct_answer: q.correct_answer,
        explanation_markdown: q.explanation_markdown,
        subject: q.subject || 'General',
        section_group: q.micro_topic || 'General',
        card_type: 'qa',
        source: { 
          kind: 'question', 
          question_id: q.id,
          options: q.options 
        }
      });
      Alert.alert('Success', 'Flashcard created successfully!');
    } catch (err) {
      console.error('Flashcard error:', err);
      Alert.alert('Error', 'Failed to create flashcard');
    }
  };

  const stats = useMemo(() => {
    if (!attempt) return null;
    const payloadQs: any[] = attempt.attempt_payload?.questions ?? [];

    // Derive counts directly from the actual question data
    const correct = payloadQs.filter(q => q.is_correct).length;
    const wrong = payloadQs.filter(q => q.selected_answer && !q.is_correct).length;
    const skipped = payloadQs.filter(q => !q.selected_answer).length;
    const attempted = correct + wrong; // Only questions that were actually answered
    
    // Total: prefer payload's stored total, then payloadQs length, then tests metadata
    const total = attempt.attempt_payload?.total_questions || payloadQs.length || attempt.tests?.question_count || 0;
    const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;

    const startMs = attempt.started_at ? new Date(attempt.started_at).getTime() : null;
    const endMs = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : null;
    const diffSec = startMs && endMs ? Math.round((endMs - startMs) / 1000) : 0;

    const payloadDuration = attempt.attempt_payload?.duration_seconds || attempt.attempt_payload?.durationSeconds;
    const timeFromQStates = states.reduce((acc, s) => acc + (s.time_spent_seconds ?? 0), 0);
    const timeFromQPayload = payloadQs.reduce((acc, q) => acc + (q.time_spent_seconds ?? 0), 0);
    
    // Priority: Explicit payload duration > Timestamp diff > Sum of question times
    const totalSec = payloadDuration || diffSec || timeFromQStates || timeFromQPayload || 0;
    
    // Divide by total (not just attempted) to get avg time per question in the session
    const avgPerQ = total > 0 ? Math.round(totalSec / total) : 0;

    const totalMarks = (correct * 2.0) - (wrong * 0.667);
    const xp = correct * 10 + attempted * 2;

    return { total, correct, wrong, skipped, attempted, accuracy, totalSec, avgPerQ, xp, totalMarks: totalMarks.toFixed(2) };
  }, [attempt, states]);

  const filteredQuestions = useMemo(() => {
    if (!attempt) return [];
    const payloadQs: any[] = attempt.attempt_payload?.questions ?? [];
    const stateByQ: Record<string, QuestionStateRow> = {};
    states.forEach(s => { stateByQ[s.question_id] = s; });

    return payloadQs.filter(p => {
      const q = questions.find(qq => qq.id === p.question_id);
      const st = stateByQ[p.question_id];
      // Merge tags from payload (always present) and question_states (synced later)
      const payloadTags: string[] = Array.isArray(p.review_tags) ? p.review_tags : [];
      const stateTags: string[] = Array.isArray(st?.review_tags) ? (st.review_tags as string[]) : [];
      const tags: string[] = Array.from(new Set([...payloadTags, ...stateTags]));

      if (filter === 'all') return true;
      if (filter === 'incorrect') return p.selected_answer && !p.is_correct;
      if (filter === 'not_attempted') return !p.selected_answer;
      if (filter === 'pyq') return q?.is_pyq === true;
      if (filter === 'imp_fact') return tags.includes('Imp. Fact');
      if (filter === 'must_revise') return tags.includes('Must Revise');
      if (filter === 'tricky') return tags.includes('Tricky');
      return true;
    });
  }, [filter, attempt, questions, states]);

  // No longer returning a full-page loading spinner if we have the attempt data
  if (loading && !attempt) return (
    <PageWrapper>
      <View style={s.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={{ color: colors.textSecondary, marginTop: 16 }}>Syncing test data...</Text>
      </View>
    </PageWrapper>
  );

  if (!attempt || !stats) return (
    <PageWrapper>
      <View style={s.center}>
        <Text style={{ color: colors.textSecondary }}>Attempt not found.</Text>
      </View>
    </PageWrapper>
  );

  const incorrectIds = (attempt.attempt_payload?.questions ?? []).filter((q: any) => q.selected_answer && !q.is_correct).map((q: any) => q.question_id);
  const allIds = (attempt.attempt_payload?.questions ?? []).map((q: any) => q.question_id);

  const startRePractice = (ids: string[]) => {
    if (!ids.length) return;
    router.push({ pathname: '/unified/engine', params: { resultIds: ids.join(','), title: 'Re-practice' } } as any);
  };

  return (
    <PageWrapper style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
        {/* ============ HEADER ============ */}
        <Text style={[s.kicker, { color: colors.primary }]}>YOUR METRICS</Text>
        <Text style={[s.testTitle, { color: colors.textPrimary }]}>{attempt.tests?.title ?? 'Test Result'}</Text>

        {/* ============ ACCURACY RING ============ */}
        <View style={[s.ringBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AccuracyRing accuracy={stats.accuracy} />
          <View style={{ flex: 1, marginLeft: spacing.lg }}>
            <Text style={[s.ringScore, { color: colors.textPrimary }]}>{stats.totalMarks}</Text>
            <Text style={[s.ringLabel, { color: colors.textTertiary }]}>TOTAL MARKS</Text>
            <View style={{ height: 8 }} />
            <View style={[s.xpPill, { backgroundColor: colors.primary + '20' }]}>
              <Award color={colors.primary} size={14} />
              <Text style={[s.xpText, { color: colors.primary }]}>{stats.xp} XP</Text>
            </View>
          </View>
        </View>

        {/* ============ OUTCOMES ROW ============ */}
        <View style={s.outcomesRow}>
          <OutcomeBox icon={<CheckCircle2 color={colors.success} size={22} />} value={stats.correct} label="Correct" tone={colors.success} testID="outcome-correct" />
          <OutcomeBox icon={<XCircle color={colors.error} size={22} />} value={stats.wrong} label="Wrong" tone={colors.error} testID="outcome-wrong" />
          <OutcomeBox icon={<MinusCircle color={colors.textTertiary} size={22} />} value={stats.skipped} label="Skipped" tone={colors.textTertiary} testID="outcome-skipped" />
        </View>

        {/* ============ DETAILED METRICS ============ */}
        <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>DETAILED METRICS</Text>
        <View style={s.metricsGrid}>
          <MetricTile icon={<Clock color={colors.primary} size={18} />} label="Total time taken" value={fmtTime(stats.totalSec)} />
          <MetricTile icon={<Target color={colors.primary} size={18} />} label="Avg time / question" value={`${stats.avgPerQ}s`} />
          <MetricTile icon={<Zap color={colors.primary} size={18} />} label="XP earned" value={`${stats.xp}`} />
          <MetricTile icon={<BookOpen color={colors.primary} size={18} />} label="Attempted" value={`${stats.attempted}/${stats.total}`} />
        </View>

        {/* ============ ACTION BUTTONS ============ */}
        <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>RE-PRACTICE</Text>
        <View style={s.actionsRow}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.error + '20', borderColor: colors.error }]} onPress={() => startRePractice(incorrectIds)} disabled={!incorrectIds.length} testID="re-practice-incorrect">
            <RefreshCw color={colors.error} size={16} />
            <Text style={[s.actionText, { color: colors.error }]}>Incorrect ({incorrectIds.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => startRePractice(allIds)} testID="re-practice-all">
            <RefreshCw color={colors.primary} size={16} />
            <Text style={[s.actionText, { color: colors.primary }]}>All ({allIds.length})</Text>
          </TouchableOpacity>
        </View>

        {/* ============ FILTERS ============ */}
        <View style={s.filterHeader}>
          <Filter color={colors.textTertiary} size={14} />
          <Text style={[s.sectionTitle, { color: colors.textTertiary }]}>REVIEW · {filteredQuestions.length}</Text>
          {loading && <ActivityIndicator color={colors.primary} size="small" style={{ marginLeft: 8 }} />}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
          <FilterPill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterPill label="Incorrect" active={filter === 'incorrect'} onPress={() => setFilter('incorrect')} />
          <FilterPill label="Not Attempted" active={filter === 'not_attempted'} onPress={() => setFilter('not_attempted')} />
          <FilterPill label="PYQ" active={filter === 'pyq'} onPress={() => setFilter('pyq')} />
          {LEARNING_TAGS.map(t => (
            <FilterPill key={t.key} label={t.label} active={filter === t.key} onPress={() => setFilter(t.key)} />
          ))}
        </ScrollView>

        {/* ============ REVIEW LIST ============ */}
        <View style={{ marginTop: spacing.md }}>
          {loading && questions.length === 0 ? (
            <View style={s.emptyBox}>
              <ActivityIndicator color={colors.primary} size="small" style={{ marginBottom: 10 }} />
              <Text style={s.emptyText}>Loading analysis details...</Text>
            </View>
          ) : filteredQuestions.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>No questions match this filter.</Text>
            </View>
          ) : null}
          
          {filteredQuestions.map((p: any, idx: number) => {
            const q = questions.find(qq => qq.id === p.question_id);
            if (!q) return null;
            const isSkipped = !p.selected_answer;
            const isCorrect = p.is_correct;
            const correctText = q.options[q.correct_answer];
            const selectedText = p.selected_answer ? q.options[p.selected_answer] : null;

            return (
              <View key={p.question_id} style={[s.qcard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID={`review-q-${idx}`}>
                <View style={s.qcardHead}>
                  <View style={[s.qBadge, isSkipped ? { backgroundColor: colors.border } : isCorrect ? { backgroundColor: colors.success + '30' } : { backgroundColor: colors.error + '30' }]}>
                    <Text style={[s.qBadgeText, { color: colors.textPrimary }]}>Q{idx + 1}</Text>
                  </View>
                  {q.subject && <Text style={[s.subjectTag, { color: colors.textTertiary, backgroundColor: colors.border }]}>{q.subject}</Text>}
                  {q.is_pyq && <Text style={s.pyqTag}>PYQ</Text>}
                  {isSkipped ? <MinusCircle color={colors.textTertiary} size={18} />
                    : isCorrect ? <CheckCircle2 color={colors.success} size={18} />
                    : <XCircle color={colors.error} size={18} />}
                </View>
                <Text style={[s.qs, { color: colors.textPrimary }]}>{q.question_text}</Text>
                
                <View style={s.optList}>
                  {Object.entries(q.options || {}).map(([key, text]) => {
                    const isCorrectOpt = key === q.correct_answer;
                    const isSelectedOpt = key === p.selected_answer;
                    
                    let circleBg = colors.surface;
                    let circleBorder = colors.border;
                    let circleTxtColor = colors.textSecondary;
                    
                    if (isCorrectOpt) {
                      circleBg = colors.success;
                      circleBorder = colors.success;
                      circleTxtColor = "#fff";
                    } else if (isSelectedOpt && !isCorrectOpt) {
                      circleBg = colors.error;
                      circleBorder = colors.error;
                      circleTxtColor = "#fff";
                    }

                    return (
                      <View key={key} style={s.optRow}>
                        <View style={[s.optCircle, { backgroundColor: circleBg, borderColor: circleBorder }]}>
                          <Text style={[s.optCircleText, { color: circleTxtColor }]}>{key}</Text>
                        </View>
                        <Text style={[s.optText, { color: colors.textSecondary }, (isCorrectOpt || isSelectedOpt) && { color: colors.textPrimary, fontWeight: '700' }]}>
                          {text}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={[s.lbl, { color: colors.textTertiary }]}>YOUR ANSWER</Text>
                <Text style={[s.ans, isSkipped ? { color: colors.textTertiary } : isCorrect ? { color: colors.success } : { color: colors.error }]}>
                  {isSkipped ? 'Not Attempted' : selectedText}
                </Text>
                {!isCorrect && (
                  <>
                    <Text style={[s.lbl, { color: colors.textTertiary }]}>CORRECT</Text>
                    <Text style={[s.ans, { color: colors.success }]}>{correctText}</Text>
                  </>
                )}
                {q.explanation_markdown ? (
                  <>
                    <Text style={[s.lbl, { color: colors.textTertiary }]}>EXPLANATION</Text>
                    <Text style={[s.exp, { color: colors.textSecondary }]} numberOfLines={6}>{q.explanation_markdown}</Text>
                  </>
                ) : null}

                {!isCorrect && !isSkipped && (
                  <View style={s.tagRow}>
                    {ERROR_TYPES.map(et => {
                      // Try payload first, then states fallback
                      const currentErrorCat = p.error_category || states.find(s => s.question_id === p.question_id)?.error_category;
                      const selected = currentErrorCat === et;
                      return (
                        <TouchableOpacity
                          key={et}
                          onPress={() => handleTagError(p.question_id, et)}
                          style={[
                            s.tagChip,
                            { 
                              backgroundColor: selected ? colors.primary : colors.surface,
                              borderColor: selected ? colors.primary : colors.border
                            }
                          ]}
                        >
                          <Text style={[s.tagChipText, { color: selected ? colors.primaryFg : colors.textSecondary }]}>
                            {et}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                <View style={s.tagRow}>
                  {REVIEW_TAGS.map(tag => {
                    const st = states.find(s => s.question_id === p.question_id);
                    const existingTags = Array.isArray(p.review_tags) ? p.review_tags : (Array.isArray(st?.review_tags) ? st.review_tags : []);
                    const selected = existingTags.includes(tag);
                    
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleReviewTag(p.question_id, tag)}
                        style={[
                          s.tagChip,
                          { 
                            backgroundColor: selected ? colors.primary + '20' : colors.surface,
                            borderColor: selected ? colors.primary : colors.border
                          }
                        ]}
                      >
                        <Text style={[s.tagChipText, { color: selected ? colors.primary : colors.textSecondary }]}>
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity 
                  onPress={() => handleAddToFlashcard(q)}
                  style={[s.flashBtn, { borderColor: colors.primary + '40' }]}
                >
                  <Zap size={14} color={colors.primary} />
                  <Text style={[s.flashBtnText, { color: colors.primary }]}>ADD TO FLASHCARD</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <TouchableOpacity testID="result-done" style={s.cta} onPress={() => router.replace('/(tabs)')}>
          <Text style={s.ctaText}>BACK TO HOME</Text>
          <ChevronRight color={colors.primaryFg} size={20} />
        </TouchableOpacity>
      </ScrollView>
    </PageWrapper>
  );
}

/* ============ Sub-components ============ */
function AccuracyRing({ accuracy }: { accuracy: number }) {
  const { colors } = useTheme();
  const size = 110, stroke = 10, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const dash = (accuracy / 100) * c;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={accuracy >= 70 ? colors.success : accuracy >= 40 ? colors.primary : colors.error}
          strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: colors.textPrimary, fontSize: 26, fontWeight: '900' }}>{accuracy}%</Text>
        <Text style={{ color: colors.textTertiary, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>ACCURACY</Text>
      </View>
    </View>
  );
}

function OutcomeBox({ icon, value, label, tone, testID }: any) {
  const { colors } = useTheme();
  return (
    <View style={[s.outcomeBox, { backgroundColor: colors.surface, borderColor: tone + '40' }]} testID={testID}>
      {icon}
      <Text style={[s.outcomeValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[s.outcomeLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function MetricTile({ icon, label, value }: any) {
  const { colors } = useTheme();
  return (
    <View style={[s.metricTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}<Text style={[s.metricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[s.metricValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function FilterPill({ label, active, onPress }: any) {
  const { colors } = useTheme();
  return (
    <Pressable 
      onPress={onPress} 
      style={[
        s.pill, 
        { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }
      ]}
    >
      <Text style={[s.pillText, { color: active ? colors.primaryFg : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60), x = sec % 60;
  return m > 0 ? `${m}m ${x}s` : `${x}s`;
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: defaultColors.primary, fontSize: 11, letterSpacing: 2, fontWeight: '900' },
  testTitle: { color: defaultColors.textPrimary, fontSize: 22, fontWeight: '900', marginTop: 4, marginBottom: spacing.lg },
  ringBlock: { flexDirection: 'row', alignItems: 'center', backgroundColor: defaultColors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: defaultColors.border, marginBottom: spacing.md },
  ringScore: { color: defaultColors.textPrimary, fontSize: 36, fontWeight: '900' },
  ringScoreSlash: { color: defaultColors.textTertiary, fontSize: 22, fontWeight: '700' },
  ringLabel: { color: defaultColors.textTertiary, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginTop: 2 },
  xpPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: defaultColors.primary + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, gap: 6 },
  xpText: { color: defaultColors.primary, fontWeight: '900', fontSize: 13 },
  outcomesRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.lg },
  outcomeBox: { flex: 1, backgroundColor: defaultColors.surface, padding: 14, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', gap: 6 },
  outcomeValue: { color: defaultColors.textPrimary, fontSize: 22, fontWeight: '900' },
  outcomeLabel: { color: defaultColors.textTertiary, fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  sectionTitle: { color: defaultColors.textTertiary, fontSize: 11, letterSpacing: 2, fontWeight: '900', marginBottom: 10, marginTop: spacing.md },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  metricTile: { flexBasis: '48%', flexGrow: 1, backgroundColor: defaultColors.surface, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: defaultColors.border, gap: 6 },
  metricLabel: { color: defaultColors.textSecondary, fontSize: 12, fontWeight: '600' },
  metricValue: { color: defaultColors.textPrimary, fontSize: 18, fontWeight: '900' },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: radius.md, borderWidth: 1 },
  actionText: { fontWeight: '900', letterSpacing: 1, fontSize: 12 },
  filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: defaultColors.surface, borderWidth: 1, borderColor: defaultColors.border },
  pillActive: { backgroundColor: defaultColors.primary, borderColor: defaultColors.primary },
  pillText: { color: defaultColors.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  pillTextActive: { color: defaultColors.primaryFg },
  emptyBox: { padding: spacing.xl, alignItems: 'center', backgroundColor: defaultColors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: defaultColors.border },
  emptyText: { color: defaultColors.textTertiary, fontSize: 13 },
  qcard: { backgroundColor: defaultColors.surface, borderColor: defaultColors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginBottom: 12 },
  qcardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  qBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  qBadgeOk: { backgroundColor: defaultColors.success + '30' },
  qBadgeBad: { backgroundColor: defaultColors.error + '30' },
  qBadgeSkip: { backgroundColor: defaultColors.border },
  qBadgeText: { color: defaultColors.textPrimary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  subjectTag: { color: defaultColors.textTertiary, fontSize: 10, fontWeight: '800', backgroundColor: defaultColors.border, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, letterSpacing: 0.5 },
  pyqTag: { color: '#15803d', fontSize: 10, fontWeight: '900', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, letterSpacing: 0.5 },
  qs: { color: defaultColors.textPrimary, fontWeight: '700', marginBottom: 12, lineHeight: 20 },
  lbl: { color: defaultColors.textTertiary, fontSize: 10, letterSpacing: 2, fontWeight: '900', marginTop: 10 },
  ans: { fontSize: 14, marginTop: 4, fontWeight: '600' },
  exp: { color: defaultColors.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  cta: { backgroundColor: defaultColors.primary, padding: 16, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: spacing.lg },
  ctaText: { color: defaultColors.primaryFg, fontWeight: '900', letterSpacing: 1 },
  optList: { marginTop: 8, gap: 8 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  optCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  optCircleText: { fontSize: 11, fontWeight: '900' },
  optText: { flex: 1, fontSize: 13, lineHeight: 18 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tagChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  tagChipText: { fontSize: 11, fontWeight: '700' },
  flashBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, borderWidth: 1, marginTop: 16, borderStyle: 'dashed' },
  flashBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
