"# 🟡 Part 6 — Trends: Fix Chart Overlap + Subject Filter

## 🔍 Diagnosis
- `app/analyse.tsx` and `src/components/AnalyseBetaSection.tsx`/`Charts.tsx` render trend cards in a vertical list. Each chart uses fixed `width` from `Dimensions.get('window')`. When labels are long, SVG text spills out of its container — adjacent charts visually overlap.
- The `subjectFilter` state IS read in some hooks but the *Repeated Weakness Tracker*, *Performance Trajectory*, and *Subject Proficiency* components ignore it — they re-fetch `attempt_payload` and aggregate over **all** subjects.

## 🎯 Goal
1. Pass `subjectFilter` into every trend component as a prop.
2. Each component filters its data array `BEFORE` aggregation.
3. Add proper `marginBottom`, fixed `height`, and SVG `overflow: hidden` on each chart card.
4. If a chart has zero data after filtering → render an empty state, not a half-broken chart.

## 🗄️ SQL
None.

## 📁 Files to change
- `app/analyse.tsx` — pass `subjectFilter` everywhere.
- `src/components/Charts.tsx` — accept & apply the filter.
- `src/components/AnalyseBetaSection.tsx` — same.

## 💻 Code

### STEP 1 — Lift `subjectFilter` to a single source
In `app/analyse.tsx` near the top of the component:

```tsx
const [subjectFilter, setSubjectFilter] = useState<string>('All');
```

Where you render `<Charts ...>` and `<AnalyseBetaSection ...>`, pass it:

```tsx
<Charts subjectFilter={subjectFilter} attempts={attempts} />
<AnalyseBetaSection subjectFilter={subjectFilter} attempts={attempts} />
```

### STEP 2 — Filter inside each chart in `Charts.tsx`

```tsx
type Props = { subjectFilter: string; attempts: any[] };

export function Charts({ subjectFilter, attempts }: Props) {
  // Universal filter applied ONCE
  const filteredAttempts = useMemo(() => {
    if (subjectFilter === 'All') return attempts;
    return attempts.map(a => ({
      ...a,
      attempt_payload: {
        ...a.attempt_payload,
        questions: (a.attempt_payload?.questions || []).filter(
          (q: any) => q.subject === subjectFilter
        ),
      },
    })).filter(a => a.attempt_payload.questions.length > 0);   // 🆕 drop empty
  }, [attempts, subjectFilter]);

  // ALL downstream charts use filteredAttempts:
  return (
    <View>
      <RepeatedWeaknessTracker attempts={filteredAttempts} subject={subjectFilter} />
      <PerformanceTrajectory   attempts={filteredAttempts} subject={subjectFilter} />
      <NegativeMarkPenalty     attempts={filteredAttempts} subject={subjectFilter} />
      <SubjectProficiency      attempts={filteredAttempts} subject={subjectFilter} />
    </View>
  );
}
```

### STEP 3 — Empty-state guard inside each chart

Add this at the top of each chart component:

```tsx
if (!attempts || attempts.length === 0) {
  return (
    <View style={[styles.card, { padding: 32, alignItems: 'center' }]}>
      <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>
        No data for \"{subject}\"
      </Text>
    </View>
  );
}
```

### STEP 4 — Stop label overlap

In `Charts.tsx` styles, every chart card:

```tsx
card: {
  marginBottom: 24,                 // 🆕 increase from likely 12
  padding: 16,
  borderRadius: 16,
  backgroundColor: colors.surface,
  overflow: 'hidden',               // 🆕 critical
},
chartContainer: {
  width: '100%',
  height: 220,                      // 🆕 fixed; SVG label can no longer push siblings
},
```

For SVG `<Text>` labels in the trajectory chart, rotate long ones:

```tsx
<SvgText
  x={x}
  y={y}
  fontSize=\"9\"
  textAnchor=\"end\"
  transform={`rotate(-30, ${x}, ${y})`}      // 🆕 prevents x-axis label collisions
  fill={colors.textSecondary}
>
  {shortLabel}
</SvgText>
```

### STEP 5 — Hide subject-proficiency chart when filter ≠ All
Subject Proficiency by definition compares **across** subjects. If the user picks just \"Polity\", it doesn't make sense to render. So:

```tsx
{subjectFilter === 'All' && (
  <SubjectProficiency attempts={filteredAttempts} subject={subjectFilter} />
)}
```

Add the same guard to any other \"all-subjects-comparison\" chart.

## 🧪 How to test
1. Open Trends with **All subjects** → all 4 charts render, clear separation, no overlap. ✅
2. Switch to **Polity** → Repeated Weakness, Trajectory, Negative Penalty all show **Polity-only** data. ✅
3. Subject Proficiency disappears (correct — comparison chart needs all subjects).
4. Switch to a subject with no attempts → each card shows the empty state, not a broken chart.

## ⚠️ Common pitfalls
- Putting the filter inside each chart instead of `Charts.tsx` parent will cause **4× re-aggregation** on every filter change — slow.
- If you use `react-native-svg-charts`, its `<XAxis>` doesn't auto-rotate labels. Either swap to `victory-native` or rotate manually as shown.
- Always verify with React DevTools that `filteredAttempts` actually changes — sometimes a `useMemo` dependency is missing and you'll think the filter is broken when it's just a stale memo.
"s