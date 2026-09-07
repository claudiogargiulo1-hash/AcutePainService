// src/services/auditService.ts
// Cronologia modifiche (audit_log) — lettura per la UI. La tabella è protetta
// da RLS lato database: solo il ruolo admin può leggerla, indipendentemente
// da questo codice.
import { supabase } from './supabase';

export interface AuditEntry {
  id: string;
  user_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string | null;
  patient_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  _user?: { id: string; first_name: string; last_name: string; role: string } | null;
}

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  patients: '👤 Paziente',
  interventions: '🔧 Intervento',
  cpsp_assessments: '🧠 Valutazione CPSP',
  cpsp_followups: '🧠 Follow-up CPSP',
  nrs_measurements: '📊 Rilevazione NRS',
  wards: '🏥 Reparto',
  opioid_records: '💊 Somministrazione oppioidi',
  opioid_prescriptions: '💊 Prescrizione oppioidi',
  opioid_discharge_plans: '💊 Piano dimissione oppioidi',
  profiles: '✦ Utente',
  registration_requests: '✦ Richiesta di accesso',
};

export const AUDIT_ACTION_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  INSERT: { label: 'Creazione', color: '#16A34A', bg: '#DCFCE7' },
  UPDATE: { label: 'Modifica', color: '#0369A1', bg: '#E0F2FE' },
  DELETE: { label: 'Eliminazione', color: '#E53935', bg: '#FEECEB' },
};

export async function fetchAuditEntries(opts: {
  patientId?: string;
  tableName?: string;
  limit?: number;
}): Promise<AuditEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit || 100);
  if (opts.patientId) query = query.eq('patient_id', opts.patientId);
  if (opts.tableName) query = query.eq('table_name', opts.tableName);

  const { data, error } = await query;
  if (error || !data) return [];

  const userIds = Array.from(new Set(data.map((r: any) => r.user_id).filter(Boolean)));
  let usersMap: Record<string, any> = {};
  if (userIds.length) {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .in('id', userIds);
    usersMap = Object.fromEntries((users || []).map((u: any) => [u.id, u]));
  }

  return data.map((r: any) => ({ ...r, _user: usersMap[r.user_id] || null }));
}

/** Confronta old/new e restituisce solo i campi effettivamente cambiati. */
export function diffAuditValues(oldV: any, newV: any): [string, any, any][] {
  const skip = ['id', 'created_at', 'updated_at'];
  if (!oldV && newV) return Object.entries(newV).filter(([k]) => !skip.includes(k)).map(([k, v]) => [k, undefined, v]);
  if (oldV && !newV) return Object.entries(oldV).filter(([k]) => !skip.includes(k)).map(([k, v]) => [k, v, undefined]);
  if (!oldV || !newV) return [];
  const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
  const changed: [string, any, any][] = [];
  keys.forEach(k => {
    if (skip.includes(k)) return;
    const a = oldV[k];
    const b = newV[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push([k, a, b]);
  });
  return changed;
}
