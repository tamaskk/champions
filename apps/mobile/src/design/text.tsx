import { Text, type TextProps, type TextStyle } from 'react-native';

import { C, F } from './tokens';

/** The design's type scale (Inter for UI text, Space Grotesk for headings and numbers). */
export const TYPE = {
  tiny: { fontFamily: F.body, fontSize: 9, lineHeight: 13.5 },
  tinyBold: { fontFamily: F.bold, fontSize: 9, lineHeight: 13.5, letterSpacing: 0.45 },
  cap: { fontFamily: F.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.6 },
  capUpper: { fontFamily: F.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  capBody: { fontFamily: F.body, fontSize: 10, lineHeight: 15 },
  body: { fontFamily: F.body, fontSize: 12, lineHeight: 16 },
  bodySemi: { fontFamily: F.semi, fontSize: 12, lineHeight: 16, letterSpacing: 0.24 },
  bodyBold: { fontFamily: F.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.24 },
  body14: { fontFamily: F.body, fontSize: 14, lineHeight: 20 },
  num9: { fontFamily: F.display, fontSize: 9, lineHeight: 13.5 },
  num13: { fontFamily: F.display, fontSize: 13, lineHeight: 19.5 },
  h14: { fontFamily: F.display, fontSize: 14, lineHeight: 18, letterSpacing: 0.7 },
  h16: { fontFamily: F.display, fontSize: 16, lineHeight: 24, letterSpacing: -0.4 },
  h20: { fontFamily: F.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  h24: { fontFamily: F.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  h28: { fontFamily: F.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  h36: { fontFamily: F.display, fontSize: 36, lineHeight: 44, letterSpacing: -1.08 },
} satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof TYPE;

export function Txt({ v = 'body', color = C.text, style, ...rest }: TextProps & { v?: TypeName; color?: string }) {
  return <Text style={[TYPE[v], { color }, style]} {...rest} />;
}
