// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, SafeAreaView, StatusBar, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { Colors, Typography, Spacing } from '../utils/theme';
import { supabase } from '../services/supabase';

type LoginMode = 'credentials' | 'pin' | 'biometric';

export default function LoginScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { signIn, signInWithBiometrics, verifyPIN, hasBiometrics } = useAuth();

  const [mode, setMode] = useState<LoginMode>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasBio, setHasBio] = useState(false);
  const [lang, setLang] = useState<'it' | 'en'>('it');

  useEffect(() => {
    hasBiometrics().then(setHasBio);
  }, []);

  const toggleLang = () => {
    const newLang = lang === 'it' ? 'en' : 'it';
    setLang(newLang);
    i18n.changeLanguage(newLang);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      return Alert.alert('Attenzione', 'Inserisci prima la tua email');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://claudiogargiulo1-hash.github.io/aps-web',
    });
    if (error) {
      Alert.alert(t('error'), error.message);
    } else {
      Alert.alert('Email inviata', 'Controlla la tua casella di posta per reimpostare la password');
    }
  };

  const handleCredentialLogin = async () => {
    if (!email || !password) return Alert.alert(t('error'), t('required_field'));
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) Alert.alert(t('error'), t('login_error'));
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    const { error } = await signInWithBiometrics();
    setLoading(false);
    if (error) Alert.alert(t('error'), error);
  };

  const handlePINLogin = async () => {
    if (pin.length !== 6) return;
    setLoading(true);
    const ok = await verifyPIN(pin);
    setLoading(false);
    if (!ok) {
      Alert.alert(t('error'), 'PIN non corretto / Wrong PIN');
      setPin('');
    }
  };

  const renderPINDots = () => (
    <View style={styles.pinDots}>
      {[0,1,2,3,4,5].map(i => (
        <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
      ))}
    </View>
  );

  const renderPINPad = () => (
    <View style={styles.pinPad}>
      {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => (
        <TouchableOpacity
          key={idx}
          style={[styles.pinKey, key === '' && styles.pinKeyEmpty]}
          disabled={key === ''}
          onPress={() => {
            if (key === '⌫') {
              setPin(p => p.slice(0, -1));
            } else if (pin.length < 6) {
              const newPin = pin + key;
              setPin(newPin);
              if (newPin.length === 6) {
                setTimeout(() => handlePINLogin(), 100);
              }
            }
          }}
        >
          {key !== '' && <Text style={styles.pinKeyText}>{key}</Text>}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Language toggle */}
      <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
        <Text style={styles.langText}>{lang === 'it' ? '🇮🇹 IT' : '🇬🇧 EN'}</Text>
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🩺</Text>
          </View>
          <Text style={styles.appName}>{t('app_name')}</Text>
          <Text style={styles.appSubtitle}>{t('app_subtitle')}</Text>
        </View>

        {/* Mode selector */}
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'credentials' && styles.modeBtnActive]}
            onPress={() => setMode('credentials')}>
            <Text style={[styles.modeBtnText, mode === 'credentials' && styles.modeBtnTextActive]}>
              🔐 Password
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'pin' && styles.modeBtnActive]}
            onPress={() => setMode('pin')}>
            <Text style={[styles.modeBtnText, mode === 'pin' && styles.modeBtnTextActive]}>
              🔢 PIN
            </Text>
          </TouchableOpacity>
          {hasBio && (
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'biometric' && styles.modeBtnActive]}
              onPress={() => setMode('biometric')}>
              <Text style={[styles.modeBtnText, mode === 'biometric' && styles.modeBtnTextActive]}>
                👁 Bio
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Login form */}
        <View style={styles.form}>
          {mode === 'credentials' && (
            <>
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                placeholderTextColor={Colors.textLight}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              <TextInput
                style={styles.input}
                placeholder={t('password')}
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
              />
              <TouchableOpacity
                style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                onPress={handleCredentialLogin}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.loginBtnText}>{t('login')}</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword}>
                <Text style={styles.forgotText}>Password dimenticata?</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.registerBtn} onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerText}>Non hai un account? <Text style={styles.registerBold}>Registrati</Text></Text>
              </TouchableOpacity>
            </>
          )}

          {mode === 'pin' && (
            <>
              <Text style={styles.pinLabel}>{t('enter_pin')}</Text>
              {renderPINDots()}
              {renderPINPad()}
            </>
          )}

          {mode === 'biometric' && (
            <View style={styles.bioContainer}>
              <TouchableOpacity style={styles.bioButton} onPress={handleBiometricLogin} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="large" color={Colors.primary} />
                  : <Text style={styles.bioIcon}>🔍</Text>
                }
              </TouchableOpacity>
              <Text style={styles.bioText}>{t('biometric_prompt')}</Text>
            </View>
          )}
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  langBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 20 },
  langText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  logoIcon: { fontSize: 40 },
  appName: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  appSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, letterSpacing: 1 },
  modeSelector: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 4, marginBottom: 24 },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 9 },
  modeBtnActive: { backgroundColor: '#fff' },
  modeBtnText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 13 },
  modeBtnTextActive: { color: Colors.primary },
  form: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  input: { backgroundColor: '#F0F7FA', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, fontSize: 16, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  loginBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  forgotBtn: { alignItems: 'center', marginTop: 14 },
  forgotText: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  registerBtn: { alignItems: 'center', marginTop: 10 },
  registerText: { color: Colors.textLight, fontSize: 14 },
  registerBold: { color: Colors.primary, fontWeight: '700' },
  // PIN styles
  pinLabel: { textAlign: 'center', fontSize: 16, color: Colors.text, marginBottom: 24, fontWeight: '500' },
  pinDots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32, gap: 12 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.primary, backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: Colors.primary },
  pinPad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  pinKey: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0F7FA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  pinKeyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  pinKeyText: { fontSize: 24, fontWeight: '600', color: Colors.text },
  // Biometric styles
  bioContainer: { alignItems: 'center', paddingVertical: 24 },
  bioButton: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F0F7FA', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: Colors.primary },
  bioIcon: { fontSize: 48 },
  bioText: { textAlign: 'center', color: Colors.textLight, fontSize: 14 },
});
