import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SyllabusProgress {
  ncert: boolean;
  pyqs: boolean;
  books: boolean;
  test: boolean;
  mastered: boolean;
  ansWriting?: boolean;
}

export class SyllabusService {
  private static STORAGE_KEY = 'upsc_syllabus_progress';

  static async getProgress(userId: string) {
    const cacheKey = `${this.STORAGE_KEY}_${userId}`;
    try {
      const { data, error } = await supabase
        .from('user_syllabus_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const progress: Record<string, SyllabusProgress> = {};
      data.forEach((row: any) => {
        progress[row.path] = row.status;
      });
      
      // Save to cache
      await AsyncStorage.setItem(cacheKey, JSON.stringify(progress));
      return progress;
    } catch (e) {
      const local = await AsyncStorage.getItem(cacheKey);
      return local ? JSON.parse(local) : {};
    }
  }

  static async getCachedProgress(userId: string) {
    const cacheKey = `${this.STORAGE_KEY}_${userId}`;
    const local = await AsyncStorage.getItem(cacheKey);
    return local ? JSON.parse(local) : {};
  }

  static async updateProgress(userId: string, path: string, status: SyllabusProgress) {
    const cacheKey = `${this.STORAGE_KEY}_${userId}`;
    try {
      const { error } = await supabase
        .from('user_syllabus_progress')
        .upsert({
          user_id: userId,
          path: path,
          status: status,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,path' });

      if (error) throw error;
      
      // Update cache
      const local = await AsyncStorage.getItem(cacheKey);
      const data = local ? JSON.parse(local) : {};
      data[path] = status;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      
    } catch (e) {
      // Fallback
      const local = await AsyncStorage.getItem(cacheKey);
      const data = local ? JSON.parse(local) : {};
      data[path] = status;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
    }
  }
}
