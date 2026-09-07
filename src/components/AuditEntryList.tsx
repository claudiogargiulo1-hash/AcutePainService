// src/components/AuditEntryList.tsx
// Elenco di voci della cronologia modifiche (audit_log), riusabile sia nella
// schermata globale (Impostazioni → Cronologia) sia nel dettaglio paziente.
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { Colors, Spacing, Radius } from '../utils/theme';
import { AuditEntry, AUDIT_TABLE_LABELS, AUDIT_ACTION_STYLE, diffAuditValues, fetchAuditEntries } from '../services/auditService';

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const style = AUDIT_ACTION_STYLE[entry.action] || { label: entry.action, color: Colors.textMuted, bg: Colors.background };
  const who = entry._user ? `${entry._user.first_name} ${entry._user.last_name}` : (entry.user_id ? 'Utente eliminato' : 'Sistema');
  const changed = entry.action === 'UPDATE' ? diffAuditValues(entry.old_values, entry.new_values)
    : entry.action === 'INSERT' ? diffAuditValues(null, entry.new_values)
    : diffAuditValues(entry.old_values, null);

  return (
    <TouchableOpacity
      activeOpacity={changed.length ? 0.7 : 1}
      onPress={() => changed.length && setOpen(o => !o)}
      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <View style={{ backgroundColor: style.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: style.color, fontWeight: '700', fontSize: 11 }}>{style.label}</Text>
        </View>
        <Text style={{ fontWeight: '600', fontSize: 13, color: Colors.text }}>
          {AUDIT_TABLE_LABELS[entry.table_name] || entry.table_name}
        </Text>
        <Text style={{ fontSize: 12, color: Colors.textMuted, flexShrink: 1 }}>
          — {who}{entry._user?.role ? ` (${entry._user.role})` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Text style={{ fontSize: 11, color: Colors.textLight }}>
          {formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true, locale: it })}
        </Text>
        {changed.length > 0 && <Text style={{ fontSize: 11, color: Colors.textLight }}>{open ? '▲' : '▼'}</Text>}
      </View>
      {open && changed.length > 0 && (
        <View style={{ marginTop: 8, backgroundColor: Colors.background, borderRadius: Radius.sm, padding: 10 }}>
          {changed.map(([k, a, b]) => (
            <View key={k} style={{ paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: Colors.borderLight, borderStyle: 'dashed' as any }}>
              <Text style={{ color: Colors.textMuted, fontWeight: '600', fontSize: 11 }}>{k}</Text>
              {entry.action === 'UPDATE' ? (
                <Text style={{ fontSize: 12, color: Colors.text }}>
                  <Text style={{ color: '#E53935', textDecorationLine: 'line-through' }}>{String(a ?? '—')}</Text>
                  {'  →  '}
                  <Text style={{ color: '#16A34A' }}>{String(b ?? '—')}</Text>
                </Text>
              ) : (
                <Text style={{ fontSize: 12, color: Colors.text }}>{String((a ?? b) ?? '—')}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function AuditEntryList({ entries, loading }: { entries: AuditEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <View style={{ paddingVertical: 30, alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }
  if (entries.length === 0) {
    return (
      <View style={{ paddingVertical: 30, alignItems: 'center' }}>
        <Text style={{ color: Colors.textMuted, fontSize: 13 }}>Nessuna modifica registrata</Text>
      </View>
    );
  }
  return <View>{entries.map(e => <AuditEntryRow key={e.id} entry={e} />)}</View>;
}


export function PatientAuditSection({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchAuditEntries({ patientId, limit: 200 }).then(e => {
      if (alive) { setEntries(e); setLoading(false); }
    });
    return () => { alive = false; };
  }, [patientId]);

  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 }}>📜 Cronologia modifiche</Text>
      <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 12 }}>
        Visibile solo agli amministratori. Tutte le modifiche registrate per questo paziente.
      </Text>
      <AuditEntryList entries={entries} loading={loading} />
    </View>
  );
}
