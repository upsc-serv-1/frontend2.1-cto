"# 🟡 Part 5 — Analyze Section: Filtering + Per-Question Error Tagging

## 🔍 Diagnosis
- `src/components/unified/ReviewSection.tsx` filters work in state (`filterMode === 'incorrect'`) but the `.filter(q => ...)` predicate uses the field `q.is_correct` — your attempt rows store this correctly, but **the predicate runs on `mergedQuestions` which doesn't carry `is_correct`** (only the raw attempt does).
- `src/components/unified/AnalyseSection.tsx` (Visual Analysis) renders the error category buttons but never actually renders the question stem. The code path takes `errorMap[questionId]` and only shows the question NUMBER, not the text.
- There is no per-Q error tag editor inline in the review flow.

## 🎯 Goal
1. When user picks \"All Incorrect\" / \"Not Attempted\" → the questions actually get filtered & rendered.
2. In each question card in the Review screen, show **5 error-type chips** (`Silly Mistake`, `Conceptual Gap`, `Elimination`, `Overthinking`, `Skipped`) tappable.
3. Tagging writes to `attempts.attempt_payload.questions[i].error_category` AND to `question_states.error_category`.
4. Visual Analysis chart re-aggregates by `error_category` — pie/bar updates live.

## 🗄️ SQL
You already have `error_category text` in `question_states`. Just make sure it's indexed:

```sql
CREATE INDEX IF NOT EXISTS idx_qstates_user_err
  ON question_states(user_id, error_category) WHERE error_category IS NOT NULL;
```

## 📁 Files to change
- `src/components/unified/ReviewSection.tsx`
- `src/components/unified/AnalyseSection.tsx`

## 💻 Code (snippets)

### STEP 1 — Fix the filter in `ReviewSection.tsx`

Find the section that builds `filteredQuestions` (search for `filterMode`). Replace with:

```tsx
const ERROR_TYPES = ['Silly Mistake', 'Conceptual Gap', 'Elimination', 'Overthinking', 'Skipped'];

const filteredQuestions = useMemo(() => {
  // attemptRow is the fetched attempt with attempt_payload.questions[]
  const qMap = new Map(
    (attemptRow?.attempt_payload?.questions || []).map((q: any) => [q.question_id, q])
  );

  return questions.filter(q => {
    const a = qMap.get(q.id);
    if (!a) return filterMode === 'unattempted';
    switch (filterMode) {
      case 'all':         return true;
      case 'correct':     return a.is_correct === true;
      case 'incorrect':   return a.selected_answer && !a.is_correct;
      case 'unattempted': return !a.selected_answer;
      default:            return true;
    }
  });
}, [questions, attemptRow, filterMode]);
```

### STEP 2 — Render the question stem + error chips per Q

In the `renderItem` (or `.map`) that draws each question card, add the chips:

```tsx
const handleTagError = async (questionId: string, errorType: string) => {
  // 1. Update the attempt_payload locally
  setAttemptRow(prev => {
    if (!prev) return prev;
    const next = JSON.parse(JSON.stringify(prev));
    const q = next.attempt_payload.questions.find((x: any) => x.question_id === questionId);
    if (q) q.error_category = errorType;
    return next;
  });

  // 2. Persist to attempts table (jsonb update)
  await supabase.rpc('update_attempt_error_category', {
    attempt_id: attemptRow.id,
    q_id: questionId,
    new_cat: errorType,
  });
  // (See SQL below for the RPC)

  // 3. Persist to question_states (so Visual Analysis aggregates)
  await supabase.from('question_states').upsert({
    user_id: session!.user.id,
    question_id: questionId,
    error_category: errorType,
  }, { onConflict: 'user_id,question_id' });
};

// Inside renderItem:
<View>
  <Text style={{ color: colors.textPrimary, fontWeight: '700', marginBottom: 8 }}>
    Q{index + 1}. {item.question_text}
  </Text>
  {/* options rendered here as before */}

  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
    {ERROR_TYPES.map(et => {
      const selected = currentErrorCat === et;
      return (
        <TouchableOpacity
          key={et}
          onPress={() => handleTagError(item.id, et)}
          style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
            backgroundColor: selected ? colors.primary : colors.surfaceStrong,
            borderWidth: 1, borderColor: selected ? colors.primary : colors.border,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: selected ? '#fff' : colors.textSecondary }}>
            {et}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
</View>
```

### STEP 3 — RPC for atomic JSONB update
Run in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION update_attempt_error_category(
  attempt_id uuid, q_id text, new_cat text
) RETURNS void AS $$
BEGIN
  UPDATE attempts
  SET attempt_payload = jsonb_set(
    attempt_payload,
    array['questions'],
    (
      SELECT jsonb_agg(
        CASE WHEN q->>'question_id' = q_id
             THEN jsonb_set(q, '{error_category}', to_jsonb(new_cat))
             ELSE q
        END
      )
      FROM jsonb_array_elements(attempt_payload->'questions') q
    )
  )
  WHERE id = attempt_id;
END;
$$ LANGUAGE plpgsql;
```

### STEP 4 — Make Visual Analysis show the question text

In `AnalyseSection.tsx` look for the loop that renders each error item. Replace the row with:

```tsx
{errorItems.map((row, idx) => (
  <View key={row.questionId} style={{ marginBottom: 16, padding: 12, backgroundColor: colors.surface, borderRadius: 12 }}>
    <Text style={{ fontWeight: '700', color: colors.textPrimary, marginBottom: 6 }}>
      Q{idx + 1}. {row.question_text}     {/* 🆕 actual stem */}
    </Text>
    <Text style={{ color: colors.textTertiary, fontSize: 11, marginBottom: 8 }}>
      Subject: {row.subject || '—'}  •  Tagged: {row.error_category || 'Untagged'}
    </Text>
    {/* keep the existing 5 chips IF you want users to retag from here too */}
  </View>
))}
```

`row.question_text` must be passed when you build `errorItems`. Update the builder (search `errorItems = useMemo`):

```tsx
const errorItems = useMemo(() => {
  return (attemptRow?.attempt_payload?.questions || []).map((q: any) => {
    const fullQ = questions.find(x => x.id === q.question_id);
    return {
      questionId: q.question_id,
      question_text: fullQ?.question_text || '(question not loaded)',
      subject: q.subject,
      error_category: q.error_category,
    };
  }).filter(r => r.error_category || (!r.is_correct && r.selected_answer));
}, [attemptRow, questions]);
```

### STEP 5 — Live update the chart
Wherever you compute the donut/bar (`errorTypeCounts`), make sure it depends on `attemptRow` so it re-renders after `handleTagError`:

```tsx
const errorTypeCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  (attemptRow?.attempt_payload?.questions || []).forEach((q: any) => {
    if (q.error_category) counts[q.error_category] = (counts[q.error_category] || 0) + 1;
  });
  return counts;
}, [attemptRow]);
```

## 🧪 How to test
1. Open Analyze → Review → tap \"All Incorrect\" → only wrong questions show. ✅
2. Tap \"Not Attempted\" → only skipped show. ✅
3. Tap a chip e.g. \"Silly Mistake\" on a question → row in `attempts.attempt_payload` updates AND `question_states` row appears. ✅
4. Switch to Visual Analysis tab → chart now shows \"Silly Mistake: 1\". ✅
5. Reload app → tags persist.

## ⚠️ Common pitfalls
- The RPC requires `gen_random_uuid()` etc. — make sure the `pgcrypto` extension is enabled (Supabase enables it by default).
- If `attemptRow.id` is null (legacy attempts), tagging only persists to `question_states` — your Visual Analysis can union from both sources.
- Don't aggregate from `question_states` only — it's per-USER not per-ATTEMPT. The `attempt_payload` is your source of truth for *this* test.
"