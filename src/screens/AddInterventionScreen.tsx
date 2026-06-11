// src/screens/AddInterventionScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Alert, ActivityIndicator, Switch,
} from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';

// ─── design tokens ────────────────────────────────────────────────────────────
const P  = '#0A6E6E';
const AC = '#00BFA5';

// ─── constants (mirror web app) ───────────────────────────────────────────────
const ANESTHESIA_TYPES      = ['Generale','Spinale','Epidurale','Combinata spinale-epidurale','Locoregionale','Sedazione','Locale'];
const LOCAL_ANESTHETICS     = ['Bupivacaina','Bupivacaina iperbarica','Bupivacaina isobarica','Levobupivacaina','Ropivacaina','Lidocaina','Mepivacaina','Altro'];
const EPIDURALE_OPIOIDS     = ['Nessuno','Morfina','Fentanil','Sufentanil'];
const GENERALE_HYPNOTICS    = ['Propofol','Sevoflurano','Desflurano','Combinato'];
const GENERALE_IND_OPIOIDS  = ['Nessuno','Fentanil','Sufentanil','Remifentanil','Metadone'];
const NEUROMUSCULAR         = ['Nessuno','Rocuronio','Vecuronio','Cisatracurio'];
const LOCO_BLOCKS           = ['PENG','ACB','Fascia Iliaca','LIA','ESPB','Paravertebrale (PVB)','Interscaleno','TAP','PECS','Epidurale toracica','Intercostale','Ileo-inguinale'];
const LOCO_ADJUVANTS        = ['Desametasone','Adrenalina','Clonidina','Bicarbonato'];
const SEDAZIONE_DRUGS       = ['Propofol TCI','Propofol mg/kg/h','Midazolam','Dexmedetomidina','Ketamina','Combinato'];
const SEDAZIONE_PH: Record<string,string> = {
  'Propofol TCI':     'es. 2.5 µg/ml (target)',
  'Propofol mg/kg/h': 'es. 4 mg/kg/h',
  'Midazolam':        'es. 2 mg',
  'Dexmedetomidina':  'es. 0.5 µg/kg/h',
  'Ketamina':         'es. 0.5 mg/kg/h',
  'Combinato':        'es. descrivi schema',
};
const BASE_ANALGESICS_LIST  = ['Paracetamolo','Ketorolac','Ketoprofene','Ibuprofene','Celecoxib','Desametasone','Magnesio solfato'];
const GAB_OPTIONS           = ['Nessuno','Gabapentin','Pregabalin'];
const KET_POST_DOSES        = ['0.05 mg/kg/h (IOR)','0.1 mg/kg/h','0.2 mg/kg/h','Personalizzata'];
const NRS_TARGETS           = ['≤3 a riposo','≤4 a riposo','Personalizzato'];
const ANALGESIC_ROUTES      = ['Orale','EV','IM','SC'];

const CATEGORIES = ['ortopedico','addominale','toracico','urologico','ginecologico','vascolare','neurochirurgico','altro'];
const SUBTYPES: Record<string,string[]> = {
  ortopedico:      ['Protesi totale anca','Protesi monocompartimentale ginocchio','Protesi totale ginocchio','Artroscopia ginocchio','Artroscopia spalla','Protesi spalla','Osteosintesi femore','Osteosintesi tibia','Osteosintesi radio/ulna','Artrodesi colonna','Discectomia lombare','Laminectomia','Amputazione','Altro ortopedico'],
  addominale:      ['Appendicectomia','Colecistectomia','Laparotomia','Ernioplastica','Resezione colon','Altro addominale'],
  toracico:        ['Lobectomia','Toracoscopia','VATS','Altro toracico'],
  urologico:       ['Prostatectomia','Nefrectomia','Cistoscopia','TURP','Altro urologico'],
  ginecologico:    ['Isterectomia','Miomectomia','Laparoscopia ginecologica','Altro ginecologico'],
  vascolare:       ['Bypass','Endoarteriectomia','Aneurisma aorta','Altro vascolare'],
  neurochirurgico: ['Craniotomia','Derivazione','Microdiscectomia','Altro neurochirurgico'],
  altro:           ['Altro'],
};

const OPIOIDS: Record<string,{ factor: number; routes: string[] }> = {
  'Morfina orale':     { factor: 1,    routes: ['orale'] },
  'Morfina EV/SC':     { factor: 3,    routes: ['ev','sc','im'] },
  'Oramorph':          { factor: 1,    routes: ['orale'] },
  'Ossicodone orale':  { factor: 1.5,  routes: ['orale'] },
  'Ossicodone EV':     { factor: 3,    routes: ['ev'] },
  'Idromorfone orale': { factor: 4,    routes: ['orale'] },
  'Idromorfone EV':    { factor: 20,   routes: ['ev','sc'] },
  'Fentanyl TTS':      { factor: 2.4,  routes: ['td'] },
  'Fentanyl EV':       { factor: 100,  routes: ['ev'] },
  'Tramadolo orale':   { factor: 0.2,  routes: ['orale'] },
  'Tramadolo EV':      { factor: 0.2,  routes: ['ev','im'] },
  'Buprenorfina SL':   { factor: 30,   routes: ['sl'] },
  'Buprenorfina TDS':  { factor: 2.4,  routes: ['td'] },
  'Tapentadolo':       { factor: 0.4,  routes: ['orale'] },
  'Codeina':           { factor: 0.15, routes: ['orale'] },
};
const OPIOID_NAMES = Object.keys(OPIOIDS);
const FREQUENCIES  = ['1x/die','2x/die','3x/die','4x/die','6x/die','8x/die'];
const FREQ_MAP: Record<string,number> = {'1x/die':1,'2x/die':2,'3x/die':3,'4x/die':4,'6x/die':6,'8x/die':8};
function toMEO(drug: string, dose: number) { return dose * (OPIOIDS[drug]?.factor || 1); }

const getNow = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2,'0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

// ─── initial state ────────────────────────────────────────────────────────────

const INIT_ANES: any = {
  types: [],
  spinale:  { la_drug:'', la_drug_custom:'', la_concentration:'', la_volume:'', morfina_it:false, morfina_dose_ug:'', fentanil_it:false, fentanil_dose_ug:'', clonidina_it:false, clonidina_dose_ug:'', ketamina_it:false, ketamina_dose_mg:'', desametasone:false, desametasone_dose_mg:'' },
  epidurale:{ la_drug:'', la_drug_custom:'', la_concentration:'', la_volume:'', opioide:'Nessuno', opioide_dose:'', clonidina:false, clonidina_dose_ug:'', desametasone:false, desametasone_dose_mg:'', pca:false, pca_bolo_ml:'', pca_lockout_min:'' },
  generale: { ipnotico:'', ipnotico_dose:'', opioide_induzione:'Nessuno', opioide_dose:'', ketamina_ev:false, ketamina_bolus_mgkg:'', ketamina_infusion_mgkgh:'', lidocaina_ev:false, lidocaina_bolus_mgkg:'', lidocaina_infusion_mgkgh:'', desametasone:false, desametasone_dose_mg:'', curarizzazione:'Nessuno', curarizzazione_dose:'' },
  locoregionale: { blocks:[] as string[] },
  sedazione:{ farmaci:[] as string[], dosi:{} as Record<string,string> },
  locale:   { la_drug:'', la_drug_custom:'', la_concentration:'', la_volume:'', adrenalina:false },
};

