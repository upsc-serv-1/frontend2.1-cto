"# 🟡 Part 7 — PYQ Heatmap: Remove Coverage Table, Sort Years DESC, Fix Sticky Header

## 🔍 Diagnosis
Open `app/pyq.tsx`:

- **Around line 800–808** there's a \"Paper totals vs fetched\" coverage table — the user explicitly wants this gone.
- `years` array (line ~165) is built ascending by default — 2013 first, 2025 last. User wants newest first.
- The heatmap uses two `ScrollView`s (one horizontal for years, one vertical for subjects). The header row has `position: 'absolute'` but its `top` doesn't match the body's `paddingTop`, causing the *\"Subject\" header overlaps year-2016 row*.

## 🎯 Goal
1. **Delete** the entire coverage block (Paper totals vs fetched).
2. Sort `years` DESC (2025 → 2013).
3. Implement a proper **sticky-corner heatmap layout**: top-left corner is fixed, top row is horizontally sticky, left column is vertically sticky, and they never overlap.

## 🗄️ SQL
None.

## 📁 File to change
- `app/pyq.tsx`.

## 💻 Code

### STEP 1 — Sort years DESC

Find where `years` is built (~line 160–170 in `pyq.tsx`):

```tsx
const years = useMemo(() => {
  const ys = new Set<number>();
  rawQuestions.forEach(q => { /* ... */ });
  return Array.from(ys).sort();              // ← old: ascending
}, [rawQuestions]);
```

Change to:

```tsx
return Array.from(ys).sort((a, b) => b - a);  // 🆕 DESC: 2025, 2024, ..., 2013
```

### STEP 2 — Remove the coverage table

Find the JSX block around lines **800–815** that has `row.fetched` / `row.expected`. **Delete the entire block** — including its parent `<View>` and any heading like \"Paper Totals vs Fetched\".

Search for `expected - row.fetched` to find the exact location. Delete from the heading text down to the closing `</View>` of that section.

### STEP 3 — Replace each heatmap with a sticky-corner layout

Currently each heatmap is something like:

```tsx
<ScrollView horizontal>
  <View>
    <View style={styles.heatmapHeader}>
      <Text>Subject</Text>
      {years.map(y => <Text>{y}</Text>)}
    </View>
    {data.map(row => (
      <View style={styles.heatmapRow}>
        <Text>{row.name}</Text>
        {years.map(y => <Text>{row.values[y]}</Text>)}
      </View>
    ))}
  </View>
</ScrollView>
```

Replace with a **2-axis sticky** version. Add this helper component **at the top of the file**:

```tsx
const CELL_W = 60;
const CELL_H = 36;
const LABEL_W = 130;

function StickyHeatmap({
  rows, years, getValue, onCellPress, colors,
}: {
  rows: { name: string; values: Record<string, number> }[];
  years: number[];
  getValue: (row: any, year: number) => number;
  onCellPress?: (row: any, year: number) => void;
  colors: any;
}) {
  const horizontalRef = useRef<ScrollView>(null);
  const headerRef = useRef<ScrollView>(null);

  const onBodyScroll = (e: any) => {
    headerRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false });
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* LEFT STICKY COLUMN */}
      <View style={{ width: LABEL_W, backgroundColor: colors.surface, zIndex: 2 }}>
        <View style={{ height: CELL_H, justifyContent: 'center', paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontWeight: '900', color: colors.textPrimary }}>Subject</Text>
        </View>
        {rows.map(row => (
          <View key={row.name} style={{ height: CELL_H, justifyContent: 'center', paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text numberOfLines={1} style={{ color: colors.textPrimary, fontWeight: '700' }}>{row.name}</Text>
          </View>
        ))}
      </View>

      {/* RIGHT SCROLLABLE GRID */}
      <View style={{ flex: 1 }}>
        {/* Sticky top row */}
        <ScrollView
          ref={headerRef}
          horizontal
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ flexDirection: 'row' }}>
            {years.map(y => (
              <View key={y} style={{ width: CELL_W, height: CELL_H, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontWeight: '900', color: colors.textPrimary }}>{y}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Body */}
        <ScrollView
          ref={horizontalRef}
          horizontal
          showsHorizontalScrollIndicator
          onScroll={onBodyScroll}
          scrollEventThrottle={16}
        >
          <View>
            {rows.map(row => (
              <View key={row.name} style={{ flexDirection: 'row' }}>
                {years.map(y => {
                  const v = getValue(row, y);
                  return (
                    <TouchableOpacity
                      key={y}
                      disabled={!v || !onCellPress}
                      onPress={() => onCellPress?.(row, y)}
                      style={{
                        width: CELL_W, height: CELL_H,
                        justifyContent: 'center', alignItems: 'center',
                        borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.border,
                        backgroundColor: v ? colors.primary + Math.min(99, 30 + v * 6).toString(16) : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: v ? '#fff' : colors.textTertiary }}>
                        {v || '·'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
```

### STEP 4 — Use it for all 4 heatmaps

Replace each old heatmap JSX with:

```tsx
<StickyHeatmap
  rows={(SUBJECTS_OR_TOPICS_ARRAY).map(name => ({
    name,
    values: Object.fromEntries(years.map(y => [y, heatmapData[y]?.[name] || 0])),
  }))}
  years={years}
  getValue={(row, y) => row.values[y] || 0}
  onCellPress={(row, y) => navigateToLearning({ subject: heatmapSubject, micro: row.name, year: y })}
  colors={colors}
/>
```

Do this for: **Subject × Year**, **Top 20 Topics × Year**, **Section Group × Year**, **Macro Topic × Year**.

### STEP 5 — Remove old `heatmapHeader` / `heatmapRow` style usage
Delete or repurpose the old `styles.heatmapHeader` / `styles.heatmapRow` blocks once nothing references them. (Lint will tell you.)

## 🧪 How to test
1. Open PYQ → Heatmaps tab.
2. The \"Paper totals vs fetched\" table is gone. ✅
3. Year row reads **2025, 2024, 2023, …** (newest left). ✅
4. Scroll horizontally → year header row moves with body, subject column stays fixed. ✅
5. Scroll vertically → subject column stays in sync, header row stays pinned. ✅
6. Tap any non-zero cell → opens Learning view filtered to that subject + year.

## ⚠️ Common pitfalls
- The header `<ScrollView>` MUST have `scrollEnabled={false}` — only the body drives scroll, header just mirrors it via `scrollTo`.
- On Android, `scrollEventThrottle` < 16 can cause jitter; keep it at 16.
- If cells flash on press, wrap `<TouchableOpacity>` in `React.memo`.
"