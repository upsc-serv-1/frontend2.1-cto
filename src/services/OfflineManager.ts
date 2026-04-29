import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { QuestionCache } from './QuestionCache';

// ─── Storage Keys ────────────────────────────────────────────────
const OFFLINE_META_KEY = '@offline_meta';
const OFFLINE_TESTS_KEY = '@offline_tests';
const USER_STATES_PREFIX = '@user_states_';
const USER_NOTES_PREFIX = '@user_notes_';
const USER_ATTEMPTS_PREFIX = '@user_attempts_';
const USER_CARDS_PREFIX = '@user_cards_';
const CARDS_PREFIX = '@cards_all';

// ─── Types ───────────────────────────────────────────────────────
export interface OfflineMetadata {
  lastFullSync: number | null;
  lastIncrementalSync: number | null;
  totalQuestions: number;
  totalTests: number;
  totalStates: number;
  totalNotes: number;
  totalAttempts: number;
  totalCards: number;
}

export interface SyncProgress {
  phase: string;       // 'tests' | 'questions' | 'states' | 'notes' | 'attempts' | 'cards' | 'done'
  current: number;
  total: number;
  detail: string;
}

const DEFAULT_META: OfflineMetadata = {
  lastFullSync: null,
  lastIncrementalSync: null,
  totalQuestions: 0,
  totalTests: 0,
  totalStates: 0,
  totalNotes: 0,
  totalAttempts: 0,
  totalCards: 0,
};

// ─── Service ─────────────────────────────────────────────────────
class OfflineManagerService {
  private _cancelled = false;

  // ── Metadata ──────────────────────────────────────────────────
  async getMetadata(): Promise<OfflineMetadata> {
    try {
      const data = await AsyncStorage.getItem(OFFLINE_META_KEY);
      return data ? { ...DEFAULT_META, ...JSON.parse(data) } : { ...DEFAULT_META };
    } catch {
      return { ...DEFAULT_META };
    }
  }

  private async setMetadata(patch: Partial<OfflineMetadata>) {
    const current = await this.getMetadata();
    await AsyncStorage.setItem(OFFLINE_META_KEY, JSON.stringify({ ...current, ...patch }));
  }

  // ── Cancel support ────────────────────────────────────────────
  cancelSync() { this._cancelled = true; }