// ─── main component ───────────────────────────────────────────────────────────

export default function AddInterventionScreen({ route, navigation }: any) {
  const { patientId, interventionId } = route.params;
  const { profile } = useAuth();
  const [loading, setLoading]       = useState(false);
  const [activeTab, setActiveTab]   = useState<'anestesia'|'dolore'>('anestesia');
  const isEdit                      = !!interventionId;

  // base form fields
  const [form, setForm] = useState({
    intervention_name: '', intervention_subtype: '', category: 'ortopedico',
    surgeon: '', anesthesiologist_name: '', nrs_alert_threshold: '6',
    intervention_end_time: getNow(), notes: '',
  });
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // anesthesia (single JSON blob matching web)
  const [anesDetails, setAnesDetails] = useState<any>(INIT_ANES);
  const setAnesField = (section: string, field: string, value: any) =>
    setAnesDetails((p: any) => ({ ...p, [section]: { ...p[section], [field]: value } }));
  const toggleAnesType = (type: string) =>
    setAnesDetails((p: any) => {
      const types = p.types.includes(type) ? p.types.filter((t: string) => t !== type) : [...p.types, type];
      return { ...p, types };
    });
  const toggleLocoBlock = (block: string) =>
    setAnesDetails((p: any) => {
      const blocks = p.locoregionale.blocks.includes(block)
        ? p.locoregionale.blocks.filter((b: string) => b !== block)
        : [...p.locoregionale.blocks, block];
      return { ...p, locoregionale: { ...p.locoregionale, blocks } };
    });
  const setBlockField = (block: string, field: string, value: any) =>
    setAnesDetails((p: any) => ({
      ...p,
      locoregionale: { ...p.locoregionale, [block]: { ...(p.locoregionale[block] || {}), [field]: value } },
    }));

  // pain therapy state (separate vars matching web)
  const [baseAnalgesics, setBaseAnalgesics]                   = useState<string[]>([]);
  const [baseAnalgesicsDetails, setBaseAnalgesicsDetails]     = useState<Record<string,{dose:string;route:string;freq:string}>>({});
  const [gabapentinoid, setGabapentinoid]                     = useState('Nessuno');
  const [gabapentinoidDose, setGabapentinoidDose]             = useState('');
  const [gabapentinoidFreq, setGabapentinoidFreq]             = useState('');
  const [ketaminePostop, setKetaminePostop]                   = useState(false);
  const [ketaminePostopDose, setKetaminePostopDose]           = useState('');
  const [ketaminePostopCustom, setKetaminePostopCustom]       = useState('');
  const [ketaminePostopHours, setKetaminePostopHours]         = useState('');
  const [lidocaineIvPostop, setLidocaineIvPostop]             = useState(false);
  const [lidocainePostopDoseMgkgh, setLidocainePostopDoseMgkgh] = useState('');
  const [lidocainePostopHours, setLidocainePostopHours]       = useState('');
  const [pcaUsed, setPcaUsed]                                 = useState(false);
  const [pcaType, setPcaType]                                 = useState('');
  const [duloxetinePeriop, setDuloxetinePeriop]               = useState(false);
  const [clonidineUsed, setClonidineUsed]                     = useState(false);
  const [clonidineDoseMg, setClonidineDoseMg]                 = useState('');
  const [nrsTarget, setNrsTarget]                             = useState('');
  const [opioidTherapyDuration, setOpioidTherapyDuration]     = useState('');
  const [patientCsiScore, setPatientCsiScore]                 = useState<number|null>(null);

  // opioid prescription builder (iOS, with PRN)
  const [opioidPrescriptions, setOpioidPrescriptions] = useState<Array<{drug:string;dose:number;frequency:string;route:string;prn:boolean}>>([]);
  const [newOpioid, setNewOpioid]   = useState({ drug:OPIOID_NAMES[0], dose:'', frequency:'2x/die', route:OPIOIDS[OPIOID_NAMES[0]].routes[0], prn:false });
  const [otherDrugs, setOtherDrugs] = useState('');
  const [newDoseText, setNewDoseText] = useState('');

  useEffect(() => {
    if (isEdit) loadIntervention();
    if (patientId) loadCsi();
  }, []);

  const loadCsi = async () => {
    const { data } = await supabase.from('cpsp_assessments').select('csi_total')
      .eq('patient_id', patientId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.csi_total != null) setPatientCsiScore(data.csi_total);
  };

  const loadIntervention = async () => {
    const { data: d } = await supabase.from('interventions').select('*').eq('id', interventionId).single();
    if (!d) return;
    setForm({
      intervention_name:     d.intervention_name ?? '',
      intervention_subtype:  d.intervention_subtype ?? '',
      category:              d.category ?? 'ortopedico',
      surgeon:               d.surgeon ?? '',
      anesthesiologist_name: d.anesthesiologist_name ?? '',
      nrs_alert_threshold:   d.nrs_alert_threshold?.toString() ?? '6',
      intervention_end_time: d.intervention_end_time ? d.intervention_end_time.slice(0,16).replace('T',' ') : getNow(),
      notes:                 d.notes ?? '',
    });
    // structured anesthesia
    if ((d as any).anesthesia_details) {
      try {
        const ad = JSON.parse((d as any).anesthesia_details);
        setAnesDetails((p: any) => ({ ...p, ...ad, locoregionale: { blocks: [], ...(ad.locoregionale || {}) } }));
      } catch {}
    } else if (d.anesthesia_type) {
      setAnesDetails((p: any) => ({ ...p, types: d.anesthesia_type!.split(',') }));
    }
    // pain
    const gabRaw = (d as any).gabapentinoid || '';
    setBaseAnalgesics((d as any).base_analgesics ? (d as any).base_analgesics.split(',') : []);
    setGabapentinoid(gabRaw.toLowerCase().includes('pregabalin') ? 'Pregabalin' : gabRaw.toLowerCase().includes('gabapentin') ? 'Gabapentin' : (gabRaw || 'Nessuno'));
    setKetaminePostop(!!(d as any).ketamine_postop);
    setKetaminePostopDose((d as any).ketamine_postop_dose ?? '');
    setKetaminePostopHours((d as any).ketamine_postop_hours?.toString() ?? '');
    setLidocaineIvPostop(!!(d as any).lidocaine_iv_postop);
    setLidocainePostopHours((d as any).lidocaine_postop_hours?.toString() ?? '');
    setPcaUsed(!!(d as any).pca_used);
    setPcaType((d as any).pca_type ?? '');
    setDuloxetinePeriop(!!(d as any).duloxetine_periop);
    setClonidineUsed(!!(d as any).clonidine_used);
    setClonidineDoseMg((d as any).clonidine_dose_mg?.toString() ?? '');
    setNrsTarget((d as any).nrs_target ?? '');
    if ((d as any).pain_therapy_details) {
      try {
        const ptd = JSON.parse((d as any).pain_therapy_details);
        if (ptd.base_analgesics_details) setBaseAnalgesicsDetails(ptd.base_analgesics_details);
        if (ptd.gabapentinoid_dose)      setGabapentinoidDose(ptd.gabapentinoid_dose);
        if (ptd.gabapentinoid_freq)      setGabapentinoidFreq(ptd.gabapentinoid_freq);
        if (ptd.lidocaine_postop_dose_mgkgh) setLidocainePostopDoseMgkgh(ptd.lidocaine_postop_dose_mgkgh);
        if (ptd.opioid_therapy_duration) setOpioidTherapyDuration(ptd.opioid_therapy_duration);
      } catch {}
    }
    const raw = (d as any).postop_drugs || '';
    if (raw.startsWith('{')) {
      try {
        const p2 = JSON.parse(raw);
        setOpioidPrescriptions((p2.opioids || []).map((op: any) => ({ ...op, prn: !!op.prn })));
        setOtherDrugs(p2.other || '');
      } catch { setOtherDrugs(raw); }
    } else { setOtherDrugs(raw); }
  };

  const handleSave = async () => {
    if (!form.intervention_name.trim()) {
      Alert.alert('Errore', "Inserisci il nome dell'intervento");
      return;
    }
    setLoading(true);
    const payload: any = {
      intervention_name:     form.intervention_name,
      intervention_subtype:  form.intervention_subtype || null,
      category:              form.category,
      surgeon:               form.surgeon || null,
      anesthesiologist_name: form.anesthesiologist_name || null,
      nrs_alert_threshold:   parseInt(form.nrs_alert_threshold) || 6,
      intervention_end_time: form.intervention_end_time ? new Date(form.intervention_end_time).toISOString() : null,
      notes:                 form.notes || null,
      // anesthesia
      anesthesia_type:      anesDetails.types.length > 0 ? anesDetails.types.join(',') : null,
      anesthesia_drugs:     anesDetails.generale.ipnotico || null,
      pain_protocol:        null,
      regional_blocks:      anesDetails.locoregionale.blocks.join(',') || null,
      regional_drugs:       null,
      anesthesia_details:   JSON.stringify(anesDetails),
      // backward compat flat anesthesia fields
      ketamine_intraop:         anesDetails.generale.ketamina_ev || null,
      ketamine_bolus_mgkg:      anesDetails.generale.ketamina_bolus_mgkg ? parseFloat(anesDetails.generale.ketamina_bolus_mgkg) : null,
      ketamine_infusion_mgkgh:  anesDetails.generale.ketamina_infusion_mgkgh ? parseFloat(anesDetails.generale.ketamina_infusion_mgkgh) : null,
      lidocaine_iv_intraop:     anesDetails.generale.lidocaina_ev || null,
      lidocaine_bolus_mgkg:     anesDetails.generale.lidocaina_bolus_mgkg ? parseFloat(anesDetails.generale.lidocaina_bolus_mgkg) : null,
      lidocaine_infusion_mgkgh: anesDetails.generale.lidocaina_infusion_mgkgh ? parseFloat(anesDetails.generale.lidocaina_infusion_mgkgh) : null,
      dexamethasone_iv:         anesDetails.generale.desametasone || null,
      dexamethasone_dose_mg:    anesDetails.generale.desametasone_dose_mg ? parseFloat(anesDetails.generale.desametasone_dose_mg) : null,
      // pain therapy
      postop_drugs:      (opioidPrescriptions.length > 0 || otherDrugs.trim()) ? JSON.stringify({ opioids: opioidPrescriptions, other: otherDrugs }) : null,
      base_analgesics:   baseAnalgesics.length > 0 ? baseAnalgesics.join(',') : null,
      gabapentinoid:     gabapentinoid && gabapentinoid !== 'Nessuno' ? gabapentinoid : null,
      ketamine_postop:   ketaminePostop || null,
      ketamine_postop_dose: ketaminePostop ? (ketaminePostopDose === 'Personalizzata' ? ketaminePostopCustom || null : ketaminePostopDose || null) : null,
      ketamine_postop_hours: ketaminePostop && ketaminePostopHours ? parseInt(ketaminePostopHours) : null,
      lidocaine_iv_postop:   lidocaineIvPostop || null,
      lidocaine_postop_hours: lidocaineIvPostop && lidocainePostopHours ? parseInt(lidocainePostopHours) : null,
      pca_used:          pcaUsed || null,
      pca_type:          pcaUsed ? pcaType || null : null,
      duloxetine_periop: duloxetinePeriop || null,
      clonidine_used:    clonidineUsed || null,
      clonidine_dose_mg: clonidineUsed && clonidineDoseMg ? parseFloat(clonidineDoseMg) : null,
      nrs_target:        nrsTarget || null,
      pain_therapy_details: JSON.stringify({
        base_analgesics_details:      Object.keys(baseAnalgesicsDetails).length > 0 ? baseAnalgesicsDetails : null,
        gabapentinoid_dose:           gabapentinoidDose || null,
        gabapentinoid_freq:           gabapentinoidFreq || null,
        lidocaine_postop_dose_mgkgh:  lidocaineIvPostop && lidocainePostopDoseMgkgh ? lidocainePostopDoseMgkgh : null,
        opioid_therapy_duration:      opioidTherapyDuration || null,
      }),
    };
    let error;
    if (isEdit) {
      ({ error } = await supabase.from('interventions').update(payload).eq('id', interventionId));
    } else {
      ({ error } = await supabase.from('interventions').insert({ ...payload, patient_id: patientId, intervention_date: new Date().toISOString(), created_by: profile?.id }));
    }
    setLoading(false);
    if (error) { Alert.alert('Errore', error.message); }
    else { Alert.alert('Successo', isEdit ? 'Intervento aggiornato!' : 'Intervento aggiunto!', [{ text: 'OK', onPress: () => navigation.goBack() }]); }
  };

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={s.title}>{isEdit ? 'Modifica Intervento' : 'Nuovo Intervento'}</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── campi base ── */}
        <Field label="Categoria">
          <View style={s.chipsWrap}>
            {CATEGORIES.map(c => (
              <Chip key={c} label={c} active={form.category === c} onPress={() => setF('category', c)} />
            ))}
          </View>
        </Field>

        <Field label="Tipo specifico">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.chipsRow}>
              {(SUBTYPES[form.category] || []).map(sub => (
                <Chip key={sub} label={sub} active={form.intervention_subtype === sub} onPress={() => {
                  const v = form.intervention_subtype === sub ? '' : sub;
                  setF('intervention_subtype', v);
                  if (v) setF('intervention_name', v);
                }} />
              ))}
            </View>
          </ScrollView>
        </Field>

        <Field label="Nome Intervento *">
          <TextInput style={s.input} value={form.intervention_name} onChangeText={v => setF('intervention_name', v)}
            placeholder="Es. Protesi totale anca destra" placeholderTextColor={Colors.textLight} />
        </Field>
        <Field label="Chirurgo">
          <TextInput style={s.input} value={form.surgeon} onChangeText={v => setF('surgeon', v)}
            placeholder="Nome del chirurgo" placeholderTextColor={Colors.textLight} />
        </Field>
        <Field label="Anestesista">
          <TextInput style={s.input} value={form.anesthesiologist_name} onChangeText={v => setF('anesthesiologist_name', v)}
            placeholder="Nome anestesista" placeholderTextColor={Colors.textLight} />
        </Field>

        {/* ── tab bar ── */}
        <View style={s.tabBar}>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'anestesia' && s.tabBtnActive]} onPress={() => setActiveTab('anestesia')}>
            <Text style={[s.tabBtnText, activeTab === 'anestesia' && s.tabBtnTextActive]}>💉 Anestesia</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.tabBtn, activeTab === 'dolore' && { ...s.tabBtnActive, backgroundColor: AC }]} onPress={() => setActiveTab('dolore')}>
            <Text style={[s.tabBtnText, activeTab === 'dolore' && s.tabBtnTextActive]}>💊 Terapia Dolore</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════ TAB ANESTESIA ══════════════════ */}
        {activeTab === 'anestesia' && (
          <View>
            <Field label="Tipo anestesia (multiplo)">
              <View style={s.chipsWrap}>
                {ANESTHESIA_TYPES.map(a => (
                  <Chip key={a} label={a} active={anesDetails.types.includes(a)} onPress={() => toggleAnesType(a)} />
                ))}
              </View>
              {anesDetails.types.length === 0 && (
                <Text style={s.hint}>Seleziona uno o più tipi per visualizzare i campi specifici</Text>
              )}
            </Field>

            {/* GENERALE */}
            {anesDetails.types.includes('Generale') && (
              <AnesBox title="Generale">
                <Field label="Ipnotico">
                  <View style={s.chipsWrap}>
                    {GENERALE_HYPNOTICS.map(h => (
                      <Chip key={h} label={h} active={anesDetails.generale.ipnotico === h} onPress={() => setAnesField('generale','ipnotico', anesDetails.generale.ipnotico === h ? '' : h)} />
                    ))}
                  </View>
                </Field>
                {!!anesDetails.generale.ipnotico && (
                  <Field label="Dose / concentrazione">
                    <TextInput style={s.input} value={anesDetails.generale.ipnotico_dose}
                      onChangeText={v => setAnesField('generale','ipnotico_dose',v)}
                      placeholder="Es. 2 mg/kg o 2%" placeholderTextColor={Colors.textLight} />
                  </Field>
                )}
                <Field label="Oppioide induzione">
                  <View style={s.chipsWrap}>
                    {GENERALE_IND_OPIOIDS.map(o => (
                      <Chip key={o} label={o} active={anesDetails.generale.opioide_induzione === o} onPress={() => setAnesField('generale','opioide_induzione',o)} />
                    ))}
                  </View>
                </Field>
                {anesDetails.generale.opioide_induzione !== 'Nessuno' && !!anesDetails.generale.opioide_induzione && (
                  <Field label="Dose (µg o mg)">
                    <TextInput style={s.input} value={anesDetails.generale.opioide_dose}
                      onChangeText={v => setAnesField('generale','opioide_dose',v)}
                      placeholder="Es. 100 µg" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
                  </Field>
                )}
                <SwitchAndTwo
                  label="Ketamina EV"
                  value={anesDetails.generale.ketamina_ev}
                  onToggle={() => setAnesField('generale','ketamina_ev',!anesDetails.generale.ketamina_ev)}
                  v1={anesDetails.generale.ketamina_bolus_mgkg} ph1="Bolo (mg/kg)"
                  onV1={v => setAnesField('generale','ketamina_bolus_mgkg',v)}
                  v2={anesDetails.generale.ketamina_infusion_mgkgh} ph2="Inf. (mg/kg/h)"
                  onV2={v => setAnesField('generale','ketamina_infusion_mgkgh',v)}
                />
                <SwitchAndTwo
                  label="Lidocaina EV"
                  value={anesDetails.generale.lidocaina_ev}
                  onToggle={() => setAnesField('generale','lidocaina_ev',!anesDetails.generale.lidocaina_ev)}
                  v1={anesDetails.generale.lidocaina_bolus_mgkg} ph1="Bolo (mg/kg)"
                  onV1={v => setAnesField('generale','lidocaina_bolus_mgkg',v)}
                  v2={anesDetails.generale.lidocaina_infusion_mgkgh} ph2="Inf. (mg/kg/h)"
                  onV2={v => setAnesField('generale','lidocaina_infusion_mgkgh',v)}
                />
                <SwitchAndDose
                  label="Desametasone"
                  value={anesDetails.generale.desametasone}
                  onToggle={() => setAnesField('generale','desametasone',!anesDetails.generale.desametasone)}
                  dose={anesDetails.generale.desametasone_dose_mg}
                  onDose={v => setAnesField('generale','desametasone_dose_mg',v)}
                  placeholder="Dose (mg)"
                />
                <Field label="Curarizzazione">
                  <View style={s.chipsWrap}>
                    {NEUROMUSCULAR.map(n => (
                      <Chip key={n} label={n} active={anesDetails.generale.curarizzazione === n} onPress={() => setAnesField('generale','curarizzazione',n)} />
                    ))}
                  </View>
                </Field>
                {anesDetails.generale.curarizzazione !== 'Nessuno' && !!anesDetails.generale.curarizzazione && (
                  <Field label="Dose curarizzante (mg/kg)">
                    <TextInput style={s.input} value={anesDetails.generale.curarizzazione_dose}
                      onChangeText={v => setAnesField('generale','curarizzazione_dose',v)}
                      placeholder="Es. 0.6" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
                  </Field>
                )}
              </AnesBox>
            )}

            {/* SPINALE (standalone o CSE) */}
            {(anesDetails.types.includes('Spinale') || anesDetails.types.includes('Combinata spinale-epidurale')) && (
              <AnesBox title={anesDetails.types.includes('Combinata spinale-epidurale') ? 'Spinale (CSE)' : 'Spinale'}>
                <LAPicker data={anesDetails.spinale} onSet={(f,v) => setAnesField('spinale',f,v)} />
                {([
                  { key:'morfina_it',  dKey:'morfina_dose_ug',   label:'Morfina intratecale',   ph:'100–300 µg' },
                  { key:'fentanil_it', dKey:'fentanil_dose_ug',  label:'Fentanil intratecale',  ph:'10–25 µg'   },
                  { key:'clonidina_it',dKey:'clonidina_dose_ug', label:'Clonidina intratecale', ph:'µg'         },
                  { key:'ketamina_it', dKey:'ketamina_dose_mg',  label:'Ketamina intratecale',  ph:'mg'         },
                  { key:'desametasone',dKey:'desametasone_dose_mg',label:'Desametasone',         ph:'mg'         },
                ] as const).map(({ key, dKey, label, ph }) => (
                  <SwitchAndDose key={key}
                    label={label}
                    value={anesDetails.spinale[key]}
                    onToggle={() => setAnesField('spinale', key, !anesDetails.spinale[key])}
                    dose={anesDetails.spinale[dKey]}
                    onDose={v => setAnesField('spinale', dKey, v)}
                    placeholder={ph}
                  />
                ))}
              </AnesBox>
            )}

            {/* EPIDURALE (standalone o CSE) */}
            {(anesDetails.types.includes('Epidurale') || anesDetails.types.includes('Combinata spinale-epidurale')) && (
              <AnesBox title={anesDetails.types.includes('Combinata spinale-epidurale') ? 'Epidurale (CSE)' : 'Epidurale'}>
                <LAPicker data={anesDetails.epidurale} onSet={(f,v) => setAnesField('epidurale',f,v)} />
                <Field label="Oppioide epidurale">
                  <View style={s.chipsWrap}>
                    {EPIDURALE_OPIOIDS.map(o => (
                      <Chip key={o} label={o} active={anesDetails.epidurale.opioide === o} onPress={() => setAnesField('epidurale','opioide',o)} />
                    ))}
                  </View>
                </Field>
                {anesDetails.epidurale.opioide !== 'Nessuno' && (
                  <Field label="Dose oppioide">
                    <TextInput style={s.input} value={anesDetails.epidurale.opioide_dose}
                      onChangeText={v => setAnesField('epidurale','opioide_dose',v)}
                      placeholder="Es. 50 µg" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
                  </Field>
                )}
                <SwitchAndDose
                  label="Clonidina"
                  value={anesDetails.epidurale.clonidina}
                  onToggle={() => setAnesField('epidurale','clonidina',!anesDetails.epidurale.clonidina)}
                  dose={anesDetails.epidurale.clonidina_dose_ug}
                  onDose={v => setAnesField('epidurale','clonidina_dose_ug',v)}
                  placeholder="µg"
                />
                <SwitchAndDose
                  label="Desametasone"
                  value={anesDetails.epidurale.desametasone}
                  onToggle={() => setAnesField('epidurale','desametasone',!anesDetails.epidurale.desametasone)}
                  dose={anesDetails.epidurale.desametasone_dose_mg}
                  onDose={v => setAnesField('epidurale','desametasone_dose_mg',v)}
                  placeholder="mg"
                />
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>PCA epidurale</Text>
                  <Switch value={anesDetails.epidurale.pca} onValueChange={v => setAnesField('epidurale','pca',v)}
                    trackColor={{ false: Colors.border, true: P }} thumbColor={anesDetails.epidurale.pca ? AC : '#f4f3f4'} />
                </View>
                {anesDetails.epidurale.pca && (
                  <View style={s.twoRow}>
                    <TextInput style={[s.input, s.halfIn]} value={anesDetails.epidurale.pca_bolo_ml}
                      onChangeText={v => setAnesField('epidurale','pca_bolo_ml',v)}
                      placeholder="Bolo (ml)" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
                    <TextInput style={[s.input, s.halfIn]} value={anesDetails.epidurale.pca_lockout_min}
                      onChangeText={v => setAnesField('epidurale','pca_lockout_min',v)}
                      placeholder="Lockout (min)" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
                  </View>
                )}
              </AnesBox>
            )}

            {/* LOCOREGIONALE */}
            {anesDetails.types.includes('Locoregionale') && (
              <AnesBox title="Locoregionale">
                <Field label="Blocchi (multiplo)">
                  <View style={s.chipsWrap}>
                    {LOCO_BLOCKS.map(b => (
                      <Chip key={b} label={b} active={anesDetails.locoregionale.blocks.includes(b)} onPress={() => toggleLocoBlock(b)} />
                    ))}
                  </View>
                </Field>
                {anesDetails.locoregionale.blocks.map((block: string) => {
                  const bd = anesDetails.locoregionale[block] || {};
                  return (
                    <View key={block} style={s.blockBox}>
                      <Text style={s.blockTitle}>{block}</Text>
                      <LAPicker
                        data={{ la_drug: bd.drug || '', la_drug_custom: bd.drug_custom || '', la_concentration: bd.drug_concentration || '', la_volume: bd.volume_ml || '' }}
                        onSet={(field, val) => {
                          const fMap: Record<string,string> = { la_drug:'drug', la_drug_custom:'drug_custom', la_concentration:'drug_concentration', la_volume:'volume_ml' };
                          setBlockField(block, fMap[field] || field, val);
                        }}
                      />
                      <Text style={s.subLabel}>Adiuvanti</Text>
                      <View style={s.chipsWrap}>
                        {LOCO_ADJUVANTS.map(adj => {
                          const sel = (bd.adjuvants || []).some((x: any) => x.adjuvant === adj);
                          return (
                            <Chip key={adj} label={adj} active={sel} onPress={() => {
                              const cur = bd.adjuvants || [];
                              setBlockField(block, 'adjuvants', sel
                                ? cur.filter((x: any) => x.adjuvant !== adj)
                                : [...cur, { adjuvant: adj, dose: '' }]);
                            }} />
                          );
                        })}
                      </View>
                      {(bd.adjuvants || []).map((adj: any) => (
                        <View key={adj.adjuvant} style={s.adjRow}>
                          <Text style={s.adjLabel}>{adj.adjuvant}</Text>
                          <TextInput style={[s.input, { flex: 1 }]}
                            value={adj.dose}
                            onChangeText={v => setBlockField(block, 'adjuvants', (bd.adjuvants || []).map((x: any) => x.adjuvant === adj.adjuvant ? { ...x, dose: v } : x))}
                            placeholder="Es. 4 mg" placeholderTextColor={Colors.textLight} />
                        </View>
                      ))}
                    </View>
                  );
                })}
              </AnesBox>
            )}

            {/* SEDAZIONE */}
            {anesDetails.types.includes('Sedazione') && (
              <AnesBox title="Sedazione">
                <Field label="Farmaci (multiplo)">
                  <View style={s.chipsWrap}>
                    {SEDAZIONE_DRUGS.map(d => {
                      const sel = (anesDetails.sedazione.farmaci || []).includes(d);
                      return (
                        <Chip key={d} label={d} active={sel} onPress={() =>
                          setAnesField('sedazione','farmaci', sel
                            ? (anesDetails.sedazione.farmaci || []).filter((f: string) => f !== d)
                            : [...(anesDetails.sedazione.farmaci || []), d])
                        } />
                      );
                    })}
                  </View>
                </Field>
                {(anesDetails.sedazione.farmaci || []).map((drug: string) => (
                  <View key={drug} style={s.sedRow}>
                    <Text style={s.sedLabel}>{drug}</Text>
                    <TextInput style={[s.input, { flex: 1 }]}
                      value={(anesDetails.sedazione.dosi || {})[drug] || ''}
                      onChangeText={v => setAnesField('sedazione','dosi', { ...(anesDetails.sedazione.dosi || {}), [drug]: v })}
                      placeholder={SEDAZIONE_PH[drug] || ''}
                      placeholderTextColor={Colors.textLight} />
                  </View>
                ))}
              </AnesBox>
            )}

            {/* LOCALE */}
            {anesDetails.types.includes('Locale') && (
              <AnesBox title="Locale">
                <LAPicker data={anesDetails.locale} onSet={(f,v) => setAnesField('locale',f,v)} />
                <View style={s.switchRow}>
                  <Text style={s.switchLabel}>Adrenalina aggiunta</Text>
                  <Switch value={anesDetails.locale.adrenalina} onValueChange={v => setAnesField('locale','adrenalina',v)}
                    trackColor={{ false: Colors.border, true: P }} thumbColor={anesDetails.locale.adrenalina ? AC : '#f4f3f4'} />
                </View>
              </AnesBox>
            )}
          </View>
        )}

        {/* ══════════════════ TAB TERAPIA DEL DOLORE ══════════════════ */}
        {activeTab === 'dolore' && (
          <View>

            {/* 1. Analgesici di base */}
            <SectionHeader title="Analgesici di base" />
            <Field label="Seleziona (multiplo)">
              <View style={s.chipsWrap}>
                {BASE_ANALGESICS_LIST.map(a => {
                  const sel = baseAnalgesics.includes(a);
                  return (
                    <Chip key={a} label={a} active={sel} onPress={() => {
                      setBaseAnalgesics(p => sel ? p.filter(x => x !== a) : [...p, a]);
                      if (sel) setBaseAnalgesicsDetails(p => { const n = { ...p }; delete n[a]; return n; });
                    }} />
                  );
                })}
              </View>
            </Field>
            {baseAnalgesics.map(drug => {
              const d = baseAnalgesicsDetails[drug] || { dose: '', route: '', freq: '' };
              const upd = (field: string, val: string) => setBaseAnalgesicsDetails(p => ({ ...p, [drug]: { ...(p[drug] || { dose:'',route:'',freq:'' }), [field]: val } }));
              return (
                <View key={drug} style={s.drugBox}>
                  <Text style={s.drugBoxTitle}>{drug}</Text>
                  <View style={s.twoRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.subLabel}>Dosaggio</Text>
                      <TextInput style={s.input} value={d.dose} onChangeText={v => upd('dose',v)} placeholder="es. 1 g" placeholderTextColor={Colors.textLight} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.subLabel}>Frequenza</Text>
                      <TextInput style={s.input} value={d.freq} onChangeText={v => upd('freq',v)} placeholder="es. x3/die" placeholderTextColor={Colors.textLight} />
                    </View>
                  </View>
                  <Text style={[s.subLabel, { marginTop: 6 }]}>Via</Text>
                  <View style={s.chipsWrap}>
                    {ANALGESIC_ROUTES.map(r => (
                      <Chip key={r} label={r} active={d.route === r} onPress={() => upd('route',r)} />
                    ))}
                  </View>
                </View>
              );
            })}

            {/* 2. Gabapentinoidi */}
            <SectionHeader title="Gabapentinoidi" />
            <Field label="Seleziona">
              <View style={s.chipsWrap}>
                {GAB_OPTIONS.map(g => (
                  <Chip key={g} label={g} active={gabapentinoid === g}
                    onPress={() => { setGabapentinoid(gabapentinoid === g ? 'Nessuno' : g); setGabapentinoidDose(''); setGabapentinoidFreq(''); }} />
                ))}
              </View>
            </Field>
            {gabapentinoid && gabapentinoid !== 'Nessuno' && (
              <View style={s.twoRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>Dosaggio</Text>
                  <TextInput style={s.input} value={gabapentinoidDose} onChangeText={setGabapentinoidDose}
                    placeholder="es. 75 mg" placeholderTextColor={Colors.textLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.subLabel}>Quantità giornaliera</Text>
                  <TextInput style={s.input} value={gabapentinoidFreq} onChangeText={setGabapentinoidFreq}
                    placeholder="es. x2/die" placeholderTextColor={Colors.textLight} />
                </View>
              </View>
            )}

            {/* 3. Ketamina postop */}
            <SectionHeader title="Ketamina postoperatoria" />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Ketamina postoperatoria</Text>
              <Switch value={ketaminePostop} onValueChange={setKetaminePostop}
                trackColor={{ false: Colors.border, true: P }} thumbColor={ketaminePostop ? AC : '#f4f3f4'} />
            </View>
            {ketaminePostop && (
              <View style={s.expanded}>
                <Text style={s.subLabel}>Dose</Text>
                <View style={s.chipsWrap}>
                  {KET_POST_DOSES.map(d => (
                    <Chip key={d} label={d} active={ketaminePostopDose === d} onPress={() => setKetaminePostopDose(ketaminePostopDose === d ? '' : d)} />
                  ))}
                </View>
                {ketaminePostopDose === 'Personalizzata' && (
                  <TextInput style={[s.input, { marginTop: 6 }]} value={ketaminePostopCustom} onChangeText={setKetaminePostopCustom}
                    placeholder="Dose personalizzata..." placeholderTextColor={Colors.textLight} />
                )}
                <Text style={[s.subLabel, { marginTop: 8 }]}>Durata (ore)</Text>
                <TextInput style={s.input} value={ketaminePostopHours} onChangeText={setKetaminePostopHours}
                  placeholder="Es. 24" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
              </View>
            )}

            {/* 4. Lidocaina EV postop */}
            <SectionHeader title="Lidocaina EV postoperatoria" />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Lidocaina EV postoperatoria</Text>
              <Switch value={lidocaineIvPostop} onValueChange={setLidocaineIvPostop}
                trackColor={{ false: Colors.border, true: P }} thumbColor={lidocaineIvPostop ? AC : '#f4f3f4'} />
            </View>
            {lidocaineIvPostop && (
              <View style={s.expanded}>
                <View style={s.twoRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subLabel}>Dosaggio</Text>
                    <TextInput style={s.input} value={lidocainePostopDoseMgkgh} onChangeText={setLidocainePostopDoseMgkgh}
                      placeholder="es. 1.5 mg/kg/h" placeholderTextColor={Colors.textLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subLabel}>Durata (ore)</Text>
                    <TextInput style={s.input} value={lidocainePostopHours} onChangeText={setLidocainePostopHours}
                      placeholder="Es. 24" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
                  </View>
                </View>
              </View>
            )}

            {/* 5. PCA */}
            <SectionHeader title="PCA / infusione continua" />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>PCA / infusione continua</Text>
              <Switch value={pcaUsed} onValueChange={setPcaUsed}
                trackColor={{ false: Colors.border, true: P }} thumbColor={pcaUsed ? AC : '#f4f3f4'} />
            </View>
            {pcaUsed && (
              <View style={[s.expanded, { paddingTop: 8 }]}>
                <View style={s.chipsWrap}>
                  {['Epidurale','EV','Subcutanea'].map(t => (
                    <Chip key={t} label={t} active={pcaType === t} onPress={() => setPcaType(pcaType === t ? '' : t)} />
                  ))}
                </View>
              </View>
            )}

            {/* 6. Duloxetina */}
            <SectionHeader title="Duloxetina perioperatoria" />
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Duloxetina perioperatoria</Text>
              <Switch value={duloxetinePeriop} onValueChange={setDuloxetinePeriop}
                trackColor={{ false: Colors.border, true: P }} thumbColor={duloxetinePeriop ? AC : '#f4f3f4'} />
            </View>
            {duloxetinePeriop && (patientCsiScore === null || patientCsiScore < 40) && (
              <View style={s.warningBox}>
                <Text style={s.warningText}>⚠️ Duloxetina raccomandata solo se CSI≥40 (sensitizzazione centrale documentata)</Text>
              </View>
            )}

            {/* 7. Clonidina */}
            <SectionHeader title="Clonidina" />
            <Text style={s.fieldNote}>Indicata se PASS≥30</Text>
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Clonidina</Text>
              <Switch value={clonidineUsed} onValueChange={setClonidineUsed}
                trackColor={{ false: Colors.border, true: P }} thumbColor={clonidineUsed ? AC : '#f4f3f4'} />
            </View>
            {clonidineUsed && (
              <View style={s.expanded}>
                <TextInput style={s.input} value={clonidineDoseMg} onChangeText={setClonidineDoseMg}
                  placeholder="Dose (mg)" placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
              </View>
            )}

            {/* 8. Target NRS */}
            <SectionHeader title="Target NRS" />
            <Field label="Seleziona target">
              <View style={s.chipsWrap}>
                {NRS_TARGETS.map(n => (
                  <Chip key={n} label={n} active={nrsTarget === n} onPress={() => setNrsTarget(nrsTarget === n ? '' : n)} />
                ))}
              </View>
            </Field>

            {/* 9. Prescrizione Oppioidi (MEO) */}
            <SectionHeader title="Prescrizione Oppioidi (MEO)" />
            <Field label="Farmaco">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={s.chipsRow}>
                  {OPIOID_NAMES.map(d => (
                    <Chip key={d} label={d} active={newOpioid.drug === d} onPress={() => setNewOpioid(p => ({ ...p, drug: d, route: OPIOIDS[d].routes[0] }))} />
                  ))}
                </View>
              </ScrollView>
            </Field>
            <View style={s.twoRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.subLabel}>Dose (mg)</Text>
                <TextInput style={s.input} value={newDoseText}
                  onChangeText={v => { setNewDoseText(v); setNewOpioid(p => ({ ...p, dose: v })); }}
                  keyboardType="decimal-pad" placeholder="mg" placeholderTextColor={Colors.textLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.subLabel}>Via</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipsRow}>
                    {(OPIOIDS[newOpioid.drug]?.routes || ['orale']).map(r => (
                      <Chip key={r} label={r} active={newOpioid.route === r} onPress={() => setNewOpioid(p => ({ ...p, route: r }))} />
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
              <TouchableOpacity style={[s.prnToggle, newOpioid.prn && s.prnToggleActive]}
                onPress={() => setNewOpioid(p => ({ ...p, prn: !p.prn }))}>
                <View style={[s.prnCheckbox, newOpioid.prn && s.prnCheckboxActive]}>
                  {newOpioid.prn && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>✓</Text>}
                </View>
                <Text style={[s.prnToggleText, newOpioid.prn && s.prnToggleTextActive]}>Al bisogno (PRN)</Text>
              </TouchableOpacity>
            </View>
            {!newOpioid.prn && (
              <Field label="Frequenza">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipsRow}>
                    {FREQUENCIES.map(f => (
                      <Chip key={f} label={f} active={newOpioid.frequency === f} onPress={() => setNewOpioid(p => ({ ...p, frequency: f }))} />
                    ))}
                  </View>
                </ScrollView>
              </Field>
            )}
            <TouchableOpacity style={s.addOpioidBtn} onPress={() => {
              const dose = parseFloat(newOpioid.dose);
              if (!dose || dose <= 0) return;
              setOpioidPrescriptions(prev => [...prev, { drug: newOpioid.drug, dose, frequency: newOpioid.prn ? 'al bisogno' : newOpioid.frequency, route: newOpioid.route, prn: newOpioid.prn }]);
              setNewDoseText('');
              setNewOpioid(p => ({ ...p, dose: '', prn: false }));
            }}>
              <Text style={s.addOpioidBtnText}>+ Aggiungi oppioide</Text>
            </TouchableOpacity>
            {opioidPrescriptions.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                {opioidPrescriptions.map((op, i) => {
                  const meo = op.prn ? toMEO(op.drug, op.dose) : toMEO(op.drug, op.dose) * (FREQ_MAP[op.frequency] || 1);
                  return (
                    <View key={i} style={op.prn ? s.opioidItemPrn : s.opioidItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.opioidName}>{op.drug}{op.prn ? ' (PRN)' : ''}</Text>
                        <Text style={s.opioidDetail}>{op.dose}mg {op.frequency} {op.route} — <Text style={s.opioidMeo}>{meo.toFixed(1)} MEO/{op.prn ? 'dose' : 'die'}</Text></Text>
                      </View>
                      <TouchableOpacity onPress={() => setOpioidPrescriptions(p => p.filter((_, j) => j !== i))}>
                        <Text style={s.removeBtn}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <View style={s.meoTotal}>
                  <Text style={s.meoTotalText}>
                    Totale MEO/die: {opioidPrescriptions.filter(op => !op.prn).reduce((sum, op) => sum + toMEO(op.drug, op.dose) * (FREQ_MAP[op.frequency] || 1), 0).toFixed(1)} mg
                  </Text>
                </View>
              </View>
            )}
            <Field label="Durata terapia">
              <TextInput style={s.input} value={opioidTherapyDuration} onChangeText={setOpioidTherapyDuration}
                placeholder="es. 7 giorni" placeholderTextColor={Colors.textLight} />
            </Field>
            <Field label="Altri farmaci (paracetamolo, FANS, ecc.)">
              <TextInput style={[s.input, s.textarea]} value={otherDrugs} onChangeText={setOtherDrugs}
                placeholder="Es. Paracetamolo 1g x3, Ketorolac 30mg x2..." placeholderTextColor={Colors.textLight}
                multiline numberOfLines={3} />
            </Field>

          </View>
        )}

        {/* ── campi finali condivisi ── */}
        <Field label="Soglia Alert NRS (0-10)">
          <TextInput style={s.input} value={form.nrs_alert_threshold} onChangeText={v => setF('nrs_alert_threshold', v)}
            keyboardType="numeric" placeholder="6" placeholderTextColor={Colors.textLight} />
        </Field>
        <Field label="Fine Intervento (YYYY-MM-DD HH:MM)">
          <TextInput style={s.input} value={form.intervention_end_time} onChangeText={v => setF('intervention_end_time', v)}
            placeholder="2026-03-01 14:30" placeholderTextColor={Colors.textLight} keyboardType="numbers-and-punctuation" />
          <Text style={s.fieldNote}>Inserendo l'orario verranno programmate rilevazioni NRS a 6, 12, 24 e 48 ore</Text>
        </Field>
        <Field label="Note">
          <TextInput style={[s.input, s.textarea]} value={form.notes} onChangeText={v => setF('notes', v)}
            placeholder="Note aggiuntive..." placeholderTextColor={Colors.textLight} multiline numberOfLines={3} />
        </Field>

        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Salva Intervento</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── reusable sub-components ──────────────────────────────────────────────────

function LAPicker({ data, onSet }: { data: any; onSet: (field: string, value: any) => void }) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <Text style={s.subLabel}>Anestetico locale</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.chipsRow}>
          {LOCAL_ANESTHETICS.map(a => (
            <Chip key={a} label={a} active={data.la_drug === a} onPress={() => onSet('la_drug', data.la_drug === a ? '' : a)} />
          ))}
        </View>
      </ScrollView>
      {data.la_drug === 'Altro' && (
        <TextInput style={[s.input, { marginTop: 6 }]} value={data.la_drug_custom} onChangeText={v => onSet('la_drug_custom', v)}
          placeholder="Nome anestetico" placeholderTextColor={Colors.textLight} />
      )}
      {!!data.la_drug && (
        <View style={[s.twoRow, { marginTop: 6 }]}>
          <TextInput style={[s.input, s.halfIn]} value={data.la_concentration} onChangeText={v => onSet('la_concentration', v)}
            placeholder="es. 0.5%" placeholderTextColor={Colors.textLight} />
          <TextInput style={[s.input, s.halfIn]} value={data.la_volume} onChangeText={v => onSet('la_volume', v)}
            placeholder="es. 20 ml" placeholderTextColor={Colors.textLight} />
        </View>
      )}
    </View>
  );
}

function SwitchAndDose({ label, value, onToggle, dose, onDose, placeholder }: {
  label: string; value: boolean; onToggle: () => void;
  dose?: string; onDose?: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <View style={s.switchRow}>
        <Text style={s.switchLabel}>{label}</Text>
        <Switch value={value} onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: P }} thumbColor={value ? AC : '#f4f3f4'} />
      </View>
      {value && onDose && (
        <TextInput style={[s.input, { marginTop: 4 }]} value={dose} onChangeText={onDose}
          placeholder={placeholder} placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
      )}
    </View>
  );
}

