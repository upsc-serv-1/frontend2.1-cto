
/**
 * Unified merging logic for Canonical questions across the app.
 * Groups questions by canonicalId (from vaultMeta) or falls back to robust text matching.
 */
export const mergeQuestions = (questions: any[]) => {
  const mergedQs: any[] = [];
  const canonicalMap = new Map<string, any>();
  const textMap = new Map<string, any>();
  const explanationMap = new Map<string, any>();
  const optionsMap = new Map<string, any>();
  const idToMergedId = new Map<string, string>();

  const cleanText = (text: string) => {
    if (!text) return "";
    return text
      .replace(/<[^>]*>?/gm, '') // Strip HTML
      .toLowerCase()
      .replace(/[^\w]/g, '')     // Strip EVERYTHING except letters and numbers (removes spaces, punctuation, slashes)
      .trim();
  };

  const getInstitute = (q: any) => {
    let inst = q.tests?.institute || q.provider;
    if (!inst && q.test_id) {
      const parts = q.test_id.split('-');
      if (parts.length > 0) {
        const first = parts[0].toLowerCase();
        if (['forum', 'vision', 'insights', 'iasbaba', 'vajiram', 'nextias', 'pw', 'raus'].includes(first)) {
          inst = first.charAt(0).toUpperCase() + first.slice(1);
        }
      }
    }
    return inst || 'UPSC';
  };

  questions.forEach(q => {
    let vaultMeta: any = null;
    try {
      if (q.source_attribution_label) {
        const parsed = typeof q.source_attribution_label === 'string' 
          ? JSON.parse(q.source_attribution_label) 
          : q.source_attribution_label;
        vaultMeta = parsed.__vaultMeta;
      }
    } catch (e) { /* ignore */ }

    // Priority 1: Official Canonical ID
    const cId = vaultMeta?.canonicalId || (vaultMeta?.isCanonical ? q.id : null) || vaultMeta?._canonicalQuestionId;
    
    // Priority 2: Text Match
    const textKey = cleanText(q.question_text);
    const explKey = cleanText(q.explanation_markdown);
    
    // Priority 3: Options Match (Very aggressive)
    const optionsKey = q.options ? Object.values(q.options).sort().join('|').toLowerCase().replace(/[^\w]/g, '') : null;

    let existing: any = null;

    if (cId) {
      existing = canonicalMap.get(cId);
    } else if (textKey && textKey.length > 30) {
      existing = textMap.get(textKey);
    } else if (explKey && explKey.length > 100) {
      existing = explanationMap.get(explKey);
    } else if (optionsKey && optionsKey.length > 50) {
      existing = optionsMap.get(optionsKey);
    }

    if (existing) {
      idToMergedId.set(q.id, existing.id);
      mergeData(existing, q, getInstitute(q));
    } else {
      prepareQuestion(q, getInstitute(q));
      if (cId) canonicalMap.set(cId, q);
      if (textKey) textMap.set(textKey, q);
      if (explKey) explanationMap.set(explKey, q);
      if (optionsKey) optionsMap.set(optionsKey, q);
      idToMergedId.set(q.id, q.id);
      mergedQs.push(q);
    }
  });

  return { mergedQs, idToMergedId };
};

const prepareQuestion = (q: any, inst: string) => {
  q._institutes = [inst];
  q._explanations = q.explanation_markdown ? [{ source: inst, text: q.explanation_markdown }] : [];
  q._mergedIds = [q.id];
};

const mergeData = (existing: any, q: any, inst: string) => {
  if (!existing._institutes) existing._institutes = [existing.tests?.institute || existing.provider || 'UPSC'];
  if (!existing._institutes.includes(inst)) {
    existing._institutes.push(inst);
  }
  
  if (!existing._mergedIds) existing._mergedIds = [existing.id];
  if (!existing._mergedIds.includes(q.id)) existing._mergedIds.push(q.id);

  if (!existing._explanations) {
    existing._explanations = existing.explanation_markdown ? [{ source: existing._institutes[0], text: existing.explanation_markdown }] : [];
  }

  if (q.explanation_markdown && q.explanation_markdown.trim()) {
    const qExplStripped = q.explanation_markdown.toLowerCase().replace(/[^\w\s]/g, '');
    const hasSimilar = existing._explanations.some((e: any) => {
      const eStripped = e.text.toLowerCase().replace(/[^\w\s]/g, '');
      return eStripped.includes(qExplStripped.substring(0, 100)) || qExplStripped.includes(eStripped.substring(0, 100));
    });

    if (!hasSimilar) {
      existing._explanations.push({ source: inst, text: q.explanation_markdown });
      // Keep the main markdown field as the first one for backward compatibility
      if (!existing.explanation_markdown) existing.explanation_markdown = q.explanation_markdown;
    }
  }
};