  // ── FULL SYNC ─────────────────────────────────────────────────
  async syncAllContent(
    userId: string,
    onProgress: (p: SyncProgress) => void
  ) {
    this._cancelled = false;
    let totalQuestions = 0;

    // ──────── 1. TESTS ──────────────────────────────────────────
    onProgress({ phase: 'tests', current: 0, total: 1, detail: 'Fetching test catalogue...' });

    const { data: tests, error: testErr } = await supabase
      .from('tests')
      .select('*');
    if (testErr) throw testErr;
    if (!tests || tests.length === 0) throw new Error('No tests found on server');

    await AsyncStorage.setItem(OFFLINE_TESTS_KEY, JSON.stringify(tests));
    onProgress({ phase: 'tests', current: 1, total: 1, detail: `${tests.length} tests saved` });
    if (this._cancelled) return;

    // ──────── 2. QUESTIONS (chunked by test) ────────────────────
    const totalTests = tests.length;
    for (let i = 0; i < totalTests; i++) {
      if (this._cancelled) return;
      const test = tests[i];
      onProgress({
        phase: 'questions',
        current: i,
        total: totalTests,
        detail: `${test.title || test.id}  (${i + 1}/${totalTests})`,
      });

      try {
        const { data: questions, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('test_id', test.id)
          .limit(5000);

        if (!qErr && questions && questions.length > 0) {
          await QuestionCache.cacheQuestions(test.id, questions);
          totalQuestions += questions.length;
        }
      } catch (err) {
        console.warn(`[Offline] Failed to cache test ${test.id}`, err);
      }
    }
    onProgress({ phase: 'questions', current: totalTests, total: totalTests, detail: `${totalQuestions} questions saved` });
    if (this._cancelled) return;

    // ──────── 3. USER QUESTION STATES ───────────────────────────
    onProgress({ phase: 'states', current: 0, total: 1, detail: 'Fetching your tags, bookmarks & notes...' });
    let totalStates = 0;
    try {
      const allStates: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      // Supabase returns max 1000 rows per query — paginate
      while (true) {
        if (this._cancelled) return;
        const { data, error } = await supabase
          .from('question_states')
          .select('*')
          .eq('user_id', userId)
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allStates.push(...data);
        from += CHUNK;
        if (data.length < CHUNK) break; // last page
      }
      await AsyncStorage.setItem(`${USER_STATES_PREFIX}${userId}`, JSON.stringify(allStates));
      totalStates = allStates.length;
    } catch (err) {
      console.warn('[Offline] Failed to fetch question_states', err);
    }
    onProgress({ phase: 'states', current: 1, total: 1, detail: `${totalStates} question states saved` });
    if (this._cancelled) return;

    // ──────── 4. USER NOTES (notebooks) ─────────────────────────
    onProgress({ phase: 'notes', current: 0, total: 1, detail: 'Fetching your notebooks...' });
    let totalNotes = 0;
    try {
      const { data: notes, error: nErr } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId);
      if (!nErr && notes) {
        await AsyncStorage.setItem(`${USER_NOTES_PREFIX}${userId}`, JSON.stringify(notes));
        totalNotes = notes.length;
      }
    } catch (err) {
      console.warn('[Offline] Failed to fetch user_notes', err);
    }
    onProgress({ phase: 'notes', current: 1, total: 1, detail: `${totalNotes} notebooks saved` });
    if (this._cancelled) return;

    // ──────── 5. TEST ATTEMPTS ──────────────────────────────────
    onProgress({ phase: 'attempts', current: 0, total: 1, detail: 'Fetching your test attempts...' });
    let totalAttempts = 0;
    try {
      const { data: attempts, error: aErr } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(500);
      if (!aErr && attempts) {
        await AsyncStorage.setItem(`${USER_ATTEMPTS_PREFIX}${userId}`, JSON.stringify(attempts));
        totalAttempts = attempts.length;
      }
    } catch (err) {
      console.warn('[Offline] Failed to fetch test_attempts', err);
    }
    onProgress({ phase: 'attempts', current: 1, total: 1, detail: `${totalAttempts} attempts saved` });
    if (this._cancelled) return;

    // ──────── 6. FLASHCARD DATA ─────────────────────────────────
    onProgress({ phase: 'cards', current: 0, total: 1, detail: 'Fetching your flashcards...' });
    let totalCards = 0;
    try {
      const { data: userCards, error: ucErr } = await supabase
        .from('user_cards')
        .select('*, cards(*)')
        .eq('user_id', userId);
      if (!ucErr && userCards) {
        await AsyncStorage.setItem(`${USER_CARDS_PREFIX}${userId}`, JSON.stringify(userCards));
        totalCards = userCards.length;
      }
    } catch (err) {
      console.warn('[Offline] Failed to fetch flashcard data', err);
    }
    onProgress({ phase: 'cards', current: 1, total: 1, detail: `${totalCards} flashcards saved` });

    // ──────── FINALIZE ──────────────────────────────────────────
    await this.setMetadata({
      lastFullSync: Date.now(),
      lastIncrementalSync: Date.now(),
      totalQuestions,
      totalTests: tests.length,
      totalStates,
      totalNotes,
      totalAttempts,
      totalCards,
    });

    onProgress({ phase: 'done', current: 1, total: 1, detail: 'All data downloaded!' });
  }

  // ── INCREMENTAL SYNC ──────────────────────────────────────────
  async incrementalSync(userId: string) {
    const meta = await this.getMetadata();
    if (!meta.lastFullSync) return; // No full sync yet, skip

    const since = meta.lastIncrementalSync
      ? new Date(meta.lastIncrementalSync).toISOString()
      : new Date(meta.lastFullSync).toISOString();

    console.log(`[Offline] Incremental sync since ${since}`);

    try {
      // 1. Refresh question_states updated since last sync
      const { data: newStates } = await supabase
        .from('question_states')
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', since);

      if (newStates && newStates.length > 0) {
        const raw = await AsyncStorage.getItem(`${USER_STATES_PREFIX}${userId}`);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const existingMap = new Map(existing.map(s => [s.question_id, s]));
        newStates.forEach(s => existingMap.set(s.question_id, s));
        await AsyncStorage.setItem(`${USER_STATES_PREFIX}${userId}`, JSON.stringify(Array.from(existingMap.values())));
        console.log(`[Offline] Merged ${newStates.length} updated question states`);
      }

      // 2. Refresh user_notes updated since last sync
      const { data: newNotes } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', since);

      if (newNotes && newNotes.length > 0) {
        const raw = await AsyncStorage.getItem(`${USER_NOTES_PREFIX}${userId}`);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const existingMap = new Map(existing.map(n => [n.id, n]));
        newNotes.forEach(n => existingMap.set(n.id, n));
        await AsyncStorage.setItem(`${USER_NOTES_PREFIX}${userId}`, JSON.stringify(Array.from(existingMap.values())));
        console.log(`[Offline] Merged ${newNotes.length} updated notes`);
      }

      // 3. Refresh test_attempts since last sync
      const { data: newAttempts } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .gte('submitted_at', since);

      if (newAttempts && newAttempts.length > 0) {
        const raw = await AsyncStorage.getItem(`${USER_ATTEMPTS_PREFIX}${userId}`);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const existingMap = new Map(existing.map(a => [a.id, a]));
        newAttempts.forEach(a => existingMap.set(a.id, a));
        await AsyncStorage.setItem(`${USER_ATTEMPTS_PREFIX}${userId}`, JSON.stringify(Array.from(existingMap.values())));
        console.log(`[Offline] Merged ${newAttempts.length} new attempts`);
      }

      await this.setMetadata({ lastIncrementalSync: Date.now() });
    } catch (err) {
      console.warn('[Offline] Incremental sync failed (will retry later)', err);
    }
  }

  // ── READERS ───────────────────────────────────────────────────
  async getOfflineTests(): Promise<any[]> {
    const raw = await AsyncStorage.getItem(OFFLINE_TESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  async getOfflineQuestions(testId: string): Promise<any[]> {
    const raw = await AsyncStorage.getItem(`@questions_${testId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async getOfflineQuestionsByIds(ids: string[]): Promise<any[]> {
    const testIds = await QuestionCache.getCachedTestIds();
    const results: any[] = [];
    const idSet = new Set(ids);

    for (const tid of testIds) {
      const questions = await this.getOfflineQuestions(tid);
      questions.forEach(q => {
        if (idSet.has(q.id)) {
          results.push(q);
          idSet.delete(q.id); // Optimization: stop looking for this ID
        }
      });
      if (idSet.size === 0) break;
    }
    return results;
  }

  async getOfflineUserStates(userId: string): Promise<any[]> {
    const raw = await AsyncStorage.getItem(`${USER_STATES_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async getOfflineNotes(userId: string): Promise<any[]> {
    const raw = await AsyncStorage.getItem(`${USER_NOTES_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async getOfflineAttempts(userId: string): Promise<any[]> {
    if (!userId) return [];
    const raw = await AsyncStorage.getItem(`${USER_ATTEMPTS_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async getConsolidatedMetadata(): Promise<any[]> {
    const tests = await this.getOfflineTests();
    if (!tests || tests.length === 0) return [];
    
    const flattened: any[] = [];
    for (const t of tests) {
      const questions = await this.getOfflineQuestions(t.id);
      if (questions.length === 0) {
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
      } else {
        questions.forEach(q => {
          flattened.push({
            subject: q.subject || null,
            section_group: q.section_group || null,
            micro_topic: q.micro_topic || null,
            test_id: t.id,
            institute: t.institute,
            program_name: t.program_name,
            series: t.series,
            title: t.title
          });
        });
      }
    }
    return flattened;
  }

  async getOfflineCards(userId: string): Promise<any[]> {
    const raw = await AsyncStorage.getItem(`${USER_CARDS_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : [];
  }

  async getOfflineFilterLists() {
    const tests = await this.getOfflineTests();
    const institutes = Array.from(new Set(tests.map(t => t.institute).filter(Boolean))).sort();
    const programs = Array.from(new Set(tests.map(t => t.program_name).filter(Boolean))).sort();
    
    // Subjects are harder because they are in questions, but we can sample cached tests
    // For now, let's just return what we have in tests.
    return { institutes, programs, tests };
  }

  // ── CLEAR ─────────────────────────────────────────────────────
  async clearAllOfflineData() {
    await QuestionCache.clearCache();
    await AsyncStorage.removeItem(OFFLINE_META_KEY);
    await AsyncStorage.removeItem(OFFLINE_TESTS_KEY);

    // Clear all user-specific keys
    const allKeys = await AsyncStorage.getAllKeys();
    const offlineKeys = allKeys.filter(
      k => k.startsWith(USER_STATES_PREFIX) ||
           k.startsWith(USER_NOTES_PREFIX) ||
           k.startsWith(USER_ATTEMPTS_PREFIX) ||
           k.startsWith(USER_CARDS_PREFIX) ||
           k.startsWith(CARDS_PREFIX)
    );
    if (offlineKeys.length > 0) {
      await AsyncStorage.multiRemove(offlineKeys);
    }
  }

  // ── HELPERS ───────────────────────────────────────────────────
  formatSyncAge(timestamp: number | null): string {
    if (!timestamp) return 'Never synced';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

export const OfflineManager = new OfflineManagerService();
