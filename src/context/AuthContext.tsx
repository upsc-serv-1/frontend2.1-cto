import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { OfflineManager } from '../services/OfflineManager';

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth Timeout')), 5000));
        const { data } = await Promise.race([supabase.auth.getSession(), timeout]) as any;
        setSession(data?.session || null);

        // Silent background refresh every time the app opens if we have a base sync
        if (data?.session?.user?.id) {
          try {
            const meta = await OfflineManager.getMetadata();
            // We only run incremental if at least one full sync has happened
            if (meta.lastFullSync) {
              console.log('[Auth] App opened, running background incremental sync...');
              OfflineManager.incrementalSync(data.session.user.id).catch(() => {});
            }
          } catch { /* Silently ignore sync errors during boot */ }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    return { error: error?.message };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
