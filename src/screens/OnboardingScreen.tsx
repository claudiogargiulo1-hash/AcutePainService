// src/screens/OnboardingScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../utils/theme';

const TENANT_FUNCTION_URL = 'https://oigokazmocdfufjxxyji.supabase.co/functions/v1/manage-tenants';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZ29rYXptb2NkZnVmanh4eWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU2NjgsImV4cCI6MjA4NzgyMTY2OH0.e_c2CHXgsTbeMaF0m3dYtc_eMnoGTjOWuot-1BIqgYM';

const ALL_WARDS = [
  'Ortopedia', 'Chirurgia Generale', 'Ginecologia', 'Urologia',
  'Toracica', 'Neurochirurgia', 'Vascolare', 'Cardiochirurgia',
  'ORL', 'Oculistica', 'Maxillofacciale', 'Traumatologia', 'Pediatria', 'Altro',
];

async function callTenantFn(body: any) {
  const res = await fetch(TENANT_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
    body: JSON.stringify(body),
  });
  return res.json();
}

type Mode = 'choose' | 'access' | 'create';

export default function OnboardingScreen({ onComplete }: { onComplete: (code: string) => void }) {
  const [mode, setMode] = useState<Mode>('choose');
  const [loading, setLoading] = useState(false);

  // Access
  const [code, setCode] = useState('');
  const [tenants, setTenants] = useState<any[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [password, setPassword] = useState('');

  // Create
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedWards, setSelectedWards] = useState<string[]>([]);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [createdCode, setCreatedCode] = useState('');

  const loadTenants = async () => {
    setLoadingTenants(true);
    const res = await callTenantFn({ action: 'list' });
    setTenants(res.tenants || []);
    setLoadingTenants(false);
  };

  const handleAccess = async () => {
    if (!code || !password) { Alert.alert('Errore', 'Inserisci codice e password'); return; }
    setLoading(true);
    const res = await callTenantFn({ action: 'verify', code: code.toUpperCase(), password });
    setLoading(false);
    if (res.error) { Alert.alert('Errore', res.error); return; }
    await AsyncStorage.setItem('tenant_code', res.tenant.code);
    await AsyncStorage.setItem('tenant_id', res.tenant.id);
    await AsyncStorage.setItem('tenant_name', res.tenant.name);
    onComplete(res.tenant.code);
  };

  const handleForgotDbPassword = () => {
    Alert.prompt(
      'Password dimenticata',
      'Inserisci il codice del database per ricevere le istruzioni via email',
      async (inputCode) => {
        if (!inputCode?.trim()) return;
        setLoading(true);
        const res = await callTenantFn({ action: 'forgot_db_password', code: inputCode.trim().toUpperCase() });
        setLoading(false);
        if (res.error) {
          Alert.alert('Errore', res.error);
        } else {
          Alert.alert(
            'Email inviata',
            `Le istruzioni per reimpostare la password del database sono state inviate a ${res.email || "l'email dell'amministratore"}.`,
          );
        }
      },
      'plain-text',
      code || '',
    );
  };

  const toggleWard = (ward: string) => {
    setSelectedWards(prev => prev.includes(ward) ? prev.filter(w => w !== ward) : [...prev, ward]);
  };

  const handleCreate = async () => {
    if (!name || !newPassword || !adminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori'); return;
    }
    if (newPassword !== confirmPassword) { Alert.alert('Errore', 'Le password non coincidono'); return; }
    if (selectedWards.length === 0) { Alert.alert('Errore', 'Seleziona almeno un reparto'); return; }
    setLoading(true);
    const res = await callTenantFn({
      action: 'create', name, password: newPassword, wards: selectedWards,
      adminEmail, adminPassword, adminFirstName, adminLastName,
    });
    setLoading(false);
    if (res.error) { Alert.alert('Errore', res.error); return; }
    setCreatedCode(res.code);
  };

  const handleConfirmCode = async () => {
    await AsyncStorage.setItem('tenant_code', createdCode);
    onComplete(createdCode);
  };

  // Schermata codice creato
  if (createdCode) return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.successContainer}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>Database Creato!</Text>
        <Text style={styles.successSubtitle}>Il tuo codice di accesso è:</Text>
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{createdCode}</Text>
        </View>
        <Text style={styles.successNote}>Conserva questo codice e condividilo con il tuo team per accedere al database.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmCode}>
          <Text style={styles.primaryBtnText}>Accedi al Database →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={{ fontSize: 32 }}>🩺</Text>
          </View>
          <Text style={styles.logoTitle}>APS Manager</Text>
          <Text style={styles.logoSubtitle}>Acute Pain Service</Text>
        </View>

        {/* Choose mode */}
        {mode === 'choose' && (
          <View style={styles.chooseContainer}>
            <TouchableOpacity style={styles.optionCard} onPress={() => { setMode('access'); loadTenants(); }}>
              <View style={styles.optionIcon}>
                <Text style={{ fontSize: 24 }}>🔑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Accedi a database esistente</Text>
                <Text style={styles.optionSubtitle}>Hai già un codice di accesso</Text>
              </View>
              <Text style={styles.optionArrow}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.optionCard, styles.optionCardAccent]} onPress={() => setMode('create')}>
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={{ fontSize: 24 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: '#fff' }]}>Crea nuovo database</Text>
                <Text style={[styles.optionSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>Configura un nuovo spazio per il tuo ospedale</Text>
              </View>
              <Text style={[styles.optionArrow, { color: 'rgba(255,255,255,0.7)' }]}>→</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Access mode */}
        {mode === 'access' && (
          <View style={styles.formContainer}>
            <TouchableOpacity onPress={() => setMode('choose')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Indietro</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>🔑 Accedi al Database</Text>

            {/* Lista database disponibili */}
            {loadingTenants ? (
              <ActivityIndicator color={Colors.primary} style={{ marginVertical: 10 }} />
            ) : tenants.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.fieldLabel}>SELEZIONA DATABASE</Text>
                {tenants.map((t: any) => (
                  <TouchableOpacity key={t.code} onPress={() => setCode(t.code)}
                    style={[styles.tenantRow, code === t.code && styles.tenantRowActive]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.tenantName, code === t.code && { color: '#fff' }]}>{t.name}</Text>
                      <Text style={[styles.tenantCode, code === t.code && { color: 'rgba(255,255,255,0.7)' }]}>{t.code}</Text>
                    </View>
                    {code === t.code && <Text style={{ color: '#fff', fontSize: 16 }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.fieldLabel}>OPPURE INSERISCI IL CODICE</Text>
            <TextInput style={[styles.input, { fontFamily: 'Courier', letterSpacing: 2 }]}
              value={code} onChangeText={t => setCode(t.toUpperCase())}
              placeholder="Es. IORDRS-2026" placeholderTextColor={Colors.textLight}
              autoCapitalize="characters" />

            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput style={styles.input}
              value={password} onChangeText={setPassword}
              placeholder="••••••••" placeholderTextColor={Colors.textLight}
              secureTextEntry />

            <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={handleAccess} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Accedi →</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotDbBtn} onPress={handleForgotDbPassword}>
              <Text style={styles.forgotDbText}>Password database dimenticata?</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Create mode */}
        {mode === 'create' && (
          <View style={styles.formContainer}>
            <TouchableOpacity onPress={() => setMode('choose')} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Indietro</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>✨ Crea Nuovo Database</Text>

            {/* Dati ospedale */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 DATI OSPEDALE</Text>
              <Text style={styles.fieldLabel}>NOME OSPEDALE *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName}
                placeholder="Es. Istituto Ortopedico Rizzoli" placeholderTextColor={Colors.textLight} />
              <Text style={styles.fieldLabel}>PASSWORD DATABASE *</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
                placeholder="Password per accedere al database" placeholderTextColor={Colors.textLight}
                secureTextEntry />
              <Text style={styles.fieldLabel}>CONFERMA PASSWORD *</Text>
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword}
                placeholder="Ripeti la password" placeholderTextColor={Colors.textLight}
                secureTextEntry />
            </View>

            {/* Reparti */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏥 REPARTI</Text>
              <View style={styles.chipsContainer}>
                {ALL_WARDS.map(ward => (
                  <TouchableOpacity key={ward}
                    onPress={() => toggleWard(ward)}
                    style={[styles.chip, selectedWards.includes(ward) && styles.chipActive]}>
                    <Text style={[styles.chipText, selectedWards.includes(ward) && styles.chipTextActive]}>{ward}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Admin */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👤 ACCOUNT AMMINISTRATORE</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>NOME *</Text>
                  <TextInput style={styles.input} value={adminFirstName} onChangeText={setAdminFirstName}
                    placeholderTextColor={Colors.textLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>COGNOME *</Text>
                  <TextInput style={styles.input} value={adminLastName} onChangeText={setAdminLastName}
                    placeholderTextColor={Colors.textLight} />
                </View>
              </View>
              <Text style={styles.fieldLabel}>EMAIL *</Text>
              <TextInput style={styles.input} value={adminEmail} onChangeText={setAdminEmail}
                placeholder="admin@ospedale.it" placeholderTextColor={Colors.textLight}
                keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.fieldLabel}>PASSWORD ACCOUNT *</Text>
              <TextInput style={styles.input} value={adminPassword} onChangeText={setAdminPassword}
                placeholder="Password per il login" placeholderTextColor={Colors.textLight}
                secureTextEntry />
            </View>

            <TouchableOpacity style={[styles.accentBtn, loading && { opacity: 0.6 }]}
              onPress={handleCreate} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>✨ Crea Database</Text>}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#064F4F' },
  logoContainer: { alignItems: 'center', paddingTop: 40, paddingBottom: 32 },
  logoIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  logoTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  logoSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 },
  chooseContainer: { paddingHorizontal: 20, gap: 14 },
  optionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  optionCardAccent: { backgroundColor: '#00BFA5' },
  optionIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#E6F4F4', alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '700', color: '#1A2B2B', marginBottom: 3 },
  optionSubtitle: { fontSize: 12, color: '#6B8080' },
  optionArrow: { fontSize: 18, color: '#6B8080' },
  formContainer: { backgroundColor: '#fff', margin: 16, borderRadius: 20, padding: 24 },
  backBtn: { marginBottom: 16 },
  backBtnText: { color: '#6B8080', fontSize: 14 },
  formTitle: { fontSize: 20, fontWeight: '700', color: '#1A2B2B', marginBottom: 20 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B8080', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#D4E6E6', borderRadius: 10, padding: 12, fontSize: 15, color: '#1A2B2B', backgroundColor: '#FAFEFE' },
  primaryBtn: { backgroundColor: '#0A6E6E', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  accentBtn: { backgroundColor: '#00BFA5', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { backgroundColor: '#F0F4F4', borderRadius: 14, padding: 14, marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#0A6E6E', marginBottom: 10 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#D4E6E6', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0A6E6E', borderColor: '#0A6E6E' },
  chipText: { fontSize: 13, color: '#1A2B2B', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  tenantRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#D4E6E6', marginBottom: 8, backgroundColor: '#fff' },
  tenantRowActive: { backgroundColor: '#0A6E6E', borderColor: '#0A6E6E' },
  tenantName: { fontSize: 14, fontWeight: '700', color: '#1A2B2B' },
  tenantCode: { fontSize: 11, color: '#6B8080', fontFamily: 'Courier', marginTop: 2 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successEmoji: { fontSize: 64, marginBottom: 16 },
  successTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 8 },
  successSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 15, marginBottom: 20 },
  codeBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16, marginBottom: 20 },
  codeText: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  successNote: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  forgotDbBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 4 },
  forgotDbText: { color: '#0A6E6E', fontSize: 14, fontWeight: '500' },
});
