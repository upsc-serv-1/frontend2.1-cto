"# 🟠 Part 4 — Dashboard Widgets (Drag, Archive, Infinite Scroll Fix)

## 🔍 Diagnosis

Open `src/services/WidgetService.ts` and `app/(tabs)/index.tsx`:

- Widget config lives in **AsyncStorage** only — no SQL, no archive table.
- `removeWidget` simply filters the ID out — there's **no `is_archived` flag**, so deleted widgets are gone forever.
- The \"infinite blank widget\" comes from `<FlatList>` rendering widgets without a fixed height + an outer `ScrollView` that gives it `flex: 1`. FlatList inside a parent ScrollView with no height = **infinite container height**, which renders one giant blank row at the end.
- Widget order isn't stored — repositioning isn't possible.

## 🎯 Goal
1. Move widget config to a **Supabase table** with `position`, `is_archived`.
2. Use **`react-native-draggable-flatlist`** for long-press → drag-to-reorder.
3. Add a **\"Manage Widgets\"** sheet that shows Active + Archived; user can tap to restore.
4. Fix the infinite scroll bug.

## 🗄️ SQL — run in Supabase

```sql
CREATE TABLE IF NOT EXISTS user_widgets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  widget_key  text NOT NULL,                         -- 'streak' | 'accuracy' | etc.
  position    integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, widget_key)
);

CREATE INDEX IF NOT EXISTS idx_user_widgets_user_pos
  ON user_widgets(user_id, is_archived, position);

ALTER TABLE user_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"users see own widgets\" ON user_widgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## 📁 Files to change
- `src/services/WidgetService.ts` — full rewrite (small file).
- `app/(tabs)/index.tsx` — wrap widget area with `DraggableFlatList`.
- `src/components/widgets/WidgetRenderer.tsx` — add long-press handle.

## 💻 Code

### STEP 1 — Replace `WidgetService.ts` (full file)

```ts
import { supabase } from '../lib/supabase';

export const ALL_WIDGET_KEYS = [
  'streak', 'goal', 'accuracy', 'time_today',
  'history_5d', 'avg_per_q', 'questions_today', 'score_today',
];

export type Widget = {
  id: string;
  widget_key: string;
  position: number;
  is_archived: boolean;
};

class WidgetSvcImpl {
  async ensureSeeded(userId: string) {
    const { data } = await supabase
      .from('user_widgets').select('widget_key').eq('user_id', userId);
    const have = new Set((data || []).map(r => r.widget_key));
    const missing = ALL_WIDGET_KEYS.filter(k => !have.has(k));
    if (!missing.length) return;
    const rows = missing.map((k, i) => ({
      user_id: userId, widget_key: k, position: (data?.length || 0) + i, is_archived: false,
    }));
    await supabase.from('user_widgets').insert(rows);
  }

  async list(userId: string): Promise<Widget[]> {
    await this.ensureSeeded(userId);
    const { data, error } = await supabase
      .from('user_widgets').select('*').eq('user_id', userId)
      .order('position', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async archive(userId: string, id: string) {
    await supabase.from('user_widgets').update({ is_archived: true })
      .eq('id', id).eq('user_id', userId);
  }

  async restore(userId: string, id: string) {
    await supabase.from('user_widgets').update({ is_archived: false })
      .eq('id', id).eq('user_id', userId);
  }

  async reorder(userId: string, orderedIds: string[]) {
    // Batch update positions
    const updates = orderedIds.map((id, idx) =>
      supabase.from('user_widgets').update({ position: idx })
        .eq('id', id).eq('user_id', userId)
    );
    await Promise.all(updates);
  }
}

export const WidgetService = new WidgetSvcImpl();
```

### STEP 2 — `app/(tabs)/index.tsx` (snippet — replace widget rendering)

Find the place where widgets are rendered (look for `<FlatList` or `.map(w =>` with `WidgetRenderer`). Replace with:

```tsx
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { WidgetService, Widget } from '../../src/services/WidgetService';

// Inside component:
const [widgets, setWidgets] = useState<Widget[]>([]);
const [showManage, setShowManage] = useState(false);

useEffect(() => {
  if (!session?.user?.id) return;
  WidgetService.list(session.user.id).then(setWidgets);
}, [session?.user?.id]);

const activeWidgets = useMemo(() => widgets.filter(w => !w.is_archived), [widgets]);
const archivedWidgets = useMemo(() => widgets.filter(w => w.is_archived), [widgets]);

const handleArchive = async (id: string) => {
  await WidgetService.archive(session!.user.id, id);
  setWidgets(prev => prev.map(w => w.id === id ? { ...w, is_archived: true } : w));
};

const handleReorder = async ({ data }: { data: Widget[] }) => {
  setWidgets(prev => [...data, ...prev.filter(w => w.is_archived)]);
  await WidgetService.reorder(session!.user.id, data.map(d => d.id));
};
```

Then the actual list:

```tsx
<View style={{ height: activeWidgets.length * 110 + 20 }}>{/* 🆕 fixed height */}
  <DraggableFlatList
    data={activeWidgets}
    keyExtractor={(item) => item.id}
    onDragEnd={handleReorder}
    activationDistance={10}
    renderItem={({ item, drag, isActive }) => (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={250}
          disabled={isActive}
          style={{ marginBottom: 12 }}
        >
          <WidgetRenderer
            widgetKey={item.widget_key}
            onArchive={() => handleArchive(item.id)}
          />
        </TouchableOpacity>
      </ScaleDecorator>
    )}
  />
</View>

<TouchableOpacity onPress={() => setShowManage(true)} style={{ padding: 12, alignItems: 'center' }}>
  <Text style={{ color: colors.primary, fontWeight: '700' }}>
    Manage Widgets ({archivedWidgets.length} archived)
  </Text>
</TouchableOpacity>
```

> **THE INFINITE SCROLL FIX** is the `style={{ height: activeWidgets.length * 110 + 20 }}` on the wrapper. `DraggableFlatList` (like `FlatList`) **must** have a bounded height when nested inside a `ScrollView`. Replace `110` with your widget card height. If your widgets vary in height, give a generous max (e.g., `widgetCount * 140 + 20`).

### STEP 3 — Manage Widgets sheet (snippet)

```tsx
<Modal visible={showManage} transparent animationType=\"slide\">
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
    <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 16 }}>Archived Widgets</Text>
      <ScrollView>
        {archivedWidgets.map(w => (
          <TouchableOpacity
            key={w.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
            onPress={async () => {
              await WidgetService.restore(session!.user.id, w.id);
              setWidgets(prev => prev.map(x => x.id === w.id ? { ...x, is_archived: false } : x));
            }}
          >
            <Text style={{ color: colors.textPrimary }}>{w.widget_key}</Text>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>RESTORE</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={() => setShowManage(false)} style={{ padding: 16, alignItems: 'center' }}>
        <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>CLOSE</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

### STEP 4 — Add archive button on each widget
In `src/components/widgets/WidgetRenderer.tsx` accept an `onArchive` prop and render a small × in the corner:

```tsx
type Props = { widgetKey: string; onArchive?: () => void; };

export default function WidgetRenderer({ widgetKey, onArchive }: Props) {
  // ... existing rendering ...
  return (
    <View style={{ position: 'relative' }}>
      {/* existing widget body */}
      {onArchive && (
        <TouchableOpacity onPress={onArchive} style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}>
          <X size={14} color=\"#999\" />
        </TouchableOpacity>
      )}
    </View>
  );
}
```

## 🧪 How to test
1. Open dashboard → widgets render with **no infinite blank row**. ✅
2. Long-press a widget → it pops out → drag up/down → release → order persists after reload.
3. Tap **×** on a widget → it disappears AND a row in `user_widgets` has `is_archived = true`. ✅
4. Open **Manage Widgets** → archived ones listed → tap RESTORE → it returns to active list.
5. Refresh app → all widgets retain their order from `position` column.

## ⚠️ Common pitfalls
- If you see *\"VirtualizedLists should never be nested inside plain ScrollViews\"* → use `nestedScrollEnabled` on the outer ScrollView OR (better) move the rest of the dashboard into a `ListHeaderComponent` of `DraggableFlatList`.
- Position updates run as parallel queries — fine for ≤30 widgets. For >100 widgets, switch to a single SQL function (`update … using values (…)`).
- Always seed defaults via `ensureSeeded` — otherwise new users see an empty dashboard.
"