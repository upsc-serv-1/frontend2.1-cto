const TAG_LABELS: Record<string, string> = {
  'imp.fact': 'Imp. Fact',
  'imp.fact': 'Imp. Fact',
  'imp.concept': 'Imp. Concept',
  'imp.concept': 'Imp. Concept',
  'trap question': 'Trap Question',
  'must revise': 'Must Revise',
  'memorize': 'Memorize',
};

export function normalizeTag(tag: string | null | undefined): string {
  return String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function formatTagLabel(tag: string | null | undefined): string {
  const normalized = normalizeTag(tag);
  if (!normalized) return '';
  if (TAG_LABELS[normalized]) return TAG_LABELS[normalized];

  return normalized
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function tagsMatch(tags: string[] | null | undefined, target: string | null | undefined): boolean {
  const normalizedTarget = normalizeTag(target);
  if (!normalizedTarget || !Array.isArray(tags)) return false;
  return tags.some(tag => normalizeTag(tag) === normalizedTarget);
}

export function summarizeTagCounts(tags: Array<string[] | null | undefined>) {
  const counts: Record<string, { label: string; count: number }> = {};

  tags.forEach(tagList => {
    if (!Array.isArray(tagList)) return;
    tagList.forEach(tag => {
      const normalized = normalizeTag(tag);
      if (!normalized) return;
      if (!counts[normalized]) {
        counts[normalized] = { label: formatTagLabel(tag), count: 0 };
      }
      counts[normalized].count += 1;
    });
  });

  return Object.entries(counts).map(([key, value]) => ({
    key,
    name: value.label,
    count: value.count,
  }));
}
