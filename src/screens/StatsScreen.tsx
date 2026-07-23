// src/screens/StatsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView,
  ActivityIndicator, TouchableOpacity, Dimensions,
} from 'react-native';
import { supabase } from '../services/supabase';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { format, subDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CHART_CONFIG = {
  backgroundColor: '#fff',
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(26, 95, 122, ${opacity})`,
  labelColor: () => Colors.textLight,
  propsForBackgroundLines: { stroke: '#E5F0F5' },
  propsForDots: { r: '4', strokeWidth: '2', stroke: Colors.primary },
};

export default function StatsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [stats, setStats] = useState<any>({
    nrsTrend: [],
    wardCounts: [],
    interventionCategories: [],
    alertRate: { high: 0, total: 0 },
    missingMeasurements: [],
  });

  useEffect(() => { fetchStats(); }, [period]);

  const fetchStats = async () => {
    setLoading(true);
    const since = subDays(new Date(), period).toISOString();

    const [nrsRes, patientsRes, interventionsRes, missingRes] = await Promise.all([
      // Andamento NRS giornaliero
      supabase.rpc('get_nrs_daily_stats', { days_back: period }).select('*'),
      // Pazienti per reparto
      supabase.from('patients').select('ward').eq('is_active', true),
      // Interventi per categoria e sottotipo
      supabase.from('interventions').select('category, intervention_subtype, intervention_name').gte('created_at', since),
      // Pazienti attivi con ultime rilevazioni
      supabase.from('patients')
        .select('id, first_name, last_name, ward, nrs_measurements(measured_at, nrs_value)')
        .eq('is_active', true),
    ]);

    // Andamento NRS - fallback con query diretta se RPC non esiste
    let nrsTrend: any[] = [];
    if (nrsRes.error) {
      const { data } = await supabase
        .from('nrs_measurements')
        .select('measured_at, nrs_value')
        .gte('measured_at', since)
        .order('measured_at');
      
      if (data) {
        const byDay: Record<string, number[]> = {};
        data.forEach((m: any) => {
          const day = m.measured_at.slice(0, 10);
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(m.nrs_value);
        });
        nrsTrend = Object.entries(byDay).map(([day, vals]) => ({
          day,
          avg_nrs: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1),
          high_count: vals.filter(v => v >= 7).length,
          total: vals.length,
        }));
      }
    } else {
      nrsTrend = nrsRes.data || [];
    }

    // Pazienti per reparto
    const wardMap: Record<string, number> = {};
    (patientsRes.data || []).forEach((p: any) => {
      wardMap[p.ward] = (wardMap[p.ward] || 0) + 1;
    });
    const wardCounts = Object.entries(wardMap).map(([ward, count]) => ({ ward, count }));

    // Interventi per categoria
    const catMap: Record<string, number> = {};
    (interventionsRes.data || []).forEach((i: any) => {
      catMap[i.category] = (catMap[i.category] || 0) + 1;
    });
    const interventionCategories = Object.entries(catMap).map(([cat, count]) => ({ cat, count }));

    // Sottotipi per categoria
    const subtypeMap: Record<string, Record<string, number>> = {};
    (interventionsRes.data || []).forEach((i: any) => {
      const subtype = i.intervention_subtype || i.intervention_name || 'Non specificato';
      if (!subtypeMap[i.category]) subtypeMap[i.category] = {};
      subtypeMap[i.category][subtype] = (subtypeMap[i.category][subtype] || 0) + 1;
    });
    const interventionSubtypes = Object.entries(subtypeMap).map(([cat, subtypes]) => ({
      cat,
      subtypes: Object.entries(subtypes).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count),
    }));

    // Tasso alert NRS elevati
    const allNrs = nrsTrend.reduce((acc: any, d: any) => ({
      high: acc.high + (parseInt(d.high_count) || 0),
      total: acc.total + (parseInt(d.total) || 0),
    }), { high: 0, total: 0 });

    // Rilevazioni mancanti (pazienti senza NRS nelle ultime 24h)
    const now = new Date();
    const missing = (missingRes.data || []).map((p: any) => {
      const measurements = p.nrs_measurements || [];
      const last = measurements.sort((a: any, b: any) =>
        new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
      )[0];
      const hoursSinceLast = last
        ? (now.getTime() - new Date(last.measured_at).getTime()) / 3600000
        : 999;
      return { ...p, hoursSinceLast, lastNRS: last?.nrs_value };
    }).filter((p: any) => p.hoursSinceLast > 12).sort((a: any, b: any) => b.hoursSinceLast - a.hoursSinceLast);

    setStats({ nrsTrend, wardCounts, interventionCategories, interventionSubtypes, alertRate: allNrs, missingMeasurements: missing });
    setLoading(false);
  };

  const PIE_COLORS = ['#1A5F7A', '#57C5B6', '#F59E0B', '#EF4444', '#8B5CF6', '#10B981', '#F97316'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📈 Statistiche</Text>
        <View style={{ width: 80 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textLight, marginTop: 12 }}>Caricamento dati...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>

          {/* Selettore periodo */}
          <View style={styles.periodSelector}>
            {([7, 14, 30] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                onPress={() => setPeriod(p)}>
                <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                  {p} giorni
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPI Cards */}
          <View style={styles.kpiRow}>
            <KPICard
              icon="🏥"
              label="Pazienti attivi"
              value={stats.wardCounts.reduce((a: number, w: any) => a + w.count, 0)}
              color={Colors.primary}
            />
            <KPICard
              icon="🔴"
              label="Alert NRS"
              value={`${stats.alertRate.total > 0 ? Math.round(stats.alertRate.high / stats.alertRate.total * 100) : 0}%`}
              color="#EF4444"
            />
            <KPICard
              icon="⚠️"
              label="Rilevaz. mancanti"
              value={stats.missingMeasurements.length}
              color="#F59E0B"
            />
          </View>

          {/* Andamento NRS */}
          {stats.nrsTrend.length >= 2 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 Andamento NRS Medio</Text>
              <LineChart
                data={{
                  labels: stats.nrsTrend.map((d: any) =>
                    format(parseISO(d.day), 'dd/MM', { locale: it })
                  ),
                  datasets: [{
                    data: stats.nrsTrend.map((d: any) => parseFloat(d.avg_nrs) || 0),
                    color: () => Colors.primary,
                    strokeWidth: 2,
                  }],
                }}
                width={SCREEN_WIDTH - 48}
                height={180}
                chartConfig={CHART_CONFIG}
                bezier
                fromZero
                segments={5}
                style={{ borderRadius: Radius.md, marginTop: 8 }}
              />
              <View style={styles.nrsLegend}>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#22C55E' }]} /><Text style={styles.legendText}>0-3 lieve</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#F59E0B' }]} /><Text style={styles.legendText}>4-6 moderato</Text></View>
                <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#EF4444' }]} /><Text style={styles.legendText}>7-10 severo</Text></View>
              </View>
            </View>
          )}

          {/* Pazienti per reparto */}
          {stats.wardCounts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏥 Pazienti per Reparto</Text>
              {stats.wardCounts.map((w: any, i: number) => (
                <View key={w.ward} style={styles.barRow}>
                  <Text style={styles.barLabel}>{w.ward}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      width: `${(w.count / Math.max(...stats.wardCounts.map((x: any) => x.count))) * 100}%`,
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }]} />
                  </View>
                  <Text style={styles.barValue}>{w.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tipi di interventi */}
          {stats.interventionCategories.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔧 Tipi di Intervento</Text>
              {stats.interventionCategories.map((c: any, i: number) => (
                <View key={c.cat} style={styles.barRow}>
                  <Text style={styles.barLabel}>{c.cat}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, {
                      width: `${(c.count / Math.max(...stats.interventionCategories.map((x: any) => x.count))) * 100}%`,
                      backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                    }]} />
                  </View>
                  <Text style={styles.barValue}>{c.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Sottotipi interventi */}
          {stats.interventionSubtypes?.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔬 Dettaglio Tipi di Intervento</Text>
              {stats.interventionSubtypes.map((group: any) => (
                <View key={group.cat} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 6, textTransform: 'uppercase' }}>
                    {group.cat}
                  </Text>
                  {group.subtypes.map((s: any, i: number) => (
                    <View key={s.name} style={styles.barRow}>
                      <Text style={[styles.barLabel, { width: 150 }]} numberOfLines={1}>{s.name}</Text>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, {
                          width: `${(s.count / group.subtypes[0].count) * 100}%`,
                          backgroundColor: Colors.accent,
                        }]} />
                      </View>
                      <Text style={styles.barValue}>{s.count}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}

          {/* Rilevazioni mancanti */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚠️ Pazienti senza rilevazione recente</Text>
            {stats.missingMeasurements.length === 0 ? (
              <View style={styles.allGood}>
                <Text style={styles.allGoodIcon}>✅</Text>
                <Text style={styles.allGoodText}>Tutti i pazienti hanno rilevazioni recenti</Text>
              </View>
            ) : (
              stats.missingMeasurements.map((p: any) => (
                <View key={p.id} style={styles.missingRow}>
                  <View style={styles.missingLeft}>
                    <Text style={styles.missingName}>{p.last_name} {p.first_name}</Text>
                    <Text style={styles.missingWard}>{p.ward}</Text>
                  </View>
                  <View style={styles.missingRight}>
                    <Text style={[styles.missingHours, { color: p.hoursSinceLast > 24 ? '#EF4444' : '#F59E0B' }]}>
                      {p.hoursSinceLast === 999 ? 'Mai' : `${Math.round(p.hoursSinceLast)}h fa`}
                    </Text>
                    {p.lastNRS !== undefined && (
                      <Text style={styles.missingNRS}>Ultimo NRS: {p.lastNRS}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function KPICard({ icon, label, value, color }: any) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: Spacing.md, paddingBottom: 60 },
  periodSelector: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: '#fff' },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  periodTextActive: { color: '#fff' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  kpiCard: { flex: 1, backgroundColor: '#fff', borderRadius: Radius.md, padding: 12, alignItems: 'center', ...Shadow.sm },
  kpiIcon: { fontSize: 22, marginBottom: 4 },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  kpiLabel: { fontSize: 10, color: Colors.textLight, textAlign: 'center', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  nrsLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: Colors.textLight },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  barLabel: { width: 90, fontSize: 12, color: Colors.text, fontWeight: '500' },
  barTrack: { flex: 1, height: 16, backgroundColor: '#F0F4F8', borderRadius: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 8 },
  barValue: { width: 24, fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'right' },
  missingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  missingLeft: { flex: 1 },
  missingName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  missingWard: { fontSize: 12, color: Colors.textLight },
  missingRight: { alignItems: 'flex-end' },
  missingHours: { fontSize: 14, fontWeight: '700' },
  missingNRS: { fontSize: 11, color: Colors.textLight },
  allGood: { alignItems: 'center', paddingVertical: 20 },
  allGoodIcon: { fontSize: 36, marginBottom: 8 },
  allGoodText: { color: Colors.textLight, fontSize: 14 },
});
