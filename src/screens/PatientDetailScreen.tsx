// src/screens/PatientDetailScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Dimensions, FlatList, TextInput,
  Modal, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow, getNrsColor, getNrsBackground } from '../utils/theme';
import { Patient, Intervention, NrsMeasurement } from '../types/database';
import { format, parseISO } from 'date-fns';

const SCREEN_WIDTH = Dimensions.get('window').width;
const QUESTIONNAIRE_BASE_URL = 'https://claudiogargiulo1-hash.github.io/aps-web/#/q/';

const MEO_FACTORS: Record<string, number> = {
  'Morfina orale': 1, 'Morfina EV/SC': 3, 'Oramorph': 1,
  'Ossicodone orale': 1.5, 'Ossicodone EV': 3,
  'Idromorfone orale': 4, 'Idromorfone EV': 20,
  'Fentanyl TTS': 2.4, 'Fentanyl EV': 100,
  'Tramadolo orale': 0.2, 'Tramadolo EV': 0.2,
  'Buprenorfina SL': 30, 'Buprenorfina TDS': 2.4,
  'Tapentadolo': 0.4, 'Codeina': 0.15,
};
const FREQ_MAP: Record<string, number> = { '1x/die': 1, '2x/die': 2, '3x/die': 3, '4x/die': 4, '6x/die': 6, '8x/die': 8 };

