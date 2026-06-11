// src/screens/NRSEntryScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { syncNrsToCpspTrajectory } from '../services/cpspService';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow, getNrsColor, getNrsBackground } from '../utils/theme';
import { Patient, Intervention } from '../types/database';

function padZ(n: number) { return String(n).padStart(2, '0'); }
function formatDate(d: Date) {
  return `${padZ(d.getDate())}/${padZ(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatTime(d: Date) {
  return `${padZ(d.getHours())}:${padZ(d.getMinutes())}`;
}

interface TimeSlot { key: string; label: string; datetime: Date }

function buildSlots(intervention: Intervention | null): TimeSlot[] {
  const endTimeStr = (intervention as any)?.intervention_end_time as string | undefined;
  if (endTimeStr) {
    const endTime = new Date(endTimeStr);
    return [6, 12, 18, 24, 48].map(h => {
      const dt = new Date(endTime.getTime() + h * 3600000);
      return { key: `+${h}h`, label: `+${h}h (${formatTime(dt)})`, datetime: dt };
    });
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return ['08:00', '12:00', '16:00', '20:00', '24:00'].map(s => {
    const [h, m] = s.split(':').map(Number);
    const dt = new Date(today);
    dt.setHours(h, m, 0, 0);
    return { key: s, label: s, datetime: dt };
  });
}

function autoSelectSlot(slots: TimeSlot[]): string {
  const now = new Date();
  const past = slots.filter(s => s.datetime <= now);
  if (past.length > 0) return past[past.length - 1].key;
  return slots[0].key;
}

export default function NRSEntryScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { profile, refreshSession } = useAuth();
  const { patientId, measurementId } = route.params;
  const isEdit = !!measurementId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [intervention, setIntervention] = useState<Intervention | null>(null);
  const [nrsValue, setNrsValue] = useState<number | null>(null);
  const [nrsRest, setNrsRest] = useState<number | null>(null);
  const [nrsMovement, setNrsMovement] = useState<number | null>(null);
  const [therapy, setTherapy] = useState('');
  const [therapyDose, setTherapyDose] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [customHour, setCustomHour] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const timeSlots = useMemo(() => buildSlots(intervention), [intervention]);

  useEffect(() => {
    loadData();
    if (measurementId) loadMeasurement();
  }, [patientId]);

  const loadMeasurement = async () => {
    const { data } = await supabase.from('nrs_measurements').select('*').eq('id', measurementId).single();
    if (data) {
      setNrsValue(data.nrs_value);
      setNrsRest(data.nrs_rest ?? null);
      setNrsMovement(data.nrs_movement ?? null);
      setTherapy(data.therapy_administered || '');
      setTherapyDose(data.therapy_dose || '');
      setNotes(data.notes || '');
      if (data.measured_at) {
        const dt = new Date(data.measured_at);
        setCustomDate(formatDate(dt));
        setCustomHour(formatTime(dt));
      }
      setSelectedSlotKey(data.scheduled_time || 'custom');
    }
  };

  const loadData = async () => {
    refreshSession?.();
    const { data: p } = await supabase.from('patients').select('*').eq('id', patientId).single();
    setPatient(p);

    const { data: i } = await supabase
      .from('interventions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    setIntervention(i);

    if (!measurementId) {
      const slots = buildSlots(i);
      setSelectedSlotKey(autoSelectSlot(slots));
    }

    setLoading(false);
  };

  const getMeasuredAt = (): string => {
    if (selectedSlotKey === 'custom') {
      const parts = customDate.split('/');
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts.map(Number);
        const [hh, mi] = customHour.split(':').map(Number);
        return new Date(yyyy, mm - 1, dd, hh || 0, mi || 0).toISOString();
      }
      return new Date().toISOString();
    }
    const slot = timeSlots.find(s => s.key === selectedSlotKey);
    return slot ? slot.datetime.toISOString() : new Date().toISOString();
  };

  const handleSave = async () => {
    if (nrsValue === null) {
      return Alert.alert(t('error'), 'Seleziona un valore NRS / Select an NRS value');
    }
    if (selectedSlotKey === 'custom' && (!customDate || !customHour)) {
      return Alert.alert(t('error'), 'Inserisci data e ora personalizzate');
    }
    setSaving(true);
    refreshSession?.();

    const payload = {
      nrs_value: nrsValue,
      nrs_rest: nrsRest ?? undefined,
      nrs_movement: nrsMovement ?? undefined,
      scheduled_time: selectedSlotKey !== 'custom' ? selectedSlotKey : undefined,
      therapy_administered: therapy || undefined,
      therapy_dose: therapyDose || undefined,
      notes: notes || undefined,
    };

    let error;
    if (isEdit) {
      const res = await supabase.from('nrs_measurements').update({
        ...payload,
        measured_at: getMeasuredAt(),
      }).eq('id', measurementId);
      error = res.error;
    } else {
      const res = await supabase.from('nrs_measurements').insert({
        ...payload,
        patient_id: patientId,
        intervention_id: intervention?.id,
        measured_at: getMeasuredAt(),
        recorded_by: profile?.id,
      });
      error = res.error;
    }

    setSaving(false);
    if (error) {
      Alert.alert(t('error'), error.message);
    } else {
      syncNrsToCpspTrajectory(supabase, patientId).catch(() => {});
      Alert.alert(t('success'), isEdit ? 'Rilevazione aggiornata' : t('measurement_saved'), [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  const handleSelectCustom = () => {
    setSelectedSlotKey('custom');
    if (!customDate) {
      const now = new Date();
      setCustomDate(formatDate(now));
      setCustomHour(formatTime(now));
    }
  };

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Patient info */}
        <View style={styles.patientHeader}>
          <View>
            <Text style={styles.patientName}>{patient?.last_name} {patient?.first_name}</Text>
            <Text style={styles.patientMeta}>
              {patient?.ward} · Letto {patient?.bed || '-'} · {patient?.admission_number}
            </Text>
            {intervention && (
              <Text style={styles.protocolBadge}>
                💊 {intervention.pain_protocol.replace('_', ' ')}
              </Text>
            )}
          </View>
        </View>

        {/* Scheduled time */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🕐 {t('scheduled_time')}</Text>
          <View style={styles.timeSlots}>
            {timeSlots.map((slot: TimeSlot) => (
              <TouchableOpacity
                key={slot.key}
                style={[styles.timeSlot, selectedSlotKey === slot.key && styles.timeSlotActive]}
                onPress={() => setSelectedSlotKey(slot.key)}>
                <Text style={[styles.timeSlotText, selectedSlotKey === slot.key && styles.timeSlotTextActive]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.timeSlot, selectedSlotKey === 'custom' && styles.timeSlotActive]}
              onPress={handleSelectCustom}>
              <Text style={[styles.timeSlotText, selectedSlotKey === 'custom' && styles.timeSlotTextActive]}>
                🕐 Personalizzato
              </Text>
            </TouchableOpacity>
          </View>
          {selectedSlotKey === 'custom' && (
            <View style={{ marginTop: 12 }}>
              <TextInput
                style={styles.input}
                placeholder="Data: GG/MM/AAAA"
                placeholderTextColor={Colors.textLight}
                value={customDate}
                onChangeText={setCustomDate}
                keyboardType="numbers-and-punctuation"
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="Ora: HH:MM"
                placeholderTextColor={Colors.textLight}
                value={customHour}
                onChangeText={setCustomHour}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}
        </View>

        {/* NRS Main */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 {t('nrs_value')}</Text>
          <Text style={styles.nrsHint}>
            <Text style={{ color: Colors.green }}>0 {t('nrs_0').split('0-')[1] || 'Nessun dolore'}</Text>
            {'  ·  '}
            <Text style={{ color: Colors.red }}>10 {t('nrs_10').split('10-')[1] || 'Dolore massimo'}</Text>
          </Text>
          <NRSSelector value={nrsValue} onChange={setNrsValue} />
        </View>

        {/* NRS Rest & Movement */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔍 Dettaglio / Detail</Text>
          <View style={styles.row}>
            <View style={styles.halfCard}>
              <Text style={styles.subLabel}>😌 {t('nrs_rest')}</Text>
              <NRSSelector value={nrsRest} onChange={setNrsRest} compact />
            </View>
            <View style={styles.halfCard}>
              <Text style={styles.subLabel}>🚶 {t('nrs_movement')}</Text>
              <NRSSelector value={nrsMovement} onChange={setNrsMovement} compact />
            </View>
          </View>
        </View>

        {/* Therapy */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💊 {t('therapy_administered')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Es. Morfina / Ketorolac"
            placeholderTextColor={Colors.textLight}
            value={therapy}
            onChangeText={setTherapy}
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder={t('therapy_dose') + ' (es. 5mg EV)'}
            placeholderTextColor={Colors.textLight}
            value={therapyDose}
            onChangeText={setTherapyDose}
          />
        </View>

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 {t('notes')}</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Note cliniche..."
            placeholderTextColor={Colors.textLight}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, nrsValue === null && styles.saveBtnDisabled, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={nrsValue === null || saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>💾 {t('save_measurement')}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function NRSSelector({ value, onChange, compact = false }: { value: number | null; onChange: (v: number) => void; compact?: boolean }) {
  const size = compact ? 32 : 44;
  const fontSize = compact ? 13 : 16;

  return (
    <View style={[styles.nrsRow, compact && styles.nrsRowCompact]}>
      {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
        const color = getNrsColor(n);
        const isSelected = value === n;
        return (
          <TouchableOpacity
            key={n}
            style={[
              styles.nrsBtn,
              { width: size, height: size, borderRadius: size / 2, borderColor: color },
              isSelected && { backgroundColor: color },
            ]}
            onPress={() => onChange(n)}>
            <Text style={[
              styles.nrsBtnText,
              { fontSize, color: isSelected ? '#fff' : color },
            ]}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  patientHeader: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  patientName: { fontSize: 18, fontWeight: '700', color: '#fff' },
  patientMeta: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  protocolBadge: { fontSize: 13, color: Colors.accent, marginTop: 4, fontWeight: '600' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  nrsHint: { fontSize: 11, marginBottom: 10 },
  timeSlots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeSlot: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  timeSlotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeSlotText: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  timeSlotTextActive: { color: '#fff', fontWeight: '700' },
  nrsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  nrsRowCompact: { gap: 4 },
  nrsBtn: { justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  nrsBtnText: { fontWeight: '700' },
  row: { flexDirection: 'row', gap: Spacing.sm },
  halfCard: { flex: 1 },
  subLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 8 },
  input: { backgroundColor: Colors.background, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
