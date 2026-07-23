// src/screens/ProfileScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, Switch, Alert,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { useTenant } from '../navigation/AppNavigator';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

export default function ProfileScreen({ navigation }: any) {
  const { t, i18n } = useTranslation();
  const { profile, user } = useAuth();
  const { clearTenant } = useTenant();
  const [isIT, setIsIT] = useState(i18n.language === 'it');

  // Change password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const toggleLanguage = (val: boolean) => {
    setIsIT(val);
    i18n.changeLanguage(val ? 'it' : 'en');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Esci', style: 'destructive', onPress: () => supabase.auth.signOut() },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Errore', 'La nuova password e la conferma non corrispondono');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Errore', 'La nuova password deve essere di almeno 6 caratteri');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Errore', error.message);
      return;
    }
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('✅', 'Password aggiornata!');
  };

  const handleChangeDatabase = () => {
    Alert.alert(
      'Cambia Database',
      'Vuoi cambiare database? Verrai disconnesso.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Continua', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove(['tenant_code', 'tenant_id', 'tenant_name']);
          await supabase.auth.signOut();
          clearTenant();
        }},
      ]
    );
  };

  const roleLabel: Record<string, string> = {
    admin: '⚙️ Amministratore',
    medico: '👨‍⚕️ Medico',
    infermiere: '👩‍⚕️ Infermiere',
    paziente: '🧑 Paziente',
  };

  const roleColor: Record<string, string> = {
    admin: '#7C3AED',
    medico: Colors.primary,
    infermiere: Colors.accent,
    paziente: Colors.yellow,
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.first_name} {profile?.last_name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleColor[profile?.role || 'infermiere'] + '20' }]}>
            <Text style={[styles.roleText, { color: roleColor[profile?.role || 'infermiere'] }]}>
              {roleLabel[profile?.role || 'infermiere']}
            </Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informazioni</Text>
          <InfoRow icon="📧" label="Email" value={user?.email || '—'} />
          <InfoRow icon="🏥" label="Reparto" value={profile?.department || '—'} />
          <InfoRow icon="🪪" label="Matricola" value={profile?.badge_number || '—'} />
          <InfoRow icon="📞" label="Telefono" value={profile?.phone || '—'} />
        </View>

        {/* Preferenze */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Preferenze</Text>
          <View style={styles.row}>
            <Text style={styles.rowIcon}>🌍</Text>
            <Text style={styles.rowLabel}>Lingua italiana</Text>
            <Switch
              value={isIT}
              onValueChange={toggleLanguage}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Admin tools - solo admin */}
        {profile?.role === 'admin' && (
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={styles.exportBtn}
              onPress={() => navigation.navigate('Export')}>
              <Text style={styles.exportText}>📊 Esporta Dati CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#7C3AED20' }]}
              onPress={() => navigation.navigate('Users')}>
              <Text style={[styles.exportText, { color: '#7C3AED' }]}>👤 Gestione Utenti</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.exportBtn, { backgroundColor: '#064F4F20' }]}
              onPress={() => navigation.navigate('Settings')}>
              <Text style={[styles.exportText, { color: '#064F4F' }]}>⚙️ Impostazioni</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Cambia Password */}
        <TouchableOpacity style={styles.changePwBtn} onPress={() => {
          setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
          setShowPasswordModal(true);
        }}>
          <Text style={styles.changePwText}>🔑 Cambia Password</Text>
        </TouchableOpacity>

        {/* Cambia Database */}
        <TouchableOpacity style={styles.changeDbBtn} onPress={handleChangeDatabase}>
          <Text style={styles.changeDbText}>🔄 Cambia Database</Text>
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>APS Manager v1.0.0</Text>
      </ScrollView>

      {/* Modal cambia password */}
      <Modal visible={showPasswordModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cambia Password</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.fieldLabel}>PASSWORD ATTUALE</Text>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Password attuale"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
            />
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>NUOVA PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Minimo 6 caratteri"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
            />
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>CONFERMA NUOVA PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Ripeti la nuova password"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.saveBtn, savingPassword && { opacity: 0.6 }]}
              onPress={handleChangePassword}
              disabled={savingPassword}>
              {savingPassword
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>💾 Salva Password</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F9FA' },
  scroll: { padding: Spacing.md, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, ...Shadow.md,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  roleText: { fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowIcon: { fontSize: 20, marginRight: 12 },
  infoLabel: { fontSize: 12, color: Colors.textLight, marginBottom: 2 },
  infoValue: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowLabel: { flex: 1, fontSize: 15, color: Colors.text, fontWeight: '500' },
  exportBtn: {
    backgroundColor: '#EFF6FF', borderRadius: Radius.lg,
    padding: 16, alignItems: 'center', marginBottom: Spacing.sm,
  },
  exportText: { color: '#1D4ED8', fontWeight: '700', fontSize: 16 },
  changePwBtn: {
    backgroundColor: '#F0FDF4', borderRadius: Radius.lg,
    padding: 16, alignItems: 'center', marginBottom: Spacing.sm,
  },
  changePwText: { color: '#166534', fontWeight: '700', fontSize: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  modalClose: { fontSize: 18, color: Colors.textLight, padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12, fontSize: 15, color: Colors.text, backgroundColor: '#FAFEFE', marginBottom: 4 },
  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  changeDbBtn: {
    backgroundColor: '#FFF7ED', borderRadius: Radius.lg,
    padding: 16, alignItems: 'center', marginBottom: Spacing.sm,
  },
  changeDbText: { color: '#C2410C', fontWeight: '700', fontSize: 16 },
  logoutBtn: {
    backgroundColor: '#FEE2E2', borderRadius: Radius.lg,
    padding: 16, alignItems: 'center', marginBottom: Spacing.md,
  },
  logoutText: { color: '#DC2626', fontWeight: '700', fontSize: 16 },
  version: { textAlign: 'center', color: Colors.textLight, fontSize: 12 },
});
