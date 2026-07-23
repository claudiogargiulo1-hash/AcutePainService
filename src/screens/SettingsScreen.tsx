// src/screens/SettingsScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator, SafeAreaView, Switch,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useTenant } from '../navigation/AppNavigator';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../utils/theme';

const TENANT_FUNCTION_URL = 'https://oigokazmocdfufjxxyji.supabase.co/functions/v1/manage-tenants';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZ29rYXptb2NkZnVmanh4eWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU2NjgsImV4cCI6MjA4NzgyMTY2OH0.e_c2CHXgsTbeMaF0m3dYtc_eMnoGTjOWuot-1BIqgYM';

export default function SettingsScreen({ navigation }: any) {
  const { clearTenant } = useTenant();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [tenantName, setTenantName] = useState('');
  const [tenantCode, setTenantCode] = useState('');

  // Wards management
  const [wards, setWards] = useState<{ id: string; name: string; is_active: boolean; sort_order: number }[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});

  // Change password
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Delete database modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    AsyncStorage.multiGet(['tenant_name', 'tenant_code']).then(pairs => {
      setTenantName(pairs[0][1] || '');
      setTenantCode(pairs[1][1] || '');
    });
    if (isAdmin) loadWards();
  }, [isAdmin]);

  const loadWards = async () => {
    setWardsLoading(true);
    const { data } = await supabase
      .from('wards')
      .select('id, name, is_active, sort_order')
      .order('sort_order');
    setWards(data || []);
    setWardsLoading(false);
  };

  const toggleWard = async (id: string, current: boolean) => {
    setWards(prev => prev.map(w => w.id === id ? { ...w, is_active: !current } : w));
    await supabase.from('wards').update({ is_active: !current }).eq('id', id);
  };

  const deactivateWard = async (id: string) => {
    swipeableRefs.current[id]?.close();
    setWards(prev => prev.map(w => w.id === id ? { ...w, is_active: false } : w));
    await supabase.from('wards').update({ is_active: false }).eq('id', id);
  };

  const handleAddWard = () => {
    let wardName = '';
    Alert.prompt(
      'Nuovo Reparto',
      'Inserisci il nome del reparto:',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Aggiungi',
          onPress: async (text) => {
            const name = (text || '').trim();
            if (!name) return;
            const maxOrder = wards.reduce((m, w) => Math.max(m, w.sort_order ?? 0), 0);
            const { data, error } = await supabase
              .from('wards')
              .insert({ name, is_active: true, sort_order: maxOrder + 1 })
              .select('id, name, is_active, sort_order')
              .single();
            if (error) { Alert.alert('Errore', error.message); return; }
            if (data) setWards(prev => [...prev, data]);
          },
        },
      ],
      'plain-text',
    );
  };

  const callTenantFn = async (body: any) => {
    const res = await fetch(TENANT_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
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

    // Step 1: verify old password
    const verifyRes = await callTenantFn({ action: 'verify', code: tenantCode, password: oldPassword });
    if (verifyRes?.error) {
      setSavingPassword(false);
      Alert.alert('Errore', 'Vecchia password non corretta');
      return;
    }

    // Step 2: update with new password
    const updateRes = await callTenantFn({ action: 'update_db_password', code: tenantCode, password: oldPassword, newPassword });
    setSavingPassword(false);

    if (updateRes?.error) {
      Alert.alert('Errore', updateRes.error);
      return;
    }

    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('✅ Successo', 'Password del database aggiornata');
  };

  const handleDeleteDatabase = () => {
    Alert.alert(
      '⚠️ ATTENZIONE',
      'Questa azione è IRREVERSIBILE!\n\nTutti i dati del database (pazienti, misurazioni, utenti) verranno eliminati permanentemente.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Continua', style: 'destructive', onPress: () => {
          setDeletePassword('');
          setDeleteConfirmText('');
          setShowDeleteModal(true);
        }},
      ]
    );
  };

  const confirmDeleteDatabase = async () => {
    if (!deletePassword) { Alert.alert('Errore', 'Inserisci la password del database'); return; }
    if (deleteConfirmText !== 'ELIMINA') { Alert.alert('Errore', 'Scrivi esattamente ELIMINA per confermare'); return; }
    setDeleting(true);
    const code = await AsyncStorage.getItem('tenant_code');
    const res = await callTenantFn({ action: 'delete', code, password: deletePassword, confirmText: deleteConfirmText });
    setDeleting(false);
    if (res?.error) { Alert.alert('Errore', res.error); return; }
    setShowDeleteModal(false);
    await AsyncStorage.multiRemove(['tenant_code', 'tenant_id', 'tenant_name']);
    await supabase.auth.signOut();
    clearTenant();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Impostazioni</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Database info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informazioni Database</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>NOME</Text>
            <Text style={styles.infoValue}>{tenantName || '—'}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>CODICE</Text>
            <Text style={[styles.infoValue, { fontFamily: 'Courier', letterSpacing: 2, color: Colors.primary }]}>
              {tenantCode || '—'}
            </Text>
          </View>
        </View>

        {/* Change password */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cambia Password Database</Text>

          <Text style={styles.fieldLabel}>VECCHIA PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={oldPassword}
            onChangeText={setOldPassword}
            placeholder="Password attuale"
            placeholderTextColor={Colors.textLight}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>NUOVA PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Minimo 6 caratteri"
            placeholderTextColor={Colors.textLight}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { marginTop: 12 }]}>CONFERMA NUOVA PASSWORD</Text>
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
        </View>

        {/* Gestione Reparti — admin only */}
        {isAdmin && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={styles.cardTitle}>Gestione Reparti</Text>
              <TouchableOpacity onPress={handleAddWard} style={styles.addWardBtn}>
                <Text style={styles.addWardBtnText}>+ Aggiungi</Text>
              </TouchableOpacity>
            </View>

            {wardsLoading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : wards.length === 0 ? (
              <Text style={{ color: Colors.textLight, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                Nessun reparto configurato
              </Text>
            ) : (
              wards.map(ward => (
                <Swipeable
                  key={ward.id}
                  ref={ref => { swipeableRefs.current[ward.id] = ref; }}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.swipeDelete}
                      onPress={() => deactivateWard(ward.id)}>
                      <Text style={styles.swipeDeleteText}>Disattiva</Text>
                    </TouchableOpacity>
                  )}>
                  <View style={styles.wardRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.wardName, !ward.is_active && { color: Colors.textLight }]}>
                        {ward.name}
                      </Text>
                      {!ward.is_active && (
                        <Text style={styles.wardInactive}>Disattivato</Text>
                      )}
                    </View>
                    <Switch
                      value={ward.is_active}
                      onValueChange={() => toggleWard(ward.id, ward.is_active)}
                      trackColor={{ false: '#D4E6E6', true: Colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                </Swipeable>
              ))
            )}
          </View>
        )}

        {/* Danger zone */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>⚠️ Zona Pericolosa</Text>
          <Text style={styles.dangerSubtitle}>
            Le azioni seguenti sono irreversibili e possono causare la perdita permanente dei dati.
          </Text>
          <TouchableOpacity style={styles.deleteDbBtn} onPress={handleDeleteDatabase}>
            <Text style={styles.deleteDbBtnText}>🗑 Elimina Database</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal elimina database */}
      <Modal visible={showDeleteModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: '#DC2626' }]}>🗑 Elimina Database</Text>
            <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 20 }}>
            <View style={styles.dangerWarningBox}>
              <Text style={styles.dangerWarningTitle}>⚠️ ATTENZIONE: Questa azione è irreversibile!</Text>
              <Text style={styles.dangerWarningText}>
                Verranno eliminati permanentemente:{'\n'}
                • Tutti i pazienti e le loro misurazioni{'\n'}
                • Tutti gli utenti e i profili{'\n'}
                • Tutte le notifiche e gli interventi{'\n'}
                • Il database e il suo codice di accesso
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 20 }]}>PASSWORD DATABASE</Text>
            <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Inserisci la password del database"
              placeholderTextColor={Colors.textLight}
              secureTextEntry
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>CONFERMA SCRITTURA "ELIMINA"</Text>
            <TextInput
              style={[styles.input, deleteConfirmText === 'ELIMINA' && { borderColor: '#DC2626' }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder='Scrivi ELIMINA per confermare'
              placeholderTextColor={Colors.textLight}
              autoCapitalize="characters"
            />

            <TouchableOpacity
              style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]}
              onPress={confirmDeleteDatabase}
              disabled={deleting}>
              {deleting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.deleteConfirmBtnText}>🗑 Elimina Definitivamente</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F4' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 8, backgroundColor: '#064F4F', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 18 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.textLight, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  infoLabel: { fontSize: 11, fontWeight: '700', color: Colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: '#1A2B2B', fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B8080', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#D4E6E6', borderRadius: 10, padding: 12, fontSize: 15, color: '#1A2B2B', backgroundColor: '#FAFEFE', marginBottom: 4 },
  saveBtn: { backgroundColor: '#0A6E6E', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dangerZone: { marginTop: 8, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#FCA5A5' },
  dangerTitle: { fontSize: 15, fontWeight: '800', color: '#DC2626', marginBottom: 6 },
  dangerSubtitle: { fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 18 },
  deleteDbBtn: { backgroundColor: '#DC2626', padding: 14, borderRadius: 12, alignItems: 'center' },
  deleteDbBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A2B2B' },
  closeBtn: { fontSize: 18, color: '#6B8080', padding: 4 },
  dangerWarningBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#FECACA' },
  dangerWarningTitle: { fontSize: 14, fontWeight: '800', color: '#DC2626', marginBottom: 10 },
  dangerWarningText: { fontSize: 13, color: '#7F1D1D', lineHeight: 22 },
  deleteConfirmBtn: { backgroundColor: '#DC2626', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  deleteConfirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  addWardBtn: { backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addWardBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  wardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0F4F4', backgroundColor: '#fff' },
  wardName: { fontSize: 14, fontWeight: '600', color: '#1A2B2B' },
  wardInactive: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  swipeDelete: { backgroundColor: '#D97706', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, marginBottom: 0 },
  swipeDeleteText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
