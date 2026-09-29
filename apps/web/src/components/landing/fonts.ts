import { Inter, Space_Grotesk } from "next/font/google";

// The app's fonts (apps/mobile/src/design/tokens.ts), for the landing page.
export const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
export const body = Inter({ subsets: ["latin"], variable: "--font-body" });
