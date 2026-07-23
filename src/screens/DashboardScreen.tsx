// src/screens/DashboardScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow, getNrsColor, getNrsBackground } from '../utils/theme';
import { Patient, NrsMeasurement } from '../types/database';
import { format, isToday, parseISO } from 'date-fns';

interface PatientWithNRS extends Patient {
  last_nrs?: NrsMeasurement;
  today_count?: number;
  missing_today?: boolean;
  latest_intervention?: any;
}

interface DashboardStats {
  active: number;
  high_pain: number;
  missing: number;
  today_total: number;
}

export default function DashboardScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { profile, refreshSession } = useAuth();
  const [patients, setPatients] = useState<PatientWithNRS[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ active: 0, high_pain: 0, missing: 0, today_total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    refreshSession?.();

    // Active patients
    const { data: patientsData } = await supabase
      .from('patients')
      .select(`
        *,
        interventions (
          id, pain_protocol, nrs_schedule, nrs_alert_threshold, intervention_name
        )
      `)
      .eq('is_active', true)
      .order('last_name');

    if (!patientsData) return;

    // Last NRS for each patient
    const enriched: PatientWithNRS[] = await Promise.all(
      patientsData.map(async (p: any) => {
        const { data: lastNRS } = await supabase
          .from('nrs_measurements')
          .select('*')
          .eq('patient_id', p.id)
          .order('measured_at', { ascending: false })
          .limit(1)
          .single();

        const { count: todayCount } = await supabase
          .from('nrs_measurements')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', p.id)
          .gte('measured_at', new Date().toISOString().split('T')[0]);

        const schedule = p.interventions?.[0]?.nrs_schedule || ['08:00','12:00','16:00','20:00','24:00'];
        const now = new Date();
        const passedSlots = schedule.filter((s: string) => {
          const [h, m] = s.split(':').map(Number);
          return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
        }).length;
        const missingToday = (todayCount || 0) < passedSlots;

        return {
          ...p,
          last_nrs: lastNRS || undefined,
          today_count: todayCount || 0,
          missing_today: missingToday,
          latest_intervention: p.interventions?.[0],
        };
      })
    );

    const highPain = enriched.filter(p => (p.last_nrs?.nrs_value || 0) > 6).length;
    const missing = enriched.filter(p => p.missing_today).length;

    const { count: todayTotal } = await supabase
      .from('nrs_measurements')
      .select('id', { count: 'exact', head: true })
      .gte('measured_at', new Date().toISOString().split('T')[0]);

    setPatients(enriched);
    setStats({
      active: enriched.length,
      high_pain: highPain,
      missing,
      today_total: todayTotal || 0,
    });
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchDashboard(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              {new Date().getHours() < 12 ? '☀️' : new Date().getHours() < 18 ? '🌤' : '🌙'} {t('dashboard')}
            </Text>
            <Text style={styles.date}>{format(new Date(), 'EEEE d MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Stats')}
            style={{ backgroundColor: Colors.accent + '30', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 }}>
            <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 13 }}>📈</Text>
          </TouchableOpacity>
          <View style={styles.profileBadge}>
            <Text style={styles.profileInitial}>
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </Text>
          </View>
        </View>

        {/* Stats cards */}
        <View style={styles.statsGrid}>
          <StatCard label={t('active_patients')} value={stats.active} icon="🏥" color={Colors.primary} />
          <StatCard label={t('high_pain')} value={stats.high_pain} icon="🔴" color={Colors.red} alert={stats.high_pain > 0} />
          <StatCard label={t('missing_measurements')} value={stats.missing} icon="⚠️" color={Colors.yellow} alert={stats.missing > 0} />
          <StatCard label={t('today_measurements')} value={stats.today_total} icon="📋" color={Colors.accent} />
        </View>

        {/* Patient list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('patients')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Patients')}>
            <Text style={styles.seeAll}>{t('see_all')}</Text>
          </TouchableOpacity>
        </View>

        {patients.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyText}>{t('no_patients')}</Text>
          </View>
        ) : (
          patients
            .sort((a, b) => (b.last_nrs?.nrs_value || 0) - (a.last_nrs?.nrs_value || 0))
            .slice(0, 8)
            .map(p => (
              <PatientCard
                key={p.id}
                patient={p}
                onPress={() => navigation.navigate('PatientDetail', { patientId: p.id })}
                onNRS={() => navigation.navigate('NRSEntry', { patientId: p.id })}
                t={t}
              />
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color, alert = false }: any) {
  return (
    <View style={[styles.statCard, alert && { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function PatientCard({ patient, onPress, onNRS, t }: any) {
  const nrsVal = patient.last_nrs?.nrs_value;
  const nrsColor = nrsVal !== undefined ? getNrsColor(nrsVal) : Colors.textLight;
  const nrsBg = nrsVal !== undefined ? getNrsBackground(nrsVal) : '#F5F5F5';

  return (
    <TouchableOpacity style={styles.patientCard} onPress={onPress}>
      <View style={styles.patientLeft}>
        <View style={[styles.alertDot, {
          backgroundColor:
            patient.missing_today ? Colors.yellow :
            (nrsVal || 0) > 6 ? Colors.red : Colors.green
        }]} />
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>{patient.last_name} {patient.first_name}</Text>
          <Text style={styles.patientMeta}>
            {patient.ward} · Letto {patient.bed || '-'} · {patient.admission_number}
          </Text>
          {patient.latest_intervention && (
            <Text style={styles.patientIntervention} numberOfLines={1}>
              🔧 {patient.latest_intervention.intervention_name}
            </Text>
          )}
          {patient.missing_today && (
            <Text style={styles.missingBadge}>⚠️ {t('missing_today')}</Text>
          )}
        </View>
      </View>
      <View style={styles.patientRight}>
        {nrsVal !== undefined ? (
          <View style={[styles.nrsBadge, { backgroundColor: nrsBg }]}>
            <Text style={[styles.nrsValue, { color: nrsColor }]}>{nrsVal}</Text>
            <Text style={[styles.nrsLabel, { color: nrsColor }]}>NRS</Text>
          </View>
        ) : (
          <View style={[styles.nrsBadge, { backgroundColor: '#F5F5F5' }]}>
            <Text style={[styles.nrsLabel, { color: Colors.textLight }]}>-</Text>
          </View>
        )}
        <TouchableOpacity style={styles.nrsBtn} onPress={onNRS}>
          <Text style={styles.nrsBtnText}>+ NRS</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.text },
  date: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  profileBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  profileInitial: { color: '#fff', fontWeight: '700', fontSize: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, ...Shadow.sm, alignItems: 'center' },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  seeAll: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: Spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 16 },
  patientCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...Shadow.sm },
  patientLeft: { flexDirection: 'row', flex: 1, alignItems: 'flex-start' },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10, marginTop: 5 },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '600', color: Colors.text },
  patientMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  patientIntervention: { fontSize: 12, color: Colors.primary, marginTop: 3 },
  missingBadge: { fontSize: 11, color: Colors.yellow, fontWeight: '600', marginTop: 3 },
  patientRight: { alignItems: 'center', gap: 6, marginLeft: 8 },
  nrsBadge: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  nrsValue: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  nrsLabel: { fontSize: 10, fontWeight: '600' },
  nrsBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 5 },
  nrsBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
