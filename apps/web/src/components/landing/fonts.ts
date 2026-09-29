import { Big_Shoulders, DM_Mono, Inter_Tight } from "next/font/google";

// Landing page type: stadium-signage display, a tight grotesk for reading, mono for the "scoreboard".
export const display = Big_Shoulders({ subsets: ["latin"], weight: ["700", "800", "900"], variable: "--font-display" });
export const body = Inter_Tight({ subsets: ["latin"], variable: "--font-body" });
export const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });
