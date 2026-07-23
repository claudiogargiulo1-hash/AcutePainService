// src/screens/CPSPScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  SafeAreaView, Alert, ActivityIndicator, TextInput, Modal, Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius, Shadow } from '../utils/theme';
import { SURGERY_TYPES, calcDynamicRisk, type RiskLevel } from '../utils/cpspRisk';
import {
  loadAssessments as svcLoadAssessments,
  saveAssessment as svcSaveAssessment,
  deleteAssessment as svcDeleteAssessment,
  loadFollowups as svcLoadFollowups,
  saveFollowup as svcSaveFollowup,
  deleteFollowup as svcDeleteFollowup,
  syncNrsToCpspTrajectory,
} from '../services/cpspService';
import CollapsibleSection from '../components/cpsp/CollapsibleSection';

const QUESTIONNAIRE_BASE_URL = 'https://claudiogargiulo1-hash.github.io/aps-web/#/q/';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

// SURGERY_TYPES imported from ../utils/cpspRisk

// PCS – Pain Catastrophizing Scale (13 item, 0–4, max 52) – Sullivan 1995, versione italiana PCS-I, Monticone et al.
// Subscale: Helplessness=items 0,1,2,4,11 | Rumination=items 6,7,8,9,10 | Magnification=items 3,5,12
const PCS_ITEMS = [
  'Sono preoccupato/a che il dolore non finirà mai',          // 0  Helplessness
  'Sento di non farcela più',                                  // 1  Helplessness
  'È terribile e penso che non migliorerà mai',                // 2  Helplessness
  'È orribile e sento che mi sopraffà',                        // 3  Magnification
  'Sento di non poter sopportare oltre il dolore',             // 4  Helplessness
  'Ho paura che il dolore peggiori',                           // 5  Magnification
  'Continuo a pensare ad altri episodi dolorosi',              // 6  Rumination
  'Desidero disperatamente che il dolore scompaia',            // 7  Rumination
  'Non riesco a togliermi il dolore dalla mente',              // 8  Rumination
  'Continuo a pensare a quanto fa male',                       // 9  Rumination
  'Continuo a pensare a quanto voglio che il dolore finisca',  // 10 Rumination
  'Non c\'è nulla che io possa fare per ridurre il dolore',    // 11 Helplessness
  'Mi chiedo se non mi stia capitando qualcosa di grave',      // 12 Magnification
];

// PASS-20 – Pain Anxiety Symptoms Scale (20 item, 0–4, max normalizzato 100)
const PASS_ITEMS = [
  'Quando avverto dolore, ho paura che succeda qualcosa di brutto',
  'Il dolore mi spaventa molto',
  'Quando ho dolore, ho difficoltà a concentrarmi',
  'Non riesco a guardare quando mi viene fatto qualcosa di doloroso',
  'Quando ho dolore, divento molto nervoso/a',
  'Evito situazioni dolorose a tutti i costi',
  'Quando ho dolore, sento che qualcosa di terribile sta per accadere',
  'Il dolore mi rende ansioso/a',
  'Mi preoccupo che il dolore possa danneggiarmi',
  'Quando avverto dolore, cerco di alleviarlo immediatamente',
  'Le sensazioni dolorose mi spaventano',
  'Se sento dolore, penso che potrebbe essere molto grave',
  'Ho difficoltà a distogliere la mente dal dolore',
  'Il dolore mi fa venire voglia di fuggire',
  'Mi agito facilmente quando avverto dolore',
  'Il pensiero del dolore mi preoccupa costantemente',
  'Non posso ignorare il dolore',
  'Il dolore mi fa venire voglia di smettere tutto',
  'Le sensazioni fisiche legate al dolore mi spaventano',
  'Sono in ansia per le conseguenze del mio dolore',
];

// CSI – Central Sensitization Inventory (25 item, 0–4, max 100)
const CSI_ITEMS = [
  'Mi affatigo facilmente',
  'Mi sento stanco/a tutto il giorno',
  'Ho dolore in molte parti del corpo',
  'Ho dolori muscolari diffusi',
  'Ho problemi di memoria',
  'Ho difficoltà a concentrarmi',
  'Mi sento ansioso/a',
  'Mi sento depresso/a',
  'Ho difficoltà ad addormentarmi o mantenere il sonno',
  'Ho spesso mal di testa',
  'Mi sento spesso gonfio/a o sto male dopo aver mangiato',
  'Ho urgenza urinaria o vescica iperattiva',
  'Soffro di sindrome del colon irritabile',
  'Soffro di nausea',
  'Ho dolore alla mascella o al viso',
  'Ho difficoltà a deglutire',
  'Ho problemi di vista non correggibili con occhiali',
  'Ho vertigini o capogiri',
  'Ho formicolio o intorpidimento in alcune zone',
  'Sono sensibile alla luce intensa',
  'Sono sensibile ai rumori forti',
  'Sono sensibile a profumi o odori chimici',
  'Sono sensibile al freddo o al caldo',
  'Devo urinare frequentemente',
  'Sono sensibile al tocco o ai massaggi',
];

// BPI – Brief Pain Inventory (7 item, 0–10)
const BPI_ITEMS = [
  'Peggior dolore nelle ultime 24h',
  'Dolore più lieve nelle ultime 24h',
  'Dolore medio nelle ultime 24h',
  'Dolore attuale',
  'Interferenza con attività generali',
  'Interferenza con umore',
  'Interferenza con lavoro/attività quotidiane',
];

// DN4 (7 item sì/no, neuropatico se ≥4)
const DN4_ITEMS = [
  'Il dolore ha carattere di bruciore',
  'Sensazione di freddo doloroso',
  'Sensazione di scosse elettriche',
  'Prurito nella zona dolorosa',
  'Formicolio nella zona dolorosa',
  'Sensazione di punture di spillo',
  'Intorpidimento nella zona dolorosa',
];

// EQ-5D (5 dimensioni 1–5)
const EQ5D_ITEMS = [
  'Mobilità (1=nessun problema, 5=incapace)',
  'Cura di sé (1=nessun problema, 5=incapace)',
  'Attività abituali (1=nessun problema, 5=incapace)',
  'Dolore/fastidio (1=nessuno, 5=estremo)',
  'Ansia/depressione (1=nessuna, 5=estrema)',
];

// PHQ-9 – Patient Health Questionnaire (9 item, 0–3 ciascuno, max 27) – Kroenke 2001, versione italiana validata
const PHQ9_ITEMS = [
  'Poco interesse o piacere nel fare le cose',
  'Sentirsi giù, depresso/a o senza speranza',
  'Difficoltà ad addormentarsi, a restare addormentato/a o dormire troppo',
  'Sentirsi stanco/a o con poca energia',
  'Scarso appetito o eccesso nel mangiare',
  'Sentirsi un/una fallito/a, o pensare di aver deluso se stesso/a o la famiglia',
  'Difficoltà a concentrarsi, ad es. nel leggere il giornale o guardare la TV',
  'Muoversi o parlare così lentamente da essere notato/a, oppure al contrario essere così agitato/a da muoversi molto più del solito',
  'Avere pensieri di farsi del male o che sarebbe meglio essere morti',
];

// GAD-7 – Generalized Anxiety Disorder scale (7 item, 0–3 ciascuno, max 21) – Spitzer 2006, versione italiana validata
const GAD7_ITEMS = [
  'Sentirsi nervoso/a, ansioso/a o molto teso/a',
  'Non riuscire a smettere di preoccuparsi o a controllare le preoccupazioni',
  'Preoccuparsi eccessivamente per cose diverse',
  'Difficoltà a rilassarsi',
  'Essere così irrequieto/a da non riuscire a stare fermo/a',
  'Irritarsi o innervosirsi facilmente',
  'Avere paura che stia per succedere qualcosa di terribile',
];

const PHQ9_LABELS = ['Mai', 'Alcuni giorni', 'Più della metà', 'Quasi ogni giorno'];
const GAD7_LABELS = ['Mai', 'Alcuni giorni', 'Più della metà', 'Quasi ogni giorno'];

function getPhq9Severity(score: number): { label: string; color: string; bg: string } {
  if (score < 5)  return { label: 'Minima',   color: Colors.green,  bg: Colors.greenLight };
  if (score < 10) return { label: 'Lieve',     color: '#F59E0B',     bg: '#FFFBEB' };
  if (score < 15) return { label: 'Moderata',  color: '#F97316',     bg: '#FFF3E0' };
  if (score < 20) return { label: 'Moderata-grave', color: Colors.red, bg: Colors.redLight };
  return           { label: 'Grave',           color: '#7F1D1D',     bg: '#FEE2E2' };
}

function getGad7Severity(score: number): { label: string; color: string; bg: string } {
  if (score < 5)  return { label: 'Minima',  color: Colors.green,  bg: Colors.greenLight };
  if (score < 10) return { label: 'Lieve',   color: '#F59E0B',     bg: '#FFFBEB' };
  if (score < 15) return { label: 'Moderata',color: '#F97316',     bg: '#FFF3E0' };
  return           { label: 'Grave',         color: Colors.red,    bg: Colors.redLight };
}

// ─── SCORE CALCULATION ───────────────────────────────────────────────────────
// calcScore, calcDynamicRisk imported from ../utils/cpspRisk

// PCS subscales (0-based indices)
function calcPcsSubscales(scores: (number | null)[]) {
  const s = scores.map(v => v ?? 0);
  return {
    helplessness: s[0] + s[1] + s[2] + s[4] + s[11],  // max 20
    rumination:   s[6] + s[7] + s[8] + s[9] + s[10],   // max 20
    magnification: s[3] + s[5] + s[12],                  // max 12
  };
}

// CSI severity label
function getCsiSeverity(csiTotal: number): string {
  if (csiTotal < 30) return 'Subclinico';
  if (csiTotal < 40) return 'Lieve';
  if (csiTotal < 50) return 'Moderato';
  if (csiTotal < 60) return 'Severo';
  return 'Estremo';
}

const RISK_CONFIG = {
  basso:     { label: 'Basso',      color: Colors.green,  bg: Colors.greenLight  },
  moderato:  { label: 'Moderato',   color: Colors.yellow, bg: Colors.yellowLight },
  alto:      { label: 'Alto',       color: '#F97316',     bg: '#FFF3E0'          },
  molto_alto:{ label: 'Molto Alto', color: Colors.red,    bg: Colors.redLight    },
};

// ─── EVIDENCE-BASED RECOMMENDATIONS ──────────────────────────────────────────

type Rec = {
  icon: string;
  category: string;
  text: string;
  source: string;
  level: 'A' | 'B' | 'C' | 'expert';
};

const CATEGORY_BG: Record<string, string> = {
  'Farmacologico':     '#E3F2FD',
  'Psicologico':       '#F3E5F5',
  'Locoregionale':     '#E0F2F1',
  'Intraoperatorio':   '#FFF3E0',
  'TPS':               '#E8F5E9',
  'Consulenza':        '#E8EAF6',
  'Follow-up':         '#F5F5F5',
  'Team':              '#FFEBEE',
  'Educazione':        '#FFFDE7',
  'Opioid management': '#EFEBE9',
  'Approccio':         '#FFF8E1',
  'Multimodale':       '#E0F2F1',
  'Centro del dolore': '#FFEBEE',
  'Priorità':          '#FFEBEE',
  'Counseling':        '#F3E5F5',
  'Nota critica':      '#FFF3E0',
};

const LEVEL_COLOR: Record<string, string> = {
  A: Colors.green, B: Colors.yellow, C: '#F97316', expert: '#9E9E9E',
};

