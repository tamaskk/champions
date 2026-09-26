/**
 * Transfermarkt country names (flag titles) → the three-letter codes used in squadPlayers
 * (FIFA-style: ENG, GER, NED, ... – the same codes the squad import prompt asks for).
 * Historical states keep their own code (URS, YUG, TCH, GDR, ...).
 */
const CODES: Record<string, string> = {
  afghanistan: "AFG", albania: "ALB", algeria: "ALG", andorra: "AND", angola: "ANG",
  "antigua and barbuda": "ATG", argentina: "ARG", armenia: "ARM", aruba: "ARU", australia: "AUS",
  austria: "AUT", azerbaijan: "AZE", bahamas: "BAH", bahrain: "BHR", bangladesh: "BAN",
  barbados: "BRB", belarus: "BLR", belgium: "BEL", belize: "BLZ", benin: "BEN", bermuda: "BER",
  bhutan: "BHU", bolivia: "BOL", "bosnia herzegovina": "BIH", "bosnia and herzegovina": "BIH",
  botswana: "BOT", brazil: "BRA", "british virgin islands": "VGB", brunei: "BRU",
  "brunei darussalam": "BRU", bulgaria: "BUL", "burkina faso": "BFA", burundi: "BDI",
  cambodia: "CAM", cameroon: "CMR", canada: "CAN", "cape verde": "CPV", "cayman islands": "CAY",
  "central african republic": "CTA", chad: "CHA", chile: "CHI", china: "CHN",
  "chinese taipei": "TPE", taiwan: "TPE", colombia: "COL", comoros: "COM", congo: "CGO",
  "dr congo": "COD", "congo dr": "COD", zaire: "COD", "cook islands": "COK", "costa rica": "CRC",
  "cote d ivoire": "CIV", "ivory coast": "CIV", croatia: "CRO", cuba: "CUB", curacao: "CUW",
  cyprus: "CYP", "czech republic": "CZE", czechia: "CZE", cssr: "TCH", czechoslovakia: "TCH",
  denmark: "DEN", djibouti: "DJI", dominica: "DMA", "dominican republic": "DOM",
  "east germany": "GDR", "east germany gdr": "GDR", gdr: "GDR", "german dem republic": "GDR",
  ecuador: "ECU", egypt: "EGY", "el salvador": "SLV", england: "ENG",
  "equatorial guinea": "EQG", eritrea: "ERI", estonia: "EST", eswatini: "SWZ", swaziland: "SWZ",
  ethiopia: "ETH", "faroe islands": "FRO", fiji: "FIJ", finland: "FIN", france: "FRA",
  "french guiana": "GUF", gabon: "GAB", gambia: "GAM", "the gambia": "GAM", georgia: "GEO",
  germany: "GER", ghana: "GHA", gibraltar: "GIB", greece: "GRE", grenada: "GRN",
  guadeloupe: "GLP", guam: "GUM", guatemala: "GUA", guinea: "GUI", "guinea bissau": "GNB",
  guyana: "GUY", haiti: "HAI", honduras: "HON", "hong kong": "HKG", hungary: "HUN",
  iceland: "ISL", india: "IND", indonesia: "IDN", iran: "IRN", iraq: "IRQ", ireland: "IRL",
  "republic of ireland": "IRL", israel: "ISR", italy: "ITA", jamaica: "JAM", japan: "JPN",
  jordan: "JOR", kazakhstan: "KAZ", kenya: "KEN", "korea south": "KOR", "south korea": "KOR",
  "korea north": "PRK", "north korea": "PRK", kosovo: "KVX", kuwait: "KUW", kyrgyzstan: "KGZ",
  laos: "LAO", latvia: "LVA", lebanon: "LBN", lesotho: "LES", liberia: "LBR", libya: "LBY",
  liechtenstein: "LIE", lithuania: "LTU", luxembourg: "LUX", macao: "MAC", madagascar: "MAD",
  malawi: "MWI", malaysia: "MAS", maldives: "MDV", mali: "MLI", malta: "MLT",
  martinique: "MTQ", mauritania: "MTN", mauritius: "MRI", mayotte: "MYT", mexico: "MEX",
  moldova: "MDA", monaco: "MCO", mongolia: "MNG", montenegro: "MNE", montserrat: "MSR",
  morocco: "MAR", mozambique: "MOZ", myanmar: "MYA", burma: "MYA", namibia: "NAM", nepal: "NEP",
  netherlands: "NED", "netherlands antilles": "ANT", "new caledonia": "NCL", "new zealand": "NZL",
  nicaragua: "NCA", niger: "NIG", nigeria: "NGA", "north macedonia": "MKD", macedonia: "MKD",
  "northern ireland": "NIR", norway: "NOR", oman: "OMA", pakistan: "PAK", palestine: "PLE",
  panama: "PAN", "papua new guinea": "PNG", paraguay: "PAR", peru: "PER", philippines: "PHI",
  poland: "POL", portugal: "POR", "puerto rico": "PUR", qatar: "QAT", reunion: "REU",
  romania: "ROU", russia: "RUS", ussr: "URS", "soviet union": "URS", "udssr": "URS",
  rwanda: "RWA", saarland: "SAA", "saudi arabia": "KSA", scotland: "SCO", senegal: "SEN",
  serbia: "SRB", "serbia and montenegro": "SCG", yugoslavia: "YUG", "jugoslawien": "YUG",
  seychelles: "SEY", "sierra leone": "SLE", singapore: "SIN", "sint maarten": "SXM",
  slovakia: "SVK", slovenia: "SVN", "solomon islands": "SOL", somalia: "SOM",
  "south africa": "RSA", "south sudan": "SSD", spain: "ESP", "sri lanka": "SRI",
  "st kitts and nevis": "SKN", "st kitts nevis": "SKN", "st lucia": "LCA",
  "st vincent and the grenadines": "VIN", "st vincent grenadinen": "VIN", "st martin": "SMN",
  "saint martin": "SMN", "st pierre and miquelon": "SPM", sudan: "SDN", suriname: "SUR",
  sweden: "SWE", switzerland: "SUI", syria: "SYR", tahiti: "TAH", tajikistan: "TJK",
  tanzania: "TAN", thailand: "THA", "timor leste": "TLS", togo: "TOG", tonga: "TGA",
  "trinidad and tobago": "TRI", tunisia: "TUN", turkey: "TUR", turkiye: "TUR",
  turkmenistan: "TKM", "turks and caicos islands": "TCA", uganda: "UGA", ukraine: "UKR",
  "united arab emirates": "UAE", "united states": "USA", usa: "USA", uruguay: "URU",
  "us virgin islands": "VIR", uzbekistan: "UZB", vanuatu: "VAN", venezuela: "VEN",
  vietnam: "VIE", wales: "WAL", yemen: "YEM", zambia: "ZAM", zimbabwe: "ZIM",
  "west germany": "GER", "german reich": "GER",
};

export function normalizeCountry(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

/** Three-letter code, or null when the name is unknown (the caller logs those). */
export function countryCode(name: string): string | null {
  return CODES[normalizeCountry(name)] ?? null;
}
