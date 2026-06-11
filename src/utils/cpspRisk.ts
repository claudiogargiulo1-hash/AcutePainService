// src/utils/cpspRisk.ts
// CPSP risk calculation utilities
// References: PERISCOPE 2025, BJA 2023, NeuPSIG guidelines

// ─── SURGERY TYPES ────────────────────────────────────────────────────────────

export const SURGERY_TYPES = [
  { label: 'THA (anca)',                    value: 'THA'                     },
  { label: 'TKA (ginocchio)',               value: 'TKA'                     },
  { label: 'Artroscopia ginocchio',         value: 'ARTR_GINOCCHIO'          },
  { label: 'Artroscopia spalla',            value: 'ARTR_SPALLA'             },
  { label: 'Protesi spalla',               value: 'PROTESI_SPALLA'           },
  { label: 'Frattura arto inf.',            value: 'FRATTURA_INF'            },
  { label: 'Frattura arto sup.',            value: 'FRATTURA_SUP'            },
  { label: 'Vertebrale fusione',            value: 'VERTEBRALE_FUSIONE'      },
  { label: 'Vertebrale decompressione',     value: 'VERTEBRALE_DECOMPRESSIONE' },
  { label: 'Altro ortopedico',              value: 'ALTRO'                   },
];

// ─── RISK LEVEL TYPE ──────────────────────────────────────────────────────────

export type RiskLevel = 'basso' | 'moderato' | 'alto' | 'molto_alto';

/**
 * Dynamic risk update at POD1.
 * Reference: BJA 2023 — acute pain at POD1 is an independent predictor of CPSP.
 */
export function calcDynamicRisk(
  preopPct: number,
  pod1NrsRest: number,
  pod1NrsMovement: number,
  pod1Ome: number | null,
): { pct: number; level: RiskLevel; delta: number } {
  const restContrib  = pod1NrsRest     <= 3 ? pod1NrsRest * 0.8 :
                       pod1NrsRest     <= 6 ? pod1NrsRest * 1.8 : pod1NrsRest * 3.0;
  const movContrib   = pod1NrsMovement <= 3 ? pod1NrsMovement * 0.5 :
                       pod1NrsMovement <= 6 ? pod1NrsMovement * 1.2 : pod1NrsMovement * 2.0;
  const omeContrib   = pod1Ome !== null && pod1Ome > 0 ? Math.min(pod1Ome / 10, 8) : 0;
  const rawAdj       = preopPct + restContrib + movContrib + omeContrib;
  const pct          = Math.min(100, Math.round(rawAdj));
  const level: RiskLevel =
    pct < 25 ? 'basso' : pct < 50 ? 'moderato' : pct < 70 ? 'alto' : 'molto_alto';
  return { pct, level, delta: pct - Math.round(preopPct) };
}
