// src/utils/theme.ts
export const Colors = {
  primary: '#1A5F7A',
  primaryDark: '#134758',
  primaryLight: '#E8F4F8',
  accent: '#57C5B6',
  accentDark: '#3DA99B',
  background: '#F5F9FA',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  text: '#1A2730',
  textMuted: '#5A7080',
  textLight: '#8A9BA8',
  border: '#D0E3EC',
  borderLight: '#EAF3F8',
  // Alert
  green: '#2ECC71',
  greenLight: '#E8F8F0',
  yellow: '#F39C12',
  yellowLight: '#FEF6E6',
  red: '#E53935',
  redLight: '#FEECEB',
  // NRS colors
  nrs0: '#2ECC71',
  nrs3: '#A8D8A8',
  nrs5: '#F9E784',
  nrs7: '#F39C12',
  nrs10: '#E53935',
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: '700' as const, color: Colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  h3: { fontSize: 18, fontWeight: '600' as const, color: Colors.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: Colors.text },
  caption: { fontSize: 12, fontWeight: '400' as const, color: Colors.textMuted },
  badge: { fontSize: 12, fontWeight: '700' as const },
};

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const Radius = {
  sm: 8, md: 12, lg: 16, xl: 24, full: 9999,
};

export const Shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 8 },
};

export const getNrsColor = (value: number): string => {
  if (value <= 2) return Colors.nrs0;
  if (value <= 4) return Colors.nrs3;
  if (value <= 6) return Colors.nrs5;
  if (value <= 8) return Colors.nrs7;
  return Colors.nrs10;
};

export const getNrsBackground = (value: number): string => {
  if (value <= 3) return Colors.greenLight;
  if (value <= 6) return Colors.yellowLight;
  return Colors.redLight;
};

export const getAlertColor = (level: 'verde' | 'giallo' | 'rosso'): string => {
  switch (level) {
    case 'verde': return Colors.green;
    case 'giallo': return Colors.yellow;
    case 'rosso': return Colors.red;
  }
};
