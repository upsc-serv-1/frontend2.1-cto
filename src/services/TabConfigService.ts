import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabKey = 'index' | 'arena' | 'analyse' | 'pyq' | 'flashcards' | 'tags' | 'notes' | 'revise' | 'tracker';

const DEFAULT_TAB_ORDER: TabKey[] = ['index', 'arena', 'analyse', 'pyq', 'flashcards', 'tags', 'notes', 'revise', 'tracker'];

export const TabConfigService = {
  async getTabOrder(): Promise<TabKey[]> {
    try {
      const stored = await AsyncStorage.getItem('user_tab_order');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to load tab order', e);
    }
    return DEFAULT_TAB_ORDER;
  },

  async setTabOrder(order: TabKey[]) {
    try {
      await AsyncStorage.setItem('user_tab_order', JSON.stringify(order));
    } catch (e) {
      console.error('Failed to save tab order', e);
    }
  }
};
