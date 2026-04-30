import { supabase } from '../lib/supabase';
import { applySM2 } from './sm2';

export type CardSource =
  | { kind: 'question'; question_id: string }
  | { kind: 'note'; note_id: string; block_id?: string }
  | { kind: 'manual' };

export interface NewCardInput {
  front_text: string;
  back_text: string;
  front_image_url?: string | null;
  back_image_url?: string | null;
  subject?: string;
  section_group?: string;
  microtopic?: string;
  card_type?: 'qa' | 'note_block' | 'manual';
  source?: CardSource;
  question_id?: string | null;
  test_id?: string | null;
}

export class FlashcardSvc {
  // ============ SUBJECT/DECK READS (unchanged behaviour) ============
  static async getSubjects(userId: string) {
    const { data, error } = await supabase
      .from('user_cards').select('cards(subject)').eq('user_id', userId);
    if (error) throw error;
    return Array.from(new Set((data ?? []).map((d: any) => d.cards?.subject).filter(Boolean))).sort();
  }
  static async getDecks(userId: string, subject: string) {
    const { data, error } = await supabase
      .from('user_cards').select('cards(section_group, microtopic)')
      .eq('user_id', userId).eq('cards.subject', subject);
    if (error) throw error;
    const decks: Record<string, string[]> = {};
    (data ?? []).forEach((d: any) => {
      const sg = d.cards?.section_group || 'General';
      const mt = d.cards?.microtopic || 'General';
      if (!decks[sg]) decks[sg] = [];
      if (!decks[sg].includes(mt)) decks[sg].push(mt);
    });
    return decks;
  }
  static async getCards(userId: string, subject: string, section: string, microtopic: string) {
    const { data, error } = await supabase
      .from('user_cards').select('*, cards!inner(*)')
      .eq('user_id', userId).eq('cards.subject', subject)
      .eq('cards.section_group', section).eq('cards.microtopic', microtopic);
    if (error) throw error;
    return (data ?? []).map((d: any) => ({ ...d.cards, ...d, id: d.card_id }));
  }
  static async getDueCards(userId: string, limit = 50) {
    const { data, error } = await supabase
      .from('user_cards').select('*, cards!inner(*)')
      .eq('user_id', userId).lte('next_review', new Date().toISOString())
      .order('next_review', { ascending: true }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((d: any) => ({ ...d.cards, ...d, id: d.card_id }));
  }

  // ============ CREATE — generic ============
  static async createCard(userId: string, input: NewCardInput) {
    if (!input.front_text?.trim()) throw new Error('Front text required');
    if (!input.back_text?.trim()) throw new Error('Back text required');

    // Try to dedupe by source.question_id when present
    let card: { id: string } | null = null;
    if (input.question_id) {
      const { data } = await supabase.from('cards').select('id').eq('question_id', input.question_id).maybeSingle();
      if (data) card = data;
    }
    if (!card) {
      const { data, error } = await supabase
        .from('cards')
        .insert({
          question_id: input.question_id || `manual_${Date.now()}`,
          subject: input.subject || 'General',
          section_group: input.section_group || 'General',
          microtopic: input.microtopic || 'General',
          front_text: input.front_text,
          back_text: input.back_text,
          front_image_url: input.front_image_url || null,
          back_image_url: input.back_image_url || null,
          card_type: input.card_type || 'manual',
          source: input.source || {},
          test_id: input.test_id || 'manual',
          // legacy fields kept for backward compat:
          question_text: input.front_text,
          answer_text: input.back_text,
        })
        .select('id').single();
      if (error) throw error;
      card = data;
    }

    // Link in user_cards (idempotent)
    const { data: existing } = await supabase
      .from('user_cards').select('id').eq('user_id', userId).eq('card_id', card!.id).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('user_cards').insert({
        user_id: userId, card_id: card!.id,
        ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0,
        next_review: new Date().toISOString(), status: 'new',
      });
      if (error) throw error;
    }
    return card!.id;
  }

  // ============ CREATE FROM QUIZ QUESTION (FIX #1) ============
  // Front = Question stem + options (a) ... (d)
  // Back  = Correct answer line + Explanation markdown
  static async createFromQuestion(userId: string, q: any) {
    const opts = q.options ?? {};
    const optionLines = Object.entries(opts).map(([k, v]) => `(${k.toUpperCase()}) ${v}`).join('\n');
    const front_text = `${q.question_text || q.questionText || ''}\n\n${optionLines}`.trim();

    const correctKey = q.correct_answer || q.correctAnswer;
    const correctText = correctKey && opts[correctKey] ? `**Correct: (${correctKey.toUpperCase()})** ${opts[correctKey]}` : '';
    const explanation = q.explanation_markdown || q.explanation || '';
    const back_text = [correctText, explanation].filter(Boolean).join('\n\n');

    return this.createCard(userId, {
      front_text, back_text,
      subject: q.subject || 'General',
      section_group: q.section_group || 'General',
      microtopic: q.micro_topic || q.microtopic || 'General',
      card_type: 'qa',
      question_id: q.id,
      test_id: q.test_id || q.testId || q.tests?.id || 'manual',
      source: { kind: 'question', question_id: q.id },
    });
  }
  /** @deprecated use createFromQuestion */
  static async createFlashcardFromQuestion(userId: string, q: any) {
    return this.createFromQuestion(userId, q);
  }

  // ============ CREATE FROM NOTE BLOCK (Step 12) ============
  static async createFromNoteBlock(userId: string, params: {
    note_id: string;
    block_id?: string;
    front_text: string;
    back_text: string;
    subject?: string; section_group?: string; microtopic?: string;
    front_image_url?: string | null; back_image_url?: string | null;
  }) {
    return this.createCard(userId, {
      front_text: params.front_text,
      back_text: params.back_text,
      subject: params.subject, section_group: params.section_group, microtopic: params.microtopic,
      card_type: 'note_block',
      front_image_url: params.front_image_url, back_image_url: params.back_image_url,
      source: { kind: 'note', note_id: params.note_id, block_id: params.block_id },
    });
  }

  // ============ EDIT / DELETE ============
  static async updateCard(cardId: string, patch: Partial<NewCardInput>) {
    const updateData: any = { ...patch, updated_at: new Date().toISOString() };
    if (patch.front_text) updateData.question_text = patch.front_text;
    if (patch.back_text) updateData.answer_text = patch.back_text;
    const { error } = await supabase.from('cards').update(updateData).eq('id', cardId);
    if (error) throw error;
  }
  static async deleteCardForUser(userId: string, cardId: string) {
    const { error } = await supabase.from('user_cards').delete().eq('user_id', userId).eq('card_id', cardId);
    if (error) throw error;
  }

  // ============ REVIEW (FIX #3 — proper SM-2) ============
  static async reviewCard(userId: string, cardId: string, quality: number) {
    const { data: cur, error } = await supabase
      .from('user_cards').select('*').eq('user_id', userId).eq('card_id', cardId).single();
    if (error) throw error;

    const sm = applySM2({
      ease_factor: Number(cur.ease_factor ?? 2.5),
      interval_days: Number(cur.interval_days ?? 0),
      repetitions: Number(cur.repetitions ?? 0),
      quality,
    }, Number(cur.lapses ?? 0));

    const newLapses = (cur.lapses ?? 0) + (sm.lapsed ? 1 : 0);

    const { error: upErr } = await supabase.from('user_cards').update({
      ease_factor: sm.ease_factor,
      interval_days: sm.interval_days,
      repetitions: sm.repetitions,
      next_review: sm.next_review.toISOString(),
      last_reviewed: new Date().toISOString(),
      last_quality: quality,
      lapses: newLapses,
      status: sm.status,
    }).eq('user_id', userId).eq('card_id', cardId);
    if (upErr) throw upErr;

    // Audit log
    await supabase.from('card_reviews').insert({
      user_id: userId, card_id: cardId,
      quality,
      prev_interval: cur.interval_days,
      new_interval: sm.interval_days,
      prev_ef: cur.ease_factor,
      new_ef: sm.ease_factor,
    });
    return sm;
  }

  /** @deprecated  Map old performance arg → quality. */
  static async updateCardProgress(userId: string, cardId: string, performance: number) {
    return this.reviewCard(userId, cardId, performance);
  }
}
