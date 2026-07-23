// src/hooks/useAuth.ts
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '../services/supabase';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Profile } from '../types/database';

const PIN_KEY = 'aps_pin';
const EMAIL_KEY = 'aps_email';
const PASSWORD_KEY = 'aps_password';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minuti

interface AuthState {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  sessionActive: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithBiometrics: () => Promise<{ error: string | null }>;
  setPIN: (pin: string) => Promise<void>;
  verifyPIN: (pin: string) => Promise<boolean>;
  hasBiometrics: () => Promise<boolean>;
  refreshSession: () => void;
}

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);
export const useAuth = () => useContext(AuthContext);

export const useAuthProvider = (): AuthContextType => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    sessionActive: false,
  });

  let sessionTimer: ReturnType<typeof setTimeout> | null = null;

  const resetSessionTimer = useCallback(() => {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(async () => { await signOut(); }, SESSION_TIMEOUT);
  }, []);

  const refreshSession = useCallback(() => { resetSessionTimer(); }, [resetSessionTimer]);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return null;
    return data as Profile;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id).then(profile => {
          setState({ user: session.user, profile, loading: false, sessionActive: true });
          resetSessionTimer();
        });
      } else {
        setState(s => ({ ...s, loading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({ user: session.user, profile, loading: false, sessionActive: true });
        resetSessionTimer();
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, profile: null, loading: false, sessionActive: false });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await SecureStore.setItemAsync(EMAIL_KEY, email);
    await SecureStore.setItemAsync(PASSWORD_KEY, password);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (sessionTimer) clearTimeout(sessionTimer);
  };

  const hasBiometrics = async (): Promise<boolean> => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  };

  const signInWithBiometrics = async (): Promise<{ error: string | null }> => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Accedi ad APS Manager',
        cancelLabel: 'Annulla',
      });
      if (!result.success) return { error: 'Autenticazione biometrica annullata' };
      const email = await SecureStore.getItemAsync(EMAIL_KEY);
      const password = await SecureStore.getItemAsync(PASSWORD_KEY);
      if (!email || !password) return { error: 'Nessuna credenziale salvata. Effettua prima il login manuale.' };
      return await signIn(email, password);
    } catch (e: any) {
      return { error: e.message || 'Errore biometria' };
    }
  };

  const setPIN = async (pin: string) => { await SecureStore.setItemAsync(PIN_KEY, pin); };

  const verifyPIN = async (pin: string): Promise<boolean> => {
    const savedPin = await SecureStore.getItemAsync(PIN_KEY);
    if (!savedPin || savedPin !== pin) return false;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) { resetSessionTimer(); setState(s => ({ ...s, sessionActive: true })); return true; }
    return false;
  };

  return { ...state, signIn, signOut, signInWithBiometrics, setPIN, verifyPIN, hasBiometrics, refreshSession };
};
