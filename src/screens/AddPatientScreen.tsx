// src/screens/AddPatientScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, TextInput, Alert, ActivityIndicator,
  Switch,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

interface FormField {
  key: string;
  labelIt: string;
  labelEn: string;
  placeholder?: string;
  keyboardType?: any;
  required?: boolean;
  multiline?: boolean;
}

export default function AddPatientScreen({ route, navigation }: any) {
  const { t, i18n } = useTranslation();
  const { profile, refreshSession } = useAuth();
  const isEdit = !!route.params?.patientId;

  type PatientStatus = 'pre_ricovero' | 'ricoverato' | 'dimesso' | 'followup_cpsp' | 'followup';

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    fiscal_code: '',
    gender: 'M' as 'M' | 'F' | 'altro',
    admission_number: '',
    ward: '',
    bed: '',
    admission_date: new Date().toISOString().split('T')[0],
    allergies: '',
    weight_kg: '',
    height_cm: '',
    asa_class: '',
    notes: '',
    patient_status: 'ricoverato' as PatientStatus,
  });
  const [dobText, setDobText] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);

  // DD/MM/YYYY → YYYY-MM-DD per il database
  const formatForDB = (text: string): string | null => {
    const parts = text.split('/');
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return null;
  };

  // YYYY-MM-DD → DD/MM/YYYY per la visualizzazione
  const formatForDisplay = (iso: string): string => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  // Auto-inserisce gli slash durante la digitazione
  const handleDobChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length >= 3) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    if (digits.length >= 5) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    setDobText(formatted);
    if (errors.date_of_birth) setErrors(e => ({ ...e, date_of_birth: '' }));
  };

  useEffect(() => {
    supabase.from('wards')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setWards(data || []));
    if (isEdit) loadPatient();
  }, []);

  const loadPatient = async () => {
    refreshSession?.();
    const { data } = await supabase.from('patients').select('*').eq('id', route.params.patientId).single();
    if (data) {
      setDobText(formatForDisplay(data.date_of_birth || ''));
      setForm({
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth,
        fiscal_code: data.fiscal_code || '',
        gender: data.gender || 'M',
        admission_number: data.admission_number,
        ward: data.ward,
        bed: data.bed || '',
        admission_date: data.admission_date,
        allergies: data.allergies || '',
        weight_kg: data.weight_kg?.toString() || '',
        height_cm: data.height_cm?.toString() || '',
        asa_class: data.asa_class?.toString() || '',
        notes: data.notes || '',
        patient_status: (data.patient_status as any) || 'ricoverato',
      });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.first_name) e.first_name = t('required_field');
    if (!form.last_name) e.last_name = t('required_field');
    if (!formatForDB(dobText)) e.date_of_birth = isIt ? 'Formato GG/MM/AAAA richiesto' : 'Required: DD/MM/YYYY';
    if (!form.admission_number) e.admission_number = t('required_field');
    if (!form.ward) e.ward = t('required_field');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    refreshSession?.();

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      date_of_birth: formatForDB(dobText) ?? form.date_of_birth,
      fiscal_code: form.fiscal_code.trim() || undefined,
      gender: form.gender,
      admission_number: form.admission_number.trim(),
      ward: form.ward.trim(),
      bed: form.bed.trim() || undefined,
      admission_date: form.admission_date,
      allergies: form.allergies.trim() || undefined,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : undefined,
      asa_class: form.asa_class ? parseInt(form.asa_class) : undefined,
      notes: form.notes.trim() || undefined,
      patient_status: form.patient_status,
      is_active: form.patient_status !== 'dimesso',
      created_by: profile?.id,
    };

    let error;
    if (isEdit) {
      const res = await supabase.from('patients').update(payload).eq('id', route.params.patientId);
      error = res.error;
    } else {
      const res = await supabase.from('patients').insert(payload);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      Alert.alert(t('error'), error.message);
    } else {
      Alert.alert(t('success'), isEdit ? 'Paziente aggiornato' : 'Paziente aggiunto', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    }
  };

  const set = (key: string, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
  };

  const isIt = i18n.language === 'it';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? t('edit_patient') : t('add_patient')}
        </Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>{t('save')}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <SectionTitle title="👤 Anagrafica" />

        <Field label={isIt ? 'Nome *' : 'First name *'} value={form.first_name} onChangeText={v => set('first_name', v)} error={errors.first_name} />
        <Field label={isIt ? 'Cognome *' : 'Last name *'} value={form.last_name} onChangeText={v => set('last_name', v)} error={errors.last_name} />
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{isIt ? 'Data di nascita *' : 'Date of birth *'}</Text>
          <TextInput
            style={[styles.input, !!errors.date_of_birth && styles.inputError]}
            value={dobText}
            onChangeText={handleDobChange}
            placeholder="GG/MM/AAAA"
            placeholderTextColor={Colors.textLight}
            keyboardType="numeric"
            maxLength={10}
          />
          {!!errors.date_of_birth && <Text style={styles.errorText}>{errors.date_of_birth}</Text>}
        </View>
        <Field label={isIt ? 'Codice Fiscale' : 'Tax ID'} value={form.fiscal_code} onChangeText={v => set('fiscal_code', v.toUpperCase())} autoCapitalize="characters" />

        {/* Gender selector */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{isIt ? 'Sesso' : 'Gender'}</Text>
          <View style={styles.segmented}>
            {(['M', 'F', 'altro'] as const).map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.segItem, form.gender === g && styles.segItemActive]}
                onPress={() => set('gender', g)}>
                <Text style={[styles.segText, form.gender === g && styles.segTextActive]}>
                  {g === 'M' ? '♂ M' : g === 'F' ? '♀ F' : '⚧ Altro'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionTitle title="🏥 Ricovero" />

        <Field label={isIt ? 'N° Ricovero *' : 'Admission number *'} value={form.admission_number} onChangeText={v => set('admission_number', v)} error={errors.admission_number} />

        {/* Reparto — Picker */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{isIt ? 'Reparto *' : 'Ward *'}</Text>
          <View style={[styles.pickerWrapper, !!errors.ward && styles.inputError]}>
            <Picker
              selectedValue={form.ward}
              onValueChange={value => set('ward', value)}
              style={styles.picker}>
              <Picker.Item label={isIt ? '-- Seleziona reparto --' : '-- Select ward --'} value="" />
              {wards.map(w => (
                <Picker.Item key={w.id} label={w.name} value={w.name} />
              ))}
            </Picker>
          </View>
          {!!errors.ward && <Text style={styles.errorText}>{errors.ward}</Text>}
        </View>

        <Field label={isIt ? 'Letto' : 'Bed'} value={form.bed} onChangeText={v => set('bed', v)} />
        <Field label={isIt ? 'Data ricovero (YYYY-MM-DD)' : 'Admission date (YYYY-MM-DD)'} value={form.admission_date} onChangeText={v => set('admission_date', v)} />

        {/* Stato iniziale */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{isIt ? 'Stato iniziale' : 'Initial status'}</Text>
          <View style={styles.segmented}>
            {([
              { v: 'pre_ricovero', icon: '🔵', label: 'Pre-ricovero' },
              { v: 'ricoverato',   icon: '🟡', label: 'Ricoverato'   },
              { v: 'dimesso',      icon: '✅', label: 'Dimesso'       },
              { v: 'followup',     icon: '🧠', label: 'Follow-up'    },
            ] as { v: typeof form.patient_status; icon: string; label: string }[]).map(opt => (
              <TouchableOpacity
                key={opt.v}
                style={[styles.segItem, form.patient_status === opt.v && styles.segItemActive]}
                onPress={() => set('patient_status', opt.v)}>
                <Text style={[styles.segText, form.patient_status === opt.v && styles.segTextActive]}>
                  {opt.icon} {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <SectionTitle title="🩺 Dati clinici" />

        <Field label={isIt ? 'Peso (kg)' : 'Weight (kg)'} value={form.weight_kg} onChangeText={v => set('weight_kg', v)} keyboardType="decimal-pad" placeholder="70.5" />
        <Field label={isIt ? 'Altezza (cm)' : 'Height (cm)'} value={form.height_cm} onChangeText={v => set('height_cm', v)} keyboardType="decimal-pad" placeholder="175" />

        {/* ASA class */}
        <View style={styles.fieldContainer}>
          <Text style={styles.label}>{isIt ? 'Classe ASA' : 'ASA class'}</Text>
          <View style={styles.segmented}>
            {['1','2','3','4','5'].map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.segItem, form.asa_class === c && styles.segItemActive]}
                onPress={() => set('asa_class', form.asa_class === c ? '' : c)}>
                <Text style={[styles.segText, form.asa_class === c && styles.segTextActive]}>ASA {c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Field
          label={isIt ? '⚠️ Allergie' : '⚠️ Allergies'}
          value={form.allergies}
          onChangeText={v => set('allergies', v)}
          multiline
          placeholder={isIt ? 'Es. Penicillina, FANS' : 'E.g. Penicillin, NSAIDs'}
        />
        <Field
          label={isIt ? 'Note cliniche' : 'Clinical notes'}
          value={form.notes}
          onChangeText={v => set('notes', v)}
          multiline
        />

      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, error, multiline, keyboardType, placeholder, autoCapitalize }: any) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        placeholder={placeholder}
        placeholderTextColor={Colors.textLight}
        autoCapitalize={autoCapitalize || (multiline ? 'sentences' : 'words')}
        numberOfLines={multiline ? 3 : 1}
      />
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm },
  backIcon: { fontSize: 22, color: '#fff', fontWeight: '700', padding: 4 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  sectionTitle: { marginTop: Spacing.md, marginBottom: Spacing.sm, borderBottomWidth: 2, borderBottomColor: Colors.primary, paddingBottom: 4 },
  sectionTitleText: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  fieldContainer: { marginBottom: Spacing.sm },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 4, fontWeight: '500' },
  input: { backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.red },
  errorText: { color: Colors.red, fontSize: 12, marginTop: 3 },
  pickerWrapper: { backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm, overflow: 'hidden' },
  picker: { color: Colors.text, fontSize: 15 },
  segmented: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  segItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  segItemActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  segTextActive: { color: '#fff', fontWeight: '700' },
});