function computeRecs(
  level: 'basso' | 'moderato' | 'alto' | 'molto_alto',
  pcsTotal: number,
  passTotal: number,
  csiTotal: number,
  opioids: 'none' | 'intermittent' | 'chronic',
  nrsPreop: number | null,
  distressScore: number | null,
  insomniaPresent: boolean,
  painOtherSites: boolean,
): Rec[] {
  const recs: Rec[] = [];

  if (level === 'basso') {
    recs.push(
      { icon: '✅', category: 'Farmacologico', text: 'Analgesia multimodale standard ERAS: paracetamolo 1g x4/die + FANS/COX-2 inibitore + oppioide rescue PRN', source: 'APS Guidelines 2016, PROSPECT 2023', level: 'A' },
      { icon: '📄', category: 'Educazione',    text: 'Informazione preoperatoria strutturata (pain neuroscience education breve, 1 sessione)', source: 'APS Guidelines 2016', level: 'B' },
      { icon: '📅', category: 'Follow-up',     text: 'Rivalutazione NRS a 1 mese dalla dimissione', source: 'Expert consensus', level: 'expert' },
    );
  } else if (level === 'moderato') {
    recs.push(
      { icon: '💊', category: 'Farmacologico', text: 'Pregabalin 75-150mg x2/die: iniziare 2h prima dell\'intervento, continuare 7-14 giorni post-op (OR riduzione CPSP 0.09 vs placebo)', source: 'Cochrane meta-analisi 2023', level: 'A' },
      { icon: '💊', category: 'Farmacologico', text: 'In alternativa: Gabapentin 300mg x3/die perioperatorio (evidenza simile al pregabalin)', source: 'Cochrane 2023', level: 'A' },
      { icon: '🦷', category: 'Locoregionale', text: 'Anestesia regionale tecnica-specifica: PENG+ACB per anca/ginocchio, ESPB per colonna/spalla, TAP block per addome', source: 'PROSPECT Guidelines 2023', level: 'A' },
      { icon: '📋', category: 'TPS',           text: 'Segnalazione al Transitional Pain Service per follow-up strutturato post-dimissione', source: 'Expert consensus', level: 'expert' },
      { icon: '📅', category: 'Follow-up',     text: 'Follow-up a 3 mesi con NRS + BPI', source: 'IASP 2021', level: 'B' },
    );
  } else if (level === 'alto') {
    recs.push(
      { icon: '💉', category: 'Intraoperatorio', text: 'Ketamina EV: 0.3-0.5mg/kg bolo all\'induzione + infusione 0.1-0.2mg/kg/h fino a 24h post-op (unico farmaco con evidenza Cochrane per riduzione CPSP)', source: 'ROCKet Trial 2024, Cochrane Review', level: 'B' },
      { icon: '💊', category: 'Farmacologico',   text: 'Lidocaina EV intraoperatoria: 1.5mg/kg bolo + 2mg/kg/h infusione (migliore evidenza per riduzione CPSP a 6 mesi in network meta-analisi)', source: 'BJA Systematic Review 2023', level: 'A' },
      { icon: '💊', category: 'Farmacologico',   text: 'Pregabalin 150mg x2/die perioperatorio (dose piena)', source: 'Cochrane 2023', level: 'A' },
      { icon: '🏥', category: 'TPS',             text: 'Presa in carico TPS obbligatoria con piano dimissione strutturato', source: 'Expert consensus', level: 'expert' },
      { icon: '👨‍⚕️', category: 'Consulenza',    text: 'Consulenza algologica preoperatoria obbligatoria', source: 'Expert consensus', level: 'expert' },
      { icon: '📅', category: 'Follow-up',       text: 'Follow-up strutturato a 3, 6, 12 mesi con BPI + DN4 + EQ-5D', source: 'IASP 2021', level: 'B' },
    );
  } else {
    recs.push(
      { icon: '🏥', category: 'Team',             text: 'Approccio multidisciplinare obbligatorio: anestesista algologo + psicologo/psichiatra + fisioterapista', source: 'IASP 2021', level: 'B' },
      { icon: '⚠️', category: 'Nota critica',     text: 'DULOXETINA: due RCT su TKA/THA (60mg/die) non hanno dimostrato riduzione CPSP come strategia routinaria. Indicata SOLO se CSI≥40 (sensitizzazione centrale documentata)', source: 'Int J Mol Sci 2024', level: 'B' },
      { icon: '💉', category: 'Intraoperatorio',  text: 'Ketamina EV + Lidocaina EV in combinazione (sinergia, evidenza emergente)', source: 'BJA 2023', level: 'B' },
      { icon: '💉', category: 'Intraoperatorio',  text: 'Considerare Metadone intraoperatorio 0.1-0.2mg/kg (emerging evidence, azione NMDA)', source: 'Expert consensus', level: 'expert' },
      { icon: '📞', category: 'Centro del dolore',text: 'Riferimento obbligatorio al Centro del Dolore Cronico PRIMA dell\'intervento', source: 'IASP 2021', level: 'B' },
      { icon: '📅', category: 'Follow-up',        text: 'Follow-up intensivo a 1, 3, 6, 12 mesi con team multidisciplinare', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (pcsTotal >= 30) {
    recs.push(
      { icon: '🧠', category: 'Psicologico', text: 'Pain Neuroscience Education (PNE) preoperatoria: 1-2 sessioni strutturate (forte evidenza in TKA/THA per riduzione catastrofizzazione)', source: 'Cochrane 2022, Lewis meta-analisi TKA', level: 'A' },
      { icon: '🧠', category: 'Psicologico', text: 'CBT orientata al dolore (riduce PCS score, intensità dolore e disabilità)', source: 'Cochrane Review 2021', level: 'A' },
      { icon: '📖', category: 'Educazione',  text: 'Fornire materiale psicoeducativo scritto validato sulla neuroscienza del dolore', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (passTotal >= 30) {
    recs.push(
      { icon: '🤝', category: 'Psicologico', text: 'Valutazione ansiolitica strutturata preoperatoria con colloquio dedicato', source: 'BJA Consensus 2024', level: 'B' },
      { icon: '💬', category: 'Counseling',  text: 'Counseling preoperatorio focalizzato sull\'ansia da dolore (2-3 sessioni)', source: 'APS Guidelines', level: 'B' },
      { icon: '💊', category: 'Farmacologico', text: 'Considerare clonidina 0.1-0.2mg preoperatoria se ansia severa (effetto ansiolitico + analgesico preemptivo)', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (csiTotal >= 40) {
    recs.push(
      { icon: '💊', category: 'Farmacologico', text: 'Pregabalin 75-150mg x2/die PRIORITARIO: target specifico sui canali calcio voltage-dipendenti della sensitizzazione centrale', source: 'IASP 2021', level: 'A' },
      { icon: '💊', category: 'Farmacologico', text: 'Duloxetina 60mg/die perioperatoria: INDICATA in presenza di CSI≥40 come unica condizione con evidenza positiva (a differenza della chirurgia ortopedica routinaria)', source: 'IASP Fact Sheet 2021', level: 'B' },
      { icon: '🔄', category: 'Multimodale',   text: 'Approccio multimodale obbligatorio, evitare strategia single-drug', source: 'APS Guidelines 2016', level: 'A' },
      { icon: '🧠', category: 'Psicologico',   text: 'MBSR (Mindfulness-Based Stress Reduction) come complemento non farmacologico', source: 'Cochrane 2019', level: 'B' },
      { icon: '⚠️', category: 'Approccio',     text: 'Sensibilità aumentata richiede titolazione analgesica più attenta intra e postoperatoria', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (opioids === 'chronic') {
    recs.push(
      { icon: '🔄', category: 'Opioid management', text: 'Opioid rotation perioperatoria se possibile (ridurre tolleranza crociata)', source: 'Expert consensus', level: 'expert' },
      { icon: '📉', category: 'Opioid management', text: 'Piano di taper strutturato post-operatorio con supporto algologico dedicato', source: 'APS Guidelines 2016', level: 'B' },
      { icon: '👨‍⚕️', category: 'Consulenza',       text: 'Coinvolgimento obbligatorio algologo (OR=4.04 per CPSP in oppioidi cronici)', source: 'Letteratura CPSP', level: 'A' },
      { icon: '💊', category: 'Farmacologico',       text: 'Considerare buprenorfina SL/TDS come bridge perioperatorio (emerging evidence)', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (nrsPreop !== null && nrsPreop >= 7) {
    recs.push(
      { icon: '🎯', category: 'Priorità',     text: 'Trattare aggressivamente il dolore preoperatorio PRIMA dell\'intervento (NRS preop = predittore principale nel modello PERISCOPE 2025)', source: 'PERISCOPE Trial 2025', level: 'A' },
      { icon: '💊', category: 'Farmacologico', text: 'Ottimizzare terapia analgesica preoperatoria e documentare caratteristiche del dolore per confronto postoperatorio', source: 'APS Guidelines 2016', level: 'B' },
    );
  }

  // ── Nuove regole Screening Clinico Core ──────────────────────────────────────
  if (distressScore !== null && distressScore >= 7) {
    recs.push(
      { icon: '🆘', category: 'Psicologico', text: 'Distress elevato (DT≥7): valutazione psicologica/psichiatrica preoperatoria obbligatoria. Il Distress Thermometer ≥7 è predittore indipendente di CPSP', source: 'NCCN Distress Guidelines 2023, BJA 2024', level: 'B' },
      { icon: '🤝', category: 'Counseling',  text: 'Supporto psicosociale strutturato preoperatorio: identificare e trattare stressors specifici (lavoro, famiglia, diagnosi oncologica/grave)', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (insomniaPresent) {
    recs.push(
      { icon: '😴', category: 'Psicologico',  text: 'Insonnia preoperatoria: intervento CBT-I (Cognitive Behavioral Therapy for Insomnia) prima dell\'intervento. L\'insonnia è fattore di rischio modificabile per CPSP', source: 'Lancet Sleep 2023, IASP 2021', level: 'B' },
      { icon: '💊', category: 'Farmacologico', text: 'Se insonnia grave: considerare melatonina 2-5mg o trazodone 50mg preoperatorio (evitare benzodiazepine long-acting)', source: 'Expert consensus', level: 'expert' },
    );
  }

  if (painOtherSites) {
    recs.push(
      { icon: '🗺️', category: 'Approccio',  text: 'Dolore in altre sedi: paziente con dolore cronico multifocale → rischio CPSP aumentato. Mappatura completa del dolore preoperatorio raccomandata', source: 'IASP 2021, Kehlet 2006', level: 'B' },
      { icon: '🔄', category: 'Multimodale', text: 'Ottimizzare terapia analgesica preoperatoria per le sedi dolorose preesistenti prima dell\'intervento elettivo', source: 'APS Guidelines 2016', level: 'B' },
    );
  }

  return recs;
}

// ─── PROSPECT BUNDLES ────────────────────────────────────────────────────────
const PROSPECT_BUNDLES: Record<string, { title: string; source: string; items: { drug: string; dose: string; level: string }[] }> = {
  THA: { title: 'THA – Artroprotesi Anca', source: 'PROSPECT 2022', items: [
    { drug: 'Paracetamolo', dose: '1g x4/die EV/PO', level: 'A' },
    { drug: 'Celecoxib 200mg x2/die', dose: 'preop + 5-7 gg', level: 'A' },
    { drug: 'PENG block + ACB', dose: 'singolo shot / catetere', level: 'A' },
    { drug: 'Desametasone 8-10mg EV', dose: 'induzione', level: 'A' },
    { drug: 'Ketamina 0.3mg/kg EV', dose: 'bolo intraop', level: 'B' },
  ]},
  TKA: { title: 'TKA – Artroprotesi Ginocchio', source: 'PROSPECT 2023', items: [
    { drug: 'Paracetamolo 1g x4/die', dose: 'EV/PO', level: 'A' },
    { drug: 'Celecoxib 200mg x2/die', dose: 'preop + 7-14 gg', level: 'A' },
    { drug: 'Adductor Canal Block + infiltrazione pericapsulare', dose: 'singolo shot', level: 'A' },
    { drug: 'Desametasone 8-10mg EV', dose: 'induzione', level: 'A' },
    { drug: 'Pregabalin 150mg x2', dose: 'solo se rischio CPSP alto', level: 'B' },
  ]},
  ARTR_GINOCCHIO: { title: 'Artroscopia Ginocchio', source: 'PROSPECT 2018', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'PO preop + 24h', level: 'A' },
    { drug: 'Ketorolac 30mg EV', dose: 'intraop', level: 'A' },
    { drug: 'Bupivacaina intra-articolare 0.25% 20ml', dose: 'fine procedura', level: 'A' },
  ]},
  ARTR_SPALLA: { title: 'Artroscopia Spalla', source: 'PROSPECT 2021', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'PO', level: 'A' },
    { drug: 'Celecoxib 200mg x2', dose: '5 gg', level: 'A' },
    { drug: 'ISB (interscalene block) ropivacaina 0.5% 20ml', dose: 'singolo shot', level: 'A' },
  ]},
  PROTESI_SPALLA: { title: 'Protesi Spalla', source: 'PROSPECT/Expert', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'PO', level: 'A' },
    { drug: 'Celecoxib 200mg x2', dose: '5-7 gg', level: 'A' },
    { drug: 'ISB continuo (ropivacaina 0.2%)', dose: 'infusione 48h', level: 'A' },
    { drug: 'Ketamina 0.3mg/kg', dose: 'bolo intraop', level: 'B' },
  ]},
  VERTEBRALE_FUSIONE: { title: 'Fusione Vertebrale', source: 'PROSPECT 2021', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'EV/PO', level: 'A' },
    { drug: 'FANS/COX-2 breve durata', dose: 'celecoxib 200mg x2', level: 'B' },
    { drug: 'ESPB bilaterale (ropivacaina 0.25% 20ml/lato)', dose: '', level: 'B' },
    { drug: 'Ketamina EV', dose: '0.3mg/kg + 0.1mg/kg/h infusione', level: 'A' },
    { drug: 'Metadone 0.1-0.2mg/kg intraop', dose: 'emerging evidence', level: 'expert' },
  ]},
  VERTEBRALE_DECOMPRESSIONE: { title: 'Decompressione Vertebrale', source: 'PROSPECT 2021', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'EV/PO', level: 'A' },
    { drug: 'Celecoxib 200mg x2', dose: '5 gg', level: 'A' },
    { drug: 'ESPB (ropivacaina 0.25%)', dose: 'singolo shot', level: 'B' },
    { drug: 'Ketamina 0.3mg/kg', dose: 'intraop', level: 'B' },
  ]},
  FRATTURA_INF: { title: 'Frattura Arto Inferiore', source: 'ESRA/Expert', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'EV', level: 'A' },
    { drug: 'FNB / FICB / popliteal block (specifico per sede)', dose: '', level: 'A' },
    { drug: 'Ketamina 0.3mg/kg', dose: 'intraop', level: 'B' },
    { drug: 'Ketorolac 15-30mg EV breve durata', dose: 'cauto in fratture', level: 'B' },
  ]},
  FRATTURA_SUP: { title: 'Frattura Arto Superiore', source: 'ESRA/Expert', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'EV', level: 'A' },
    { drug: 'Blocco plessico brachiale (ropivacaina 0.5%)', dose: '', level: 'A' },
    { drug: 'Ketorolac 15mg EV', dose: 'intraop', level: 'B' },
  ]},
  ALTRO: { title: 'Procedura Ortopedica Generale', source: 'APS / PROSPECT', items: [
    { drug: 'Paracetamolo 1g x4', dose: 'EV/PO', level: 'A' },
    { drug: 'FANS/COX-2 (se non controindicati)', dose: '', level: 'A' },
    { drug: 'Blocco locoregionale tecnica-specifico', dose: '—', level: 'A' },
    { drug: 'Oppioide rescue PRN', dose: 'morfina/tramadolo', level: 'B' },
  ]},
};

// ─── NEUP-SIG 2025 ────────────────────────────────────────────────────────────
type NeupsigDrug = { name: string; dose: string; nnt: string; step: 1|2|3; notes?: string };
const NEUP_SIG_DRUGS: NeupsigDrug[] = [
  { name: 'Amitriptilina',      dose: '10-75 mg/die (titolazione lenta)',        nnt: '3.6',  step: 1, notes: 'Prima scelta se comorbidità insonnia; attenzione effetti anticolinergici' },
  { name: 'Duloxetina',         dose: '30-120 mg/die',                           nnt: '6.4',  step: 1, notes: 'Preferita se comorbidità depressione/GAD; monitorare PA' },
  { name: 'Pregabalin',         dose: '150-600 mg/die',                          nnt: '7.7',  step: 1, notes: 'Titolazione su 2-4 settimane; aggiustamento renale' },
  { name: 'Gabapentin',         dose: '1200-3600 mg/die (3 dosi)',               nnt: '6.3',  step: 1, notes: 'Alternativa a pregabalin; profilo simile' },
  { name: 'Tramadolo',          dose: '200-400 mg/die',                          nnt: '4.7',  step: 2, notes: 'Rischio dipendenza; evitare con SSRI/SNRI' },
  { name: 'Capsaicina patch 8%',dose: '1-4 patch ogni 3 mesi',                  nnt: '10.6', step: 2, notes: 'Solo dolore neuropatico periferico; applicazione ospedaliera' },
  { name: 'Lidocaina patch 5%', dose: '1-3 patch/die (max 12h on/off)',          nnt: '—',    step: 2, notes: 'Dolore neuropatico localizzato; ottima tollerabilità' },
  { name: 'Morfina/Ossicodone CR', dose: 'Titolazione individuale',              nnt: '4.3',  step: 3, notes: 'Solo se step 1-2 falliti; piano taper obbligatorio; consenso informato' },
  { name: 'Buprenorfina TDS',   dose: '35-70 µg/h ogni 3 giorni',               nnt: '—',    step: 3, notes: 'Profilo recettoriale favorevole; sicuro in insufficienza renale' },
  { name: 'Combinazione step 1+2', dose: 'Es. gabapentin + tramadolo',           nnt: '—',    step: 3, notes: 'Sinergia farmacodinamica; ridurre dosi individuali' },
];

// ─── CPSP DIAGNOSTIC ALGORITHM ───────────────────────────────────────────────
const CPSP_CRITERIA = [
  'Il dolore è iniziato o si è significativamente intensificato dopo la procedura chirurgica',
  'Il dolore è localizzato nell\'area dell\'intervento o nella zona di distribuzione del nervo operato',
  'Il dolore persiste da più di 3 mesi dall\'intervento chirurgico',
  'Il dolore non è spiegato meglio da una condizione pre-esistente o da altra causa',
];
const CPSP_EXCLUSIONS = [
  'Patologia oncologica attiva o recidiva locale/sistemica',
  'Infezione chirurgica attiva, osteomielite o sepsi periprotesica',
  'Complicanza meccanica hardware/protesi (allentamento, frattura, mobilizzazione)',
  'CRPS (Complex Regional Pain Syndrome) – criteri Budapest presenti',
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function initScores(n: number) { return new Array(n).fill(null) as (number | null)[]; }

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function CPSPScreen({ route, navigation }: any) {
  const { profile, refreshSession } = useAuth();
  const { patientId, patientName } = route.params;

  // Section
  const [section, setSection] = useState<'valutazione' | 'followup_cpsp'>('valutazione');

  // Valutazione form
  const [surgeryValue, setSurgeryValue] = useState<string>('');
  const [opioids, setOpioids] = useState<'none' | 'intermittent' | 'chronic'>('none');
  const [nrsPreop, setNrsPreop] = useState<number | null>(null);
  const [scaleTab, setScaleTab] = useState<'pcs' | 'pass' | 'csi'>('pcs');
  const [pcsScores, setPcsScores] = useState<(number | null)[]>(initScores(PCS_ITEMS.length));
  const [passScores, setPassScores] = useState<(number | null)[]>(initScores(PASS_ITEMS.length));
  const [csiScores, setCsiScores] = useState<(number | null)[]>(initScores(CSI_ITEMS.length));
  const [result, setResult] = useState<{ pct: number; level: RiskLevel; version?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);

  // Screening Clinico Core
  const [painOtherSites, setPainOtherSites] = useState<boolean>(false);
  const [painOtherSitesNrs, setPainOtherSitesNrs] = useState<number | null>(null);
  const [insomniaPresent, setInsomniaPresent] = useState<boolean>(false);
  const [insomniaSeverity, setInsomniaSeverity] = useState<number | null>(null);
  const [distressScore, setDistressScore] = useState<number | null>(null);
  const [smoking, setSmoking] = useState<boolean>(false);
  const [alcohol, setAlcohol] = useState<boolean>(false);
  const [bmiText, setBmiText] = useState<string>('');
  const [fragilityPresent, setFragilityPresent] = useState<boolean>(false);
  const [opioidOme, setOpioidOme] = useState<string>('');
  const [opioidWeeks, setOpioidWeeks] = useState<string>('');

  // Dati anagrafici preop
  const [patientAge, setPatientAge] = useState<string>('');
  const [patientSex, setPatientSex] = useState<'M' | 'F' | null>(null);
  const [concernSurgery, setConcernSurgery] = useState<number | null>(null);

  // Dati intraoperatori
  const [surgeryDurationMin, setSurgeryDurationMin] = useState<string>('');
  const [regionalAnesthesia, setRegionalAnesthesia] = useState<boolean>(false);
  const [regionalAnesthesiaType, setRegionalAnesthesiaType] = useState<string>('');
  const [autoPopulatedFromIntervention, setAutoPopulatedFromIntervention] = useState<boolean>(false);

  // Follow-up form
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [fpMonths, setFpMonths] = useState<0.5 | 1 | 3 | 6 | 12>(3);
  const [fpDate, setFpDate] = useState('');
  const [fpPainPresent, setFpPainPresent] = useState<boolean | null>(null);
  const [fpNrs, setFpNrs] = useState<number | null>(null);
  const [fpBpi, setFpBpi] = useState<(number | null)[]>(initScores(BPI_ITEMS.length));
  const [fpDn4, setFpDn4] = useState<(boolean | null)[]>(new Array(DN4_ITEMS.length).fill(null));
  const [fpEq5d, setFpEq5d] = useState<(number | null)[]>(initScores(EQ5D_ITEMS.length));
  const [fpEqVas, setFpEqVas] = useState<number | null>(null);
  const [fpTherapy, setFpTherapy] = useState('');
  const [fpCpspConfirmed, setFpCpspConfirmed] = useState<boolean | null>(null);
  const [fpPainCenter, setFpPainCenter] = useState<boolean | null>(null);
  const [fpFas, setFpFas] = useState<'A' | 'B' | 'C' | null>(null);
  const [fpOpioidUsePostop, setFpOpioidUsePostop] = useState<'none' | 'prn' | 'scheduled' | null>(null);
  const [fpOpioidOmePostop, setFpOpioidOmePostop] = useState<string>('');
  const [fpNeuropathicChecklist, setFpNeuropathicChecklist] = useState<boolean[]>(new Array(5).fill(false));

  // Fenotipo Neuropatico Precoce (2 settimane)
  const [fpEarlyNeuroBurning, setFpEarlyNeuroBurning] = useState<boolean>(false);
  const [fpEarlyNeuroElectric, setFpEarlyNeuroElectric] = useState<boolean>(false);
  const [fpEarlyNeuroAllodynia, setFpEarlyNeuroAllodynia] = useState<boolean>(false);
  const [fpEarlyNeuroCold, setFpEarlyNeuroCold] = useState<boolean>(false);

  // CPSP Diagnostic Algorithm (follow-up ≥3 mesi)
  const [cpspDiagStep, setCpspDiagStep] = useState<1|2|3|4>(1);
  const [cpspCriteria, setCpspCriteria] = useState<boolean[]>(new Array(4).fill(false));
  const [cpspExclusions, setCpspExclusions] = useState<boolean[]>(new Array(4).fill(false));
  const [phq9Answers, setPhq9Answers] = useState<number[]>(new Array(9).fill(0));
  const [gad7Answers, setGad7Answers] = useState<number[]>(new Array(7).fill(0));
  const [fpOpioidDaysLast14, setFpOpioidDaysLast14] = useState<string>('');
  // NeuPSIG documentation
  const [neupsigDocStep, setNeupsigDocStep] = useState<1|2|3>(1);
  const [neupsigDocDrug, setNeupsigDocDrug] = useState<string>('');

  const [fpNrsRest, setFpNrsRest] = useState<number | null>(null);
  const [fpNrsMovement, setFpNrsMovement] = useState<number | null>(null);
  const [fpShowAllBpi, setFpShowAllBpi] = useState(false);

  const [savingFp, setSavingFp] = useState(false);

  // POD1 dynamic update
  const [pod1ModalId, setPod1ModalId] = useState<string | null>(null);
  const [pod1NrsRest, setPod1NrsRest] = useState<number | null>(null);
  const [pod1NrsMovement, setPod1NrsMovement] = useState<number | null>(null);
  const [pod1OmeText, setPod1OmeText] = useState<string>('');
  const [pod1DynResult, setPod1DynResult] = useState<{ pct: number; level: 'basso' | 'moderato' | 'alto' | 'molto_alto'; delta: number } | null>(null);
  const [savingPod1, setSavingPod1] = useState(false);

  // NRS Daily clinician entry modal
  const [nrsDayModal, setNrsDayModal] = useState<{ assessmentId: string; podDay: number; existingId: string | null } | null>(null);
  const [ndNrsRest, setNdNrsRest] = useState<number | null>(null);
  const [ndNrsMovement, setNdNrsMovement] = useState<number | null>(null);
  const [ndPainInterference, setNdPainInterference] = useState<number | null>(null);
  const [ndSleepQuality, setNdSleepQuality] = useState<number | null>(null);
  const [ndMoodScore, setNdMoodScore] = useState<number | null>(null);
  const [ndUsingOpioids, setNdUsingOpioids] = useState(false);
  const [savingNrsDay, setSavingNrsDay] = useState(false);

  // Assessment form visibility & expand
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);

  // Edit state
  const [editingAssessmentId, setEditingAssessmentId] = useState<string | null>(null);
  const [editingFollowupId, setEditingFollowupId] = useState<string | null>(null);

  // Follow-up linked assessment
  const [fpAssessmentId, setFpAssessmentId] = useState<string | null>(null);

  // Data
  const [assessments, setAssessments] = useState<any[]>([]);
  const [followups, setFollowups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Patient record (loaded for BMI/age/sex pre-fill)
  const [patientRecord, setPatientRecord] = useState<any | null>(null);

  // NRS Daily monitoring data (keyed by assessment_id)
  const [nrsDailyMap, setNrsDailyMap] = useState<Record<string, any[]>>({});

  // QR Modal
  const [qrModal, setQrModal] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<'pending' | 'completed' | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAssessmentId, setQrAssessmentId] = useState<string | null>(null);
  // token status per assessment id (preop scales)
  const [tokenMap, setTokenMap] = useState<Record<string, { token: string; status: string }>>({});
  // post-discharge QR tokens (post_discharge_nrs)
  const [pdTokenMap, setPdTokenMap] = useState<Record<string, { token: string; status: string }>>({});
  const [pdQrLoading, setPdQrLoading] = useState(false);

  useEffect(() => {
    loadData();
    AsyncStorage.getItem('tenant_id').then(setTenantId);
    // Load patient record for auto-fill
    supabase.from('patients').select('*').eq('id', patientId).single().then(({ data }) => {
      if (!data) return;
      setPatientRecord(data);
      // Auto-fill age from date_of_birth
      if (data.date_of_birth) {
        const age = Math.floor(
          (new Date().getTime() - new Date(data.date_of_birth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
        );
        setPatientAge(String(age));
      }
      // Auto-fill sex
      if (data.gender === 'M' || data.gender === 'F') setPatientSex(data.gender);
      // Auto-fill BMI
      if (data.weight_kg && data.height_cm) {
        const bmi = Math.round((data.weight_kg / Math.pow(data.height_cm / 100, 2)) * 10) / 10;
        setBmiText(String(bmi));
      }
    });
  }, [patientId]);

  // Polling while QR modal is open
  useEffect(() => {
    if (!qrModal || !qrToken || qrStatus === 'completed') return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('patient_questionnaire_tokens')
        .select('status')
        .eq('token', qrToken)
        .single();
      if (data?.status === 'completed') {
        setQrStatus('completed');
        if (qrAssessmentId) {
          setTokenMap(prev => ({
            ...prev,
            [qrAssessmentId]: { ...prev[qrAssessmentId], status: 'completed' },
          }));
        }
        loadData();
        clearInterval(interval);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [qrModal, qrToken, qrStatus]);

  const loadData = async () => {
    refreshSession?.();
    const [aRes, fRes] = await Promise.all([
      svcLoadAssessments(supabase, patientId),
      svcLoadFollowups(supabase, patientId),
    ]);
    setAssessments(aRes.data);
    setFollowups(fRes.data);
    setLoading(false);
    // fetch token statuses and nrs daily for all assessments
    if (aRes.data && aRes.data.length > 0) {
      const ids = aRes.data.map((a: any) => a.id);
      const [{ data: tokens }, { data: pdTokens }, { data: nrsDaily }] = await Promise.all([
        supabase.from('patient_questionnaire_tokens').select('id, assessment_id, token, status, token_type').in('assessment_id', ids).eq('token_type', 'preop_scales'),
        supabase.from('patient_questionnaire_tokens').select('id, assessment_id, token, status, token_type').in('assessment_id', ids).eq('token_type', 'post_discharge_nrs'),
        supabase.from('cpsp_nrs_daily').select('*').in('assessment_id', ids).order('pod_day', { ascending: true }),
      ]);
      if (tokens) {
        const map: Record<string, { token: string; status: string }> = {};
        tokens.forEach((t: any) => { map[t.assessment_id] = { token: t.token ?? t.id, status: t.status }; });
        setTokenMap(map);
      }
      if (pdTokens) {
        const map: Record<string, { token: string; status: string }> = {};
        pdTokens.forEach((t: any) => { map[t.assessment_id] = { token: t.token ?? t.id, status: t.status }; });
        setPdTokenMap(map);
      }
      if (nrsDaily) {
        const dailyMap: Record<string, any[]> = {};
        nrsDaily.forEach((r: any) => {
          if (!dailyMap[r.assessment_id]) dailyMap[r.assessment_id] = [];
          dailyMap[r.assessment_id].push(r);
        });
        setNrsDailyMap(dailyMap);
      }
    }
  };

  const handleGenerateQR = async (assessmentId: string) => {
    setQrLoading(true);
    setQrAssessmentId(assessmentId);
    // Check existing token
    const existing = tokenMap[assessmentId];
    if (existing) {
      setQrToken(existing.token);
      setQrStatus(existing.status as 'pending' | 'completed');
      setQrModal(true);
      setQrLoading(false);
      return;
    }
    // Debug logs
    console.log('handleGenerateQR - assessmentId:', assessmentId);
    console.log('handleGenerateQR - patientId:', patientId);
    console.log('handleGenerateQR - tenantId:', tenantId);

    // Verifica che tenantId sia valido
    if (!tenantId) {
      const stored = await AsyncStorage.getItem('tenant_id');
      console.log('tenantId from storage:', stored);
    }

    // Create new token
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('patient_questionnaire_tokens')
      .insert({
        assessment_id: assessmentId,
        patient_id: patientId,
        tenant_id: tenantId,
        created_by: user?.id || null,
        scales: ['pcs', 'pass', 'csi'],
        token_type: 'preop_scales',
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select('id, token, status')
      .single();
    setQrLoading(false);
    if (error) {
      Alert.alert('Errore QR', `${error.message}\nCode: ${error.code}\nDetails: ${JSON.stringify(error.details)}`);
      return;
    }
    const tok = data.token ?? data.id;
    setQrToken(tok);
    setQrStatus('pending');
    setTokenMap(prev => ({ ...prev, [assessmentId]: { token: tok, status: 'pending' } }));
    setQrModal(true);
  };

  const handleGeneratePostDischargeQR = async (assessmentId: string) => {
    // Show existing token if present
    const existing = pdTokenMap[assessmentId];
    if (existing) {
      setQrToken(existing.token);
      setQrStatus(existing.status as 'pending' | 'completed');
      setQrAssessmentId(assessmentId);
      setQrModal(true);
      return;
    }
    setPdQrLoading(true);

    // Check which POD days are already covered in cpsp_nrs_daily
    const [{ data: dailyRows }, { data: assessmentData }] = await Promise.all([
      supabase
        .from('cpsp_nrs_daily')
        .select('pod_day, source')
        .eq('assessment_id', assessmentId)
        .order('pod_day', { ascending: true }),
      supabase
        .from('cpsp_assessments')
        .select('discharge_date, surgery_date')
        .eq('id', assessmentId)
        .single(),
    ]);
    setPdQrLoading(false);

    const apsDays = (dailyRows ?? []).filter((d: any) => d.source === 'aps').map((d: any) => d.pod_day);
    const patientDays = (dailyRows ?? []).filter((d: any) => d.source !== 'aps').map((d: any) => d.pod_day);
    const coveredDays = (dailyRows ?? []).map((d: any) => d.pod_day);
    const neededDays = [1, 2, 3, 4, 5, 6, 7].filter(d => !coveredDays.includes(d));
    const validUntilPod = neededDays.length > 0 ? Math.max(...neededDays) : 7;

    if (neededDays.length === 0) {
      Alert.alert(
        '✅ Monitoraggio Completo',
        'Tutti i 7 giorni post-dimissione sono già stati registrati.',
        [{ text: 'OK' }],
      );
      return;
    }

    const dischargeDate = assessmentData?.discharge_date
      ?? assessmentData?.surgery_date
      ?? new Date().toISOString().split('T')[0];

    const apsDaysStr = apsDays.length > 0 ? apsDays.map((d: number) => `POD${d}`).join(', ') : 'Nessuno';
    const patientDaysStr = patientDays.length > 0 ? patientDays.map((d: number) => `POD${d}`).join(', ') : 'Nessuno';
    const neededDaysStr = neededDays.map(d => `POD${d}`).join(', ');

    Alert.alert(
      '📱 QR Post-Dimissione',
      `🏥 Giorni coperti da APS: ${apsDaysStr}\n📱 Dati paziente: ${patientDaysStr}\n\n⬜ Da richiedere al paziente:\n${neededDaysStr}\n\nQR valido fino al POD${validUntilPod}.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Genera QR', onPress: async () => {
            setPdQrLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            const { data, error } = await supabase
              .from('patient_questionnaire_tokens')
              .insert({
                assessment_id: assessmentId,
                patient_id: patientId,
                tenant_id: tenantId,
                created_by: user?.id || null,
                scales: ['nrs_daily'],
                token_type: 'post_discharge_nrs',
                status: 'pending',
                discharge_date: dischargeDate,
                valid_until_pod: validUntilPod,
                expires_at: new Date(Date.now() + validUntilPod * 24 * 60 * 60 * 1000).toISOString(),
              })
              .select('id, token, status')
              .single();
            setPdQrLoading(false);
            if (error) {
              Alert.alert('Errore QR Post-Dimissione', error.message);
              return;
            }
            const tok = data.token ?? data.id;
            setPdTokenMap(prev => ({ ...prev, [assessmentId]: { token: tok, status: 'pending' } }));
            setQrToken(tok);
            setQrStatus('pending');
            setQrAssessmentId(assessmentId);
            setQrModal(true);
          },
        },
      ],
    );
  };

  const resetAssessmentForm = () => {
    setSurgeryValue('');
    setOpioids('none');
    setNrsPreop(null);
    setPcsScores(initScores(PCS_ITEMS.length));
    setPassScores(initScores(PASS_ITEMS.length));
    setCsiScores(initScores(CSI_ITEMS.length));
    setResult(null);
    setEditingAssessmentId(null);
    // Screening Clinico Core reset
    setPainOtherSites(false); setPainOtherSitesNrs(null);
    setInsomniaPresent(false); setInsomniaSeverity(null);
    setDistressScore(null);
    setSmoking(false); setAlcohol(false);
    setBmiText(''); setFragilityPresent(false);
    setOpioidOme(''); setOpioidWeeks('');
    setPatientAge(''); setPatientSex(null); setConcernSurgery(null);
    setSurgeryDurationMin(''); setRegionalAnesthesia(false); setRegionalAnesthesiaType(''); setAutoPopulatedFromIntervention(false);
  };

  const handleNewAssessment = async () => {
    resetAssessmentForm();
    // Auto-fill patient anagrafica (reset to anagrafica values)
    const pr = patientRecord;
    if (pr) {
      if (pr.date_of_birth) {
        const age = Math.floor((new Date().getTime() - new Date(pr.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        setPatientAge(String(age));
      }
      if (pr.gender === 'M' || pr.gender === 'F') setPatientSex(pr.gender);
      if (pr.weight_kg && pr.height_cm) {
        const bmi = Math.round((pr.weight_kg / Math.pow(pr.height_cm / 100, 2)) * 10) / 10;
        setBmiText(String(bmi));
      }
    }
    // Auto-fill OME from active prescriptions
    const { data: prescs } = await supabase
      .from('opioid_prescriptions')
      .select('ome_daily, is_prn, status')
      .eq('patient_id', patientId)
      .eq('status', 'active');
    if (prescs && prescs.length > 0) {
      const totalOme = prescs.reduce((s: number, p: any) => s + (p.ome_daily || 0), 0);
      const roundedOme = Math.round(totalOme * 10) / 10;
      setOpioidOme(String(roundedOme));
      // Auto-set opioid category
      if (roundedOme > 90) setOpioids('chronic');
      else if (roundedOme > 0) setOpioids('intermittent');
    }
    // Auto-fill intraop fields from last intervention
    const { data: lastIntervention } = await supabase
      .from('interventions')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastIntervention) {
      let anyPopulated = false;
      // Duration: prefer computed from timestamps, fallback to duration_minutes
      if (lastIntervention.intervention_start_time && lastIntervention.intervention_end_time) {
        const start = new Date(lastIntervention.intervention_start_time).getTime();
        const end = new Date(lastIntervention.intervention_end_time).getTime();
        const diffMin = Math.round((end - start) / 60000);
        if (diffMin > 0) {
          setSurgeryDurationMin(String(diffMin));
          anyPopulated = true;
        }
      } else if (lastIntervention.duration_minutes != null && lastIntervention.duration_minutes > 0) {
        setSurgeryDurationMin(String(lastIntervention.duration_minutes));
        anyPopulated = true;
      }
      // Regional anesthesia
      const regionalAnesthesiaTypes = ['epidurale', 'locoregionale', 'spinale'];
      const isRegionalType = regionalAnesthesiaTypes.includes(lastIntervention.anesthesia_type ?? '');
      const hasRegionalBlocks = lastIntervention.regional_blocks && String(lastIntervention.regional_blocks).trim() !== '';
      if (isRegionalType || hasRegionalBlocks) {
        setRegionalAnesthesia(true);
        if (hasRegionalBlocks) {
          setRegionalAnesthesiaType(String(lastIntervention.regional_blocks));
        }
        anyPopulated = true;
      }
      if (anyPopulated) {
        setAutoPopulatedFromIntervention(true);
      }
    }
    setShowAssessmentForm(true);
  };

  const loadAssessmentForEdit = (a: any) => {
    setSurgeryValue(a.surgery_type ?? '');
    setOpioids(a.opioid_use_preop ?? 'none');
    setNrsPreop(a.preop_nrs ?? null);
    setPcsScores(Array.isArray(a.pcs_answers) ? a.pcs_answers : initScores(PCS_ITEMS.length));
    setPassScores(Array.isArray(a.pass_answers) ? a.pass_answers : initScores(PASS_ITEMS.length));
    setCsiScores(Array.isArray(a.csi_answers) ? a.csi_answers : initScores(CSI_ITEMS.length));
    // Screening Clinico Core
    setPainOtherSites(a.pain_other_sites ?? false);
    setPainOtherSitesNrs(a.pain_other_sites_nrs ?? null);
    setInsomniaPresent(a.insomnia_present ?? false);
    setInsomniaSeverity(a.insomnia_severity ?? null);
    setDistressScore(a.distress_thermometer ?? null);
    setSmoking(a.smoking ?? false);
    setAlcohol(a.alcohol_risk ?? false);
    setBmiText(a.bmi !== null && a.bmi !== undefined ? String(a.bmi) : '');
    setFragilityPresent(a.frailty ?? false);
    setOpioidOme(a.opioid_ome_mg_day !== null && a.opioid_ome_mg_day !== undefined ? String(a.opioid_ome_mg_day) : '');
    setOpioidWeeks(a.opioid_duration_weeks !== null && a.opioid_duration_weeks !== undefined ? String(a.opioid_duration_weeks) : '');
    setPatientAge(a.age !== null && a.age !== undefined ? String(a.age) : '');
    setPatientSex(a.sex ?? null);
    setConcernSurgery(a.concern_about_surgery ?? null);
    setSurgeryDurationMin(a.surgery_duration_minutes !== null && a.surgery_duration_minutes !== undefined ? String(a.surgery_duration_minutes) : '');
    setRegionalAnesthesia(a.regional_anesthesia ?? false);
    setRegionalAnesthesiaType(a.regional_anesthesia_type ?? '');
    setResult(null);
    setEditingAssessmentId(a.id);
    setShowAssessmentForm(true);
    setSection('valutazione');
  };

  const deleteAssessment = (id: string) => {
    Alert.alert('Elimina valutazione', 'Eliminare questa valutazione CPSP?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await svcDeleteAssessment(supabase, id);
        if (editingAssessmentId === id) { setEditingAssessmentId(null); setShowAssessmentForm(false); }
        if (expandedAssessmentId === id) setExpandedAssessmentId(null);
        loadData();
      }},
    ]);
  };

  const deleteFollowup = (id: string) => {
    Alert.alert('Elimina follow-up', 'Eliminare questo follow-up?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => {
        await svcDeleteFollowup(supabase, id);
        if (editingFollowupId === id) { setEditingFollowupId(null); setShowFollowupForm(false); }
        loadData();
      }},
    ]);
  };

  const loadFollowupForEdit = (fp: any) => {
    setFpMonths((fp.followup_months as 0.5 | 1 | 3 | 6 | 12) ?? 3);
    setFpDate(fp.followup_date ?? '');
    setFpPainPresent(fp.pain_present ?? null);
    setFpNrs(fp.pain_nrs_current ?? null);
    const bpi = initScores(BPI_ITEMS.length);
    bpi[4] = fp.bpi_general_activity ?? null;
    bpi[5] = fp.bpi_mood ?? null;
    bpi[6] = fp.bpi_work ?? null;
    setFpBpi(bpi);
    setFpDn4(Array.isArray(fp.dn4_answers) ? fp.dn4_answers : new Array(DN4_ITEMS.length).fill(null));
    setFpEq5d([fp.eq5d_mobility ?? null, fp.eq5d_self_care ?? null, fp.eq5d_usual_activities ?? null, fp.eq5d_pain ?? null, fp.eq5d_anxiety ?? null]);
    setFpEqVas(fp.eq5d_vas ?? null);
    setFpTherapy(fp.current_therapy ?? '');
    setFpCpspConfirmed(fp.cpsp_confirmed ?? null);
    setFpPainCenter(fp.referral_pain_center ?? null);
    setFpFas(fp.fas_score ?? null);
    setFpOpioidUsePostop(fp.opioid_use_postop ?? null);
    setFpOpioidOmePostop(fp.opioid_ome_postop !== null && fp.opioid_ome_postop !== undefined ? String(fp.opioid_ome_postop) : '');
    setFpNeuropathicChecklist(Array.isArray(fp.neuropathic_checklist) ? fp.neuropathic_checklist : new Array(5).fill(false));
    setFpEarlyNeuroBurning(fp.early_neuro_burning ?? false);
    setFpEarlyNeuroElectric(fp.early_neuro_electric ?? false);
    setFpEarlyNeuroAllodynia(fp.early_neuro_allodynia ?? false);
    setFpEarlyNeuroCold(fp.early_neuro_cold_pain ?? false);
    setCpspCriteria(Array.isArray(fp.cpsp_criteria) ? fp.cpsp_criteria : new Array(4).fill(false));
    setCpspExclusions(Array.isArray(fp.cpsp_exclusions) ? fp.cpsp_exclusions : new Array(4).fill(false));
    setPhq9Answers(Array.isArray(fp.phq9_answers) && fp.phq9_answers.length === 9 ? fp.phq9_answers : new Array(9).fill(0));
    setGad7Answers(Array.isArray(fp.gad7_answers) && fp.gad7_answers.length === 7 ? fp.gad7_answers : new Array(7).fill(0));
    setFpOpioidDaysLast14(fp.opioid_days_last14 != null ? String(fp.opioid_days_last14) : '');
    setNeupsigDocStep(fp.neup_sig_step ?? 1);
    setNeupsigDocDrug(fp.neup_sig_drug ?? '');
    setCpspDiagStep(1);
    setFpAssessmentId(fp.assessment_id ?? null);
    setEditingFollowupId(fp.id);
    setShowFollowupForm(true);
  };

  // ── Score helpers ──────────────────────────────────────────────────────────

  const sumScores = (arr: (number | null)[]) =>
    arr.reduce<number>((s, v) => s + (v ?? 0), 0);

  const allFilled = (arr: (number | null)[]) => arr.every(v => v !== null);

  const phq9Score = phq9Answers.reduce((a, b) => a + b, 0);
  const gad7Score = gad7Answers.reduce((a, b) => a + b, 0);

  const resolveScoreErrorMessage = (error: any, data: any): string => {
    console.log('compute-cpsp-risk error:', error, data);
    const status = error?.context?.status ?? error?.status;
    if (status === 401) {
      return 'Sessione scaduta: effettua di nuovo il login.';
    }
    return 'Calcolo non riuscito: verifica la connessione e riprova.';
  };

  const handleCalculate = async () => {
    if (!surgeryValue) return Alert.alert('Attenzione', 'Seleziona il tipo di intervento');
    if (nrsPreop === null) return Alert.alert('Attenzione', 'Inserisci il dolore NRS preoperatorio');
    if (!allFilled(pcsScores)) return Alert.alert('Attenzione', 'Completa tutti gli item PCS');
    if (!allFilled(passScores)) return Alert.alert('Attenzione', 'Completa tutti gli item PASS');
    if (!allFilled(csiScores)) return Alert.alert('Attenzione', 'Completa tutti gli item CSI');
    setCalculating(true);
    setScoreError(null);
    const { data, error } = await supabase.functions.invoke('compute-cpsp-risk', {
      body: {
        surgeryType: surgeryValue,
        opioids,
        nrsPreop,
        pcsTotal: sumScores(pcsScores),
        passTotal: sumScores(passScores),
        csiTotal: sumScores(csiScores),
        distressThermometer: distressScore ?? 0,
        painOtherSites,
        insomniaPresent,
        smoking,
        frailty: fragilityPresent,
      },
    });
    setCalculating(false);
    if (error || data?.error) {
      setScoreError(resolveScoreErrorMessage(error, data));
    } else {
      setResult({ pct: data.pct, level: data.level as RiskLevel, version: data.version });
    }
  };

  const retryScore = async (assessmentId: string) => {
    setCalculating(true);
    setScoreError(null);
    const { data, error } = await supabase.functions.invoke('compute-cpsp-risk', {
      body: {
        surgeryType: surgeryValue,
        opioids,
        nrsPreop,
        pcsTotal: sumScores(pcsScores),
        passTotal: sumScores(passScores),
        csiTotal: sumScores(csiScores),
        distressThermometer: distressScore ?? 0,
        painOtherSites,
        insomniaPresent,
        smoking,
        frailty: fragilityPresent,
      },
    });
    setCalculating(false);
    if (error || data?.error) {
      const msg = resolveScoreErrorMessage(error, data);
      setScoreError(msg);
      Alert.alert('Errore calcolo', msg);
      return;
    }
    const updated = { pct: data.pct, level: data.level as RiskLevel, version: data.version };
    setResult(updated);
    await supabase.from('cpsp_assessments').update({
      cpsp_risk_pct: updated.pct,
      cpsp_risk_level: updated.level,
    }).eq('id', assessmentId);
    setPendingSaveId(null);
    Alert.alert('Punteggio aggiornato', `Rischio CPSP: ${updated.pct}% (${updated.level})`);
    resetAssessmentForm();
    setShowAssessmentForm(false);
    loadData();
  };

  const handleSaveAssessment = async () => {
    setSaving(true);
    const pcsTotal = sumScores(pcsScores);
    const passTotal = sumScores(passScores);
    const csiTotal = sumScores(csiScores);
    const bmiVal = bmiText.trim() !== '' ? parseFloat(bmiText) : null;
    const payload = {
      surgery_type: surgeryValue,
      opioid_use_preop: opioids,
      opioid_ome_mg_day: opioidOme.trim() !== '' ? parseFloat(opioidOme) : null,
      opioid_duration_weeks: opioidWeeks.trim() !== '' ? parseInt(opioidWeeks) : null,
      preop_nrs: nrsPreop,
      pcs_answers: pcsScores,
      pcs_score: pcsTotal,
      pass_answers: passScores,
      pass_score: passTotal,
      csi_answers: csiScores,
      csi_score: csiTotal,
      cpsp_risk_pct: result?.pct ?? null,
      cpsp_risk_level: result?.level ?? null,
      // Screening Clinico Core
      pain_other_sites: painOtherSites,
      pain_other_sites_nrs: painOtherSites ? painOtherSitesNrs : null,
      insomnia_present: insomniaPresent,
      insomnia_severity: insomniaPresent ? insomniaSeverity : null,
      distress_thermometer: distressScore,
      smoking,
      alcohol_risk: alcohol,
      frailty: fragilityPresent,
      bmi: bmiVal,
      age: anagrAge ?? (patientAge.trim() !== '' ? parseInt(patientAge) : null),
      sex: anagrSex ?? patientSex,
      concern_about_surgery: concernSurgery,
      surgery_duration_minutes: surgeryDurationMin.trim() !== '' ? parseInt(surgeryDurationMin) : null,
      regional_anesthesia: regionalAnesthesia,
      regional_anesthesia_type: regionalAnesthesia ? (regionalAnesthesiaType || null) : null,
    };
    const { data: saveData, error: saveError } = await svcSaveAssessment(
      supabase,
      editingAssessmentId
        ? payload
        : { ...payload, patient_id: patientId, tenant_id: tenantId, recorded_by: profile?.id, surgery_date: null, notes: null },
      editingAssessmentId,
    );
    setSaving(false);
    if (saveError) {
      Alert.alert('Errore', saveError.message);
      return;
    }
    const savedId: string = editingAssessmentId ?? (saveData as any)?.id;
    if (result === null) {
      setPendingSaveId(savedId);
      Alert.alert(
        'Salvato senza punteggio',
        'I dati sono stati salvati.\n\nIl punteggio CPSP non è ancora calcolato. Premi "Riprova calcolo" per calcolarlo ora.',
        [
          { text: 'Chiudi', style: 'cancel', onPress: () => { resetAssessmentForm(); setShowAssessmentForm(false); loadData(); } },
          { text: 'Riprova calcolo', onPress: () => retryScore(savedId) },
        ],
      );
    } else {
      Alert.alert('Salvato', editingAssessmentId ? 'Valutazione aggiornata' : 'Valutazione CPSP salvata con successo');
      resetAssessmentForm();
      setShowAssessmentForm(false);
      loadData();
    }
  };

  const handleCalculatePod1 = (preopPct: number) => {
    if (pod1NrsRest === null) return Alert.alert('Attenzione', 'Inserisci NRS riposo POD1');
    if (pod1NrsMovement === null) return Alert.alert('Attenzione', 'Inserisci NRS movimento POD1');
    const ome = pod1OmeText.trim() !== '' ? parseFloat(pod1OmeText) : null;
    setPod1DynResult(calcDynamicRisk(preopPct, pod1NrsRest, pod1NrsMovement, ome));
  };

  const handleSavePod1 = async (assessmentId: string) => {
    if (!pod1DynResult) return;
    setSavingPod1(true);
    const ome = pod1OmeText.trim() !== '' ? parseFloat(pod1OmeText) : null;
    const { error } = await supabase.from('cpsp_assessments').update({
      pod1_nrs_rest:      pod1NrsRest,
      pod1_nrs_movement:  pod1NrsMovement,
      pod1_opioid_ome:    ome,
      pod1_assessed_at:   new Date().toISOString(),
      risk_score_dynamic: pod1DynResult.pct,
      risk_pct_dynamic:   pod1DynResult.pct,
      risk_level_dynamic: pod1DynResult.level,
      risk_delta:         pod1DynResult.delta,
    }).eq('id', assessmentId);
    setSavingPod1(false);
    if (error) {
      Alert.alert('Errore', error.message);
    } else {
      Alert.alert('Salvato', 'Aggiornamento POD1 salvato');
      setPod1ModalId(null);
      setPod1NrsRest(null);
      setPod1NrsMovement(null);
      setPod1OmeText('');
      setPod1DynResult(null);
      loadData();
    }
  };

  const openNrsDayModal = (assessmentId: string, podDay: number, existing: any | null) => {
    setNdNrsRest(existing?.nrs_rest ?? null);
    setNdNrsMovement(existing?.nrs_movement ?? null);
    setNdPainInterference(existing?.pain_interference ?? null);
    setNdSleepQuality(existing?.sleep_quality ?? null);
    setNdMoodScore(existing?.mood_score ?? null);
    setNdUsingOpioids(existing?.using_opioids ?? existing?.analgesics_used ?? false);
    setNrsDayModal({ assessmentId, podDay, existingId: existing?.id ?? null });
  };

  const handleSaveNrsDay = async () => {
    if (!nrsDayModal || ndNrsRest === null) {
      Alert.alert('Attenzione', 'NRS a riposo obbligatorio');
      return;
    }
    setSavingNrsDay(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      assessment_id: nrsDayModal.assessmentId,
      patient_id: patientId,
      tenant_id: tenantId,
      pod_day: nrsDayModal.podDay,
      nrs_rest: ndNrsRest,
      nrs_movement: ndNrsMovement,
      pain_interference: ndPainInterference,
      sleep_quality: ndSleepQuality,
      mood_score: ndMoodScore,
      using_opioids: ndUsingOpioids,
      source: 'clinician',
      recorded_by: user?.id ?? null,
      recorded_at: new Date().toISOString(),
    };
    let error;
    if (nrsDayModal.existingId) {
      ({ error } = await supabase.from('cpsp_nrs_daily').update(payload).eq('id', nrsDayModal.existingId));
    } else {
      ({ error } = await supabase.from('cpsp_nrs_daily').insert(payload));
    }
    setSavingNrsDay(false);
    if (error) { Alert.alert('Errore', error.message); return; }
    setNrsDayModal(null);
    loadData();
  };

  const handleSaveFollowup = async () => {
    if (fpPainPresent === null) return Alert.alert('Attenzione', 'Indica se il paziente ha dolore');
    setSavingFp(true);
    const dn4Score = fpDn4.filter(v => v === true).length;
    const earlyNeuropathicScore = [fpEarlyNeuroBurning, fpEarlyNeuroElectric, fpEarlyNeuroAllodynia, fpEarlyNeuroCold].filter(Boolean).length;
    const payload = {
      // ── Timing ──────────────────────────────────────────────────────────
      followup_months:                  Number(fpMonths),
      followup_date:                    fpDate || new Date().toISOString().split('T')[0],
      // ── BOOLEAN fields ──────────────────────────────────────────────────
      pain_present:                     Boolean(fpPainPresent),
      dn4_neuropathic:                  dn4Score >= 4,
      cpsp_confirmed:                   Boolean(fpCpspConfirmed),
      referral_pain_center:             Boolean(fpPainCenter),
      referral_aps:                     false,
      cpsp_diag_pain_present:           Boolean(cpspCriteria[0]),
      cpsp_diag_site_correlated:        Boolean(cpspCriteria[1]),
      cpsp_diag_duration_3m:            Boolean(cpspCriteria[2]),
      cpsp_alternative_excluded:        Boolean(cpspCriteria[3]),
      oncologic_patient:                Boolean(cpspExclusions[0]),
      oncologic_recurrence_excluded:    Boolean(!cpspExclusions[0]),
      infection_excluded:               Boolean(!cpspExclusions[1]),
      hardware_complication_excluded:   Boolean(!cpspExclusions[2]),
      crps_suspected:                   Boolean(cpspExclusions[3]),
      early_neuropathic_burning:        Boolean(fpEarlyNeuroBurning),
      early_neuropathic_electric:       Boolean(fpEarlyNeuroElectric),
      early_neuropathic_allodynia:      Boolean(fpEarlyNeuroAllodynia),
      early_neuropathic_cold:           Boolean(fpEarlyNeuroCold),
      opioid_use_followup:              Boolean(fpOpioidUsePostop && fpOpioidUsePostop !== 'none'),
      // ── INTEGER fields ──────────────────────────────────────────────────
      pain_nrs_current:                 parseInt(String(fpNrs ?? 0)) || 0,
      pain_nrs_rest:                    fpNrsRest !== null ? parseInt(String(fpNrsRest)) : null,
      pain_nrs_movement:                fpNrsMovement !== null ? parseInt(String(fpNrsMovement)) : null,
      dn4_score:                        parseInt(String(dn4Score)) || 0,
      eq5d_mobility:                    parseInt(String(fpEq5d[0] ?? 0)) || 0,
      eq5d_self_care:                   parseInt(String(fpEq5d[1] ?? 0)) || 0,
      eq5d_usual_activities:            parseInt(String(fpEq5d[2] ?? 0)) || 0,
      eq5d_pain:                        parseInt(String(fpEq5d[3] ?? 0)) || 0,
      eq5d_anxiety:                     parseInt(String(fpEq5d[4] ?? 0)) || 0,
      eq5d_vas:                         parseInt(String(fpEqVas ?? 0)) || 0,
      phq9_answers:                     phq9Answers,
      phq9_score:                       phq9Score,
      gad7_answers:                     gad7Answers,
      gad7_score:                       gad7Score,
      neup_sig_step:                    parseInt(String(neupsigDocStep)) || 0,
      early_neuropathic_score:          parseInt(String(earlyNeuropathicScore)) || 0,
      bpi_general_activity:             parseInt(String(fpBpi[0] ?? 0)) || 0,
      bpi_mood:                         parseInt(String(fpBpi[1] ?? 0)) || 0,
      bpi_walking:                      parseInt(String(fpBpi[2] ?? 0)) || 0,
      bpi_work:                         parseInt(String(fpBpi[3] ?? 0)) || 0,
      bpi_relations:                    parseInt(String(fpBpi[4] ?? 0)) || 0,
      bpi_sleep:                        parseInt(String(fpBpi[5] ?? 0)) || 0,
      bpi_enjoyment:                    parseInt(String(fpBpi[6] ?? 0)) || 0,
      opioid_days_last14:               parseInt(fpOpioidDaysLast14) || 0,
      // ── DECIMAL fields ──────────────────────────────────────────────────
      fu_opioid_ome:                    fpOpioidOmePostop.trim() !== '' ? parseFloat(fpOpioidOmePostop) || null : null,
      opioid_ome_followup:              fpOpioidOmePostop.trim() !== '' ? parseFloat(fpOpioidOmePostop) || null : null,
      // ── Other valid fields ───────────────────────────────────────────────
      dn4_answers:                      fpDn4,
      current_therapy:                  fpTherapy || null,
      fas_score:                        fpFas ?? null,
      neup_sig_drug:                    neupsigDocDrug || null,
      pain_trajectory_score:            (() => {
        const earlyCount = [fpEarlyNeuroBurning, fpEarlyNeuroElectric, fpEarlyNeuroAllodynia, fpEarlyNeuroCold].filter(Boolean).length;
        const dn4Count   = fpDn4.filter(v => v === true).length;
        const base       = fpNrs ?? 0;
        const earlyBonus = earlyCount >= 2 ? 2 : earlyCount === 1 ? 0.5 : 0;
        const dn4Bonus   = dn4Count >= 2 ? 1 : 0;
        return Math.min(10, Math.round((base + earlyBonus + dn4Bonus) * 10) / 10);
      })(),
      notes:                            null,
    };
    const { error } = await svcSaveFollowup(
      supabase,
      editingFollowupId
        ? payload
        : {
            ...payload,
            patient_id: patientId,
            assessment_id: fpAssessmentId ?? (assessments.length > 0 ? assessments[0].id : null),
            tenant_id: tenantId,
            recorded_by: profile?.id,
          },
      editingFollowupId,
    );
    setSavingFp(false);
    if (error) {
      Alert.alert('Errore', error.message);
    } else {
      Alert.alert('Salvato', editingFollowupId ? 'Follow-up aggiornato' : 'Follow-up salvato con successo');
      setShowFollowupForm(false);
      setEditingFollowupId(null);
      setFpPainPresent(null); setFpNrs(null); setFpNrsRest(null); setFpNrsMovement(null);
      setFpShowAllBpi(false);
      setFpBpi(initScores(BPI_ITEMS.length));
      setFpDn4(new Array(DN4_ITEMS.length).fill(null));
      setFpEq5d(initScores(EQ5D_ITEMS.length));
      setFpEqVas(null); setFpTherapy('');
      setFpCpspConfirmed(null); setFpPainCenter(null);
      setFpFas(null); setFpOpioidUsePostop(null); setFpOpioidOmePostop('');
      setFpNeuropathicChecklist(new Array(5).fill(false));
      setFpEarlyNeuroBurning(false); setFpEarlyNeuroElectric(false);
      setFpEarlyNeuroAllodynia(false); setFpEarlyNeuroCold(false);
      setCpspDiagStep(1); setCpspCriteria(new Array(4).fill(false));
      setCpspExclusions(new Array(4).fill(false));
      setPhq9Answers(new Array(9).fill(0)); setGad7Answers(new Array(7).fill(0)); setFpOpioidDaysLast14('');
      setNeupsigDocStep(1); setNeupsigDocDrug('');
      setFpAssessmentId(null);
      loadData();
    }
  };

  // ── Patient anagrafica derived values ─────────────────────────────────────
  const anagrBmi = patientRecord?.weight_kg && patientRecord?.height_cm
    ? Math.round((patientRecord.weight_kg / Math.pow(patientRecord.height_cm / 100, 2)) * 10) / 10
    : null;
  const anagrAge = patientRecord?.date_of_birth
    ? Math.floor((new Date().getTime() - new Date(patientRecord.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;
  const anagrSex: 'M' | 'F' | null =
    patientRecord?.gender === 'M' || patientRecord?.gender === 'F' ? patientRecord.gender : null;
  const bmiFromAnagr = anagrBmi !== null;
  const bmiVal = bmiText.trim() !== '' ? parseFloat(bmiText) : null;
  const bmiColor = bmiVal === null ? Colors.textMuted
    : bmiVal < 18.5 ? '#0369A1'
    : bmiVal < 25   ? Colors.green
    : bmiVal < 30   ? Colors.yellow
    : Colors.red;
  const bmiLabel = bmiVal === null ? '—'
    : bmiVal < 18.5 ? 'Sottopeso'
    : bmiVal < 25   ? 'Normale'
    : bmiVal < 30   ? 'Sovrappeso'
    : 'Obesità';

  // ── Scale progress helpers ─────────────────────────────────────────────────

  const pcsTotal = sumScores(pcsScores);
  const passTotal = sumScores(passScores);
  const csiTotal = sumScores(csiScores);
  const pcsAnswered = pcsScores.filter(v => v !== null).length;
  const passAnswered = passScores.filter(v => v !== null).length;
  const csiAnswered = csiScores.filter(v => v !== null).length;

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
  );

  const riskConf = result ? RISK_CONFIG[result.level] : null;

  const qrUrl = qrToken ? `${QUESTIONNAIRE_BASE_URL}${qrToken}` : '';

  return (
    <SafeAreaView style={s.container}>

      {/* ── QR Modal ── */}
      <Modal
        visible={qrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModal(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setQrModal(false)}>
          <Pressable
            style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' }}
            onPress={() => {}}>

            {/* Status banner */}
            {qrStatus === 'completed' ? (
              <View style={{ backgroundColor: Colors.greenLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, alignSelf: 'stretch', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.green }}>
                  ✅ Questionario completato dal paziente
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: Colors.yellowLight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 16, alignSelf: 'stretch', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.yellow }}>
                  ⏳ In attesa di compilazione
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 16, textAlign: 'center' }}>
              📱 Questionario Paziente
            </Text>

            {/* QR Code */}
            {qrUrl !== '' && (
              <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, ...Shadow.sm }}>
                <QRCode value={qrUrl} size={200} />
              </View>
            )}

            {/* Link copiabile */}
            <TouchableOpacity
              style={{ backgroundColor: Colors.primaryLight, borderRadius: 10, paddingVertical: 10,
                paddingHorizontal: 14, alignSelf: 'stretch', marginBottom: 8 }}
              onPress={async () => {
                await Clipboard.setStringAsync(qrUrl);
                Alert.alert('✅ Copiato', 'Link copiato negli appunti');
              }}>
              <Text style={{ fontSize: 11, color: Colors.primary, textAlign: 'center', fontFamily: 'monospace' }}
                numberOfLines={2}>
                {qrUrl}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 4 }}>
                📋 Tocca per copiare il link
              </Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 16, textAlign: 'center' }}>
              🕐 Valido 7 giorni · Scales: PCS · PASS · CSI
            </Text>

            <TouchableOpacity
              style={{ backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12,
                alignSelf: 'stretch', alignItems: 'center' }}
              onPress={() => setQrModal(false)}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Chiudi</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── POD1 Dynamic Update Modal ── */}
      {assessments.map(a => {
        const preopPct = a.cpsp_risk_pct ?? 0;
        const preopRc  = RISK_CONFIG[a.cpsp_risk_level as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.basso;
        return (
          <Modal
            key={`pod1-${a.id}`}
            visible={pod1ModalId === a.id}
            transparent
            animationType="slide"
            onRequestClose={() => setPod1ModalId(null)}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
              onPress={() => setPod1ModalId(null)}>
              <Pressable
                style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 24, maxHeight: '90%' }}
                onPress={() => {}}>
                <ScrollView showsVerticalScrollIndicator={false}>

                  <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 }}>
                    📊 Aggiornamento Dinamico T1 — POD1
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 20 }}>
                    Il dolore acuto al POD1 è predittore indipendente di CPSP (BJA 2023)
                  </Text>

                  {/* NRS riposo POD1 */}
                  <Text style={[s.fieldLabel, { marginBottom: 6 }]}>NRS riposo POD1</Text>
                  <View style={s.nrsRow}>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                      const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : n <= 8 ? '#F97316' : Colors.red;
                      return (
                        <TouchableOpacity
                          key={n}
                          style={[s.nrsBtn, { borderColor: col }, pod1NrsRest === n && { backgroundColor: col }]}
                          onPress={() => { setPod1NrsRest(n); setPod1DynResult(null); }}>
                          <Text style={[s.nrsBtnText, { color: pod1NrsRest === n ? '#fff' : col }]}>{n}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* NRS movimento POD1 */}
                  <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 6 }]}>NRS movimento POD1</Text>
                  <View style={s.nrsRow}>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                      const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : n <= 8 ? '#F97316' : Colors.red;
                      return (
                        <TouchableOpacity
                          key={n}
                          style={[s.nrsBtn, { borderColor: col }, pod1NrsMovement === n && { backgroundColor: col }]}
                          onPress={() => { setPod1NrsMovement(n); setPod1DynResult(null); }}>
                          <Text style={[s.nrsBtnText, { color: pod1NrsMovement === n ? '#fff' : col }]}>{n}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* OME */}
                  <Text style={[s.fieldLabel, { marginTop: 14 }]}>OME mg/24h (opzionale)</Text>
                  <TextInput
                    style={[s.input, { marginTop: 4 }]}
                    placeholder="es. 30"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="numeric"
                    value={pod1OmeText}
                    onChangeText={v => { setPod1OmeText(v); setPod1DynResult(null); }}
                  />

                  {/* Calcola */}
                  <TouchableOpacity
                    style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 18 }}
                    onPress={() => handleCalculatePod1(preopPct)}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Calcola Rischio Aggiornato</Text>
                  </TouchableOpacity>

                  {/* Risultato */}
                  {pod1DynResult && (() => {
                    const dynRc = RISK_CONFIG[pod1DynResult.level];
                    const levelChanged = pod1DynResult.level !== a.cpsp_risk_level;
                    return (
                      <View style={{ marginTop: 18, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: dynRc.color }}>
                        <View style={{ backgroundColor: dynRc.bg, padding: 14 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 13, color: Colors.textMuted }}>
                              Rischio preop: <Text style={{ fontWeight: '700', color: preopRc.color }}>{preopPct}% ({preopRc.label})</Text>
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Text style={{ fontSize: 15, color: Colors.text, fontWeight: '700' }}>Rischio aggiornato:</Text>
                            <View style={{ backgroundColor: dynRc.color, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{pod1DynResult.pct}%</Text>
                            </View>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: dynRc.color }}>{dynRc.label}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: pod1DynResult.delta >= 0 ? Colors.red : Colors.green }}>
                            {pod1DynResult.delta >= 0 ? '▲' : '▼'} {pod1DynResult.delta >= 0 ? '+' : ''}{pod1DynResult.delta}%
                          </Text>
                          {levelChanged && (
                            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
                                ⚠️ Livello rischio aumentato a {dynRc.label}
                              </Text>
                            </View>
                          )}
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: dynRc.color, padding: 14, alignItems: 'center' }}
                          onPress={() => handleSavePod1(a.id)}
                          disabled={savingPod1}>
                          {savingPod1
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>💾 Salva Aggiornamento POD1</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    );
                  })()}

                  <TouchableOpacity
                    style={{ marginTop: 14, alignItems: 'center', paddingVertical: 10 }}
                    onPress={() => setPod1ModalId(null)}>
                    <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Annulla</Text>
                  </TouchableOpacity>

                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })}

      {/* ── NRS Day Clinician Entry Modal ── */}
      <Modal
        visible={nrsDayModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setNrsDayModal(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}
          onPress={() => setNrsDayModal(null)}>
          <Pressable
            style={{ backgroundColor: Colors.surface, borderRadius: 20, padding: 24, maxHeight: '92%' }}
            onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 4 }}>
                {nrsDayModal?.existingId ? '✏️' : '➕'} POD{nrsDayModal?.podDay} — Rilevazione clinica
              </Text>
              <Text style={{ fontSize: 12, color: Colors.textMuted, marginBottom: 20 }}>
                I dati inseriti dal clinico hanno priorità sulla fonte paziente
              </Text>

              {/* NRS riposo */}
              <Text style={[s.fieldLabel, { marginBottom: 6 }]}>NRS a riposo *</Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : n <= 8 ? '#F97316' : Colors.red;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, ndNrsRest === n && { backgroundColor: col }]}
                      onPress={() => setNdNrsRest(n)}>
                      <Text style={[s.nrsBtnText, { color: ndNrsRest === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* NRS movimento */}
              <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 6 }]}>NRS al movimento</Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : n <= 8 ? '#F97316' : Colors.red;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, ndNrsMovement === n && { backgroundColor: col }]}
                      onPress={() => setNdNrsMovement(n)}>
                      <Text style={[s.nrsBtnText, { color: ndNrsMovement === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Interferenza */}
              <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 6 }]}>Interferenza con attività (0–10)</Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 3 ? Colors.green : n <= 6 ? Colors.yellow : Colors.red;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, ndPainInterference === n && { backgroundColor: col }]}
                      onPress={() => setNdPainInterference(ndPainInterference === n ? null : n)}>
                      <Text style={[s.nrsBtnText, { color: ndPainInterference === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Qualità sonno */}
              <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 6 }]}>Qualità del sonno (0 = pessima → 10 = ottima)</Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 3 ? Colors.red : n <= 6 ? Colors.yellow : Colors.green;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, ndSleepQuality === n && { backgroundColor: col }]}
                      onPress={() => setNdSleepQuality(ndSleepQuality === n ? null : n)}>
                      <Text style={[s.nrsBtnText, { color: ndSleepQuality === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Umore */}
              <Text style={[s.fieldLabel, { marginTop: 14, marginBottom: 6 }]}>Umore (0 = molto negativo → 10 = molto positivo)</Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 3 ? Colors.red : n <= 6 ? Colors.yellow : Colors.green;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, ndMoodScore === n && { backgroundColor: col }]}
                      onPress={() => setNdMoodScore(ndMoodScore === n ? null : n)}>
                      <Text style={[s.nrsBtnText, { color: ndMoodScore === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Oppioidi/Analgesici */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18,
                  backgroundColor: ndUsingOpioids ? '#EDE9FE' : Colors.background,
                  borderRadius: 10, padding: 14, borderWidth: 1,
                  borderColor: ndUsingOpioids ? '#7C3AED' : Colors.border }}
                onPress={() => setNdUsingOpioids(v => !v)}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                  borderColor: ndUsingOpioids ? '#7C3AED' : Colors.textLight,
                  backgroundColor: ndUsingOpioids ? '#7C3AED' : 'transparent',
                  justifyContent: 'center', alignItems: 'center' }}>
                  {ndUsingOpioids && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, color: ndUsingOpioids ? '#7C3AED' : Colors.text, fontWeight: ndUsingOpioids ? '700' : '400' }}>
                  💊 Oppioidi / analgesici usati oggi
                </Text>
              </TouchableOpacity>

              {/* Save button */}
              <TouchableOpacity
                style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14,
                  alignItems: 'center', marginTop: 22 }}
                onPress={handleSaveNrsDay}
                disabled={savingNrsDay}>
                {savingNrsDay
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                      💾 {nrsDayModal?.existingId ? 'Aggiorna' : 'Salva'} POD{nrsDayModal?.podDay}
                    </Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: 14, alignItems: 'center', paddingVertical: 10 }}
                onPress={() => setNrsDayModal(null)}>
                <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Annulla</Text>
              </TouchableOpacity>

            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>🧠 CPSP Assessment</Text>
          <Text style={s.headerSub}>{patientName}</Text>
        </View>
      </View>

      {/* Section tabs */}
      <View style={s.sectionTabs}>
        <TouchableOpacity
          style={[s.sectionTab, section === 'valutazione' && s.sectionTabActive]}
          onPress={() => setSection('valutazione')}>
          <Text style={[s.sectionTabText, section === 'valutazione' && s.sectionTabTextActive]}>
            📋 Valutazione Preop
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.sectionTab, section === 'followup_cpsp' && s.sectionTabActive]}
          onPress={() => setSection('followup_cpsp')}>
          <Text style={[s.sectionTabText, section === 'followup_cpsp' && s.sectionTabTextActive]}>
            📅 Follow-up ({followups.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ══════════════════ VALUTAZIONE ══════════════════ */}
        {section === 'valutazione' && (
          <>
            {/* ── Lista valutazioni salvate ── */}
            {assessments.map((a, idx) => {
              const rc = RISK_CONFIG[a.cpsp_risk_level as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.basso;
              const isEditing = editingAssessmentId === a.id;
              const isExpanded = expandedAssessmentId === a.id;
              const surgLabel = SURGERY_TYPES.find(st => st.value === a.surgery_type)?.label ?? a.surgery_type ?? '—';
              const savedRecs = computeRecs(
                a.cpsp_risk_level,
                a.pcs_score ?? 0,
                a.pass_score ?? 0,
                a.csi_score ?? 0,
                a.opioid_use_preop ?? 'none',
                a.preop_nrs ?? null,
                a.distress_thermometer ?? null,
                a.insomnia_present ?? false,
                a.pain_other_sites ?? false,
              );
              return (
                <View key={a.id} style={[s.card, { borderLeftWidth: 3, borderLeftColor: rc.color }]}>
                  {/* Header row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.cardTitle, { marginBottom: 2 }]}>
                        {idx === 0 ? '📊 Ultima valutazione' : `📊 Valutazione ${assessments.length - idx}`}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>{surgLabel} · {new Date(a.created_at).toLocaleDateString('it-IT')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <TouchableOpacity style={s.editBtn} onPress={() => loadAssessmentForEdit(a)}>
                        <Text style={s.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.editBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => deleteAssessment(a.id)}>
                        <Text style={[s.editBtnText, { color: '#DC2626' }]}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Risk badge + score */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <View style={[s.riskBadgeSm, { backgroundColor: rc.bg }]}>
                      <Text style={[s.riskBadgeSmText, { color: rc.color }]}>{rc.label}</Text>
                    </View>
                    <Text style={{ fontSize: 13, color: Colors.textMuted }}>{a.cpsp_risk_pct}%</Text>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>
                      PCS {a.pcs_score ?? '?'}/52 · PASS {a.pass_score ?? '?'}/80 · CSI {a.csi_score ?? '?'}/100
                    </Text>
                  </View>

                  {/* Editing banner */}
                  {isEditing && (
                    <View style={{ backgroundColor: Colors.yellowLight, borderRadius: 6, padding: 6, marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: Colors.yellow, fontWeight: '700' }}>✏️ Stai modificando questa valutazione</Text>
                    </View>
                  )}

                  {/* Expand/collapse recommendations */}
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                    onPress={() => setExpandedAssessmentId(isExpanded ? null : a.id)}>
                    <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '700' }}>
                      {isExpanded ? '▲ Nascondi' : '▼ Raccomandazioni'} ({savedRecs.length})
                    </Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={{ marginTop: 8 }}>
                      {savedRecs.map((rec, i) => <RecCard key={i} rec={rec} />)}
                    </View>
                  )}

                  {/* QR / Token status */}
                  {tokenMap[a.id] ? (
                    <TouchableOpacity
                      style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: tokenMap[a.id].status === 'completed' ? Colors.greenLight : Colors.yellowLight,
                        borderRadius: 8, padding: 8 }}
                      onPress={() => handleGenerateQR(a.id)}>
                      <Text style={{ fontSize: 13 }}>
                        {tokenMap[a.id].status === 'completed' ? '✅' : '⏳'}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '600',
                        color: tokenMap[a.id].status === 'completed' ? Colors.green : Colors.yellow, flex: 1 }}>
                        {tokenMap[a.id].status === 'completed'
                          ? 'Questionario completato dal paziente'
                          : 'In attesa di compilazione – Mostra QR'}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted }}>📱</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                        gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 8, padding: 10 }}
                      onPress={() => handleGenerateQR(a.id)}
                      disabled={qrLoading}>
                      {qrLoading
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primary }}>
                            📱 Invia Questionario al Paziente
                          </Text>
                      }
                    </TouchableOpacity>
                  )}

                  {/* POD1 badge + button */}
                  {a.pod1_assessed_at ? (
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: RISK_CONFIG[a.risk_level_dynamic as keyof typeof RISK_CONFIG]?.bg ?? Colors.greenLight,
                      borderRadius: 10, padding: 10 }}>
                      <Text style={{ fontSize: 13 }}>📊</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700',
                          color: RISK_CONFIG[a.risk_level_dynamic as keyof typeof RISK_CONFIG]?.color ?? Colors.green }}>
                          POD1 aggiornato · {a.risk_pct_dynamic}% ({RISK_CONFIG[a.risk_level_dynamic as keyof typeof RISK_CONFIG]?.label ?? '—'})
                        </Text>
                        <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                          {a.risk_delta >= 0 ? '▲ +' : '▼ '}{a.risk_delta}% rispetto al preop
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={{ backgroundColor: Colors.primaryLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                        onPress={() => {
                          setPod1NrsRest(a.pod1_nrs_rest ?? null);
                          setPod1NrsMovement(a.pod1_nrs_movement ?? null);
                          setPod1OmeText(a.pod1_opioid_ome !== null && a.pod1_opioid_ome !== undefined ? String(a.pod1_opioid_ome) : '');
                          setPod1DynResult(null);
                          setPod1ModalId(a.id);
                        }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary }}>✏️</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
                        backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10 }}
                      onPress={() => {
                        setPod1NrsRest(null);
                        setPod1NrsMovement(null);
                        setPod1OmeText('');
                        setPod1DynResult(null);
                        setPod1ModalId(a.id);
                      }}>
                      <Text style={{ fontSize: 13 }}>⏳</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#92400E', flex: 1 }}>
                        POD1 in attesa — Aggiorna Rischio
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.primary }}>📊</Text>
                    </TouchableOpacity>
                  )}
                  {/* ── 📈 Traiettoria Prima Settimana ── */}
                  {(() => {
                    const daily = nrsDailyMap[a.id] || [];

                    // ── No data: show QR button ───────────────────────────────
                    if (daily.length === 0) {
                      const pdTok = pdTokenMap[a.id];
                      return (
                        <TouchableOpacity
                          style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
                            backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10,
                            borderWidth: 1, borderColor: '#BFDBFE', borderStyle: 'dashed' }}
                          onPress={() => handleGeneratePostDischargeQR(a.id)}
                          disabled={pdQrLoading}>
                          {pdQrLoading
                            ? <ActivityIndicator size="small" color="#2563EB" />
                            : <Text style={{ fontSize: 15 }}>{pdTok ? '📱' : '📱'}</Text>
                          }
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#1D4ED8' }}>
                              {pdTok
                                ? (pdTok.status === 'completed' ? '✅ Monitoraggio completato' : '⏳ Monitoraggio in corso — Mostra QR')
                                : '📈 Traiettoria Prima Settimana'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 1 }}>
                              {pdTok ? '' : 'Genera QR post-dimissione per monitorare il paziente'}
                            </Text>
                          </View>
                          {!pdTok && <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Genera →</Text>}
                        </TouchableOpacity>
                      );
                    }

                    // ── Data present: detailed trajectory ────────────────────
                    const maxNrs = Math.max(...daily.map((d: any) => Math.max(d.nrs_rest ?? 0, d.nrs_movement ?? 0)));
                    const avgNrs = Math.round(daily.reduce((s: number, d: any) => s + Math.max(d.nrs_rest ?? 0, d.nrs_movement ?? 0), 0) / daily.length * 10) / 10;
                    const lastDay = daily[daily.length - 1];
                    const trend = daily.length >= 2
                      ? (lastDay.nrs_rest ?? 0) - (daily[0].nrs_rest ?? 0)
                      : 0;

                    // Average secondary metrics (optional fields)
                    const avgInterference = daily.some((d: any) => d.pain_interference != null)
                      ? Math.round(daily.reduce((s: number, d: any) => s + (d.pain_interference ?? 0), 0) / daily.length * 10) / 10 : null;
                    const avgSleep = daily.some((d: any) => d.sleep_quality != null)
                      ? Math.round(daily.reduce((s: number, d: any) => s + (d.sleep_quality ?? 0), 0) / daily.length * 10) / 10 : null;
                    const avgMood = daily.some((d: any) => d.mood_score != null)
                      ? Math.round(daily.reduce((s: number, d: any) => s + (d.mood_score ?? 0), 0) / daily.length * 10) / 10 : null;
                    const opioidDays = daily.filter((d: any) => d.using_opioids === true || d.analgesics_used === true).length;

                    // Composite score /100
                    const baseScore = Math.round(avgNrs * 4);
                    const peakPenalty = maxNrs >= 7 ? 30 : maxNrs >= 4 ? 15 : 0;
                    const trendPenalty = trend > 2 ? 15 : trend > 0 ? 8 : 0;
                    const compositeScore = Math.min(100, baseScore + peakPenalty + trendPenalty);

                    const trajectoryColor = maxNrs >= 7 ? Colors.red : maxNrs >= 4 ? '#F97316' : Colors.green;
                    const trajectoryLabel = maxNrs >= 7 ? '🔴 Alto' : maxNrs >= 4 ? '🟠 Moderato' : '🟢 Basso';
                    const t2Pct = Math.min(100, (a.cpsp_risk_pct ?? 0) + (maxNrs >= 7 ? 15 : maxNrs >= 4 ? 8 : 0));
                    const t2Level = t2Pct < 25 ? 'basso' : t2Pct < 50 ? 'moderato' : t2Pct < 70 ? 'alto' : 'molto_alto';
                    const t2rc = RISK_CONFIG[t2Level as keyof typeof RISK_CONFIG];

                    const nrsEmoji = (n: number) => n >= 7 ? '😟' : n >= 4 ? '😐' : '😊';

                    return (
                      <View style={{ marginTop: 8, backgroundColor: '#F0F9FF', borderRadius: 10, padding: 10, borderLeftWidth: 3, borderLeftColor: '#0369A1' }}>
                        {/* Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#0369A1', flex: 1 }}>
                            📈 Traiettoria Prima Settimana
                          </Text>
                          <View style={{ backgroundColor: trajectoryColor, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{trajectoryLabel}</Text>
                          </View>
                        </View>

                        {/* Day-by-day list — all 7 POD days */}
                        <View style={{ gap: 4, marginBottom: 10 }}>
                          {[1, 2, 3, 4, 5, 6, 7].map((podNum) => {
                            const d = daily.find((r: any) => r.pod_day === podNum);
                            const src = d?.source ?? null;
                            const nrsMax = d ? Math.max(d.nrs_rest ?? 0, d.nrs_movement ?? 0) : null;
                            const dot = nrsMax != null
                              ? (nrsMax >= 7 ? Colors.red : nrsMax >= 4 ? '#F97316' : Colors.green)
                              : '#D1D5DB';
                            const rowBg = src === 'aps' ? '#EFF6FF' : src === 'patient_qr' ? '#F0FDF4' : '#F9FAFB';
                            const sourceBadge = src === 'aps' ? '🏥' : src === 'patient_qr' ? '📱' : '⬜';
                            const sourceColor = src === 'aps' ? '#1D4ED8' : src === 'patient_qr' ? '#16A34A' : '#9CA3AF';
                            return (
                              <View key={podNum} style={{ flexDirection: 'row', alignItems: 'center', gap: 6,
                                backgroundColor: rowBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: dot,
                                  justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>P{podNum}</Text>
                                </View>
                                <Text style={{ fontSize: 12, color: d ? Colors.text : '#9CA3AF', flex: 1 }}>
                                  {d
                                    ? `${nrsEmoji(nrsMax!)} NRS ${d.nrs_rest ?? '?'}/${d.nrs_movement ?? '?'}${d.pain_interference != null ? `  |  Int. ${d.pain_interference}` : ''}`
                                    : 'Dato mancante'}
                                </Text>
                                <Text style={{ fontSize: 11, color: sourceColor }}>{sourceBadge}</Text>
                                {(d?.using_opioids || d?.analgesics_used) && (
                                  <Text style={{ fontSize: 10, color: '#7C3AED' }}>💊</Text>
                                )}
                                <TouchableOpacity
                                  onPress={() => openNrsDayModal(a.id, podNum, d ?? null)}
                                  style={{ backgroundColor: d ? '#EFF6FF' : '#F0FDF4', borderRadius: 6,
                                    paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1,
                                    borderColor: d ? '#BFDBFE' : '#BBF7D0' }}>
                                  <Text style={{ fontSize: 11, color: d ? '#1D4ED8' : '#16A34A', fontWeight: '700' }}>
                                    {d ? '✏️' : '➕'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                        </View>

                        {/* Composite score */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
                          backgroundColor: '#E0F2FE', borderRadius: 8, padding: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, color: '#0369A1', fontWeight: '700', marginBottom: 2 }}>SCORE COMPOSITO</Text>
                            <View style={{ height: 6, backgroundColor: '#BAE6FD', borderRadius: 3, overflow: 'hidden' }}>
                              <View style={{ height: '100%', width: `${compositeScore}%`, backgroundColor: trajectoryColor, borderRadius: 3 }} />
                            </View>
                          </View>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: trajectoryColor }}>{compositeScore}<Text style={{ fontSize: 11, fontWeight: '400' }}>/100</Text></Text>
                        </View>

                        {/* Averages row */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          <StatPill label="NRS medio" value={`${avgNrs}`} />
                          <StatPill label={`${daily.length} giorni`} value={`Trend ${trend > 0 ? `▲+${trend}` : trend < 0 ? `▼${trend}` : '→'}`} />
                          {avgInterference !== null && <StatPill label="Interferenza" value={String(avgInterference)} />}
                          {avgSleep !== null && <StatPill label="Sonno" value={String(avgSleep)} />}
                          {avgMood !== null && <StatPill label="Umore" value={String(avgMood)} />}
                          {opioidDays > 0 && <StatPill label="Oppioidi" value={`${opioidDays}gg`} color="#7C3AED" />}
                        </View>

                        {/* T2 Risk */}
                        <View style={{ backgroundColor: t2rc.bg, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 10, color: t2rc.color, fontWeight: '700' }}>RISCHIO T2 (3 mesi)</Text>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: t2rc.color }}>{t2Pct}%<Text style={{ fontSize: 11, fontWeight: '400' }}> {t2rc.label}</Text></Text>
                          </View>
                          {t2Pct > (a.cpsp_risk_pct ?? 0) && (
                            <Text style={{ fontSize: 11, fontWeight: '700', color: t2rc.color }}>
                              ▲ +{t2Pct - (a.cpsp_risk_pct ?? 0)}% dal preop
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })()}
                </View>
              );
            })}

            {/* ── Pulsante Nuova Valutazione ── */}
            {!showAssessmentForm && (
              <TouchableOpacity
                style={[s.addFollowupBtn, { backgroundColor: Colors.primaryDark }]}
                onPress={handleNewAssessment}>
                <Text style={s.addFollowupBtnText}>+ Nuova Valutazione</Text>
              </TouchableOpacity>
            )}

            {/* ── Form nuova / modifica valutazione ── */}
            {showAssessmentForm && (
              <>
                {/* Header form */}
                <View style={[s.card, { backgroundColor: editingAssessmentId ? Colors.yellowLight : Colors.primaryLight, borderLeftWidth: 3, borderLeftColor: editingAssessmentId ? Colors.yellow : Colors.primary }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={s.cardTitle}>{editingAssessmentId ? '✏️ Modifica valutazione' : '➕ Nuova valutazione'}</Text>
                    <TouchableOpacity style={s.editBtn} onPress={() => { resetAssessmentForm(); setShowAssessmentForm(false); }}>
                      <Text style={s.editBtnText}>✕ Annulla</Text>
                    </TouchableOpacity>
                  </View>
                </View>

            {/* Dati anagrafici */}
            <View style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                <Text style={s.cardTitle}>👤 Dati paziente</Text>
                {(anagrAge !== null || anagrSex !== null || bmiFromAnagr) && (
                  <View style={{ backgroundColor: Colors.greenLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.green }}>Da anagrafica</Text>
                  </View>
                )}
                {!patientRecord?.weight_kg || !patientRecord?.height_cm ? (
                  <TouchableOpacity onPress={() => Alert.alert(
                    'Dati mancanti',
                    'Aggiungi peso e altezza nell\'anagrafica del paziente per calcolare il BMI automaticamente.'
                  )}>
                    <Text style={{ fontSize: 11, color: Colors.yellow }}>⚠️ BMI mancante</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Età */}
                <View style={{ flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 2 }}>Età</Text>
                  {anagrAge !== null ? (
                    <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text }}>{anagrAge} <Text style={{ fontSize: 12, fontWeight: '400' }}>anni</Text></Text>
                  ) : (
                    <TextInput
                      style={[s.input, { marginBottom: 0 }]}
                      placeholder="es. 65"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numeric"
                      value={patientAge}
                      onChangeText={setPatientAge}
                    />
                  )}
                </View>

                {/* Sesso */}
                <View style={{ flex: 1, backgroundColor: Colors.background, borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 6 }}>Sesso</Text>
                  {anagrSex !== null ? (
                    <View style={{ backgroundColor: Colors.primaryLight, borderRadius: 6, paddingVertical: 4, alignItems: 'center' }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.primary }}>{anagrSex}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {(['M', 'F'] as const).map(s_ => (
                        <TouchableOpacity key={s_} style={[s.chip, { flex: 1 }, patientSex === s_ && s.chipActive]} onPress={() => setPatientSex(s_)}>
                          <Text style={[s.chipText, patientSex === s_ && s.chipTextActive]}>{s_}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* BMI */}
                <View style={{ flex: 1.2, backgroundColor: Colors.background, borderRadius: 8, padding: 10 }}>
                  <Text style={{ fontSize: 10, color: Colors.textMuted, marginBottom: 2 }}>BMI</Text>
                  {bmiFromAnagr ? (
                    <>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: bmiColor }}>{anagrBmi}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: bmiColor }}>{bmiLabel}</Text>
                    </>
                  ) : (
                    <TextInput
                      style={[s.input, { marginBottom: 0 }]}
                      placeholder="kg/m²"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numeric"
                      value={bmiText}
                      onChangeText={setBmiText}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* Surgery type */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🔪 Tipo di intervento</Text>
              <View style={s.chipRow}>
                {SURGERY_TYPES.map(surg => (
                  <TouchableOpacity
                    key={surg.value}
                    style={[s.chip, surgeryValue === surg.value && s.chipActive]}
                    onPress={() => setSurgeryValue(surg.value)}>
                    <Text style={[s.chipText, surgeryValue === surg.value && s.chipTextActive]}>
                      {surg.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Opioid use */}
            <View style={s.card}>
              <Text style={s.cardTitle}>💊 Uso oppioidi preoperatorio</Text>
              <View style={s.chipRow}>
                {([
                  { v: 'none' as const, label: 'Nessuno', sub: '+0 pt' },
                  { v: 'intermittent' as const, label: 'Intermittente', sub: '+15 pt' },
                  { v: 'chronic' as const, label: 'Cronico', sub: '+30 pt' },
                ]).map(opt => (
                  <TouchableOpacity
                    key={opt.v}
                    style={[s.chip, { flex: 1 }, opioids === opt.v && s.chipActive]}
                    onPress={() => setOpioids(opt.v)}>
                    <Text style={[s.chipText, opioids === opt.v && s.chipTextActive]}>{opt.label}</Text>
                    <Text style={[s.chipSub, opioids === opt.v && { color: 'rgba(255,255,255,0.8)' }]}>{opt.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {opioids !== 'none' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>OME mg/die</Text>
                    <TextInput
                      style={s.input}
                      placeholder="es. 30"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numeric"
                      value={opioidOme}
                      onChangeText={setOpioidOme}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Durata (settimane)</Text>
                    <TextInput
                      style={s.input}
                      placeholder="es. 12"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numeric"
                      value={opioidWeeks}
                      onChangeText={setOpioidWeeks}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* NRS preop */}
            <View style={s.card}>
              <Text style={s.cardTitle}>📊 Dolore NRS preoperatorio</Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : n <= 8 ? Colors.yellow : Colors.red;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, nrsPreop === n && { backgroundColor: col }]}
                      onPress={() => setNrsPreop(n)}>
                      <Text style={[s.nrsBtnText, { color: nrsPreop === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Preoccupazione per chirurgia */}
              <Text style={[s.fieldLabel, { marginTop: 14 }]}>
                Preoccupazione per l'intervento (0=per niente, 10=moltissimo)
              </Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n <= 3 ? Colors.green : n <= 6 ? Colors.yellow : Colors.red;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[s.nrsBtn, { borderColor: col }, concernSurgery === n && { backgroundColor: col }]}
                      onPress={() => setConcernSurgery(n)}>
                      <Text style={[s.nrsBtnText, { color: concernSurgery === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Dati Intraoperatori ── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🏥 Dati Intraoperatori</Text>

              {autoPopulatedFromIntervention && (
                <View style={s.autofillBanner}>
                  <Text style={s.autofillBannerText}>
                    ℹ️ Dati pre-compilati dall'ultimo intervento registrato — modificabili
                  </Text>
                </View>
              )}

              <Text style={s.fieldLabel}>Durata intervento (minuti)</Text>
              <TextInput
                style={s.input}
                placeholder="es. 90"
                placeholderTextColor={Colors.textLight}
                keyboardType="numeric"
                value={surgeryDurationMin}
                onChangeText={setSurgeryDurationMin}
              />

              <Text style={[s.fieldLabel, { marginTop: 12 }]}>Anestesia regionale?</Text>
              <View style={s.chipRow}>
                <TouchableOpacity style={[s.chip, { flex: 1 }, !regionalAnesthesia && s.chipActive]}
                  onPress={() => { setRegionalAnesthesia(false); setRegionalAnesthesiaType(''); }}>
                  <Text style={[s.chipText, !regionalAnesthesia && s.chipTextActive]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.chip, { flex: 1 }, regionalAnesthesia && s.chipActive]}
                  onPress={() => setRegionalAnesthesia(true)}>
                  <Text style={[s.chipText, regionalAnesthesia && s.chipTextActive]}>Sì</Text>
                </TouchableOpacity>
              </View>

              {regionalAnesthesia && (
                <>
                  <Text style={[s.fieldLabel, { marginTop: 10 }]}>Tipo di blocco</Text>
                  <View style={s.chipRow}>
                    {['SAB/Spinale','Epidurale','FNB','ACB','FICB','SNB','ISB','Sovraclavicolare','TAP','Altro'].map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[s.chip, regionalAnesthesiaType === t && s.chipActive]}
                        onPress={() => setRegionalAnesthesiaType(t)}>
                        <Text style={[s.chipText, regionalAnesthesiaType === t && s.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* ── Screening Clinico Core ── */}
            <View style={s.card}>
              <Text style={s.cardTitle}>🩺 Screening Clinico Core</Text>

              {/* Dolore altre sedi */}
              <Text style={s.fieldLabel}>Dolore in altre sedi corporee?</Text>
              <View style={s.chipRow}>
                <TouchableOpacity style={[s.chip, { flex: 1 }, !painOtherSites && s.chipActive]} onPress={() => { setPainOtherSites(false); setPainOtherSitesNrs(null); }}>
                  <Text style={[s.chipText, !painOtherSites && s.chipTextActive]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.chip, { flex: 1 }, painOtherSites && s.chipActive]} onPress={() => setPainOtherSites(true)}>
                  <Text style={[s.chipText, painOtherSites && s.chipTextActive]}>Sì</Text>
                </TouchableOpacity>
              </View>
              {painOtherSites && (
                <>
                  <Text style={s.fieldLabel}>NRS dolore altra sede (0–10)</Text>
                  <View style={s.nrsRow}>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                      const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : n <= 8 ? Colors.yellow : Colors.red;
                      return (
                        <TouchableOpacity key={n} style={[s.nrsBtn, { borderColor: col }, painOtherSitesNrs === n && { backgroundColor: col }]} onPress={() => setPainOtherSitesNrs(n)}>
                          <Text style={[s.nrsBtnText, { color: painOtherSitesNrs === n ? '#fff' : col }]}>{n}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Insonnia */}
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>Insonnia preoperatoria?</Text>
              <View style={s.chipRow}>
                <TouchableOpacity style={[s.chip, { flex: 1 }, !insomniaPresent && s.chipActive]} onPress={() => { setInsomniaPresent(false); setInsomniaSeverity(null); }}>
                  <Text style={[s.chipText, !insomniaPresent && s.chipTextActive]}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.chip, { flex: 1 }, insomniaPresent && s.chipActive]} onPress={() => setInsomniaPresent(true)}>
                  <Text style={[s.chipText, insomniaPresent && s.chipTextActive]}>Sì</Text>
                </TouchableOpacity>
              </View>
              {insomniaPresent && (
                <>
                  <Text style={s.fieldLabel}>Severità insonnia (0=nessuna, 10=grave)</Text>
                  <View style={s.nrsRow}>
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                      <TouchableOpacity key={n} style={[s.nrsBtn, { borderColor: Colors.primary }, insomniaSeverity === n && { backgroundColor: Colors.primary }]} onPress={() => setInsomniaSeverity(n)}>
                        <Text style={[s.nrsBtnText, { color: insomniaSeverity === n ? '#fff' : Colors.primary }]}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Distress Thermometer */}
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>
                Distress Thermometer (0–10){distressScore !== null && distressScore >= 7 ? ' ⚠️' : ''}
              </Text>
              <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 6 }}>
                0 = nessun distress · 10 = distress estremo · soglia clinica ≥7
              </Text>
              <View style={s.nrsRow}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                  const col = n < 4 ? Colors.green : n < 7 ? Colors.yellow : Colors.red;
                  return (
                    <TouchableOpacity key={n} style={[s.nrsBtn, { borderColor: col }, distressScore === n && { backgroundColor: col }]} onPress={() => setDistressScore(n)}>
                      <Text style={[s.nrsBtnText, { color: distressScore === n ? '#fff' : col }]}>{n}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {distressScore !== null && distressScore >= 7 && (
                <View style={{ backgroundColor: '#FFF3E0', borderRadius: 6, padding: 6, marginTop: 4 }}>
                  <Text style={{ fontSize: 12, color: '#E65100', fontWeight: '700' }}>⚠️ DT≥7: valutazione psicologica preoperatoria indicata</Text>
                </View>
              )}

              {/* Fattori modificabili */}
              <Text style={[s.fieldLabel, { marginTop: 10 }]}>Fattori modificabili</Text>
              <View style={{ gap: 8 }}>
                {(
                  [
                    { key: 'smoking',   label: '🚬 Fumo attivo',           val: smoking,          onNo: () => setSmoking(false),          onSi: () => setSmoking(true) },
                    { key: 'alcohol',   label: '🍺 Alcol (>14 unità/sett.)', val: alcohol,          onNo: () => setAlcohol(false),          onSi: () => setAlcohol(true) },
                    { key: 'fragility', label: '🧓 Fragilità clinica',      val: fragilityPresent, onNo: () => setFragilityPresent(false), onSi: () => setFragilityPresent(true) },
                  ]
                ).map(item => (
                  <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 13, color: Colors.text, flex: 1 }}>{item.label}</Text>
                    <View style={s.chipRow}>
                      <TouchableOpacity style={[s.chip, { paddingHorizontal: 14, paddingVertical: 6 }, !item.val && s.chipActive]} onPress={item.onNo}>
                        <Text style={[s.chipText, !item.val && s.chipTextActive]}>No</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.chip, { paddingHorizontal: 14, paddingVertical: 6 }, item.val && s.chipActive]} onPress={item.onSi}>
                        <Text style={[s.chipText, item.val && s.chipTextActive]}>Sì</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {/* BMI summary (read from dati paziente card) */}
                {bmiVal !== null && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, color: Colors.text, flex: 1 }}>⚖️ BMI</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: bmiColor }}>{bmiVal} kg/m²</Text>
                    <View style={{ backgroundColor: bmiColor + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: bmiColor }}>{bmiLabel}</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Scale tabs */}
            <View style={s.card}>
              <View style={s.scaleTabs}>
                {([
                  { key: 'pcs' as const, label: 'PCS', answered: pcsAnswered, total: PCS_ITEMS.length, score: pcsTotal, max: 52 },
                  { key: 'pass' as const, label: 'PASS', answered: passAnswered, total: PASS_ITEMS.length, score: passTotal, max: 80 },
                  { key: 'csi' as const, label: 'CSI', answered: csiAnswered, total: CSI_ITEMS.length, score: csiTotal, max: 100 },
                ]).map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.scaleTab, scaleTab === t.key && s.scaleTabActive]}
                    onPress={() => setScaleTab(t.key)}>
                    <Text style={[s.scaleTabLabel, scaleTab === t.key && s.scaleTabLabelActive]}>{t.label}</Text>
                    <Text style={[s.scaleTabMeta, scaleTab === t.key && { color: '#fff' }]}>
                      {t.answered}/{t.total} · {t.score}/{t.max}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scale description */}
              <Text style={s.scaleDesc}>
                {scaleTab === 'pcs' && 'Scale di catastrofizzazione del dolore · 13 item · 0=Per niente  4=Sempre'}
                {scaleTab === 'pass' && 'Ansia da dolore · 20 item · 0=Mai  4=Sempre'}
                {scaleTab === 'csi' && 'Sensitizzazione centrale · 25 item · 0=Mai  4=Sempre/Quasi sempre'}
              </Text>

              {/* Score legend */}
              <View style={s.legendRow}>
                {[0,1,2,3,4].map(v => (
                  <View key={v} style={s.legendItem}>
                    <View style={[s.legendBtn, { borderColor: Colors.primary }]}>
                      <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '700' }}>{v}</Text>
                    </View>
                    <Text style={s.legendLabel}>
                      {v === 0 ? 'Mai' : v === 1 ? 'Raramente' : v === 2 ? 'A volte' : v === 3 ? 'Spesso' : 'Sempre'}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Items */}
              {(scaleTab === 'pcs' ? PCS_ITEMS : scaleTab === 'pass' ? PASS_ITEMS : CSI_ITEMS).map((item, idx) => {
                const scores = scaleTab === 'pcs' ? pcsScores : scaleTab === 'pass' ? passScores : csiScores;
                const setScores = scaleTab === 'pcs' ? setPcsScores : scaleTab === 'pass' ? setPassScores : setCsiScores;
                const val = scores[idx];
                return (
                  <View key={idx} style={[s.itemRow, idx % 2 === 0 && { backgroundColor: Colors.background }]}>
                    <Text style={s.itemNum}>{idx + 1}</Text>
                    <Text style={s.itemText}>{item}</Text>
                    <View style={s.itemBtns}>
                      {[0,1,2,3,4].map(v => (
                        <TouchableOpacity
                          key={v}
                          style={[s.itemBtn, val === v && s.itemBtnActive]}
                          onPress={() => {
                            const next = [...scores];
                            next[idx] = v;
                            setScores(next);
                          }}>
                          <Text style={[s.itemBtnText, val === v && s.itemBtnTextActive]}>{v}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Calculate button */}
            <TouchableOpacity style={[s.calcBtn, calculating && { opacity: 0.6 }]} onPress={handleCalculate} disabled={calculating}>
              {calculating
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.calcBtnText}>🧮 Calcola Rischio CPSP</Text>}
            </TouchableOpacity>
            {scoreError && (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#FECACA' }}>
                <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: '600' }}>⚠ Errore calcolo</Text>
                <Text style={{ color: '#7F1D1D', fontSize: 12, marginTop: 4 }}>{scoreError}</Text>
                <TouchableOpacity onPress={handleCalculate} style={{ marginTop: 8 }}>
                  <Text style={{ color: Colors.primary, fontWeight: '700', fontSize: 13 }}>↩ Riprova</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Result */}
            {result && riskConf && (
              <View style={[s.card, { borderLeftWidth: 4, borderLeftColor: riskConf.color }]}>
                <Text style={s.cardTitle}>📊 Risultato</Text>

                {/* Risk level badge */}
                <View style={[s.riskBadge, { backgroundColor: riskConf.bg }]}>
                  <Text style={[s.riskLabel, { color: riskConf.color }]}>
                    Rischio {riskConf.label}
                  </Text>
                  <Text style={[s.riskPct, { color: riskConf.color }]}>{result.pct}%</Text>
                </View>

                {/* Gauge bar */}
                <View style={s.gaugeBar}>
                  <View style={[s.gaugeFill, { width: `${result.pct}%` as any, backgroundColor: riskConf.color }]} />
                </View>
                <View style={s.gaugeLabels}>
                  <Text style={s.gaugeLbl}>0%</Text>
                  <Text style={[s.gaugeLbl, { color: Colors.green }]}>25%</Text>
                  <Text style={[s.gaugeLbl, { color: Colors.yellow }]}>50%</Text>
                  <Text style={[s.gaugeLbl, { color: '#F97316' }]}>70%</Text>
                  <Text style={s.gaugeLbl}>100%</Text>
                </View>

                {/* Score breakdown */}
                {/* TODO: per-item point contributions (chirurgia X/30, punteggio base→%) rimossi
                    perché richiedevano riskWeight locale (SURGERY_RISK_MAP rimosso in Fase B-iOS).
                    Per ripristinarli estendere compute-cpsp-risk a restituire un oggetto breakdown. */}
                <View style={s.breakdown}>
                  <Text style={s.breakdownTitle}>Dati di input (punteggio calcolato server)</Text>
                  {(() => {
                    const surg = SURGERY_TYPES.find(st => st.value === surgeryValue);
                    const pcsSubsc = calcPcsSubscales(pcsScores);
                    const csiSev = getCsiSeverity(sumScores(csiScores));
                    const passRaw = sumScores(passScores);
                    return (
                      <>
                        {[
                          { label: 'Chirurgia', val: surg?.label ?? surgeryValue },
                          { label: 'Oppioidi preop', val: opioids === 'chronic' ? 'Cronico' : opioids === 'intermittent' ? 'Intermittente' : 'Nessuno' },
                          { label: 'NRS preop', val: `${nrsPreop ?? '–'}/10` },
                          { label: 'PCS', val: `${sumScores(pcsScores)}/52` },
                          { label: `PASS${passRaw >= 30 ? ' ⚠️' : ''}`, val: `${passRaw}/80` },
                          { label: `CSI – ${csiSev}`, val: `${sumScores(csiScores)}/100` },
                        ].map(row => (
                          <View key={row.label} style={s.bdRow}>
                            <Text style={s.bdLabel}>{row.label}</Text>
                            <Text style={s.bdVal}>{row.val}</Text>
                          </View>
                        ))}
                        {/* Bonus screening */}
                        <View style={{ marginTop: 6, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 6 }}>
                          {distressScore !== null && distressScore >= 7 && <View style={s.bdRow}><Text style={s.bdLabel}>+ Distress DT ≥7</Text><Text style={s.bdVal}>+15%</Text></View>}
                          {painOtherSites  && <View style={s.bdRow}><Text style={s.bdLabel}>+ Dolore altre sedi</Text><Text style={s.bdVal}>+10%</Text></View>}
                          {insomniaPresent && <View style={s.bdRow}><Text style={s.bdLabel}>+ Insonnia</Text><Text style={s.bdVal}>+8%</Text></View>}
                          {smoking         && <View style={s.bdRow}><Text style={s.bdLabel}>+ Fumo</Text><Text style={s.bdVal}>+3%</Text></View>}
                          {fragilityPresent && <View style={s.bdRow}><Text style={s.bdLabel}>+ Fragilità</Text><Text style={s.bdVal}>+5%</Text></View>}
                          <View style={[s.bdRow, { marginTop: 4 }]}>
                            <Text style={[s.bdLabel, { fontWeight: '800', color: Colors.primary }]}>TOTALE (server)</Text>
                            <Text style={[s.bdVal, { fontWeight: '800', color: Colors.primary }]}>{result.pct}%</Text>
                          </View>
                          {result.version && <Text style={{ fontSize: 10, color: Colors.textMuted, marginTop: 2 }}>engine v{result.version}</Text>}
                        </View>
                        <View style={{ marginTop: 8, backgroundColor: Colors.primaryLight, borderRadius: 6, padding: 8 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.primary, marginBottom: 4 }}>
                            PCS Subscale (cutoff ≥30/52):
                          </Text>
                          <Text style={{ fontSize: 11, color: Colors.text }}>
                            Helplessness: {pcsSubsc.helplessness}/20 · Rumination: {pcsSubsc.rumination}/20 · Magnification: {pcsSubsc.magnification}/12
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Recommendations */}
                {(() => {
                  const recs = computeRecs(result.level, pcsTotal, passTotal, csiTotal, opioids, nrsPreop, distressScore, insomniaPresent, painOtherSites);
                  return (
                    <View style={{ marginTop: 12 }}>
                      <Text style={s.recTitle}>📋 Raccomandazioni ({recs.length})</Text>
                      {recs.map((rec, i) => <RecCard key={i} rec={rec} />)}
                      {/* PROSPECT Bundle procedure-specific */}
                      {surgeryValue && PROSPECT_BUNDLES[surgeryValue] && (
                        <ProspectBundleCard bundle={PROSPECT_BUNDLES[surgeryValue]} />
                      )}
                      <View style={s.disclaimer}>
                        <Text style={s.disclaimerText}>
                          ⚠️ Strumento di supporto decisionale — non sostituisce la valutazione clinica individuale.{'\n\n'}
                          Nota metodologica: Formula composita ispirata a P4-Prevoque (PERISCOPE Trial 2025, AUC=0.81). Variabili predittive validate: tipo chirurgia (Kehlet 2006; Macrae 2008), uso oppioidi cronico preop (Chapman 2020), NRS preop (Kalkman 2003), fattori psicologici PCS/PASS/CSI (Sullivan 1995; McCracken 2002; Mayer 2012), distress termometro NCCN (cutoff ≥7), insonnia (Lancet Sleep 2023), sensibilizzazione centrale, dolore multifocale, fragilità. Aggiornamento dinamico T1: dolore acuto POD1 come predittore indipendente di CPSP (BJA 2023). Fenotipo neuropatico precoce a 2 sett.: bruciore/scosse/allodinia/freddo come indicatori precoci (Pain 2022). Pain Trajectory Score: composito NRS + fenotipo neuropatico + DN4 (scala 0–10).{'\n\n'}
                          Scale validate: PCS (Sullivan 1995, PCS-I Monticone et al., cutoff ≥30/52); PASS-20 (McCracken 2002, cutoff ≥30/80); CSI (Mayer 2012, Neblett 2013, cutoff ≥40/100); DN4 (Bouhassira 2005, cutoff ≥4/7); BPI (Cleeland 1994); EQ-5D-5L (EuroQol 1990); FAS (Mitchell 2010). Follow-up strutturato (2 sett., 1, 3, 6, 12 mesi). Evidenze: PERISCOPE 2025, IASP 2021, BJA 2023-24, ROCKet 2024, APS 2016, PROSPECT 2023, Cochrane 2022-23, Pain 2022, NCCN 2023. Nota: duloxetina non raccomandata routinariamente in chirurgia ortopedica (evidenza negativa TKA/THA). Tutti i farmaci off-label per uso perioperatorio preventivo.
                        </Text>
                      </View>
                    </View>
                  );
                })()}

              </View>
            )}
            {/* Save button — always visible so clinician can save data even before scoring */}
            {!result && (
              <View style={{ backgroundColor: '#FFF7ED', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#FED7AA' }}>
                <Text style={{ color: '#92400E', fontSize: 12 }}>⚠ Punteggio non calcolato. Premi "Calcola Rischio CPSP" prima di salvare, oppure salva solo i dati del questionario.</Text>
              </View>
            )}
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }, { marginTop: 12 }]}
              onPress={handleSaveAssessment}
              disabled={saving}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.saveBtnText}>{result ? '💾 Salva Valutazione' : '💾 Salva senza punteggio'}</Text>
              }
            </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* ══════════════════ FOLLOW-UP ══════════════════ */}
        {section === 'followup_cpsp' && (
          <>
            {/* Existing follow-ups */}
            {followups.length === 0 && !showFollowupForm && (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 36, marginBottom: 8 }}>📅</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 14 }}>Nessun follow-up registrato</Text>
              </View>
            )}

            {followups.map(fp => {
              const dn4Score = fp.dn4_score ?? 0;
              return (
                <View key={fp.id} style={[s.card, { borderLeftWidth: 3, borderLeftColor: fp.cpsp_confirmed ? Colors.red : Colors.green }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={s.fpTitle}>Follow-up {fp.followup_months} mesi</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>{fp.followup_date}</Text>
                      <TouchableOpacity style={s.editBtn} onPress={() => loadFollowupForEdit(fp)}>
                        <Text style={s.editBtnText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.editBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => deleteFollowup(fp.id)}>
                        <Text style={[s.editBtnText, { color: '#DC2626' }]}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={s.fpRow}>
                    <FpBadge label="Dolore" value={fp.pain_present ? 'Sì' : 'No'} color={fp.pain_present ? Colors.red : Colors.green} />
                    {fp.nrs_value !== null && fp.nrs_value !== undefined && (
                      <FpBadge label="NRS" value={String(fp.nrs_value)} color={fp.nrs_value >= 7 ? Colors.red : fp.nrs_value >= 4 ? Colors.yellow : Colors.green} />
                    )}
                    {fp.bpi_average !== null && fp.bpi_average !== undefined && (
                      <FpBadge label="BPI" value={String(fp.bpi_average)} color={Colors.primary} />
                    )}
                    <FpBadge
                      label="DN4"
                      value={`${dn4Score}/7${fp.dn4_neuropathic ? ' ⚡' : ''}`}
                      color={fp.dn4_neuropathic ? '#F97316' : Colors.green}
                    />
                    {fp.eq5d_vas !== null && fp.eq5d_vas !== undefined && (
                      <FpBadge label="EQ-VAS" value={String(fp.eq5d_vas)} color={Colors.primary} />
                    )}
                  </View>
                  {fp.cpsp_confirmed && (
                    <Text style={{ fontSize: 12, color: Colors.red, fontWeight: '700', marginTop: 4 }}>⚠️ CPSP confermato</Text>
                  )}
                  {fp.pain_center_referral && (
                    <Text style={{ fontSize: 12, color: '#F97316', marginTop: 2 }}>🏥 Inviato a centro del dolore</Text>
                  )}
                  {fp.therapy && (
                    <Text style={{ fontSize: 12, color: Colors.textMuted, marginTop: 2 }}>💊 {fp.therapy}</Text>
                  )}
                </View>
              );
            })}

            {/* New follow-up button */}
            {!showFollowupForm && (
              <TouchableOpacity style={s.addFollowupBtn} onPress={() => setShowFollowupForm(true)}>
                <Text style={s.addFollowupBtnText}>+ Nuovo Follow-up</Text>
              </TouchableOpacity>
            )}

            {/* Follow-up form */}
            {showFollowupForm && (
              <View style={s.card}>
                <Text style={s.cardTitle}>{editingFollowupId ? '✏️ Modifica Follow-up' : '📝 Nuovo Follow-up'}</Text>

                {/* Assessment selector (se > 1 valutazione) */}
                {assessments.length > 1 && (
                  <>
                    <Text style={s.fieldLabel}>Valutazione di riferimento</Text>
                    <View style={s.chipRow}>
                      {assessments.map((a, idx) => {
                        const rc = RISK_CONFIG[a.cpsp_risk_level as keyof typeof RISK_CONFIG] ?? RISK_CONFIG.basso;
                        const selected = (fpAssessmentId ?? assessments[0].id) === a.id;
                        return (
                          <TouchableOpacity key={a.id} style={[s.chip, selected && s.chipActive]} onPress={() => setFpAssessmentId(a.id)}>
                            <Text style={[s.chipText, selected && s.chipTextActive]}>{idx === 0 ? 'Ultima' : `Val. ${assessments.length - idx}`}</Text>
                            <Text style={[s.chipSub, selected && { color: 'rgba(255,255,255,0.8)' }]}>{rc.label} · {new Date(a.created_at).toLocaleDateString('it-IT')}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* ── SEZIONE BASE ──────────────────────────────────── */}

                {/* Timepoint */}
                <Text style={s.fieldLabel}>Timepoint follow-up</Text>
                <View style={s.chipRow}>
                  {([{ v: 0.5 as const, label: '2 sett.' }, { v: 1 as const, label: '1 mese' }, { v: 3 as const, label: '3 mesi' }, { v: 6 as const, label: '6 mesi' }, { v: 12 as const, label: '12 mesi' }]).map(opt => (
                    <TouchableOpacity key={opt.v} style={[s.chip, fpMonths === opt.v && s.chipActive]} onPress={() => setFpMonths(opt.v)}>
                      <Text style={[s.chipText, fpMonths === opt.v && s.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Data */}
                <Text style={s.fieldLabel}>Data follow-up</Text>
                <TextInput style={s.input} placeholder="GG/MM/AAAA" placeholderTextColor={Colors.textLight} value={fpDate} onChangeText={setFpDate} keyboardType="numbers-and-punctuation" />

                {/* Dolore presente */}
                <Text style={s.fieldLabel}>Dolore presente?</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, { flex: 1 }, fpPainPresent === false && s.chipActive]} onPress={() => setFpPainPresent(false)}>
                    <Text style={[s.chipText, fpPainPresent === false && s.chipTextActive]}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, { flex: 1 }, fpPainPresent === true && { backgroundColor: Colors.red, borderColor: Colors.red }]} onPress={() => setFpPainPresent(true)}>
                    <Text style={[s.chipText, fpPainPresent === true && s.chipTextActive]}>Sì</Text>
                  </TouchableOpacity>
                </View>

                {/* NRS triplo (solo se dolore presente) */}
                {fpPainPresent && (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    {([
                      { label: 'NRS attuale', value: fpNrs, set: setFpNrs },
                      { label: 'NRS a riposo', value: fpNrsRest, set: setFpNrsRest },
                      { label: 'NRS in movimento', value: fpNrsMovement, set: setFpNrsMovement },
                    ] as const).map(({ label, value, set }) => (
                      <View key={label}>
                        <Text style={s.fieldLabel}>{label}</Text>
                        <View style={s.nrsRow}>
                          {[0,1,2,3,4,5,6,7,8,9,10].map(n => {
                            const col = n <= 2 ? Colors.green : n <= 4 ? '#A8D8A8' : n <= 6 ? Colors.yellow : Colors.red;
                            return (
                              <TouchableOpacity key={n} style={[s.nrsBtn, { borderColor: col }, value === n && { backgroundColor: col }]} onPress={() => set(n)}>
                                <Text style={[s.nrsBtnText, { color: value === n ? '#fff' : col }]}>{n}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* FAS */}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>⚡ FAS – Functional Activity Scale</Text>
                <Text style={{ fontSize: 11, color: Colors.textMuted, marginBottom: 6 }}>A = nessuna · B = moderata · C = grave</Text>
                <View style={s.chipRow}>
                  {(['A', 'B', 'C'] as const).map(grade => {
                    const gc = grade === 'A' ? Colors.green : grade === 'B' ? Colors.yellow : Colors.red;
                    return (
                      <TouchableOpacity key={grade} style={[s.chip, { flex: 1 }, fpFas === grade && { backgroundColor: gc, borderColor: gc }]} onPress={() => setFpFas(grade)}>
                        <Text style={[s.chipText, fpFas === grade && s.chipTextActive]}>{grade}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Oppioidi */}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>💊 Oppioidi in uso?</Text>
                <View style={s.chipRow}>
                  {([{ v: 'none' as const, label: 'No' }, { v: 'prn' as const, label: 'Al bisogno' }, { v: 'scheduled' as const, label: 'Programmato' }]).map(opt => (
                    <TouchableOpacity key={opt.v} style={[s.chip, { flex: 1 }, fpOpioidUsePostop === opt.v && s.chipActive]} onPress={() => setFpOpioidUsePostop(opt.v)}>
                      <Text style={[s.chipText, fpOpioidUsePostop === opt.v && s.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {fpOpioidUsePostop && fpOpioidUsePostop !== 'none' && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <View style={{ flex: 2 }}>
                      <Text style={s.fieldLabel}>OME mg/die</Text>
                      <TextInput style={s.input} placeholder="es. 20" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={fpOpioidOmePostop} onChangeText={setFpOpioidOmePostop} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.fieldLabel}>Giorni/14</Text>
                      <TextInput style={s.input} placeholder="0-14" placeholderTextColor={Colors.textLight} keyboardType="numeric" value={fpOpioidDaysLast14} onChangeText={setFpOpioidDaysLast14} />
                    </View>
                  </View>
                )}

                {/* Terapia */}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>💊 Terapia in corso</Text>
                <TextInput style={s.input} placeholder="Es. Pregabalin 75mg x2/die" placeholderTextColor={Colors.textLight} value={fpTherapy} onChangeText={setFpTherapy} />

                {/* CPSP + referral */}
                <Text style={[s.fieldLabel, { marginTop: 12 }]}>⚠️ CPSP confermato?</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, { flex: 1 }, fpCpspConfirmed === false && s.chipActive]} onPress={() => setFpCpspConfirmed(false)}>
                    <Text style={[s.chipText, fpCpspConfirmed === false && s.chipTextActive]}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, { flex: 1 }, fpCpspConfirmed === true && { backgroundColor: Colors.red, borderColor: Colors.red }]} onPress={() => setFpCpspConfirmed(true)}>
                    <Text style={[s.chipText, fpCpspConfirmed === true && s.chipTextActive]}>Sì – CPSP</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[s.fieldLabel, { marginTop: 10 }]}>🏥 Invio a centro del dolore?</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, { flex: 1 }, fpPainCenter === false && s.chipActive]} onPress={() => setFpPainCenter(false)}>
                    <Text style={[s.chipText, fpPainCenter === false && s.chipTextActive]}>No</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, { flex: 1 }, fpPainCenter === true && s.chipActive]} onPress={() => setFpPainCenter(true)}>
                    <Text style={[s.chipText, fpPainCenter === true && s.chipTextActive]}>Sì</Text>
                  </TouchableOpacity>
                </View>

                {/* ── 🧬 Fenotipo Neuropatico Precoce (solo ≤1 mese) ── */}
                {fpMonths <= 1 && (
                  <View style={{ marginTop: 14 }}>
                    <CollapsibleSection title="🧬 Fenotipo Neuropatico Precoce" defaultOpen color="#E65100">
                      <Text style={{ fontSize: 11, color: '#BF360C', marginBottom: 10 }}>
                        Caratteristiche neuropatiche a {fpMonths === 0.5 ? '2 settimane' : '1 mese'} — predittore CPSP
                      </Text>
                      {([
                        { label: '🔥 Bruciore', state: fpEarlyNeuroBurning, set: setFpEarlyNeuroBurning },
                        { label: '⚡ Scosse elettriche', state: fpEarlyNeuroElectric, set: setFpEarlyNeuroElectric },
                        { label: '👆 Allodinia', state: fpEarlyNeuroAllodynia, set: setFpEarlyNeuroAllodynia },
                        { label: '🧊 Freddo doloroso', state: fpEarlyNeuroCold, set: setFpEarlyNeuroCold },
                      ] as const).map(({ label, state, set }) => (
                        <TouchableOpacity key={label}
                          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FFE0B2' }}
                          onPress={() => set(!state)}>
                          <Text style={{ fontSize: 13, color: '#3E2723', flex: 1 }}>{label}</Text>
                          <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: state ? '#E65100' : '#D7CCC8', justifyContent: 'center', paddingHorizontal: 3 }}>
                            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: state ? 'flex-end' : 'flex-start' }} />
                          </View>
                        </TouchableOpacity>
                      ))}
                      {(() => {
                        const cnt = [fpEarlyNeuroBurning, fpEarlyNeuroElectric, fpEarlyNeuroAllodynia, fpEarlyNeuroCold].filter(Boolean).length;
                        return (
                          <View style={{ marginTop: 10 }}>
                            <View style={{ backgroundColor: cnt >= 2 ? '#FFCCBC' : '#F5F5F5', borderRadius: 8, padding: 8 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: cnt >= 2 ? '#BF360C' : Colors.textMuted }}>
                                Score: {cnt}/4 {cnt >= 2 ? '⚠️ Fenotipo neuropatico positivo — rischio CPSP elevato' : ''}
                              </Text>
                            </View>
                          </View>
                        );
                      })()}
                    </CollapsibleSection>
                  </View>
                )}

                {/* ── 🔍 Algoritmo CPSP (solo ≥3 mesi) ── */}
                {fpMonths >= 3 && (
                  <View style={{ marginTop: 14 }}>
                    <CollapsibleSection title="🔍 Algoritmo Diagnostico CPSP" color="#6A1B9A">
                      {/* Step 1: Criteri */}
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6A1B9A', marginBottom: 6 }}>Step 1 — Criteri diagnostici</Text>
                      {[
                        { label: 'Dolore insorto/peggiorato dopo l\'intervento', idx: 0 },
                        { label: 'Sede correlata all\'area chirurgica', idx: 1 },
                        { label: 'Durata ≥3 mesi dall\'intervento', idx: 2 },
                        { label: 'Non spiegato da altra causa pre-esistente', idx: 3 },
                      ].map(({ label, idx }) => (
                        <TouchableOpacity key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, gap: 10, borderBottomWidth: 1, borderBottomColor: '#E1BEE7' }}
                          onPress={() => { const n = [...cpspCriteria]; n[idx] = !n[idx]; setCpspCriteria(n); }}>
                          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, marginTop: 1, borderColor: cpspCriteria[idx] ? Colors.green : '#9C27B0', backgroundColor: cpspCriteria[idx] ? Colors.green : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                            {cpspCriteria[idx] && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                          </View>
                          <Text style={{ fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17 }}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={{ marginTop: 6, backgroundColor: cpspCriteria.every(Boolean) ? Colors.greenLight : '#FFF3E0', borderRadius: 6, padding: 8, marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cpspCriteria.every(Boolean) ? Colors.green : '#E65100' }}>
                          {cpspCriteria.filter(Boolean).length}/4 criteri {cpspCriteria.every(Boolean) ? '✓' : ''}
                        </Text>
                      </View>

                      {/* Step 2: Esclusioni */}
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6A1B9A', marginBottom: 6 }}>Step 2 — Diagnosi alternative (CPSP escluso se presente)</Text>
                      {CPSP_EXCLUSIONS.map((item, idx) => (
                        <TouchableOpacity key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7, gap: 10, borderBottomWidth: 1, borderBottomColor: '#E1BEE7' }}
                          onPress={() => { const n = [...cpspExclusions]; n[idx] = !n[idx]; setCpspExclusions(n); }}>
                          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, marginTop: 1, borderColor: cpspExclusions[idx] ? Colors.red : '#9C27B0', backgroundColor: cpspExclusions[idx] ? Colors.red : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
                            {cpspExclusions[idx] && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                          </View>
                          <Text style={{ fontSize: 12, color: Colors.text, flex: 1, lineHeight: 17 }}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                      <View style={{ marginTop: 6, marginBottom: 14, backgroundColor: cpspExclusions.some(Boolean) ? Colors.redLight : Colors.greenLight, borderRadius: 6, padding: 8 }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: cpspExclusions.some(Boolean) ? Colors.red : Colors.green }}>
                          {cpspExclusions.some(Boolean) ? '⚠️ Diagnosi alternativa — CPSP escluso' : '✓ Nessuna diagnosi alternativa'}
                        </Text>
                      </View>

                      {/* Step 3: Badge */}
                      {(() => {
                        const confirmed = cpspCriteria.every(Boolean) && !cpspExclusions.some(Boolean);
                        const partial = cpspCriteria.filter(Boolean).length >= 2 && !cpspExclusions.some(Boolean);
                        return (
                          <View style={{ marginBottom: 14, borderRadius: 10, padding: 12, backgroundColor: confirmed ? Colors.redLight : partial ? Colors.yellowLight : '#F5F5F5', borderWidth: 1.5, borderColor: confirmed ? Colors.red : partial ? Colors.yellow : Colors.border }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: confirmed ? Colors.red : partial ? '#D97706' : Colors.textMuted, textAlign: 'center' }}>
                              {confirmed ? '🔴 CPSP CONFERMATA' : partial ? '🟡 Criteri parziali — rivalutare' : '🟢 Non soddisfa criteri CPSP'}
                            </Text>
                          </View>
                        );
                      })()}

                      {/* Step 4: DN4 + PHQ9 + GAD7 */}
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#6A1B9A', marginBottom: 6 }}>Step 4 — Fenotipizzazione</Text>
                      <Text style={[s.fieldLabel, { marginTop: 0 }]}>⚡ DN4 (≥4 = neuropatico) — score: {fpDn4.filter(v => v === true).length}/7 {fpDn4.filter(v => v === true).length >= 4 ? '⚠️' : ''}</Text>
                      {DN4_ITEMS.map((item, idx) => (
                        <View key={idx} style={s.fpItemRow}>
                          <Text style={s.fpItemText}>{idx + 1}. {item}</Text>
                          <View style={s.chipRow}>
                            <TouchableOpacity style={[s.chip, { paddingHorizontal: 12, paddingVertical: 5 }, fpDn4[idx] === false && s.chipActive]} onPress={() => { const n = [...fpDn4]; n[idx] = false; setFpDn4(n); }}>
                              <Text style={[s.chipText, fpDn4[idx] === false && s.chipTextActive]}>No</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.chip, { paddingHorizontal: 12, paddingVertical: 5 }, fpDn4[idx] === true && { backgroundColor: '#F97316', borderColor: '#F97316' }]} onPress={() => { const n = [...fpDn4]; n[idx] = true; setFpDn4(n); }}>
                              <Text style={[s.chipText, fpDn4[idx] === true && s.chipTextActive]}>Sì</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                      {/* PHQ-9 full scale */}
                      {(() => {
                        const sev = getPhq9Severity(phq9Score);
                        return (
                          <CollapsibleSection
                            title={`😔 PHQ-9 — Score: ${phq9Score}/27`}
                            color="#5C6BC0"
                            defaultOpen={false}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <Text style={{ fontSize: 11, color: Colors.textMuted }}>Nelle ultime 2 settimane, con quale frequenza ha avuto i seguenti disturbi?</Text>
                              <View style={{ backgroundColor: sev.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: sev.color }}>{sev.label} ({phq9Score})</Text>
                              </View>
                            </View>
                            {PHQ9_ITEMS.map((item, idx) => (
                              <View key={idx} style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 12, color: Colors.text, marginBottom: 6, lineHeight: 17 }}>{idx + 1}. {item}</Text>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  {PHQ9_LABELS.map((lbl, v) => (
                                    <TouchableOpacity
                                      key={v}
                                      style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
                                        borderColor: phq9Answers[idx] === v ? '#5C6BC0' : Colors.border,
                                        backgroundColor: phq9Answers[idx] === v ? '#5C6BC0' : Colors.surface }}
                                      onPress={() => { const n = [...phq9Answers]; n[idx] = v; setPhq9Answers(n); }}
                                    >
                                      <Text style={{ fontSize: 13, fontWeight: '700', color: phq9Answers[idx] === v ? '#fff' : Colors.text }}>{v}</Text>
                                      <Text style={{ fontSize: 9, color: phq9Answers[idx] === v ? 'rgba(255,255,255,0.85)' : Colors.textMuted, marginTop: 2, textAlign: 'center' }}>{lbl}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            ))}
                            {phq9Score >= 10 && (
                              <View style={{ backgroundColor: Colors.redLight, borderRadius: 8, padding: 10, marginTop: 4 }}>
                                <Text style={{ fontSize: 12, color: Colors.red, fontWeight: '700' }}>⚠️ Score ≥10: considerare supporto psicologico/psichiatrico</Text>
                              </View>
                            )}
                          </CollapsibleSection>
                        );
                      })()}

                      {/* GAD-7 full scale */}
                      {(() => {
                        const sev = getGad7Severity(gad7Score);
                        return (
                          <CollapsibleSection
                            title={`😰 GAD-7 — Score: ${gad7Score}/21`}
                            color="#00838F"
                            defaultOpen={false}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                              <Text style={{ fontSize: 11, color: Colors.textMuted }}>Nelle ultime 2 settimane, con quale frequenza ha avuto i seguenti disturbi?</Text>
                              <View style={{ backgroundColor: sev.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: sev.color }}>{sev.label} ({gad7Score})</Text>
                              </View>
                            </View>
                            {GAD7_ITEMS.map((item, idx) => (
                              <View key={idx} style={{ marginBottom: 12 }}>
                                <Text style={{ fontSize: 12, color: Colors.text, marginBottom: 6, lineHeight: 17 }}>{idx + 1}. {item}</Text>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  {GAD7_LABELS.map((lbl, v) => (
                                    <TouchableOpacity
                                      key={v}
                                      style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
                                        borderColor: gad7Answers[idx] === v ? '#00838F' : Colors.border,
                                        backgroundColor: gad7Answers[idx] === v ? '#00838F' : Colors.surface }}
                                      onPress={() => { const n = [...gad7Answers]; n[idx] = v; setGad7Answers(n); }}
                                    >
                                      <Text style={{ fontSize: 13, fontWeight: '700', color: gad7Answers[idx] === v ? '#fff' : Colors.text }}>{v}</Text>
                                      <Text style={{ fontSize: 9, color: gad7Answers[idx] === v ? 'rgba(255,255,255,0.85)' : Colors.textMuted, marginTop: 2, textAlign: 'center' }}>{lbl}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            ))}
                            {gad7Score >= 10 && (
                              <View style={{ backgroundColor: Colors.redLight, borderRadius: 8, padding: 10, marginTop: 4 }}>
                                <Text style={{ fontSize: 12, color: Colors.red, fontWeight: '700' }}>⚠️ Score ≥10: ansia moderata-severa, valutare consulenza</Text>
                              </View>
                            )}
                          </CollapsibleSection>
                        );
                      })()}
                    </CollapsibleSection>
                  </View>
                )}

                {/* ── 📊 Qualità di vita (solo ≥3 mesi) ── */}
                {fpMonths >= 3 && (
                  <View style={{ marginTop: 14 }}>
                    <CollapsibleSection title="📊 Qualità di vita" color={Colors.primary}>
                      {/* BPI key items */}
                      <Text style={s.fieldLabel}>BPI – interferenza (0–10)</Text>
                      {BPI_ITEMS.slice(4).map((item, i) => {
                        const idx = i + 4;
                        return (
                          <View key={idx} style={s.fpItemRow}>
                            <Text style={s.fpItemText}>{item}</Text>
                            <View style={s.fpItemBtns}>
                              {[0,2,4,6,8,10].map(v => (
                                <TouchableOpacity key={v} style={[s.fpSmBtn, fpBpi[idx] === v && { backgroundColor: Colors.primary }]} onPress={() => { const n = [...fpBpi]; n[idx] = v; setFpBpi(n); }}>
                                  <Text style={[s.fpSmBtnText, fpBpi[idx] === v && { color: '#fff' }]}>{v}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                      {!fpShowAllBpi ? (
                        <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 8 }} onPress={() => setFpShowAllBpi(true)}>
                          <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>+ Mostra scala severità</Text>
                        </TouchableOpacity>
                      ) : (
                        <>
                          <Text style={[s.fieldLabel, { marginTop: 8 }]}>BPI – severità</Text>
                          {BPI_ITEMS.slice(0, 4).map((item, idx) => (
                            <View key={idx} style={s.fpItemRow}>
                              <Text style={s.fpItemText}>{item}</Text>
                              <View style={s.fpItemBtns}>
                                {[0,2,4,6,8,10].map(v => (
                                  <TouchableOpacity key={v} style={[s.fpSmBtn, fpBpi[idx] === v && { backgroundColor: Colors.primary }]} onPress={() => { const n = [...fpBpi]; n[idx] = v; setFpBpi(n); }}>
                                    <Text style={[s.fpSmBtnText, fpBpi[idx] === v && { color: '#fff' }]}>{v}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          ))}
                        </>
                      )}

                      {/* EQ-5D compact */}
                      <Text style={[s.fieldLabel, { marginTop: 12 }]}>🏥 EQ-5D (1=no problema · 5=estremo)</Text>
                      {EQ5D_ITEMS.map((item, idx) => (
                        <View key={idx} style={s.fpItemRow}>
                          <Text style={s.fpItemText}>{item}</Text>
                          <View style={s.fpItemBtns}>
                            {[1,2,3,4,5].map(v => (
                              <TouchableOpacity key={v} style={[s.fpSmBtn, fpEq5d[idx] === v && { backgroundColor: Colors.primary }]} onPress={() => { const n = [...fpEq5d]; n[idx] = v; setFpEq5d(n); }}>
                                <Text style={[s.fpSmBtnText, fpEq5d[idx] === v && { color: '#fff' }]}>{v}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                      <Text style={[s.fieldLabel, { marginTop: 8 }]}>EQ-VAS (0–100)</Text>
                      <View style={s.fpItemBtns}>
                        {[0,20,40,60,80,100].map(v => (
                          <TouchableOpacity key={v} style={[s.fpSmBtn, { width: 44 }, fpEqVas === v && { backgroundColor: Colors.primary }]} onPress={() => setFpEqVas(v)}>
                            <Text style={[s.fpSmBtnText, fpEqVas === v && { color: '#fff' }]}>{v}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </CollapsibleSection>
                  </View>
                )}

                {/* ── 💊 Terapia NeuPSIG (solo se CPSP confermato) ── */}
                {fpCpspConfirmed && (
                  <View style={{ marginTop: 14 }}>
                    <CollapsibleSection title="💊 Terapia NeuPSIG 2025" color="#3F51B5">
                      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 10 }}>
                        {([1, 2, 3] as const).map(st => (
                          <TouchableOpacity key={st} style={{ flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center', backgroundColor: neupsigDocStep === st ? '#3F51B5' : '#C5CAE9' }}
                            onPress={() => { setNeupsigDocStep(st); setNeupsigDocDrug(''); }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: neupsigDocStep === st ? '#fff' : '#1A237E' }}>Linea {st}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
                        {NEUP_SIG_DRUGS.filter(d => d.step === neupsigDocStep).map(drug => (
                          <TouchableOpacity key={drug.name}
                            style={{ backgroundColor: neupsigDocDrug === drug.name ? '#3F51B5' : Colors.surface, borderRadius: 8, padding: 10, marginBottom: 6, borderWidth: 1.5, borderColor: neupsigDocDrug === drug.name ? '#3F51B5' : '#C5CAE9' }}
                            onPress={() => setNeupsigDocDrug(drug.name)}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', flex: 1, color: neupsigDocDrug === drug.name ? '#fff' : Colors.text }}>{drug.name}</Text>
                              <View style={{ backgroundColor: neupsigDocDrug === drug.name ? 'rgba(255,255,255,0.2)' : '#E8EAF6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: neupsigDocDrug === drug.name ? '#fff' : '#3F51B5' }}>NNT {drug.nnt}</Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 11, color: neupsigDocDrug === drug.name ? 'rgba(255,255,255,0.8)' : Colors.textMuted }}>{drug.dose}</Text>
                            {drug.notes && <Text style={{ fontSize: 10, marginTop: 2, fontStyle: 'italic', color: neupsigDocDrug === drug.name ? 'rgba(255,255,255,0.65)' : Colors.textLight }}>{drug.notes}</Text>}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      {neupsigDocDrug !== '' && (
                        <View style={{ backgroundColor: Colors.greenLight, borderRadius: 6, padding: 8, marginTop: 4 }}>
                          <Text style={{ fontSize: 12, color: Colors.green, fontWeight: '700' }}>✓ Documentato: {neupsigDocDrug} (Linea {neupsigDocStep})</Text>
                        </View>
                      )}
                    </CollapsibleSection>
                  </View>
                )}

                {/* Form actions */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity style={[s.chip, { flex: 1, paddingVertical: 12, borderColor: Colors.border }]} onPress={() => { setShowFollowupForm(false); setEditingFollowupId(null); }}>
                    <Text style={s.chipText}>Annulla</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.saveBtn, { flex: 2 }, savingFp && { opacity: 0.6 }]} onPress={handleSaveFollowup} disabled={savingFp}>
                    {savingFp ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>💾 Salva Follow-up</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function StatPill({ label, value, color = Colors.primary }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 1, borderColor: Colors.border, alignItems: 'center' }}>
      <Text style={{ fontSize: 9, color: Colors.textMuted, fontWeight: '600' }}>{label.toUpperCase()}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color }}>{value}</Text>
    </View>
  );
}

function FpBadge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 10, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color }}>{value}</Text>
    </View>
  );
}

function RecCard({ rec }: { rec: Rec }) {
  const bg = CATEGORY_BG[rec.category] ?? '#F5F5F5';
  const lvlColor = LEVEL_COLOR[rec.level] ?? '#9E9E9E';
  const lvlLabel = rec.level === 'expert' ? 'Expert' : `Livello ${rec.level}`;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 }}>
        <Text style={{ fontSize: 16 }}>{rec.icon}</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, flex: 1 }}>
          {rec.category.toUpperCase()}
        </Text>
        <View style={{ backgroundColor: lvlColor, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>{lvlLabel}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 13, color: Colors.text, lineHeight: 19 }}>{rec.text}</Text>
      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 4, fontStyle: 'italic' }}>
        📚 {rec.source}
      </Text>
    </View>
  );
}

// ─── PROSPECT BUNDLE CARD ────────────────────────────────────────────────────

function ProspectBundleCard({ bundle }: { bundle: typeof PROSPECT_BUNDLES[string] }) {
  return (
    <View style={{ backgroundColor: '#E0F2F1', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Text style={{ fontSize: 15 }}>🎯</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#004D40', flex: 1 }}>
          PROSPECT Bundle: {bundle.title}
        </Text>
      </View>
      <Text style={{ fontSize: 11, color: '#00695C', marginBottom: 8, fontStyle: 'italic' }}>
        📚 {bundle.source}
      </Text>
      {bundle.items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5,
          borderBottomWidth: i < bundle.items.length - 1 ? 1 : 0,
          borderBottomColor: '#B2DFDB', gap: 8 }}>
          <View style={{ backgroundColor: LEVEL_COLOR[item.level] ?? '#9E9E9E',
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>
              {item.level === 'expert' ? 'Exp' : item.level}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: '#004D40', fontWeight: '600' }}>{item.drug}</Text>
            {item.dose !== '' && (
              <Text style={{ fontSize: 11, color: '#00796B' }}>{item.dose}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 18 },
  backIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  sectionTabs: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTab: { flex: 1, paddingVertical: 13, alignItems: 'center' },
  sectionTabActive: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
  sectionTabText: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  sectionTabTextActive: { color: Colors.primary, fontWeight: '700' },
  scroll: { padding: Spacing.md, paddingBottom: 100 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, marginBottom: Spacing.md, ...Shadow.sm },
  cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  chipSub: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  nrsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  nrsBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  nrsBtnText: { fontSize: 13, fontWeight: '700' },
  scaleTabs: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: Radius.md, padding: 3, marginBottom: 10, gap: 3 },
  scaleTab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm },
  scaleTabActive: { backgroundColor: Colors.primary },
  scaleTabLabel: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  scaleTabLabelActive: { color: '#fff' },
  scaleTabMeta: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  scaleDesc: { fontSize: 11, color: Colors.textMuted, marginBottom: 8, textAlign: 'center' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  legendItem: { alignItems: 'center', gap: 3 },
  legendBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  legendLabel: { fontSize: 9, color: Colors.textMuted },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6, gap: 6 },
  itemNum: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, width: 20, textAlign: 'right' },
  itemText: { flex: 1, fontSize: 12, color: Colors.text, lineHeight: 17 },
  itemBtns: { flexDirection: 'row', gap: 4 },
  itemBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  itemBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  itemBtnText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  itemBtnTextActive: { color: '#fff' },
  calcBtn: { backgroundColor: Colors.primaryDark, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  riskBadge: { borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginBottom: 12 },
  riskBadgeSm: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radius.full },
  riskBadgeSmText: { fontSize: 12, fontWeight: '700' },
  riskLabel: { fontSize: 18, fontWeight: '800' },
  riskPct: { fontSize: 32, fontWeight: '800', marginTop: 2 },
  gaugeBar: { height: 12, backgroundColor: Colors.borderLight, borderRadius: 6, marginBottom: 4, overflow: 'hidden' },
  gaugeFill: { height: '100%', borderRadius: 6 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  gaugeLbl: { fontSize: 10, color: Colors.textMuted },
  breakdown: { backgroundColor: Colors.background, borderRadius: Radius.sm, padding: 10 },
  breakdownTitle: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 6 },
  bdRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  bdLabel: { fontSize: 12, color: Colors.text, flex: 1 },
  bdVal: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  recTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8 },
  recRow: { flexDirection: 'row', gap: 6, marginBottom: 5 },
  recBullet: { fontSize: 14, fontWeight: '700' },
  recText: { fontSize: 13, color: Colors.text, flex: 1, lineHeight: 18 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  addFollowupBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 16, alignItems: 'center', marginBottom: Spacing.md },
  addFollowupBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fpTitle: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  fpRow: { flexDirection: 'row', gap: 16, marginTop: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: Colors.background, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  fpItemRow: { marginBottom: 10 },
  fpItemText: { fontSize: 12, color: Colors.text, marginBottom: 5 },
  fpItemBtns: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  fpSmBtn: { width: 38, height: 30, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  fpSmBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  disclaimer: { backgroundColor: '#F5F5F5', borderRadius: 8, padding: 10, marginTop: 8 },
  disclaimerText: { fontSize: 11, color: Colors.textMuted, lineHeight: 16, fontStyle: 'italic' },
  editBtn: { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  editBtnText: { fontSize: 12, fontWeight: '600', color: Colors.text },
  autofillBanner: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#3B82F6' },
  autofillBannerText: { fontSize: 12, color: '#1D4ED8', lineHeight: 17 },
});
