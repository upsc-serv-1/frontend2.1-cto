class DataStorageService {
  private cache: Record<string, any> = {};

  set(key: string, data: any) {
    this.cache[key] = data;
  }

  get<T>(key: string): T | null {
    return (this.cache[key] as T) || null;
  }

  has(key: string): boolean {
    return !!this.cache[key];
  }

  clear(key?: string) {
    if (key) delete this.cache[key];
    else this.cache = {};
  }
}

export const DataStorage = new DataStorageService();
