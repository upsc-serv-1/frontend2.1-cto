import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_INDEX_KEY = '@cached_test_ids';
const QUESTION_CACHE_PREFIX = '@questions_';

export interface CachedQuestion {
  id: string;
  test_id: string;
  question_text: string;
  explanation_markdown: string;
  subject: string;
  section_group: string;
  exam_stage: string;
  is_pyq: boolean;
  provider?: string;
}

class QuestionCacheService {
  /**
   * Saves questions for a specific test ID to local storage
   */
  async cacheQuestions(testId: string, questions: any[]) {
    if (!testId || !questions.length) return;
    
    try {
      // 1. Save questions
      await AsyncStorage.setItem(`${QUESTION_CACHE_PREFIX}${testId}`, JSON.stringify(questions));
      
      // 2. Update index
      const index = await this.getCachedTestIds();
      if (!index.includes(testId)) {
        await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify([...index, testId]));
      }
      console.log(`[Cache] Saved ${questions.length} questions for test ${testId}`);
    } catch (err) {
      console.error('[Cache] Failed to cache questions', err);
    }
  }

  async getCachedTestIds(): Promise<string[]> {
    const data = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Search across all locally cached questions
   */
  async searchLocal(query: string, mode: 'Matching' | 'Exact', fields: string[] = ['Questions', 'Explanations']): Promise<CachedQuestion[]> {
    const term = query.toLowerCase().trim();
    if (!term) return [];

    const testIds = await this.getCachedTestIds();
    const results: CachedQuestion[] = [];
    const keywords = term.split(/\s+/).filter(Boolean);
    
    const searchQuestions = fields.includes('Questions');
    const searchExplanations = fields.includes('Explanations');

    for (const testId of testIds) {
      const data = await AsyncStorage.getItem(`${QUESTION_CACHE_PREFIX}${testId}`);
      if (!data) continue;

      const questions: CachedQuestion[] = JSON.parse(data);
      for (const q of questions) {
        const text = searchQuestions ? (q.question_text || "").toLowerCase() : "";
        const expl = searchExplanations ? (q.explanation_markdown || "").toLowerCase() : "";

        if (mode === 'Exact') {
          if ((text && text.includes(term)) || (expl && expl.includes(term))) {
            results.push(q);
          }
        } else {
          // Matching mode: all keywords must be present (logical AND)
          const matches = keywords.every(kw => (text && text.includes(kw)) || (expl && expl.includes(kw)));
          if (matches) {
            results.push(q);
          }
        }
      }
    }
    return results;
  }

  /**
   * Returns parsed questions for a single cached test
   */
  async getCachedQuestions(testId: string): Promise<any[]> {
    const data = await AsyncStorage.getItem(`${QUESTION_CACHE_PREFIX}${testId}`);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Returns the total number of questions across all cached tests
   */
  async getCachedQuestionCount(): Promise<number> {
    const testIds = await this.getCachedTestIds();
    let count = 0;
    for (const testId of testIds) {
      const data = await AsyncStorage.getItem(`${QUESTION_CACHE_PREFIX}${testId}`);
      if (data) {
        try {
          count += JSON.parse(data).length;
        } catch { /* skip corrupted */ }
      }
    }
    return count;
  }

  async clearCache() {
    const testIds = await this.getCachedTestIds();
    for (const id of testIds) {
      await AsyncStorage.removeItem(`${QUESTION_CACHE_PREFIX}${id}`);
    }
    await AsyncStorage.removeItem(CACHE_INDEX_KEY);
  }
}

export const QuestionCache = new QuestionCacheService();
