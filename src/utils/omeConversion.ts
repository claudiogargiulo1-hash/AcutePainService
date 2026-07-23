// src/utils/omeConversion.ts
// Oral Morphine Equivalent (OME) conversion tables and calculator.
// References: CDC 2022, NIH HEAL 2024, StatPearls 2024

export const OME_CONVERSION: Record<string, { factor: number; routes: string[]; note: string }> = {
  'Morfina orale':     { factor: 1,    routes: ['orale'],        note: 'Standard di riferimento' },
  'Morfina EV/SC':     { factor: 3,    routes: ['ev','sc','im'], note: '10mg EV = 30mg orale (ratio 1:3)' },
  'Oramorph':          { factor: 1,    routes: ['orale'],        note: 'Morfina solfato orale' },
  'Ossicodone orale':  { factor: 1.5,  routes: ['orale'],        note: 'CDC 2022: 1mg = 1.5mg OME' },
  'Ossicodone EV':     { factor: 3,    routes: ['ev'],           note: 'EV equivale a orale x2' },
  'Idromorfone orale': { factor: 4,    routes: ['orale'],        note: '7.5mg orale = 30mg morfina' },
  'Idromorfone EV':    { factor: 20,   routes: ['ev','sc'],      note: '1.5mg EV = 30mg morfina orale' },
  'Fentanyl TTS':      { factor: 2.4,  routes: ['td'],           note: 'Inserire mcg/h. 25mcg/h ≈ 60mg OME/die' },
  'Fentanyl EV':       { factor: 100,  routes: ['ev'],           note: '0.1mg EV = 10mg morfina orale' },
  'Tramadolo orale':   { factor: 0.2,  routes: ['orale'],        note: '100mg = 20mg OME (NIH HEAL 2024)' },
  'Tramadolo EV':      { factor: 0.2,  routes: ['ev','im'],      note: 'Stesso fattore orale' },
  'Buprenorfina SL':   { factor: 30,   routes: ['sl'],           note: 'CDC 2022: 1mg SL = 30mg OME' },
  'Buprenorfina TDS':  { factor: 2.4,  routes: ['td'],           note: 'Inserire mcg/h. 35mcg/h ≈ 84mg OME/die' },
  'Tapentadolo':       { factor: 0.4,  routes: ['orale'],        note: 'Palexia: 100mg = 40mg OME' },
  'Codeina':           { factor: 0.15, routes: ['orale'],        note: '200mg codeina ≈ 30mg morfina' },
};

/**
 * Calculates OME per dose and daily OME for a given opioid prescription.
 */
export function calcOME(
  drug: string,
  dosePerAdmin: number,
  isPrn: boolean,
  frequencyPerDay: number,
  prnDosesPerDay: number,
): { omePerDose: number; omeDaily: number } {
  const factor = OME_CONVERSION[drug]?.factor ?? 1;
  const omePerDose = Math.round(dosePerAdmin * factor * 10) / 10;
  const omeDaily = isPrn
    ? Math.round(omePerDose * prnDosesPerDay * 10) / 10
    : Math.round(omePerDose * frequencyPerDay * 10) / 10;
  return { omePerDose, omeDaily };
}
