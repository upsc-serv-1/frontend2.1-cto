import { supabase } from '../lib/supabase';

export const ALL_WIDGET_KEYS = [
  'streak', 'goal', 'accuracy', 'time_today',
  'history_5d', 'avg_per_q', 'questions_today', 'score_today',
];

export type Widget = {
  id: string;
  widget_key: string;
  position: number;
  is_archived: boolean;
};

class WidgetSvcImpl {
  async ensureSeeded(userId: string) {
    const { data } = await supabase
      .from('user_widgets').select('widget_key').eq('user_id', userId);
    const have = new Set((data || []).map(r => r.widget_key));
    const missing = ALL_WIDGET_KEYS.filter(k => !have.has(k));
    if (!missing.length) return;
    const rows = missing.map((k, i) => ({
      user_id: userId, widget_key: k, position: (data?.length || 0) + i, is_archived: false,
    }));
    await supabase.from('user_widgets').insert(rows);
  }

  async list(userId: string): Promise<Widget[]> {
    await this.ensureSeeded(userId);
    const { data, error } = await supabase
      .from('user_widgets').select('*').eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async archive(userId: string, id: string) {
    await supabase.from('user_widgets').update({ is_archived: true })
      .eq('id', id).eq('user_id', userId);
  }

  async restore(userId: string, id: string) {
    await supabase.from('user_widgets').update({ is_archived: false })
      .eq('id', id).eq('user_id', userId);
  }

  async reorder(userId: string, orderedIds: string[]) {
    // Batch update positions
    const updates = orderedIds.map((id, idx) =>
      supabase.from('user_widgets').update({ position: idx })
        .eq('id', id).eq('user_id', userId)
    );
    await Promise.all(updates);
  }
}

export const WidgetService = new WidgetSvcImpl();
