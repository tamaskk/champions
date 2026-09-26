import { DarkTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ProgressToast } from '@/components/progress-toast';
import { C, FONT_ASSETS } from '@/design/tokens';
import { initWallet } from '@/game/wallet';

SplashScreen.preventAutoHideAsync();

// The design is dark only.
const THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, background: C.bg, card: C.surface, text: C.text } };

export default function TabLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  // Coins: load the wallet and collect the daily login bonus once per app start.
  useEffect(() => {
    void initWallet();
  }, []);
  return (
    <ThemeProvider value={THEME}>
      <StatusBar style="light" />
      <AnimatedSplashOverlay />
      {fontsLoaded ? <AppTabs /> : <View style={{ flex: 1, backgroundColor: C.bg }} />}
      {fontsLoaded && <ProgressToast />}
    </ThemeProvider>
  );
}
