import { Inter, Instrument_Serif } from "next/font/google";

// Landing page type: a light grotesk, with italic serif accent words.
export const sans = Inter({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-sans" });
export const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });
