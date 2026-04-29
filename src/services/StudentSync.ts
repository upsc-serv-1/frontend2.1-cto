import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const PENDING_WRITES_KEY = '@pending_writes';
const USER_STATES_PREFIX = '@user_states_';
const USER_NOTES_PREFIX = '@user_notes_';
const USER_ATTEMPTS_PREFIX = '@user_attempts_';

export type WriteKind = 
  | 'attempt_draft' 
  | 'question_state' 
  | 'attempt_submit' 
  | 'user_note' 
  | 'note_content' 
  | 'tag_update';

export interface PendingWrite {
  id: string;
  kind: WriteKind;
  payload: any;
  enqueuedAt: number;
  failedAttempts: number;
  lastError?: string;
}

class StudentSyncService {
  private processing = false;

  async enqueue(kind: WriteKind, payload: any) {
    const newWrite: PendingWrite = {
      id: Math.random().toString(36).substring(7),
      kind,
      payload,
      enqueuedAt: Date.now(),
      failedAttempts: 0
    };

    try {
      const existing = await this.getQueue();
      await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify([...existing, newWrite]));
      console.log(`[Sync] Enqueued ${kind}`);
      
      // Dual-Path: Update local cache immediately so UI is instant
      this.updateLocalCache(newWrite).catch(e => console.warn('[Sync] Local cache update failed', e));

      this.processQueue();
    } catch (err) {
      console.error('[Sync] Failed to enqueue', err);
    }
  }

  private async updateLocalCache(write: PendingWrite) {
    const { kind, payload } = write;
    const userId = payload.userId;
    if (!userId) return;

    try {
      if (kind === 'question_state') {
        const key = `${USER_STATES_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const map = new Map(existing.map(s => [s.question_id, s]));
        
        // Merge patch into existing or create new
        const qid = payload.questionId;
        const current = map.get(qid) || { user_id: userId, question_id: qid };
        map.set(qid, { ...current, ...payload.patch, updated_at: new Date().toISOString() });
        
        await AsyncStorage.setItem(key, JSON.stringify(Array.from(map.values())));
      } 
      else if (kind === 'attempt_submit') {
        const key = `${USER_ATTEMPTS_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        
        // Add new attempt to the front
        const newAttempt = {
          id: write.id, // Temporary ID if we don't have one, but for submit it's usually real
          ...payload.attempt,
          user_id: userId,
          test_id: payload.testId,
          submitted_at: payload.attempt.submitted_at || new Date().toISOString()
        };
        await AsyncStorage.setItem(key, JSON.stringify([newAttempt, ...existing].slice(0, 500)));
      }
      else if (kind === 'user_note') {
        const key = `${USER_NOTES_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const map = new Map(existing.map(n => [n.question_id, n]));
        
        const qid = payload.questionId;
        map.set(qid, { 
          user_id: userId, 
          question_id: qid, 
          content: payload.content, 
          updated_at: new Date().toISOString() 
        });
        await AsyncStorage.setItem(key, JSON.stringify(Array.from(map.values())));
      }
    } catch (err) {
      console.warn('[Sync] Dual-path local update failed:', err);
    }
  }

  async getQueue(): Promise<PendingWrite[]> {
    const data = await AsyncStorage.getItem(PENDING_WRITES_KEY);
    return data ? JSON.parse(data) : [];
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      let queue = await this.getQueue();
      if (queue.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`[Sync] Processing ${queue.length} pending writes`);
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      for (const item of queue) {
        // SAFETY: Discard items that don't match current session user
        if (!currentUserId || item.payload.userId !== currentUserId) {
          console.warn(`[Sync] Discarding stale item for user ${item.payload.userId}`);
          queue = queue.filter(i => i.id !== item.id);
          await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
          continue;
        }

        try {
          await this.applyWrite(item);
          // Success: remove from queue
          queue = queue.filter(i => i.id !== item.id);
          await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
        } catch (err: any) {
          console.error(`[Sync] Failed to apply write ${item.id}`, err);
          
          // If it's an RLS error or schema error, remove it so it doesn't block the queue
          if (err.code === '42501' || err.code === 'PGRST204') {
            console.warn(`[Sync] Removing permanently failing item: ${err.message}`);
            queue = queue.filter(i => i.id !== item.id);
            await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
            continue;
          }

          item.failedAttempts++;
          item.lastError = err.message;
          await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
          // Stop processing if it's likely a network error
          break;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async applyWrite(item: PendingWrite) {
    const { kind, payload } = item;

    switch (kind) {
      case 'question_state':
        return this.saveQuestionState(payload);
      case 'user_note':
        return this.saveUserNote(payload);
      case 'tag_update':
        return this.saveTagUpdate(payload);
      case 'attempt_submit':
        return this.saveAttemptSubmit(payload);
      // Add more cases as needed
      default:
        console.warn(`[Sync] Unknown write kind: ${kind}`);
    }
  }

  private async saveQuestionState(payload: any) {
    const { userId, questionId, testId, attemptId, patch } = payload;
    if (!questionId) {
      console.warn('[Sync] Skipping question_state because questionId is missing');
      return;
    }

    
    // ALIGN WITH WEBSITE SCHEMA:
    // 1. 'personal_note' in app -> 'note' in website DB
    // 2. 'review_tags' is jsonb in website DB
    // 3. Track 'is_incorrect_last_attempt' based on performance
    
    const sanitizedPatch: any = { ...patch };
    
    // SAFETY: Proactively strip the non-existent 'is_correct' column 
    // to prevent errors from stale writes in the local queue.
    if (sanitizedPatch.hasOwnProperty('is_correct')) {
      delete sanitizedPatch.is_correct;
    }

    if (sanitizedPatch.hasOwnProperty('last_attempt_at')) {
      delete sanitizedPatch.last_attempt_at;
    }
    
    if (sanitizedPatch.hasOwnProperty('personal_note')) {
      sanitizedPatch.note = sanitizedPatch.personal_note;
      delete sanitizedPatch.personal_note;
    }
    if (sanitizedPatch.hasOwnProperty('review_difficulty')) {
      sanitizedPatch.difficulty_level = sanitizedPatch.review_difficulty;
      delete sanitizedPatch.review_difficulty;
    }

    if (sanitizedPatch.hasOwnProperty('status')) {
      const isCorrect = sanitizedPatch.status === 'Correct';
      sanitizedPatch.is_incorrect_last_attempt = !isCorrect;
      delete sanitizedPatch.status; // Strip after mapping
      
      // WEBSITE INTEROPERABILITY: Create a history entry matching the CSV format
      const historyEntry = {
        wasCorrect: isCorrect,
        submittedAt: new Date().toISOString(),
        selectedAnswer: sanitizedPatch.selected_answer || "",
        confidence: sanitizedPatch.confidence || ""
      };
    }

    console.log(`[Sync] Saving state for Q:${questionId} User:${userId}`, sanitizedPatch);
    
    // WORKAROUND for missing unique constraint (42P10):
    // 1. Try to find existing record
    const { data: existing } = await supabase
      .from('question_states')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle();

    const updateData: any = {
      user_id: userId,
      question_id: questionId,
      test_id: testId,
      attempt_id: attemptId,
      selected_answer: sanitizedPatch.selected_answer,
      confidence: sanitizedPatch.confidence,
      review_tags: sanitizedPatch.review_tags,
      user_tags: Array.isArray(sanitizedPatch.review_tags) ? sanitizedPatch.review_tags : null,
      highlight_text: sanitizedPatch.note,
      note: sanitizedPatch.note,
      is_incorrect_last_attempt: sanitizedPatch.is_incorrect_last_attempt,
      marked_must_revise: sanitizedPatch.marked_must_revise,
      attempt_hour: sanitizedPatch.attempt_hour || new Date().getHours(),
      time_spent_seconds: sanitizedPatch.time_spent_seconds || 0,
      difficulty_level: sanitizedPatch.difficulty_level,
      error_category: sanitizedPatch.error_category,
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      // 2a. Update by ID
      const { error } = await supabase
        .from('question_states')
        .update(updateData)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      // 2b. Insert new
      const { error } = await supabase
        .from('question_states')
        .insert(updateData);
      
      // Handle race condition: if someone inserted it between our select and insert
      if (error && error.code === '23505') {
        return this.saveQuestionState(payload); // Retry
      }
      if (error) throw error;
    }
  }

  private async saveUserNote(payload: any) {
    const { userId, questionId, content } = payload;
    if (!questionId) {
      console.warn('[Sync] Skipping user_note because questionId is missing');
      return;
    }

    
    // WORKAROUND for missing unique constraint
    const { data: existing } = await supabase
      .from('user_notes')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle();

    const updateData = {
      user_id: userId,
      question_id: questionId,
      content,
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('user_notes')
        .update(updateData)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_notes')
        .insert(updateData);
      
      if (error && error.code === '23505') {
        return this.saveUserNote(payload); // Retry
      }
      if (error) throw error;
    }
  }

  private async saveTagUpdate(payload: any) {
    const { userId, questionId, tags } = payload;
    if (!questionId) {
      console.warn('[Sync] Skipping tag_update because questionId is missing');
      return;
    }

    
    // WORKAROUND for missing unique constraint
    const { data: existing } = await supabase
      .from('question_states')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle();

    const updateData = {
      user_id: userId,
      question_id: questionId,
      review_tags: tags,
      user_tags: tags,
      marked_must_revise: Array.isArray(tags) && tags.includes('Must Revise'),
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('question_states')
        .update(updateData)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('question_states')
        .insert(updateData);
      
      if (error && error.code === '23505') {
        return this.saveTagUpdate(payload); // Retry
      }
      if (error) throw error;
    }
  }

  private uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async saveAttemptSubmit(payload: any) {
    const { userId, testId, attempt } = payload;
    const attemptId = attempt.id || this.uuidv4();
    
    const { data, error } = await supabase
      .from('test_attempts')
      .insert({
        id: attemptId,
        user_id: userId,
        test_id: testId,
        score: attempt.score ?? 0,
        attempt_payload: attempt.attempt_payload ?? attempt,
        started_at: attempt.started_at ?? null,
        submitted_at: attempt.submitted_at ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id as string | undefined;
  }

  /**
   * Synchronously insert a test_attempts row and return its id.
   * Use this when the UI needs the attempt_id immediately
   * (e.g. to navigate to the result screen).
   */
  async submitAttemptNow(payload: {
    userId: string;
    testId: string;
    attempt: {
      score: number;
      attempt_payload: any;
      started_at: string;
      submitted_at: string;
    };
  }): Promise<string | undefined> {
    const attemptId = await this.saveAttemptSubmit(payload);
    
    // Dual-Path: Update local cache immediately
    if (attemptId) {
      const key = `${USER_ATTEMPTS_PREFIX}${payload.userId}`;
      const raw = await AsyncStorage.getItem(key);
      const existing: any[] = raw ? JSON.parse(raw) : [];
      const newAttempt = {
        id: attemptId,
        ...payload.attempt,
        user_id: payload.userId,
        test_id: payload.testId
      };
      await AsyncStorage.setItem(key, JSON.stringify([newAttempt, ...existing].slice(0, 500)));
    }

    return attemptId;
  }
}

export const StudentSync = new StudentSyncService();
