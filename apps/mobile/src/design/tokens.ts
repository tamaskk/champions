/**
 * Design tokens of the Spinvincible design (Figma "Champion" file, dark only).
 * Every screen takes its colours, fonts and radii from here.
 */

export const C = {
  /** Screen background. */
  bg: '#0d141e',
  /** Deepest wells: slot chamber, pitch frame, scoreboard. */
  deep: '#080f18',
  /** Cards. */
  surface: '#151c26',
  surface2: '#19202a',
  surface3: '#232a35',
  surface4: '#2e3540',
  divider: '#333a45',

  text: '#dce3f1',
  textMuted: '#bdcabe',
  textDim: '#879489',

  green: '#6ddc9e',
  greenStrong: '#30a46c',
  greenLight: '#8af8b9',
  onGreen: '#00311b',
  onGreenStrong: '#003920',

  gold: '#ffc72c',
  goldDeep: '#e0ac00',
  goldLight: '#ffdf99',
  onGold: '#584200',
  onGoldDark: '#3f2e00',

  blue: '#3093f8',
  blueLight: '#a4c9ff',
  blueSoft: '#d4e3ff',
  onBlue: '#002b52',

  red: '#ffb4ab',
  redDeep: '#93000a',

  pitchDark: '#1b5e2a',
  pitchLight: '#206e31',
} as const;

/** rgba() helper for the translucent fills the design uses everywhere. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Font families (loaded in the root layout). */
export const F = {
  display: 'SpaceGrotesk_700Bold',
  displaySemi: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  icons: 'MaterialSymbols_400Regular',
} as const;

export const FONT_ASSETS = {
  [F.display]: require('@/assets/fonts/SpaceGrotesk_700Bold.ttf'),
  [F.displaySemi]: require('@/assets/fonts/SpaceGrotesk_600SemiBold.ttf'),
  [F.body]: require('@/assets/fonts/Inter_400Regular.ttf'),
  [F.semi]: require('@/assets/fonts/Inter_600SemiBold.ttf'),
  [F.bold]: require('@/assets/fonts/Inter_700Bold.ttf'),
  [F.icons]: require('@/assets/fonts/MaterialSymbols_400Regular.ttf'),
};

export const R = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, pill: 9999 } as const;

/** Header bar height (below the status bar) and the room the floating tab bar takes. */
export const HEADER_HEIGHT = 64;
export const NAV_ROOM = 96;

export const IMAGES = {
  appIcon: require('@/assets/images/design/app-icon.png'),
  stadium: require('@/assets/images/design/stadium.png'),
};
