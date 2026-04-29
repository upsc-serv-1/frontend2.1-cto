import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheSet<T>(key: string, value: T) {
  try {
    await AsyncStorage.setItem(`g1:${key}`, JSON.stringify({ v: value, t: Date.now() }));
  } catch {}
}

export async function cacheGet<T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`g1:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v as T;
  } catch {
    return null;
  }
}
