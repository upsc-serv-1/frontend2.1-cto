/**
 * Auto-tagging mapping for UPSC subjects based on trigger words.
 */
export const AUTO_TAG_MAPPING: Record<string, string[]> = {
  'Polity': [
    'Constitution', 'Article', 'Amendment', 'Schedule',
    'Fundamental Rights', 'DPSP', 'Fundamental Duties',
    'Parliament', 'Lok Sabha', 'Rajya Sabha',
    'President', 'Vice President', 'Governor',
    'Supreme Court', 'High Court', 'Judicial Review',
    'Federalism', 'Separation of Powers',
    'Election Commission', 'CAG', 'Finance Commission',
    'Ordinance', 'Bill', 'Act', 'Tribunal',
    'Basic Structure Doctrine', 'Emergency Provisions'
  ],
  'Economy': [
    'GDP', 'GNP', 'Inflation', 'Deflation',
    'Fiscal Deficit', 'Revenue Deficit',
    'Monetary Policy', 'Repo Rate', 'Reverse Repo',
    'RBI', 'SEBI', 'NABARD',
    'Budget', 'Taxation', 'Subsidy',
    'Disinvestment', 'Privatization',
    'Balance of Payments', 'Forex',
    'Banking', 'NPA', 'Basel Norms',
    'FDI', 'FII', 'MSME', 'Startup'
  ],
  'Geography': [
    'Monsoon', 'Cyclone', 'Jet Stream',
    'Latitude', 'Longitude',
    'Plate Tectonics', 'Earthquake', 'Volcano',
    'River', 'Drainage Basin',
    'Soil Types', 'Vegetation',
    'Desert', 'Glacier',
    'Climate Change', 'El Niño', 'La Niña',
    'Ocean Currents', 'Biosphere', 'Ecosystem'
  ],
  'Environment': [
    'Biodiversity', 'Conservation',
    'National Park', 'Wildlife Sanctuary',
    'Endangered Species', 'IUCN',
    'Climate Change', 'Global Warming',
    'Carbon Sink', 'Carbon Credit',
    'Ozone Layer', 'Pollution',
    'Sustainable Development',
    'Environmental Impact Assessment', 'EIA',
    'COP', 'UNFCC'
  ],
  'History': [
    'Revolt', 'Movement', 'Congress',
    'British Rule', 'Governor General',
    'Charter Act', 'Regulating Act',
    'Freedom Struggle', 'Harappa', 'Vedic',
    'Maurya', 'Gupta', 'Sultanate', 'Mughal',
    'Treaty', 'Pact', 'Nationalism'
  ],
  'Science': [
    'ISRO', 'NASA', 'Satellite', 'Rocket',
    'DNA', 'RNA', 'Biotechnology',
    'Genetic Engineering', 'AI', 'Machine Learning',
    'Quantum Technology', 'Vaccine', 'Virus',
    'Semiconductor', 'Nanotechnology'
  ],
  'IR': [
    'UN', 'IMF', 'World Bank', 'WTO', 'WHO',
    'Treaty', 'Agreement', 'Indo-Pacific',
    'QUAD', 'BRICS', 'G20'
  ]
};

/**
 * Scans text for trigger words and returns matching tags.
 */
export function getAutoTags(text: string): string[] {
  if (!text) return [];
  
  const foundTags = new Set<string>();
  const lowerText = text.toLowerCase();

  for (const [tag, triggers] of Object.entries(AUTO_TAG_MAPPING)) {
    for (const trigger of triggers) {
      const regex = new RegExp(`\\b${trigger.toLowerCase()}\\b`, 'i');
      if (regex.test(lowerText)) {
        foundTags.add(tag);
        break;
      }
    }
  }

  return Array.from(foundTags);
}

/**
 * Wraps trigger words in markdown bold to highlight them in text.
 * Only highlights if the word is NOT already part of a markdown link or bold.
 */
export function highlightTriggersMarkdown(text: string): string {
  if (!text) return "";
  
  let processed = text;
  
  const allTriggers = Object.values(AUTO_TAG_MAPPING)
    .flat()
    .sort((a, b) => b.length - a.length);

  const uniqueTriggers = Array.from(new Set(allTriggers));

  for (const trigger of uniqueTriggers) {
    // Negative lookahead/lookbehind to avoid double-bolding
    // and avoid matching words already inside [brackets] or **stars**
    const regex = new RegExp(`(?<![\\*])\\b(${trigger})\\b(?![\\*])`, 'gi');
    processed = processed.replace(regex, '**$1**');
  }

  return processed;
}
