import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

// AsyncStorage accesses window on web — safe-guard during SSR/static render.
const isBrowserOrNative = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isBrowserOrNative ? (AsyncStorage as any) : undefined,
    autoRefreshToken: isBrowserOrNative,
    persistSession: isBrowserOrNative,
    detectSessionInUrl: false,
  },
});

// Public delivery URL prefix from Cloudflare Images (fill once you have CF account)
export const CF_IMAGE_PREFIX = 'https://imagedelivery.net/<YOUR_CF_HASH>';

