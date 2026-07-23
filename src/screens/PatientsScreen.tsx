// src/screens/PatientsScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  SafeAreaView, TextInput, ActivityIndicator, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow, getNrsColor, getNrsBackground } from '../utils/theme';
import { format, parseISO } from 'date-fns';

type TabType = 'pre_ricovero' | 'ricoverato' | 'dimesso' | 'followup_cpsp';

const TABS: { key: TabType; icon: string; label: string }[] = [
  { key: 'pre_ricovero', icon: '🔵', label: 'Pre-ricovero' },
  { key: 'ricoverato',   icon: '🟡', label: 'Ricoverati'   },
  { key: 'dimesso',      icon: '✅', label: 'Dimessi'       },
  { key: 'followup_cpsp', icon: '🧠', label: 'Follow-up'    },
];

function classifyStatus(p: any): TabType {
  const s = p.patient_status as string | undefined;
  if (s === 'pre_ricovero') return 'pre_ricovero';
  if (s === 'followup_cpsp' || s === 'followup') return 'followup_cpsp';
  if (!p.is_active || s === 'dimesso') return 'dimesso';
  return 'ricoverato';
}

export default function PatientsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { profile, refreshSession } = useAuth();
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('ricoverato');
  const [loading, setLoading] = useState(true);

  const fetchPatients = async () => {
    refreshSession?.();
    const { data } = await supabase
      .from('patients')
      .select(`*, nrs_measurements (nrs_value, measured_at, alert_level)`)
      .order('last_name');

    const enriched = (data || []).map((p: any) => {
      const sorted = (p.nrs_measurements || []).sort(
        (a: any, b: any) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
      );
      return { ...p, last_nrs: sorted[0], _tab: classifyStatus(p) };
    });

    setAllPatients(enriched);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchPatients(); }, []));

  // Tab counts
  const counts = TABS.reduce<Record<TabType, number>>((acc, t) => {
    acc[t.key] = allPatients.filter(p => p._tab === t.key).length;
    return acc;
  }, { pre_ricovero: 0, ricoverato: 0, dimesso: 0, followup_cpsp: 0 });

  // Filtered list: tab + search
  const tabPatients = allPatients.filter(p => p._tab === activeTab);
  const filtered = search.trim()
    ? tabPatients.filter((p: any) => {
        const q = search.toLowerCase();
        return (
          p.last_name.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          p.admission_number.toLowerCase().includes(q) ||
          p.ward.toLowerCase().includes(q)
        );
      })
    : tabPatients;

  const canAddPatient = ['medico', 'infermiere', 'admin'].includes(profile?.role || '');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('patients')}</Text>
        {canAddPatient && (
          <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddPatient')}>
            <Text style={styles.addBtnText}>+ {t('add_patient')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.search}
          placeholder={t('search_patients')}
          placeholderTextColor={Colors.textLight}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Tab selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={styles.tabIcon}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                  {counts[tab.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>{filtered.length} pazienti</Text>
        <View style={styles.statsRight}>
          <AlertDot color={Colors.red}    count={filtered.filter(p => (p.last_nrs?.nrs_value ?? -1) > 6).length} label="NRS>6" />
          <AlertDot color={Colors.yellow} count={filtered.filter(p => p.last_nrs?.alert_level === 'giallo').length} label="Moderato" />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={p => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>{TABS.find(t => t.key === activeTab)?.icon ?? '🏥'}</Text>
              <Text style={styles.emptyText}>Nessun paziente in questa categoria</Text>
            </View>
          }
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('PatientDetail', { patientId: p.id })}>
              <View style={styles.cardLeft}>
                <View style={[styles.alertBar, { backgroundColor: p.last_nrs ? getNrsColor(p.last_nrs.nrs_value) : Colors.border }]} />
                <View style={styles.cardInfo}>
                  <Text style={styles.name}>{p.last_name} {p.first_name}</Text>
                  <Text style={styles.meta}>{p.ward} · Letto {p.bed || '-'}</Text>
                  <Text style={styles.meta}>{p.admission_number}</Text>
                  {p.allergies && <Text style={styles.allergy}>⚠️ {p.allergies}</Text>}
                </View>
              </View>
              <View style={styles.cardRight}>
                {p.last_nrs ? (
                  <View style={[styles.nrsBadge, { backgroundColor: getNrsBackground(p.last_nrs.nrs_value) }]}>
                    <Text style={[styles.nrsValue, { color: getNrsColor(p.last_nrs.nrs_value) }]}>{p.last_nrs.nrs_value}</Text>
                    <Text style={[styles.nrsLabel, { color: getNrsColor(p.last_nrs.nrs_value) }]}>NRS</Text>
                    <Text style={styles.nrsTime}>{format(parseISO(p.last_nrs.measured_at), 'HH:mm')}</Text>
                  </View>
                ) : (
                  <View style={[styles.nrsBadge, { backgroundColor: '#F5F5F5' }]}>
                    <Text style={{ color: Colors.textLight, fontSize: 18, fontWeight: '700' }}>-</Text>
                  </View>
                )}
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function AlertDot({ color, count, label }: any) {
  if (!count) return null;
  return (
    <View style={styles.alertDotContainer}>
      <View style={[styles.dot, { backgroundColor: color }]}>
        <Text style={styles.dotText}>{count}</Text>
      </View>
      <Text style={styles.dotLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginVertical: Spacing.sm, borderRadius: Radius.md, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  searchIcon: { fontSize: 16, marginRight: 8 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: Colors.text },
  tabScroll: { flexGrow: 0 },
  tabRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: 8, flexDirection: 'row' },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface, flexShrink: 0 },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabIcon: { fontSize: 13 },
  tabLabel: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  tabLabelActive: { color: '#fff', fontWeight: '700' },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.borderLight, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  tabBadgeTextActive: { color: '#fff' },
  statsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  statsText: { fontSize: 13, color: Colors.textMuted },
  statsRight: { flexDirection: 'row', gap: 12 },
  alertDotContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  dotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dotLabel: { fontSize: 11, color: Colors.textMuted },
  list: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, marginBottom: Spacing.sm, ...Shadow.sm, overflow: 'hidden' },
  cardLeft: { flex: 1, flexDirection: 'row' },
  alertBar: { width: 5 },
  cardInfo: { flex: 1, padding: Spacing.md },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  allergy: { fontSize: 11, color: Colors.yellow, fontWeight: '600', marginTop: 3 },
  cardRight: { flexDirection: 'row', alignItems: 'center', paddingRight: 8, gap: 4 },
  nrsBadge: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  nrsValue: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  nrsLabel: { fontSize: 10, fontWeight: '600' },
  nrsTime: { fontSize: 9, color: Colors.textMuted },
  chevron: { fontSize: 22, color: Colors.textLight },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
});
