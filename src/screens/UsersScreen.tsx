// src/screens/UsersScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTenant } from '../navigation/AppNavigator';
import { Colors } from '../utils/theme';

const FUNCTION_URL = 'https://oigokazmocdfufjxxyji.supabase.co/functions/v1/manage-users';
const TENANT_FUNCTION_URL = 'https://oigokazmocdfufjxxyji.supabase.co/functions/v1/manage-tenants';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pZ29rYXptb2NkZnVmanh4eWppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNDU2NjgsImV4cCI6MjA4NzgyMTY2OH0.e_c2CHXgsTbeMaF0m3dYtc_eMnoGTjOWuot-1BIqgYM';

const roleColor: Record<string, string> = {
  admin: '#7C3AED', medico: '#0A6E6E', infermiere: '#00BFA5', paziente: '#F59E0B'
};

export default function UsersScreen({ navigation }: any) {
  const { profile } = useAuth();
  const { clearTenant } = useTenant();

  const [users, setUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Approve modal
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [approveRole, setApproveRole] = useState('infermiere');
  const [approving, setApproving] = useState(false);

  // Delete database modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    email: '', password: '', role: 'infermiere',
    firstName: '', lastName: '', department: '', badgeNumber: '', phone: '',
  });

  useEffect(() => { fetchUsers(); fetchPendingRequests(); }, []);

  const callFn = async (body: any) => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { Alert.alert('Errore', 'Sessione scaduta'); return {}; }
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'apikey': ANON_KEY },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const callTenantFn = async (body: any) => {
    const res = await fetch(TENANT_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').neq('status', 'pending').order('last_name');
    setUsers(data || []);
    setLoading(false);
  };

  const fetchPendingRequests = async () => {
    const res = await callFn({ action: 'list_requests' });
    setPendingRequests(res?.requests || []);
  };

  const openApproveModal = (req: any) => {
    setApproveRole('infermiere');
    setApproveTarget(req);
  };

  const confirmApprove = async () => {
    setApproving(true);
    const res = await callFn({ action: 'approve_request', userId: approveTarget.id, role: approveRole });
    setApproving(false);
    if (res?.error) {
      Alert.alert('Errore', res.error);
    } else {
      setApproveTarget(null);
      fetchUsers();
      fetchPendingRequests();
    }
  };

  const rejectRequest = async (req: any) => {
    Alert.alert('Rifiuta richiesta', `Rifiutare ${req.first_name} ${req.last_name}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rifiuta', style: 'destructive', onPress: async () => {
        const res = await callFn({ action: 'reject_request', userId: req.id });
        if (res?.error) Alert.alert('Errore', res.error);
        else fetchPendingRequests();
      }},
    ]);
  };

  const createUser = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori'); return;
    }
    setSaving(true);
    const res = await callFn({ action: 'create', ...form });
    setSaving(false);
    if (res?.error) { Alert.alert('Errore', res.error); return; }
    setShowForm(false);
    setForm({ email: '', password: '', role: 'infermiere', firstName: '', lastName: '', department: '', badgeNumber: '', phone: '' });
    fetchUsers();
  };

  const updateRole = async (userId: string, role: string) => {
    const res = await callFn({ action: 'update_role', userId, role });
    if (res?.error) Alert.alert('Errore', res.error);
    else fetchUsers();
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    Alert.alert(
      isActive ? 'Disattiva utente' : 'Riattiva utente',
      isActive ? 'Disattivare questo utente?' : 'Riattivare questo utente?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Conferma', onPress: async () => {
          const res = await callFn({ action: 'toggle_active', userId });
          if (res?.error) Alert.alert('Errore', res.error);
          else fetchUsers();
        }},
      ]
    );
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { Alert.alert('Errore', 'Password minimo 6 caratteri'); return; }
    setSaving(true);
    const res = await callFn({ action: 'reset_password', userId: resetUser.id, password: newPassword });
    setSaving(false);
    if (res?.error) { Alert.alert('Errore', res.error); return; }
    setResetUser(null); setNewPassword('');
    Alert.alert('✅', 'Password aggiornata!');
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
        <Text style={styles.headerTitle}>Gestione Utenti</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Nuovo</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Richieste in attesa */}
          {pendingRequests.length > 0 && (
            <View style={styles.pendingSection}>
              <View style={styles.pendingSectionHeader}>
                <Text style={styles.pendingSectionTitle}>Richieste in attesa</Text>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{pendingRequests.length}</Text>
                </View>
              </View>
              {pendingRequests.map((req: any) => (
                <View key={req.id} style={styles.pendingCard}>
                  <View style={styles.userInfo}>
                    <View style={[styles.avatar, { backgroundColor: '#FEF3C740' }]}>
                      <Text style={[styles.avatarText, { color: '#D97706' }]}>
                        {req.first_name?.[0]}{req.last_name?.[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{req.last_name} {req.first_name}</Text>
                      <Text style={styles.userEmail}>{req.email}</Text>
                      <Text style={styles.userDept}>{req.department || 'Reparto non specificato'}</Text>
                      {req.created_at && (
                        <Text style={styles.pendingDate}>
                          {new Date(req.created_at).toLocaleDateString('it-IT')}
                        </Text>
                      )}
                      {req.message ? <Text style={styles.pendingMessage}>"{req.message}"</Text> : null}
                    </View>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => openApproveModal(req)} style={styles.approveBtn}>
                      <Text style={styles.approveBtnText}>✅ Approva</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => rejectRequest(req)} style={styles.rejectBtn}>
                      <Text style={styles.rejectBtnText}>❌ Rifiuta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Utenti attivi */}
          {users.map(u => (
            <View key={u.id} style={styles.userCard}>
              {/* Avatar + info */}
              <View style={styles.userInfo}>
                <View style={[styles.avatar, { backgroundColor: (roleColor[u.role] || Colors.primary) + '25' }]}>
                  <Text style={[styles.avatarText, { color: roleColor[u.role] || Colors.primary }]}>
                    {u.first_name?.[0]}{u.last_name?.[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userName}>{u.last_name} {u.first_name}</Text>
                  <Text style={styles.userEmail}>{u.email}</Text>
                  <Text style={styles.userDept}>{u.department || 'N/D'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: u.is_active ? '#DCFCE7' : '#FEE2E2' }]}>
                  <Text style={[styles.statusText, { color: u.is_active ? '#166534' : '#DC2626' }]}>
                    {u.is_active ? 'Attivo' : 'Inattivo'}
                  </Text>
                </View>
              </View>

              {/* Role selector */}
              <View style={styles.roleRow}>
                <Text style={styles.roleLabel}>Ruolo:</Text>
                {['admin','medico','infermiere','paziente'].map(r => (
                  <TouchableOpacity key={r} onPress={() => updateRole(u.id, r)}
                    style={[styles.roleChip, u.role === r && { backgroundColor: roleColor[r], borderColor: roleColor[r] }]}>
                    <Text style={[styles.roleChipText, u.role === r && { color: '#fff' }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => setResetUser(u)} style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>🔑 Reset pw</Text>
                </TouchableOpacity>
                {u.id !== profile?.id && (
                  <TouchableOpacity onPress={() => toggleActive(u.id, u.is_active)}
                    style={[styles.actionBtn, { backgroundColor: u.is_active ? '#FEE2E2' : '#DCFCE7' }]}>
                    <Text style={[styles.actionBtnText, { color: u.is_active ? '#DC2626' : '#166534' }]}>
                      {u.is_active ? '🚫 Disattiva' : '✅ Riattiva'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* ⚠️ Zona Pericolosa */}
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
      )}

      {/* Modal approvazione con ruolo */}
      <Modal visible={!!approveTarget} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Approva Richiesta</Text>
            <TouchableOpacity onPress={() => setApproveTarget(null)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1A2B2B', marginBottom: 4 }}>
              {approveTarget?.last_name} {approveTarget?.first_name}
            </Text>
            <Text style={{ fontSize: 13, color: '#6B8080', marginBottom: 4 }}>{approveTarget?.email}</Text>
            {approveTarget?.department ? (
              <Text style={{ fontSize: 12, color: '#A0B4B4', marginBottom: 4 }}>{approveTarget.department}</Text>
            ) : null}
            {approveTarget?.message ? (
              <Text style={{ fontSize: 12, color: '#92400E', fontStyle: 'italic', marginBottom: 16 }}>
                "{approveTarget.message}"
              </Text>
            ) : <View style={{ marginBottom: 16 }} />}

            <Text style={styles.fieldLabel}>ASSEGNA RUOLO</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 24 }}>
              {['admin','medico','infermiere','paziente'].map(r => (
                <TouchableOpacity key={r} onPress={() => setApproveRole(r)}
                  style={[styles.roleChip, approveRole === r && { backgroundColor: roleColor[r], borderColor: roleColor[r] }, { paddingHorizontal: 16, paddingVertical: 10 }]}>
                  <Text style={[styles.roleChipText, approveRole === r && { color: '#fff' }, { fontSize: 13 }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, approving && { opacity: 0.6 }]}
              onPress={confirmApprove} disabled={approving}>
              {approving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>✅ Approva come {approveRole}</Text>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal nuovo utente */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuovo Utente</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>
            {([['Nome *', 'firstName'], ['Cognome *', 'lastName'], ['Email *', 'email'], ['Password *', 'password'], ['Reparto', 'department'], ['Badge', 'badgeNumber'], ['Telefono', 'phone']] as [string, string][]).map(([label, key]) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
                <TextInput
                  style={styles.input}
                  value={(form as any)[key]}
                  onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                  secureTextEntry={key === 'password'}
                  autoCapitalize={key === 'email' ? 'none' : 'words'}
                  keyboardType={key === 'email' ? 'email-address' : 'default'}
                  placeholderTextColor={Colors.textLight}
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>RUOLO</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {['admin','medico','infermiere','paziente'].map(r => (
                <TouchableOpacity key={r} onPress={() => setForm(f => ({ ...f, role: r }))}
                  style={[styles.roleChip, form.role === r && { backgroundColor: roleColor[r], borderColor: roleColor[r] }]}>
                  <Text style={[styles.roleChipText, form.role === r && { color: '#fff' }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={createUser} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Crea Utente</Text>}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal reset password */}
      <Modal visible={!!resetUser} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <TouchableOpacity onPress={() => { setResetUser(null); setNewPassword(''); }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={{ color: Colors.textLight, marginBottom: 20 }}>
              {resetUser?.first_name} {resetUser?.last_name}
            </Text>
            <Text style={styles.fieldLabel}>NUOVA PASSWORD</Text>
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword}
              placeholder="Minimo 6 caratteri" placeholderTextColor={Colors.textLight}
              secureTextEntry />
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#E53E3E', marginTop: 20 }, saving && { opacity: 0.6 }]}
              onPress={resetPassword} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Aggiorna Password</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

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
  addBtn: { backgroundColor: '#00BFA5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  userCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', fontSize: 15 },
  userName: { fontSize: 14, fontWeight: '700', color: '#1A2B2B' },
  userEmail: { fontSize: 12, color: '#6B8080', marginTop: 2 },
  userDept: { fontSize: 11, color: '#A0B4B4', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  roleLabel: { fontSize: 12, color: '#6B8080', fontWeight: '600' },
  roleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, borderColor: '#D4E6E6' },
  roleChipText: { fontSize: 11, fontWeight: '600', color: '#1A2B2B' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#92400E' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A2B2B' },
  closeBtn: { fontSize: 18, color: '#6B8080', padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B8080', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderColor: '#D4E6E6', borderRadius: 10, padding: 12, fontSize: 15, color: '#1A2B2B', backgroundColor: '#FAFEFE', marginBottom: 4 },
  saveBtn: { backgroundColor: '#0A6E6E', padding: 16, borderRadius: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Pending section
  pendingSection: { marginBottom: 16 },
  pendingSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  pendingSectionTitle: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  pendingBadge: { backgroundColor: '#F59E0B', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  pendingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pendingCard: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: '#FDE68A' },
  pendingDate: { fontSize: 10, color: '#A0B4B4', marginTop: 2 },
  pendingMessage: { fontSize: 11, color: '#92400E', marginTop: 3, fontStyle: 'italic' },
  approveBtn: { flex: 1, backgroundColor: '#DCFCE7', padding: 10, borderRadius: 10, alignItems: 'center' },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: '#166534' },
  rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', padding: 10, borderRadius: 10, alignItems: 'center' },
  rejectBtnText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  // Danger zone
  dangerZone: { marginTop: 24, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#FCA5A5' },
  dangerTitle: { fontSize: 15, fontWeight: '800', color: '#DC2626', marginBottom: 6 },
  dangerSubtitle: { fontSize: 12, color: '#6B7280', marginBottom: 14, lineHeight: 18 },
  deleteDbBtn: { backgroundColor: '#DC2626', padding: 14, borderRadius: 12, alignItems: 'center' },
  deleteDbBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Delete modal
  dangerWarningBox: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#FECACA' },
  dangerWarningTitle: { fontSize: 14, fontWeight: '800', color: '#DC2626', marginBottom: 10 },
  dangerWarningText: { fontSize: 13, color: '#7F1D1D', lineHeight: 22 },
  deleteConfirmBtn: { backgroundColor: '#DC2626', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  deleteConfirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
