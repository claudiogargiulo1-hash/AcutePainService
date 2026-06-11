// src/services/cpspService.ts
// Data access layer for CPSP assessments and follow-ups.

import { SupabaseClient } from '@supabase/supabase-js';

// ─── ASSESSMENTS ─────────────────────────────────────────────────────────────

export async function loadAssessments(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from('cpsp_assessments')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function saveAssessment(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  id?: string | null,
) {
  if (id) {
    const res = await supabase.from('cpsp_assessments').update(payload).eq('id', id);
    return { data: { id }, error: res.error };
  }
  return supabase.from('cpsp_assessments').insert(payload).select('id').single();
}

export async function deleteAssessment(supabase: SupabaseClient, id: string) {
  return supabase.from('cpsp_assessments').delete().eq('id', id);
}

// ─── FOLLOW-UPS ──────────────────────────────────────────────────────────────

export async function loadFollowups(supabase: SupabaseClient, patientId: string) {
  const { data, error } = await supabase
    .from('cpsp_followups')
    .select('*')
    .eq('patient_id', patientId)
    .order('followup_months', { ascending: true });
  return { data: data ?? [], error };
}

export async function saveFollowup(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  id?: string | null,
) {
  if (id) {
    return supabase.from('cpsp_followups').update(payload).eq('id', id);
  }
  return supabase.from('cpsp_followups').insert(payload);
}

export async function deleteFollowup(supabase: SupabaseClient, id: string) {
  return supabase.from('cpsp_followups').delete().eq('id', id);
}

// ─── SYNC APS NRS → CPSP DAILY TRAJECTORY ────────────────────────────────────

/**
 * Reads nrs_measurements recorded after surgery and upserts them into
 * cpsp_nrs_daily (source='aps').  Patient-submitted rows are never overwritten.
 */
export async function syncNrsToCpspTrajectory(
  supabase: SupabaseClient,
  patientId: string,
) {
  // Get the latest CPSP assessment (for id + surgery reference date)
  const { data: assessment } = await supabase
    .from('cpsp_assessments')
    .select('id, surgery_date, created_at, tenant_id')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!assessment) return;

  const refDate = assessment.surgery_date
    ? new Date(assessment.surgery_date)
    : (() => { const d = new Date(assessment.created_at); d.setHours(0, 0, 0, 0); return d; })();

  // Fetch NRS measurements from surgery day onwards (POD 1-7 window)
  const windowEnd = new Date(refDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: measurements } = await supabase
    .from('nrs_measurements')
    .select('id, nrs_value, nrs_rest, nrs_movement, measured_at, recorded_by')
    .eq('patient_id', patientId)
    .gte('measured_at', refDate.toISOString())
    .lte('measured_at', windowEnd)
    .order('measured_at', { ascending: true });

  if (!measurements || measurements.length === 0) return;

  // Group by POD day (last measurement per day wins)
  const dayMap: Record<number, any> = {};
  for (const m of measurements) {
    const diffMs = new Date(m.measured_at).getTime() - refDate.getTime();
    const pod = Math.max(1, Math.min(7, Math.ceil(diffMs / (24 * 60 * 60 * 1000))));
    dayMap[pod] = m;
  }

  // Fetch existing rows to avoid overwriting patient-submitted data
  const pods = Object.keys(dayMap).map(Number);
  const { data: existing } = await supabase
    .from('cpsp_nrs_daily')
    .select('id, pod_day, source')
    .eq('assessment_id', assessment.id)
    .in('pod_day', pods);

  const existingByPod: Record<number, any> = {};
  (existing ?? []).forEach((r: any) => { existingByPod[r.pod_day] = r; });

  for (const [podStr, m] of Object.entries(dayMap)) {
    const pod = Number(podStr);
    const row = {
      assessment_id: assessment.id,
      patient_id: patientId,
      tenant_id: assessment.tenant_id ?? null,
      pod_day: pod,
      nrs_rest: m.nrs_rest ?? m.nrs_value ?? null,
      nrs_movement: m.nrs_movement ?? null,
      source: 'aps',
      recorded_by: m.recorded_by ?? null,
      recorded_at: m.measured_at,
    };

    const existingRow = existingByPod[pod];
    if (!existingRow) {
      await supabase.from('cpsp_nrs_daily').insert(row);
    } else if (existingRow.source === 'aps') {
      await supabase.from('cpsp_nrs_daily').update(row).eq('id', existingRow.id);
    }
    // source='patient_qr' → skip, patient data takes precedence
  }
}
