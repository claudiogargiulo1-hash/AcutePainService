// src/screens/RegisterScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { Colors, Typography, Spacing } from '../utils/theme';

const FUNCTION_URL = 'https://oigokazmocdfufjxxyji.supabase.co/functions/v1/manage-users';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZ29rYXptb2NkZnVmanh4eWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU2NjgsImV4cCI6MjA4NzgyMTY2OH0.e_c2CHXgsTbeMaF0m3dYtc_eMnoGTjOWuot-1BIqgYM';

export default function RegisterScreen({ navigation }: any) {
  const [form, setForm] = useState({
    dbCode: '',
    firstName: '',
    lastName: '',
    email: '',
    department: '',
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const setField = (key: string) => (value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    if (!form.dbCode || !form.firstName || !form.lastName || !form.email) {
      Alert.alert('Attenzione', 'Compila tutti i campi obbligatori (*)');
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(form.email)) {
      Alert.alert('Attenzione', 'Inserisci un indirizzo email valido');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + ANON_KEY,
        },
        body: JSON.stringify({
          action: 'register',
          dbCode: form.dbCode,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          department: form.department,
          message: form.message,
        }),
      });
      const data = await res.json();
      if (data.error) {
        Alert.alert('Errore', data.error);
      } else {
        Alert.alert(
          'Richiesta inviata',
          'La tua richiesta è stata inviata. Riceverai una notifica quando il tuo account sarà approvato.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (e) {
      Alert.alert('Errore', 'Impossibile inviare la richiesta. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🩺</Text>
          </View>
          <Text style={styles.title}>Richiedi Accesso</Text>
          <Text style={styles.subtitle}>Compila il modulo per richiedere un account</Text>
        </View>

        <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>CODICE DATABASE *</Text>
              <TextInput
                style={styles.input}
                placeholder="Es. IOR-2024"
                placeholderTextColor={Colors.textLight}
                value={form.dbCode}
                onChangeText={setField('dbCode')}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>NOME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mario"
                  placeholderTextColor={Colors.textLight}
                  value={form.firstName}
                  onChangeText={setField('firstName')}
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>COGNOME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Rossi"
                  placeholderTextColor={Colors.textLight}
                  value={form.lastName}
                  onChangeText={setField('lastName')}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>EMAIL *</Text>
              <TextInput
                style={styles.input}
                placeholder="mario.rossi@ospedale.it"
                placeholderTextColor={Colors.textLight}
                value={form.email}
                onChangeText={setField('email')}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>REPARTO</Text>
              <TextInput
                style={styles.input}
                placeholder="Es. Ortopedia, Terapia Intensiva..."
                placeholderTextColor={Colors.textLight}
                value={form.department}
                onChangeText={setField('department')}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>MESSAGGIO</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Motivo della richiesta, ruolo previsto..."
                placeholderTextColor={Colors.textLight}
                value={form.message}
                onChangeText={setField('message')}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Invia Richiesta</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.goBack()}>
              <Text style={styles.loginLinkText}>Hai già un account? <Text style={styles.loginLinkBold}>Accedi</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primary },
  inner: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 12, paddingBottom: 24, paddingHorizontal: 24 },
  backBtn: {
    position: 'absolute', left: 16, top: 12,
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: '#fff', fontSize: 18 },
  logoContainer: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  logoIcon: { fontSize: 32 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, textAlign: 'center' },
  formContainer: { paddingHorizontal: 16, paddingBottom: 32 },
  form: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  field: { marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textLight,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F0F7FA', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  textArea: { minHeight: 80, paddingTop: 12 },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { color: Colors.textLight, fontSize: 14 },
  loginLinkBold: { color: Colors.primary, fontWeight: '700' },
});