function SwitchAndTwo({ label, value, onToggle, v1, ph1, onV1, v2, ph2, onV2 }: {
  label: string; value: boolean; onToggle: () => void;
  v1: string; ph1: string; onV1: (v: string) => void;
  v2: string; ph2: string; onV2: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <View style={s.switchRow}>
        <Text style={s.switchLabel}>{label}</Text>
        <Switch value={value} onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: P }} thumbColor={value ? AC : '#f4f3f4'} />
      </View>
      {value && (
        <View style={[s.twoRow, { marginTop: 4 }]}>
          <TextInput style={[s.input, s.halfIn]} value={v1} onChangeText={onV1}
            placeholder={ph1} placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
          <TextInput style={[s.input, s.halfIn]} value={v2} onChangeText={onV2}
            placeholder={ph2} placeholderTextColor={Colors.textLight} keyboardType="decimal-pad" />
        </View>
      )}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AnesBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.anesBox}>
      <Text style={s.anesBoxTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F0F4F4' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  back:         { color: P, fontWeight: '600', fontSize: 15 },
  title:        { fontSize: 17, fontWeight: '700', color: Colors.text },
  scroll:       { padding: Spacing.md, paddingBottom: 60 },
  field:        { marginBottom: Spacing.md },
  label:        { fontSize: 12, fontWeight: '700', color: Colors.textLight, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  subLabel:     { fontSize: 11, fontWeight: '700', color: Colors.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:        { backgroundColor: '#fff', borderRadius: Radius.md, padding: 12, fontSize: 14, color: Colors.text, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  textarea:     { height: 80, textAlignVertical: 'top' },
  // chips
  chipsRow:     { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chipsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 4 },
  chip:         { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border },
  chipActive:   { backgroundColor: P, borderColor: P },
  chipText:     { fontSize: 13, color: Colors.text, fontWeight: '500' },
  chipTextActive:{ color: '#fff', fontWeight: '700' },
  // tabs
  tabBar:           { flexDirection: 'row', backgroundColor: '#fff', borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.md, marginTop: Spacing.sm },
  tabBtn:           { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive:     { backgroundColor: P },
  tabBtnText:       { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabBtnTextActive: { color: '#fff', fontWeight: '700' },
  // section headers
  sectionHeader:  { backgroundColor: P + '18', borderRadius: Radius.md, padding: 8, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  sectionTitle:   { fontSize: 13, fontWeight: '700', color: P },
  // anesthesia box
  anesBox:        { borderWidth: 2, borderColor: P, borderRadius: Radius.md, padding: 12, backgroundColor: P + '08', marginBottom: Spacing.md },
  anesBoxTitle:   { fontSize: 12, fontWeight: '800', color: P, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  // switch
  switchRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadow.sm },
  switchLabel:    { fontSize: 14, color: Colors.text, fontWeight: '500', flex: 1, marginRight: 8 },
  // expanded (below switch)
  expanded:       { backgroundColor: '#fff', borderRadius: Radius.md, padding: 10, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  // two-column row
  twoRow:         { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  halfIn:         { flex: 1 },
  // locoregionale block
  blockBox:       { borderWidth: 1.5, borderColor: '#00897B', borderRadius: Radius.md, padding: 10, backgroundColor: '#E0F2F144', marginBottom: 8 },
  blockTitle:     { fontSize: 12, fontWeight: '800', color: '#00695C', marginBottom: 8, textTransform: 'uppercase' },
  adjRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  adjLabel:       { fontSize: 12, fontWeight: '600', color: Colors.text, minWidth: 90 },
  // sedazione
  sedRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sedLabel:       { fontSize: 13, fontWeight: '600', color: Colors.text, flex: 1 },
  // base analgesics drug box
  drugBox:        { backgroundColor: '#E8F5F3', borderRadius: Radius.md, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#A5D6A7' },
  drugBoxTitle:   { fontSize: 13, fontWeight: '700', color: '#2E7D32', marginBottom: 8 },
  // pain warnings / notes
  warningBox:     { backgroundColor: '#FFF7ED', borderRadius: Radius.md, padding: 10, marginBottom: Spacing.sm, borderWidth: 1, borderColor: '#FED7AA' },
  warningText:    { fontSize: 12, color: '#C2410C', fontWeight: '600' },
  fieldNote:      { fontSize: 11, color: Colors.textMuted, marginBottom: Spacing.sm, marginTop: -4 },
  hint:           { fontSize: 11, color: Colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  // opioid builder
  addOpioidBtn:   { backgroundColor: AC, borderRadius: Radius.md, padding: 12, alignItems: 'center', marginBottom: 10 },
  addOpioidBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  opioidItem:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5F3', borderRadius: 8, padding: 10, marginBottom: 6 },
  opioidItemPrn:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E8', borderRadius: 8, padding: 10, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  opioidName:     { fontWeight: '700', fontSize: 13, color: '#1a1a2e' },
  opioidDetail:   { fontSize: 12, color: '#6B7280', marginTop: 2 },
  opioidMeo:      { color: P, fontWeight: '600' },
  removeBtn:      { fontSize: 16, color: '#9CA3AF', padding: 4 },
  meoTotal:       { backgroundColor: AC + '22', borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 8 },
  meoTotalText:   { fontWeight: '800', fontSize: 14, color: '#007A6B' },
  prnToggle:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.border },
  prnToggleActive:{ backgroundColor: '#FFF3E8', borderColor: '#F59E0B' },
  prnCheckbox:    { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  prnCheckboxActive:{ backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  prnToggleText:  { fontSize: 14, fontWeight: '600', color: Colors.text },
  prnToggleTextActive:{ color: '#D97706' },
  // save
  saveBtn:        { backgroundColor: P, borderRadius: Radius.lg, padding: 16, alignItems: 'center', marginTop: Spacing.md, ...Shadow.md },
  saveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 16 },
});
