export const colors = {
  background: '#F2F5F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EDF1F5',
  border: '#D4DBE3',
  borderStrong: '#AFBAC6',
  text: '#13212E',
  textMuted: '#5A6B7C',
  primary: '#1B64C4',
  primaryDark: '#144E9B',
  onPrimary: '#FFFFFF',
  success: '#17803D',
  successSurface: '#E6F4EA',
  danger: '#C02B24',
  dangerSurface: '#FCEAE9',
  pending: '#9A6200',
  pendingSurface: '#FFF4E0',
  chart: '#1B64C4',
  chartMuted: '#C3D4EA',
  info: '#1B64C4',
  infoSurface: '#E7F0FB',
} as const;

export const shadow = {
  card: {
    shadowColor: '#13212E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 13,
  body: 16,
  bodyLarge: 18,
  title: 20,
  heading: 24,
  display: 30,
} as const;
