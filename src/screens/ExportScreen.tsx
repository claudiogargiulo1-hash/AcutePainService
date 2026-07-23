// src/screens/ExportScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from 'expo-sharing';
import { supabase } from '../services/supabase';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

const EXPORTS = [
  { id: 'patients', label: 'Pazienti', icon: '👥', description: 'Anagrafica e dati clinici di tutti i pazienti' },
  { id: 'interventions', label: 'Interventi', icon: '🔧', description: 'Tutti gli interventi chirurgici registrati' },
  { id: 'nrs_measurements', label: 'Rilevazioni NRS', icon: '📊', description: 'Tutte le misurazioni del dolore' },
  { id: 'notifications', label: 'Notifiche', icon: '🔔', description: 'Log delle notifiche e alert generati' },
  { id: 'profiles', label: 'Utenti', icon: '👤', description: 'Profili del personale sanitario' },
];

export default function ExportScreen({ navigation }: any) {
  const [loading, setLoading] = useState<string | null>(null);

  const toCSV = (data: any[]): string => {
    if (!data || data.length === 0) return 'Nessun dato disponibile\n';
    const headers = Object.keys(data[0]);
    const rows = data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
      }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  const exportData = async (tableId: string, label: string) => {
    setLoading(tableId);
    try {
      const { data, error } = await supabase.from(tableId).select('*').order('created_at', { ascending: false });
      
      if (error) {
        Alert.alert('Errore', error.message);
        setLoading(null);
        return;
      }

      const csv = toCSV(data || []);
      const filename = `APS_${label}_${new Date().toISOString().slice(0,10)}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: "utf8" });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Esporta ${label}`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Successo', `File salvato: ${filename}`);
      }
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    }
    setLoading(null);
  };

  const exportAll = async () => {
    setLoading('all');
    try {
      const results = await Promise.all(
        EXPORTS.map(e => supabase.from(e.id).select('*').order('created_at', { ascending: false }))
      );

      let fullCSV = '';
      EXPORTS.forEach((exp, i) => {
        fullCSV += `\n\n=== ${exp.label.toUpperCase()} ===\n`;
        fullCSV += toCSV(results[i].data || []);
      });

      const filename = `APS_Export_Completo_${new Date().toISOString().slice(0,10)}.csv`;
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, fullCSV, { encoding: "utf8" });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Esporta tutti i dati',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Successo', `File salvato: ${filename}`);
      }
    } catch (e: any) {
      Alert.alert('Errore', e.message);
    }
    setLoading(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Export Dati</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>📋 Esporta i dati in formato CSV compatibile con Excel, Numbers e Google Sheets.</Text>
        </View>

        {/* Export singoli */}
        {EXPORTS.map(exp => (
          <TouchableOpacity
            key={exp.id}
            style={styles.card}
            onPress={() => exportData(exp.id, exp.label)}
            disabled={!!loading}>
            <View style={styles.cardLeft}>
              <Text style={styles.cardIcon}>{exp.icon}</Text>
              <View>
                <Text style={styles.cardLabel}>{exp.label}</Text>
                <Text style={styles.cardDesc}>{exp.description}</Text>
              </View>
            </View>
            {loading === exp.id
              ? <ActivityIndicator color={Colors.primary} />
              : <Text style={styles.exportBtn}>CSV ↓</Text>
            }
          </TouchableOpacity>
        ))}

        {/* Export completo */}
        <TouchableOpacity
          style={styles.exportAllBtn}
          onPress={exportAll}
          disabled={!!loading}>
          {loading === 'all'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.exportAllText}>📦 Esporta Tutto</Text>
          }
        </TouchableOpacity>

        <Text style={styles.note}>⚠️ I dati esportati sono sensibili. Gestirli nel rispetto del GDPR.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { color: Colors.primary, fontWeight: '600', fontSize: 15 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.text },
  scroll: { padding: Spacing.md, paddingBottom: 60 },
  infoBox: { backgroundColor: Colors.primary + '15', borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  infoText: { color: Colors.primary, fontSize: 13, lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...Shadow.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIcon: { fontSize: 28 },
  cardLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  cardDesc: { fontSize: 12, color: Colors.textLight, marginTop: 2 },
  exportBtn: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  exportAllBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 16, alignItems: 'center', marginTop: Spacing.md, ...Shadow.md },
  exportAllText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  note: { textAlign: 'center', color: Colors.textLight, fontSize: 12, marginTop: Spacing.md, lineHeight: 18 },
});
