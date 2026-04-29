import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'RECENTS_NOTES_V1';
const MAX_RECENTS = 8;

export interface RecentNote {
  id: string;
  title: string;
  subject: string;
  timestamp: number;
}

export function useRecentNotes() {
  const [recents, setRecents] = useState<RecentNote[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) setRecents(JSON.parse(data));
    } catch (e) { console.error('Recents load error', e); }
  };

  const addRecent = async (note: Omit<RecentNote, 'timestamp'>) => {
    try {
      const current = await AsyncStorage.getItem(STORAGE_KEY);
      let list: RecentNote[] = current ? JSON.parse(current) : [];
      
      // Remove existing to bring to top
      list = list.filter(item => item.id !== note.id);
      
      // Add new
      list.unshift({ ...note, timestamp: Date.now() });
      
      // Limit
      if (list.length > MAX_RECENTS) list = list.slice(0, MAX_RECENTS);
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      setRecents(list);
    } catch (e) { console.error('Recents save error', e); }
  };

  return { recents, addRecent, refreshRecents: load };
}