export default function PatientDetailScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { profile, refreshSession } = useAuth();
  const { patientId } = route.params;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [measurements, setMeasurements] = useState<NrsMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'nrs' | 'interventions'>('nrs');

  const [tenantId, setTenantId] = useState<string | null>(null);

  // NRS Home monitoring QR
  const [nrsHomeModal, setNrsHomeModal] = useState(false);
  const [nrsHomeToken, setNrsHomeToken] = useState<string | null>(null);
  const [nrsHomeStatus, setNrsHomeStatus] = useState<'pending' | 'completed' | null>(null);
  const [nrsHomeLoading, setNrsHomeLoading] = useState(false);

  // Piano Dimissione Oppioidi
  const [opioidType, setOpioidType] = useState<'none'|'IR'|'MR'|'LA'>('none');
  const [opioidDose, setOpioidDose] = useState('');
  const [opioidDays, setOpioidDays] = useState('');
  const [opioidTaper, setOpioidTaper] = useState(false);
  const [opioidOverride, setOpioidOverride] = useState('');

  const fetchAll = async () => {
    refreshSession?.();
    const [pRes, iRes, mRes] = await Promise.all([
      supabase.from('patients').select('*').eq('id', patientId).single(),
      supabase.from('interventions').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }),
      supabase.from('nrs_measurements').select('*').eq('patient_id', patientId).order('measured_at', { ascending: false }).limit(48),
    ]);
    setPatient(pRes.data);
    setInterventions(iRes.data || []);
    setMeasurements(mRes.data || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => {
    fetchAll();
    AsyncStorage.getItem('tenant_id').then(setTenantId);
  }, []));

  const canDeleteNRS = ['medico', 'infermiere', 'admin'].includes(profile?.role || '');
  const canDeleteIntervention = ['medico', 'admin'].includes(profile?.role || '');
  const canDeletePatient = ['medico', 'admin'].includes(profile?.role || '');

  const deleteNRS = (id: string) => {
    Alert.alert('Elimina rilevazione', 'Sei sicuro di voler eliminare questa rilevazione NRS?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('nrs_measurements').delete().eq('id', id);
        setMeasurements(prev => prev.filter(m => m.id !== id));
      }},
    ]);
  };

  const deleteIntervention = (id: string) => {
    Alert.alert('Elimina intervento', 'Sei sicuro di voler eliminare questo intervento?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('interventions').delete().eq('id', id);
        setInterventions(prev => prev.filter(i => i.id !== id));
      }},
    ]);
  };

  const deletePatient = () => {
    Alert.alert('Elimina paziente', 'Sei sicuro di voler eliminare questo paziente e tutti i suoi dati?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await supabase.from('patients').delete().eq('id', patientId);
        navigation.goBack();
      }},
    ]);
  };

  const handleAdmit = () => {
    Alert.alert('Ricovera paziente', 'Confermi il ricovero?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Ricovera', onPress: async () => {
        await supabase.from('patients').update({
          patient_status: 'ricoverato',
          is_active: true,
          admission_date: new Date().toISOString().split('T')[0],
        }).eq('id', patientId);
        fetchAll();
      }},
    ]);
  };

  const handleNrsHomeQR = async () => {
    setNrsHomeLoading(true);
    // Check existing post_discharge_nrs token for this patient
    const { data: existing } = await supabase
      .from('patient_questionnaire_tokens')
      .select('id, token, status')
      .eq('patient_id', patientId)
      .eq('token_type', 'post_discharge_nrs')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setNrsHomeLoading(false);
    if (existing) {
      setNrsHomeToken(existing.token ?? existing.id);
      setNrsHomeStatus(existing.status as 'pending' | 'completed');
      setNrsHomeModal(true);
      return;
    }
    // Create new token
    const { data, error } = await supabase
      .from('patient_questionnaire_tokens')
      .insert({
        patient_id: patientId,
        tenant_id: tenantId,
        token_type: 'post_discharge_nrs',
        scales: ['nrs_daily'],
        status: 'pending',
        discharge_date: (patient as any)?.discharge_date ?? new Date().toISOString().split('T')[0],
        valid_until_pod: 7,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (error) { Alert.alert('Errore', error.message); return; }
    setNrsHomeToken(data.token ?? data.id);
    setNrsHomeStatus('pending');
    setNrsHomeModal(true);
  };

  const handleDismiss = () => {
    Alert.alert('Dimissione paziente', 'Vuoi dimettere questo paziente?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Dimetti', onPress: () => {
        Alert.prompt(
          'Note di dimissione (opzionale)',
          '',
          async (notes) => {
            await supabase.from('patients').update({
              is_active: false,
              patient_status: 'dimesso',
              discharge_date: new Date().toISOString().split('T')[0],
              ...(notes?.trim() ? { notes: notes.trim() } : {}),
            }).eq('id', patientId);
            navigation.goBack();
          },
          'plain-text',
          '',
        );
      }},
    ]);
  };

  const handleSetFollowup = () => {
    Alert.alert('CPSP Follow-up', 'Spostare il paziente in follow-up CPSP?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Conferma', onPress: async () => {
        await supabase.from('patients').update({
          patient_status: 'followup_cpsp',
          is_active: true,
        }).eq('id', patientId);
        fetchAll();
        navigation.navigate('CPSP', {
          patientId,
          patientName: patient ? patient.last_name + ' ' + patient.first_name : '',
        });
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  if (!patient) return null;

  const chartData = measurements.slice(0, 24).reverse();
  const hasChart = chartData.length >= 2;

  const nrsHomeUrl = nrsHomeToken ? `${QUESTIONNAIRE_BASE_URL}${nrsHomeToken}` : '';

  return (
    <SafeAreaView style={styles.container}>

      {/* ── NRS Casa QR Modal ── */}
      <Modal visible={nrsHomeModal} transparent animationType="fade" onRequestClose={() => setNrsHomeModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setNrsHomeModal(false)}>
          <Pressable style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' }}
            onPress={() => {}}>

            {nrsHomeStatus === 'completed' ? (
              <View style={{ backgroundColor: '#DCFCE7', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, alignSelf: 'stretch', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#16A34A' }}>✅ Monitoraggio completato</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#FEF9C3', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, alignSelf: 'stretch', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#A16207' }}>⏳ In attesa di compilazione</Text>
              </View>
            )}

            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4, textAlign: 'center' }}>
              📱 Monitoraggio NRS Casa
            </Text>
            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 16, textAlign: 'center' }}>
              Paziente compila NRS riposo/movimento da casa · POD1→7
            </Text>

            {nrsHomeUrl !== '' && (
              <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16,
                shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
                <QRCode value={nrsHomeUrl} size={200} />
              </View>
            )}

            <TouchableOpacity
              style={{ backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch', marginBottom: 8 }}
              onPress={async () => { await Clipboard.setStringAsync(nrsHomeUrl); Alert.alert('✅ Copiato', 'Link copiato negli appunti'); }}>
              <Text style={{ fontSize: 11, color: '#1D4ED8', textAlign: 'center', fontFamily: 'monospace' }} numberOfLines={2}>
                {nrsHomeUrl}
              </Text>
              <Text style={{ fontSize: 11, color: '#1D4ED8', fontWeight: '700', textAlign: 'center', marginTop: 4 }}>
                📋 Tocca per copiare il link
              </Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16, textAlign: 'center' }}>
              🕐 Valido 14 giorni · NRS POD1–7
            </Text>

            <TouchableOpacity
              style={{ backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignSelf: 'stretch', alignItems: 'center' }}
              onPress={() => setNrsHomeModal(false)}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Chiudi</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        {/* Riga 1: back + nome paziente */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{patient.last_name} {patient.first_name}</Text>
            <Text style={styles.headerMeta}>{patient.ward} · Letto {patient.bed || '-'} · {patient.admission_number}</Text>
          </View>
        </View>
        {/* Riga 2: tasti azione — scroll orizzontale */}
        {(() => {
          const patientName = patient ? patient.last_name + ' ' + patient.first_name : '';
          const btns = [
            { key: 'nrs',    emoji: '➕', label: '+ NRS',   bg: '#00BFA5', fg: '#fff',     onPress: () => navigation.navigate('NRSEntry', { patientId }) },
            { key: 'meo',    emoji: '💊', label: 'MEO',     bg: '#E6F4F4', fg: '#0A6E6E',  onPress: () => navigation.navigate('Opioid', { patientId, patientName, interventionId: interventions[0]?.id }) },
            { key: 'cpsp',   emoji: '🧠', label: 'CPSP',    bg: '#F0E6FF', fg: '#6B21A8',  onPress: () => navigation.navigate('CPSP', { patientId, patientName }) },
            ...((patient as any)?.patient_status === 'dimesso' ? [
              { key: 'nrshome', emoji: '📱', label: 'NRS Casa', bg: '#E0F2FE', fg: '#0369A1', onPress: handleNrsHomeQR },
            ] : []),
            ...(canDeletePatient ? [
              { key: 'edit',   emoji: '✏️', label: 'Edit',    bg: '#EFF6FF', fg: '#1D4ED8',  onPress: () => navigation.navigate('AddPatient', { patientId }) },
              ...(!patient?.patient_status || patient?.patient_status === 'ricoverato' ? [
                { key: 'dim',  emoji: '🏠', label: 'Dimetti', bg: '#FEF3C7', fg: '#92400E',  onPress: handleDismiss },
              ] : []),
              { key: 'del',    emoji: '🗑', label: 'Elimina', bg: '#FEE2E2', fg: '#DC2626',  onPress: deletePatient },
            ] : []),
          ];
          return (
            <FlatList
              data={btns}
              keyExtractor={b => b.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 6 }}
              renderItem={({ item: b }) => (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: b.bg }]} onPress={b.onPress}>
                  <Text style={styles.actionBtnEmoji}>{b.emoji}</Text>
                  <Text style={[styles.actionBtnLabel, { color: b.fg }]}>{b.label}</Text>
                </TouchableOpacity>
              )}
            />
          );
        })()}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['nrs', 'info', 'interventions'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'nrs' ? '📊 NRS' : tab === 'info' ? '👤 Info' : '🔧 Interventi'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {activeTab === 'nrs' && (
          <>
            {/* NRS Chart */}
            {hasChart && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('nrs_history')}</Text>
                <LineChart
                  data={{
                    labels: chartData.map((_, i) => i % 4 === 0 ? format(parseISO(chartData[i].measured_at), 'HH:mm') : ''),
                    datasets: [{ data: chartData.map(m => m.nrs_value), color: () => Colors.primary, strokeWidth: 2 }],
                  }}
                  width={SCREEN_WIDTH - 48}
                  height={180}
                  yAxisInterval={1}
                  chartConfig={{
                    backgroundColor: Colors.surface,
                    backgroundGradientFrom: Colors.surface,
                    backgroundGradientTo: Colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(26, 95, 122, ${opacity})`,
                    labelColor: () => Colors.textMuted,
                    propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
                    propsForBackgroundLines: { stroke: Colors.borderLight },
                  }}
                  fromZero
                  segments={5}
                  bezier
                  style={{ borderRadius: Radius.md, marginTop: 8 }}
                />
                <View style={styles.legend}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.green }]} /><Text style={styles.legendText}>0–3</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.yellow }]} /><Text style={styles.legendText}>4–6</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.red }]} /><Text style={styles.legendText}>7–10</Text></View>
                </View>
              </View>
            )}

            {/* Measurement list */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Rilevazioni recenti</Text>
              {measurements.length === 0 ? (
                <Text style={styles.empty}>{t('no_measurements')}</Text>
              ) : (
                measurements.map(m => <MeasurementRow key={m.id} m={m} t={t} canDelete={canDeleteNRS} onDelete={deleteNRS} navigation={navigation} patientId={patientId} />)
              )}
            </View>
          </>
        )}

        {activeTab === 'info' && (
          <View style={styles.card}>
            <InfoRow label="Nome" value={`${patient.first_name} ${patient.last_name}`} />
            <InfoRow label="Data di nascita" value={patient.date_of_birth} />
            <InfoRow label="Codice Fiscale" value={patient.fiscal_code || '-'} />
            <InfoRow label="Sesso" value={patient.gender || '-'} />
            <InfoRow label="N° Ricovero" value={patient.admission_number} />
            <InfoRow label="Reparto" value={patient.ward} />
            <InfoRow label="Letto" value={patient.bed || '-'} />
            <InfoRow label="Data ricovero" value={patient.admission_date} />
            <InfoRow label="Peso" value={patient.weight_kg ? `${patient.weight_kg} kg` : '-'} />
            <InfoRow label="Altezza" value={patient.height_cm ? `${patient.height_cm} cm` : '-'} />
            <InfoRow label="Classe ASA" value={patient.asa_class ? `ASA ${patient.asa_class}` : '-'} />
            {patient.allergies && <InfoRow label="Allergie ⚠️" value={patient.allergies} highlight />}
            {patient.notes && <InfoRow label="Note" value={patient.notes} />}
          </View>
        )}

        {activeTab === 'interventions' && (
          <>
            {/* Piano Dimissione Oppioidi */}
            <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: Colors.primary }]}>
              <Text style={styles.cardTitle}>💊 Piano Dimissione Oppioidi</Text>

              {/* Tipo */}
              <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 8 }}>
                Tipo oppioide alla dimissione
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {([
                  { v: 'none' as const, label: 'Nessuno' },
                  { v: 'IR'   as const, label: 'IR (breve durata)' },
                  { v: 'MR'   as const, label: 'MR (lento rilascio)' },
                  { v: 'LA'   as const, label: 'LA (lunga azione)' },
                ]).map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                      borderColor: opioidType === opt.v ? Colors.primary : Colors.border,
                      backgroundColor: opioidType === opt.v ? Colors.primary : Colors.surface }}
                    onPress={() => setOpioidType(opt.v)}>
                    <Text style={{ fontSize: 13, fontWeight: '600',
                      color: opioidType === opt.v ? '#fff' : Colors.text }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Alert rosso MR/LA */}
              {(opioidType === 'MR' || opioidType === 'LA') && (
                <View style={{ backgroundColor: '#FFEBEE', borderRadius: 8, padding: 10,
                  borderWidth: 1.5, borderColor: Colors.red, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.red, marginBottom: 3 }}>
                    ⛔ ATTENZIONE: Oppioide a rilascio prolungato (MR/LA)
                  </Text>
                  <Text style={{ fontSize: 12, color: '#C62828', lineHeight: 17 }}>
                    Prescrizione MR/LA alla dimissione: aumentato rischio dipendenza (CDC 2022).{'\n'}
                    Documentare indicazione specifica e piano di taper. Preferire IR se possibile.
                  </Text>
                </View>
              )}

              {opioidType !== 'none' && (
                <>
                  {/* Dose */}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 }}>
                    Dose (mg/die o unità posologica)
                  </Text>
                  <TextInput
                    style={{ backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 14,
                      paddingVertical: 10, fontSize: 14, color: Colors.text, borderWidth: 1,
                      borderColor: Colors.border, marginBottom: 12 }}
                    placeholder="Es. Ossicodone IR 5mg x2/die"
                    placeholderTextColor={Colors.textLight}
                    value={opioidDose}
                    onChangeText={setOpioidDose}
                  />

                  {/* Durata */}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 }}>
                    Durata prevista (giorni){opioidDays !== '' && parseInt(opioidDays) > 7 ? '  ⚠️ >7 gg' : ''}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 14,
                      paddingVertical: 10, fontSize: 14, color: Colors.text, borderWidth: 1,
                      borderColor: opioidDays !== '' && parseInt(opioidDays) > 7 ? Colors.red : Colors.border,
                      marginBottom: 8 }}
                    placeholder="Es. 5"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                    value={opioidDays}
                    onChangeText={setOpioidDays}
                  />

                  {/* Override motivation if >7 days */}
                  {opioidDays !== '' && parseInt(opioidDays) > 7 && (
                    <View style={{ marginBottom: 12 }}>
                      <View style={{ backgroundColor: '#FFF3E0', borderRadius: 8, padding: 10,
                        borderWidth: 1.5, borderColor: '#F97316', marginBottom: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#E65100' }}>
                          ⚠️ Durata {opioidDays} giorni: motivazione clinica obbligatoria
                        </Text>
                        <Text style={{ fontSize: 11, color: '#BF360C', marginTop: 2 }}>
                          Linee guida: ≤7 giorni per oppioidi post-chirurgici acuti (CDC 2022, NICE 2023)
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginBottom: 6 }}>
                        Motivazione clinica (obbligatoria) *
                      </Text>
                      <TextInput
                        style={{ backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 14,
                          paddingVertical: 10, fontSize: 13, color: Colors.text, borderWidth: 1.5,
                          borderColor: opioidOverride.trim() === '' ? Colors.red : Colors.green,
                          minHeight: 72, textAlignVertical: 'top' }}
                        placeholder="Descrivere la specifica indicazione clinica che giustifica durata >7 giorni..."
                        placeholderTextColor={Colors.textLight}
                        multiline
                        numberOfLines={3}
                        value={opioidOverride}
                        onChangeText={setOpioidOverride}
                      />
                    </View>
                  )}

                  {/* Piano di taper */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <Text style={{ fontSize: 13, color: Colors.text, flex: 1 }}>📉 Piano di taper strutturato</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {([
                        { val: false, label: 'No', activeColor: Colors.primary },
                        { val: true,  label: 'Sì', activeColor: Colors.green },
                      ]).map(opt => (
                        <TouchableOpacity
                          key={String(opt.val)}
                          style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5,
                            borderColor: opioidTaper === opt.val ? opt.activeColor : Colors.border,
                            backgroundColor: opioidTaper === opt.val ? opt.activeColor : Colors.surface }}
                          onPress={() => setOpioidTaper(opt.val)}>
                          <Text style={{ fontSize: 12, fontWeight: '600',
                            color: opioidTaper === opt.val ? '#fff' : Colors.text }}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Save */}
                  <TouchableOpacity
                    style={{ backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12,
                      alignItems: 'center',
                      opacity: (opioidDays !== '' && parseInt(opioidDays) > 7 && opioidOverride.trim() === '') ? 0.4 : 1 }}
                    disabled={opioidDays !== '' && parseInt(opioidDays) > 7 && opioidOverride.trim() === ''}
                    onPress={() => Alert.alert(
                      '✅ Piano Dimissione Oppioidi',
                      `Farmaco: ${opioidType} – ${opioidDose || '—'}\nDurata: ${opioidDays || '—'} gg\nTaper: ${opioidTaper ? 'Sì' : 'No'}${opioidOverride.trim() ? `\nMotivazione: ${opioidOverride}` : ''}`,
                    )}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>💾 Salva Piano Dimissione</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {(profile?.role === 'medico' || profile?.role === 'admin') && (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => navigation.navigate('AddIntervention', { patientId })}>
                <Text style={styles.addBtnText}>+ {t('add_intervention')}</Text>
              </TouchableOpacity>
            )}
            {interventions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🔧</Text>
                <Text style={styles.empty}>Nessun intervento registrato</Text>
              </View>
            ) : (
              interventions.map(i => <InterventionCard key={i.id} intervention={i} t={t} canDelete={canDeleteIntervention} onDelete={deleteIntervention} navigation={navigation} patientId={patientId} />)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MeasurementRow({ m, t, canDelete, onDelete, navigation, patientId }: any) {
  const color = getNrsColor(m.nrs_value);
  const bg = getNrsBackground(m.nrs_value);
  return (
    <View style={[styles.measureRow, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={[styles.measureBadge, { backgroundColor: bg }]}>
        <Text style={[styles.measureValue, { color }]}>{m.nrs_value}</Text>
      </View>
      <View style={styles.measureInfo}>
        <Text style={styles.measureTime}>{format(parseISO(m.measured_at), 'dd/MM/yyyy HH:mm')}</Text>
        {m.scheduled_time && <Text style={styles.measureSlot}>Slot: {m.scheduled_time}</Text>}
        {m.therapy_administered && <Text style={styles.measureTherapy}>💊 {m.therapy_administered} {m.therapy_dose || ''}</Text>}
        {m.notes && <Text style={styles.measureNotes}>{m.notes}</Text>}
      </View>
      <View style={styles.measureDetail}>
        {m.nrs_rest !== null && m.nrs_rest !== undefined && <Text style={styles.detailText}>R: {m.nrs_rest}</Text>}
        {m.nrs_movement !== null && m.nrs_movement !== undefined && <Text style={styles.detailText}>M: {m.nrs_movement}</Text>}
        {canDelete && (
          <TouchableOpacity onPress={() => navigation.navigate('NRSEntry', { patientId, measurementId: m.id })} style={{ marginTop: 4, padding: 4 }}>
            <Text style={{ fontSize: 16 }}>✏️</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity onPress={() => onDelete(m.id)} style={{ marginTop: 4, padding: 4 }}>
            <Text style={{ color: '#DC2626', fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function InfoRow({ label, value, highlight }: any) {
  return (
    <View style={[styles.infoRow, highlight && styles.infoRowHighlight]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
    </View>
  );
}

function PostopDrugsView({ raw }: { raw: string }) {
  if (!raw) return null;

  let opioids: Array<{ drug: string; dose: number; frequency: string; route: string; prn?: boolean }> = [];
  let other = '';
  let isStructured = false;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && ('opioids' in parsed || 'other' in parsed)) {
      opioids = parsed.opioids || [];
      other = parsed.other || '';
      isStructured = true;
    }
  } catch {}

  if (!isStructured) {
    return <Text style={styles.interventionMeta}>📋 Terapia post-op: {raw}</Text>;
  }

  const fixedOpioids = opioids.filter(op => !op.prn);
  const prnOpioids = opioids.filter(op => op.prn);

  const totalMEO = fixedOpioids.reduce((sum, op) => {
    const factor = MEO_FACTORS[op.drug] || 1;
    const freq = FREQ_MAP[op.frequency] || 1;
    return sum + op.dose * factor * freq;
  }, 0);

  return (
    <View style={{ marginTop: 4 }}>
      <Text style={[styles.interventionMeta, { fontWeight: '700' }]}>📋 Terapia post-op:</Text>

      {fixedOpioids.length > 0 && (
        <View style={{ marginTop: 2 }}>
          <Text style={[styles.interventionMeta, { marginLeft: 8, fontWeight: '700', color: Colors.primary, fontSize: 12 }]}>Terapia fissa:</Text>
          {fixedOpioids.map((op, i) => {
            const factor = MEO_FACTORS[op.drug] || 1;
            const freq = FREQ_MAP[op.frequency] || 1;
            const meoDay = op.dose * factor * freq;
            return (
              <Text key={i} style={[styles.interventionMeta, { marginLeft: 8 }]}>
                {'💊 '}{op.drug} {op.dose}mg x{op.frequency} ({op.route})
                {'\n'}{'   = '}{meoDay.toFixed(1)}mg MEO/die
              </Text>
            );
          })}
          <Text style={[styles.interventionMeta, { marginLeft: 8, fontWeight: '700', color: Colors.primary }]}>
            Totale MEO/die: {totalMEO.toFixed(1)}mg
          </Text>
        </View>
      )}

      {prnOpioids.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={[styles.interventionMeta, { marginLeft: 8, fontWeight: '700', color: '#D97706', fontSize: 12 }]}>Al bisogno (PRN):</Text>
          {prnOpioids.map((op, i) => {
            const factor = MEO_FACTORS[op.drug] || 1;
            const meoSingle = op.dose * factor;
            return (
              <Text key={i} style={[styles.interventionMeta, { marginLeft: 8, color: '#D97706' }]}>
                {'💊 PRN — '}{op.drug} {op.dose}mg al bisogno ({op.route})
                {'\n'}{'   = '}{meoSingle.toFixed(1)}mg MEO/dose
              </Text>
            );
          })}
        </View>
      )}

      {other ? <Text style={[styles.interventionMeta, { marginLeft: 8, marginTop: 4 }]}>💊 Altri: {other}</Text> : null}
    </View>
  );
}

function InterventionCard({ intervention, t, canDelete, onDelete, navigation, patientId }: any) {
  return (
    <View style={styles.interventionCard}>
      <View style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, flexDirection: 'row', gap: 8 }}>
        {canDelete && (
          <TouchableOpacity onPress={() => navigation.navigate('AddIntervention', { patientId, interventionId: intervention.id })} style={{ padding: 4 }}>
            <Text style={{ fontSize: 18 }}>✏️</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity onPress={() => onDelete(intervention.id)} style={{ padding: 4 }}>
            <Text style={{ color: '#DC2626', fontSize: 18 }}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.interventionName}>{intervention.intervention_name}</Text>
      <Text style={styles.interventionMeta}>{intervention.category} · {format(parseISO(intervention.intervention_date), 'dd/MM/yyyy HH:mm')}</Text>
      {intervention.surgeon && <Text style={styles.interventionMeta}>🔪 Chirurgo: {intervention.surgeon}</Text>}
      {intervention.anesthesiologist_name && <Text style={styles.interventionMeta}>🩺 Anestesista: {intervention.anesthesiologist_name}</Text>}
      {intervention.intervention_end_time && <Text style={styles.interventionMeta}>🏁 Fine intervento: {format(parseISO(intervention.intervention_end_time), 'dd/MM/yyyy HH:mm')}</Text>}
      {intervention.intervention_end_time && <Text style={[styles.interventionMeta, { color: '#0369A1' }]}>⏰ NRS programmati: +6h · +12h · +24h · +48h</Text>}
      <Text style={styles.interventionMeta}>💉 Anestesia: {intervention.anesthesia_type}</Text>
      {intervention.anesthesia_drugs && <Text style={styles.interventionMeta}>   Farmaci: {intervention.anesthesia_drugs}</Text>}
      {intervention.regional_blocks && <Text style={styles.interventionMeta}>🎯 Blocchi: {intervention.regional_blocks}</Text>}
      {intervention.regional_drugs && <Text style={styles.interventionMeta}>   Farmaci locoregionali: {intervention.regional_drugs}</Text>}
      <Text style={styles.interventionMeta}>💊 Protocollo: {intervention.pain_protocol.replace(/_/g, ' ')}</Text>
      {intervention.postop_drugs && <PostopDrugsView raw={intervention.postop_drugs} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: Colors.primary, flexDirection: 'column', padding: Spacing.md, gap: 4 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18 },
  backIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerMeta: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  actionBtn: { width: 64, height: 64, borderRadius: 14, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  actionBtnEmoji: { fontSize: 22, lineHeight: 26 },
  actionBtnLabel: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  tabText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: Colors.textMuted },
  empty: { textAlign: 'center', color: Colors.textMuted, paddingVertical: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  measureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingLeft: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, gap: 10 },
  measureBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  measureValue: { fontSize: 18, fontWeight: '700' },
  measureInfo: { flex: 1 },
  measureTime: { fontSize: 13, fontWeight: '600', color: Colors.text },
  measureSlot: { fontSize: 11, color: Colors.textMuted },
  measureTherapy: { fontSize: 12, color: Colors.primary, marginTop: 2 },
  measureNotes: { fontSize: 11, color: Colors.textMuted, fontStyle: 'italic' },
  measureDetail: { alignItems: 'flex-end' },
  detailText: { fontSize: 11, color: Colors.textMuted },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  infoRowHighlight: { backgroundColor: Colors.yellowLight, marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 4 },
  infoLabel: { fontSize: 13, color: Colors.textMuted, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 2, textAlign: 'right' },
  infoValueHighlight: { color: Colors.yellow },
  interventionCard: { backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  interventionName: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  interventionMeta: { fontSize: 13, color: Colors.text, marginTop: 2 },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.md },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
