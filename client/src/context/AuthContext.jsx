import { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://npkozldwxhkhiuxmwbua.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa296bGR3eGhraGl1eG13YnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTk4NjYsImV4cCI6MjA4NTczNTg2Nn0.pvn3Z-Osncx-13zpbx_UX2_da6QuGm3FmDTffjMdhMo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [human, setHuman] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchHuman(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchHuman(session.user.id);
      } else {
        setHuman(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchHuman = async (userId) => {
    const { data } = await supabase
      .from('humans')
      .select('*')
      .eq('id', userId)
      .single();
    setHuman(data);
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { data, error };
  };

  const signUp = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName }
      }
    });

    if (data.user && !error) {
      // Create human record
      await supabase.from('humans').insert({
        id: data.user.id,
        email,
        display_name: displayName,
        email_verified: false,
        tier: 'new'
      });
    }

    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setHuman(null);
  };

  const signInWithProvider = async (provider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
    return { data, error };
  };

  const signInWithGitHub = () => signInWithProvider('github');
  const signInWithGoogle = () => signInWithProvider('google');

  const value = {
    user,
    human,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithGitHub,
    signInWithGoogle,
    supabase
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
