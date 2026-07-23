// src/screens/OpioidScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ActivityIndicator
} from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors } from '../utils/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OME_CONVERSION, calcOME } from '../utils/omeConversion';
export { OME_CONVERSION, calcOME };

// Keep OPIOIDS as alias for backward compat with opioid_records display
const OPIOIDS = OME_CONVERSION;

const ROUTES: Record<string, string> = {
  orale: '💊 Orale', ev: '💉 EV', sc: '🩸 SC',
  im: '💪 IM', td: '🩹 TD', sl: '👅 SL',
};

function toMEO(drug: string, dose: number): number {
  return dose * (OPIOIDS[drug]?.factor || 1);
}

function getNow(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ============================================================
// MAIN SCREEN
// ============================================================
export default function OpioidScreen({ route, navigation }: any) {
  const { patientId, patientName, interventionId } = route.params || {};
  const { profile } = useAuth();

  const [records, setRecords] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [tab, setTab] = useState<'somministrato'|'prescritto'>('prescritto');
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Common form fields
  const [drugName, setDrugName] = useState('Morfina orale');
  const [doseMg, setDoseMg] = useState('');
  const [route_, setRoute_] = useState('orale');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDrugPicker, setShowDrugPicker] = useState(false);

  // Somministrato-only
  const [adminAt, setAdminAt] = useState(getNow());

  // Prescritto-only (structured prescription)
  const [isScheduled, setIsScheduled] = useState(true);
  const [frequencyPerDay, setFrequencyPerDay] = useState('2');
  const [prnDosesPerDay, setPrnDosesPerDay] = useState('2');

  useEffect(() => {
    AsyncStorage.getItem('tenant_id').then(setTenantId);
    fetchAll();
  }, [patientId]);

  const fetchAll = async () => {
    setLoading(true);
    const [recRes, presRes] = await Promise.all([
      supabase
        .from('opioid_records')
        .select('*')
        .eq('patient_id', patientId)
        .order('administered_at', { ascending: false }),
      supabase
        .from('opioid_prescriptions')
        .select('*')
        .eq('patient_id', patientId)
        .order('prescribed_at', { ascending: false }),
    ]);
    setRecords(recRes.data || []);
    setPrescriptions(presRes.data || []);
    setLoading(false);
  };

  // Save somministrato → opioid_records
  const saveSomministrato = async () => {
    if (!doseMg || isNaN(parseFloat(doseMg))) {
      Alert.alert('Errore', 'Inserisci una dose valida');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('opioid_records').insert({
      patient_id: patientId,
      intervention_id: interventionId || null,
      drug_name: drugName,
      dose_mg: parseFloat(doseMg),
      route: route_,
      type: 'somministrato',
      administered_at: adminAt ? new Date(adminAt).toISOString() : new Date().toISOString(),
      notes: notes || null,
      recorded_by: profile?.id,
    });
    setSaving(false);
    if (error) { Alert.alert('Errore', error.message); return; }
    resetForm();
    setShowForm(false);
    fetchAll();
  };

  // Save prescritto → opioid_prescriptions
  const savePrescription = async () => {
    if (!doseMg || isNaN(parseFloat(doseMg))) {
      Alert.alert('Errore', 'Inserisci una dose valida');
      return;
    }
    const freq = parseFloat(frequencyPerDay) || 1;
    const prnDoses = parseFloat(prnDosesPerDay) || 2;
    const { omePerDose, omeDaily } = calcOME(drugName, parseFloat(doseMg), !isScheduled, freq, prnDoses);

    setSaving(true);
    const { error } = await supabase.from('opioid_prescriptions').insert({
      patient_id: patientId,
      intervention_id: interventionId || null,
      tenant_id: tenantId,
      drug_name: drugName,
      dose_mg: parseFloat(doseMg),
      route: route_,
      is_prn: !isScheduled,
      frequency_per_day: isScheduled ? freq : null,
      prn_doses_per_day: !isScheduled ? prnDoses : null,
      ome_per_dose: omePerDose,
      ome_daily: omeDaily,
      status: 'active',
      prescribed_by: profile?.id,
      notes: notes || null,
    });
    setSaving(false);
    if (error) { Alert.alert('Errore', error.message); return; }
    resetForm();
    setShowForm(false);
    fetchAll();
  };

  const deletePrescription = async (id: string) => {
    Alert.alert('Elimina', 'Eliminare questa prescrizione?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('opioid_prescriptions').delete().eq('id', id);
        setPrescriptions(prev => prev.filter(r => r.id !== id));
      }},
    ]);
  };

  const discontinuePrescription = async (id: string) => {
    await supabase.from('opioid_prescriptions').update({ status: 'discontinued' }).eq('id', id);
    fetchAll();
  };

  const deleteRecord = async (id: string) => {
    Alert.alert('Elimina', 'Eliminare questa registrazione?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('opioid_records').delete().eq('id', id);
        setRecords(prev => prev.filter(r => r.id !== id));
      }},
    ]);
  };

  const resetForm = () => {
    setDoseMg(''); setNotes(''); setAdminAt(getNow());
    setIsScheduled(true); setFrequencyPerDay('2'); setPrnDosesPerDay('2');
  };

  const filteredRecords = records.filter(r => r.type === 'somministrato');
  const totalMEO24h = filteredRecords
    .filter(r => new Date(r.administered_at) > new Date(Date.now() - 86400000))
    .reduce((s, r) => s + toMEO(r.drug_name, r.dose_mg), 0);

  const activePrescriptions = prescriptions.filter(p => p.status === 'active');
  const totalOmeDaily = activePrescriptions.reduce((s, p) => s + (p.ome_daily || 0), 0);

  const drugRoutes = OPIOIDS[drugName]?.routes || ['orale'];

  // Live OME preview for prescription form
  const doseNum = doseMg && !isNaN(parseFloat(doseMg)) ? parseFloat(doseMg) : null;
  const { omePerDose: previewPerDose, omeDaily: previewDaily } = doseNum
    ? calcOME(drugName, doseNum, !isScheduled, parseFloat(frequencyPerDay) || 1, parseFloat(prnDosesPerDay) || 2)
    : { omePerDose: 0, omeDaily: 0 };

  const omeDailyColor = totalOmeDaily > 90 ? '#E53E3E' : totalOmeDaily > 50 ? '#D97706' : '#00BFA5';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Equivalenti Morfina (OME)</Text>
          {patientName && <Text style={styles.headerSub}>{patientName}</Text>}
        </View>
        <TouchableOpacity onPress={() => { resetForm(); setShowForm(true); }} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Aggiungi</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          {tab === 'somministrato' ? (
            <>
              <View style={[styles.summaryCard, { borderLeftColor: Colors.primary }]}>
                <Text style={styles.summaryLabel}>OME 24h somministrati</Text>
                <Text style={[styles.summaryValue, { color: Colors.primary }]}>{totalMEO24h.toFixed(1)} mg</Text>
                {totalMEO24h > 90 && <Text style={styles.alertText}>⚠️ Dose elevata</Text>}
              </View>
            </>
          ) : (
            <>
              <View style={[styles.summaryCard, { borderLeftColor: omeDailyColor }]}>
                <Text style={styles.summaryLabel}>OME/die prescritto</Text>
                <Text style={[styles.summaryValue, { color: omeDailyColor }]}>{totalOmeDaily.toFixed(1)} mg</Text>
                {totalOmeDaily > 90 && <Text style={styles.alertText}>⚠️ Dose alta</Text>}
                {totalOmeDaily > 50 && totalOmeDaily <= 90 && <Text style={[styles.alertText, { color: '#D97706' }]}>⚠️ Dose moderata</Text>}
              </View>
              <View style={[styles.summaryCard, { borderLeftColor: '#6B8080' }]}>
                <Text style={styles.summaryLabel}>Prescrizioni attive</Text>
                <Text style={[styles.summaryValue, { color: '#1A2B2B' }]}>{activePrescriptions.length}</Text>
              </View>
            </>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['prescritto', 'somministrato'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'somministrato' ? '💉 Somministrato' : '📋 Prescritto'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Records */}
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : tab === 'somministrato' ? (
          filteredRecords.length === 0
            ? <View style={styles.empty}><Text style={styles.emptyText}>Nessun record</Text></View>
            : filteredRecords.map(r => (
              <View key={r.id} style={styles.recordCard}>
                <View style={styles.omeBadge}>
                  <Text style={styles.omeValue}>{toMEO(r.drug_name, r.dose_mg).toFixed(1)}</Text>
                  <Text style={styles.omeLabel}>OME</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordDrug}>{r.drug_name} {r.dose_mg}mg
                    <Text style={styles.recordRoute}> ({ROUTES[r.route] || r.route})</Text>
                  </Text>
                  <Text style={styles.recordTime}>
                    {new Date(r.administered_at).toLocaleDateString('it-IT')} {new Date(r.administered_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {r.notes ? <Text style={styles.recordNotes}>{r.notes}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => deleteRecord(r.id)} style={styles.deleteBtn}>
                  <Text>🗑</Text>
                </TouchableOpacity>
              </View>
            ))
        ) : (
          prescriptions.length === 0
            ? <View style={styles.empty}><Text style={styles.emptyText}>Nessuna prescrizione</Text></View>
            : prescriptions.map(p => {
              const isActive = p.status === 'active';
              return (
                <View key={p.id} style={[styles.recordCard, !isActive && { opacity: 0.5 }]}>
                  <View style={[styles.omeBadge, { backgroundColor: isActive ? '#E6F4F4' : '#F0F0F0' }]}>
                    <Text style={[styles.omeValue, { color: isActive ? '#0A6E6E' : '#999' }]}>
                      {(p.ome_daily || 0).toFixed(1)}
                    </Text>
                    <Text style={styles.omeLabel}>OME/die</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordDrug}>{p.drug_name} {p.dose_mg}mg
                      <Text style={styles.recordRoute}> ({ROUTES[p.route] || p.route})</Text>
                    </Text>
                    <Text style={styles.recordTime}>
                      {p.is_prn
                        ? `PRN · OME/dose: ${(p.ome_per_dose || 0).toFixed(1)} mg`
                        : `${p.frequency_per_day}×/die · OME/dose: ${(p.ome_per_dose || 0).toFixed(1)} mg`}
                    </Text>
                    {p.notes ? <Text style={styles.recordNotes}>{p.notes}</Text> : null}
                    {!isActive && <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Sospeso</Text>}
                  </View>
                  <View style={{ gap: 4 }}>
                    {isActive && (
                      <TouchableOpacity onPress={() => discontinuePrescription(p.id)} style={styles.stopBtn}>
                        <Text style={{ fontSize: 10, color: '#D97706', fontWeight: '700' }}>STOP</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => deletePrescription(p.id)} style={styles.deleteBtn}>
                      <Text>🗑</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
        )}

        {/* Tabella di riferimento */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📖 Tabella OME (CDC 2022, NIH 2024)</Text>
          {Object.entries(OME_CONVERSION).map(([name, info]) => (
            <View key={name} style={styles.tableRow}>
              <Text style={styles.tableDrug}>{name}</Text>
              <Text style={styles.tableFactor}>x{info.factor}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {tab === 'prescritto' ? '📋 Nuova Prescrizione' : '💉 Nuova Somministrazione'}
            </Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Tipo tab (switch) */}
            <Text style={styles.fieldLabel}>TIPO</Text>
            <View style={styles.chipRow}>
              {(['prescritto', 'somministrato'] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setTab(t)}
                  style={[styles.chip, tab === t && styles.chipActive]}>
                  <Text style={[styles.chipText, tab === t && styles.chipTextActive]}>
                    {t === 'prescritto' ? '📋 Prescritto' : '💉 Somministrato'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Farmaco */}
            <Text style={styles.fieldLabel}>FARMACO</Text>
            <TouchableOpacity onPress={() => setShowDrugPicker(true)} style={styles.pickerBtn}>
              <Text style={styles.pickerText}>{drugName} (x{OPIOIDS[drugName]?.factor})</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
            {OPIOIDS[drugName]?.note && (
              <Text style={styles.noteText}>ℹ️ {OPIOIDS[drugName].note}</Text>
            )}

            {/* Dose */}
            <Text style={styles.fieldLabel}>DOSE (mg{drugName.includes('TTS') || drugName.includes('TDS') ? ', mcg/h' : ''})</Text>
            <TextInput style={styles.input} value={doseMg} onChangeText={setDoseMg}
              keyboardType="decimal-pad" placeholder="Es. 10" placeholderTextColor={Colors.textLight} />

            {/* Via */}
            <Text style={styles.fieldLabel}>VIA DI SOMMINISTRAZIONE</Text>
            <View style={styles.chipRow}>
              {drugRoutes.map(r => (
                <TouchableOpacity key={r} onPress={() => setRoute_(r)}
                  style={[styles.chip, route_ === r && styles.chipActive]}>
                  <Text style={[styles.chipText, route_ === r && styles.chipTextActive]}>{ROUTES[r] || r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── Prescritto: Scheduled vs PRN + frequency ── */}
            {tab === 'prescritto' && (
              <>
                <Text style={styles.fieldLabel}>MODALITÀ</Text>
                <View style={styles.chipRow}>
                  <TouchableOpacity onPress={() => setIsScheduled(true)}
                    style={[styles.chip, isScheduled && styles.chipActive]}>
                    <Text style={[styles.chipText, isScheduled && styles.chipTextActive]}>🕐 Scheduled</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsScheduled(false)}
                    style={[styles.chip, !isScheduled && styles.chipActive]}>
                    <Text style={[styles.chipText, !isScheduled && styles.chipTextActive]}>⚡ PRN</Text>
                  </TouchableOpacity>
                </View>

                {isScheduled ? (
                  <>
                    <Text style={styles.fieldLabel}>SOMMINISTRAZIONI/DIE</Text>
                    <View style={styles.chipRow}>
                      {['1','2','3','4','6'].map(n => (
                        <TouchableOpacity key={n} onPress={() => setFrequencyPerDay(n)}
                          style={[styles.chip, frequencyPerDay === n && styles.chipActive]}>
                          <Text style={[styles.chipText, frequencyPerDay === n && styles.chipTextActive]}>{n}×</Text>
                        </TouchableOpacity>
                      ))}
                      <TextInput
                        style={[styles.chip, { width: 60, textAlign: 'center', color: '#1A2B2B' }]}
                        value={frequencyPerDay}
                        onChangeText={setFrequencyPerDay}
                        keyboardType="decimal-pad"
                        placeholder="altro"
                        placeholderTextColor={Colors.textLight}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>DOSI PRN ATTESE/DIE</Text>
                    <View style={styles.chipRow}>
                      {['1','2','3','4'].map(n => (
                        <TouchableOpacity key={n} onPress={() => setPrnDosesPerDay(n)}
                          style={[styles.chip, prnDosesPerDay === n && styles.chipActive]}>
                          <Text style={[styles.chipText, prnDosesPerDay === n && styles.chipTextActive]}>{n}×</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* OME Preview Card */}
                {doseNum !== null && (
                  <View style={styles.omePreviewCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.omePreviewLabel}>OME/dose</Text>
                        <Text style={styles.omePreviewValue}>{previewPerDose.toFixed(1)} mg</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: '#C6E0E0' }} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.omePreviewLabel}>OME/die</Text>
                        <Text style={[styles.omePreviewValue, {
                          color: previewDaily > 90 ? '#E53E3E' : previewDaily > 50 ? '#D97706' : '#0A6E6E'
                        }]}>{previewDaily.toFixed(1)} mg</Text>
                      </View>
                      <View style={{ width: 1, backgroundColor: '#C6E0E0' }} />
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.omePreviewLabel}>Totale attivo</Text>
                        <Text style={[styles.omePreviewValue, { color: omeDailyColor }]}>
                          {(totalOmeDaily + previewDaily).toFixed(1)} mg
                        </Text>
                      </View>
                    </View>
                    {previewDaily > 90 && (
                      <Text style={[styles.alertText, { marginTop: 8, textAlign: 'center' }]}>
                        ⚠️ OME/die &gt; 90 mg — dose elevata
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            {/* Somministrato: Data/Ora */}
            {tab === 'somministrato' && (
              <>
                <Text style={styles.fieldLabel}>DATA/ORA (vuoto = adesso)</Text>
                <TextInput style={styles.input} value={adminAt} onChangeText={setAdminAt}
                  placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={Colors.textLight} />

                {/* MEO preview for administered */}
                {doseNum !== null && (
                  <View style={styles.meoPreview}>
                    <Text style={styles.meoPreviewText}>= {toMEO(drugName, doseNum).toFixed(1)} mg OME</Text>
                  </View>
                )}
              </>
            )}

            {/* Note */}
            <Text style={styles.fieldLabel}>NOTE</Text>
            <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes}
              placeholder="Note..." placeholderTextColor={Colors.textLight} multiline numberOfLines={3} />

            <TouchableOpacity
              onPress={tab === 'prescritto' ? savePrescription : saveSomministrato}
              disabled={saving}
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              <Text style={styles.saveBtnText}>{saving ? 'Salvataggio...' : '💾 Salva'}</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Drug Picker Modal */}
      <Modal visible={showDrugPicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Seleziona Farmaco</Text>
            <TouchableOpacity onPress={() => setShowDrugPicker(false)}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {Object.entries(OME_CONVERSION).map(([name, info]) => (
              <TouchableOpacity key={name} onPress={() => {
                setDrugName(name);
                setRoute_(info.routes[0]);
                setShowDrugPicker(false);
              }} style={[styles.drugRow, name === drugName && styles.drugRowActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.drugName, name === drugName && { color: Colors.primary }]}>{name}</Text>
                  <Text style={styles.drugNote}>{info.note}</Text>
                </View>
                <Text style={styles.drugFactor}>x{info.factor}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F4' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56, backgroundColor: '#064F4F', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: 18 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  addBtn: { backgroundColor: '#00BFA5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 4 },
  summaryLabel: { fontSize: 11, color: '#6B8080', fontWeight: '700', textTransform: 'uppercase' },
  summaryValue: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  alertText: { fontSize: 11, color: '#E53E3E', marginTop: 2 },
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 3, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#0A6E6E' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B8080' },
  tabTextActive: { color: '#fff' },
  empty: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#6B8080', fontSize: 14 },
  recordCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 12 },
  omeBadge: { backgroundColor: '#E6F4F4', borderRadius: 10, padding: 10, alignItems: 'center', minWidth: 56 },
  omeValue: { fontSize: 16, fontWeight: '800', color: '#0A6E6E' },
  omeLabel: { fontSize: 9, color: '#6B8080' },
  recordDrug: { fontSize: 13, fontWeight: '700', color: '#1A2B2B' },
  recordRoute: { fontWeight: '400', color: '#6B8080' },
  recordTime: { fontSize: 11, color: '#6B8080', marginTop: 2 },
  recordNotes: { fontSize: 11, color: '#6B8080', marginTop: 2 },
  deleteBtn: { padding: 8 },
  stopBtn: { borderWidth: 1, borderColor: '#D97706', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center' },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1A2B2B', marginBottom: 12 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  tableDrug: { fontSize: 13, color: '#1A2B2B' },
  tableFactor: { fontSize: 13, fontWeight: '700', color: '#0A6E6E' },
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1A2B2B' },
  closeBtn: { fontSize: 18, color: '#6B8080', padding: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#6B8080', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#D4E6E6' },
  chipActive: { backgroundColor: '#0A6E6E', borderColor: '#0A6E6E' },
  chipText: { fontSize: 13, color: '#1A2B2B', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1.5, borderColor: '#D4E6E6', borderRadius: 10, padding: 12, backgroundColor: '#FAFEFE' },
  pickerText: { fontSize: 15, color: '#1A2B2B' },
  pickerArrow: { fontSize: 12, color: '#6B8080' },
  noteText: { fontSize: 11, color: '#6B8080', marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: '#D4E6E6', borderRadius: 10, padding: 12, fontSize: 15, color: '#1A2B2B', backgroundColor: '#FAFEFE' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  omePreviewCard: { backgroundColor: '#E6F4F4', borderRadius: 12, padding: 16, marginTop: 12 },
  omePreviewLabel: { fontSize: 10, color: '#6B8080', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  omePreviewValue: { fontSize: 20, fontWeight: '800', color: '#0A6E6E' },
  meoPreview: { backgroundColor: '#E6F4F4', borderRadius: 10, padding: 12, marginTop: 8 },
  meoPreviewText: { fontSize: 16, fontWeight: '800', color: '#0A6E6E' },
  saveBtn: { backgroundColor: '#0A6E6E', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  drugRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F4F4' },
  drugRowActive: { backgroundColor: '#E6F4F4' },
  drugName: { fontSize: 14, fontWeight: '700', color: '#1A2B2B' },
  drugNote: { fontSize: 12, color: '#6B8080', marginTop: 2 },
  drugFactor: { fontSize: 16, fontWeight: '800', color: '#0A6E6E', marginLeft: 12 },
});
