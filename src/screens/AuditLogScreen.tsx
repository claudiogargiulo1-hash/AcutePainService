// src/screens/AuditLogScreen.tsx
// Cronologia modifiche globale — visibile solo agli admin (gate lato UI qui,
// e comunque protetta a monte dalla policy RLS "audit_admin_only" sul DB).
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, FlatList,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';
import { fetchAuditEntries, AuditEntry, AUDIT_TABLE_LABELS } from '../services/auditService';
import AuditEntryList from '../components/AuditEntryList';

export default function AuditLogScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState<string | null>(null);

  const load = useCallback(async (filter: string | null) => {
    setLoading(true);
    const data = await fetchAuditEntries({ tableName: filter || undefined, limit: 300 });
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(tableFilter); }, [tableFilter, load]);

  if (profile?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← Indietro</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Cronologia</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
          <Text style={{ color: Colors.textMuted }}>Sezione riservata agli amministratori.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filters = [{ id: null as string | null, label: 'Tutte' }, ...Object.entries(AUDIT_TABLE_LABELS).map(([id, label]) => ({ id, label }))];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Cronologia modifiche</Text>
        <View style={{ width: 80 }} />
      </View>

      <View style={styles.filterBar}>
        <FlatList
          data={filters}
          keyExtractor={f => f.id || 'all'}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: Spacing.md }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setTableFilter(item.id)}
              style={[styles.chip, tableFilter === item.id && styles.chipActive]}>
              <Text style={[styles.chipText, tableFilter === item.id && styles.chipTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <AuditEntryList entries={entries} loading={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  filterBar: { backgroundColor: '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: '#fff' },
  chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  chipTextActive: { color: '#fff' },
  scroll: { padding: Spacing.md, paddingBottom: 60 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm },
});
