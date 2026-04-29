"# 🟠 Part 2 — Notes Pro Drag & Drop + Folder Movement

## 🔍 Diagnosis

Open `app/notes.tsx`. Two problems:

### Issue A — \"Confirm Move\" does nothing
Around **line 339** `handleMoveNoteAction` reads `targetSubject` to build the new `parent_id`. But when the user drags a note to a target folder in `DraggableNoteCard` (line 390+), you only call `setMoveTarget(note)` + `setMoveNoteVisible(true)` — **you never pre-fill `targetSubject`**. The user has to manually tap a destination in the modal. That's fine — but many users don't realize they need to tap a row, so they just click \"Confirm Move\" while `targetSubject` is `null` → the button is disabled (it visually looks enabled due to the `colors.textTertiary` fallback, but `onPress` early-returns).

### Issue B — Long-press \"Move Folder\" on a sub-folder bypasses the picker
Look at `TreeMicroTopic` (~line 488) and `TreeSection` (~line 523):

```tsx
{ text: \"Move Folder\", onPress: () => { 
    setMoveTarget(topic); 
    setTargetSubject(topic.parentId || 'root');   // ← BUG
    setMoveNoteVisible(true); 
} },
```

You **pre-select** `targetSubject = topic.parentId || 'root'`. If the folder has no parent (top level), this becomes `'root'`. Then the modal opens already pre-selected on *Root*, and if the user just clicks Confirm — it \"moves to root\" (i.e., nowhere). Worse: on many users it looks like the modal *silently closed* and the folder jumped to root.

## 🎯 Goal
1. Confirm-Move button must be **visually disabled** when no destination is chosen.
2. For folders, open the modal with **NO pre-selection** → forces the user to pick a destination.
3. Add **folders** (not just notes) to the list of items the picker can move.
4. When dragging a note **onto a folder card** in the tree, auto-move without a modal.

## 🗄️ SQL changes — **CRITICAL**
The move flow uses one table: `user_note_nodes`. Make sure this index exists (massive perf boost for deep trees):

```sql
-- Run in Supabase → SQL Editor
CREATE INDEX IF NOT EXISTS idx_nodes_user_parent 
  ON user_note_nodes(user_id, parent_id);

-- Prevent circular moves (a folder becoming its own grandparent).
-- We'll enforce this in JS too, but a DB guard is defence-in-depth.
CREATE OR REPLACE FUNCTION prevent_cycle_move()
RETURNS trigger AS $$
DECLARE
  cur uuid := NEW.parent_id;
BEGIN
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'Cannot move folder into its own descendant';
    END IF;
    SELECT parent_id INTO cur FROM user_note_nodes WHERE id = cur;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_cycle ON user_note_nodes;
CREATE TRIGGER trg_prevent_cycle
  BEFORE UPDATE OF parent_id ON user_note_nodes
  FOR EACH ROW EXECUTE FUNCTION prevent_cycle_move();
```

## 📁 Files to change
- `app/notes.tsx` — snippet edits.

## 💻 Code (snippets)

### STEP 1 — Fix folder long-press to open empty picker
Find **line ~486** in `TreeMicroTopic`:

```tsx
{ text: \"Move Folder\", onPress: () => { setMoveTarget(topic); setTargetSubject(topic.parentId || 'root'); setMoveNoteVisible(true); } },
```

Change to:

```tsx
{ text: \"Move Folder\", onPress: () => { 
    setMoveTarget(topic); 
    setTargetSubject(null);              // 🆕 force user to pick
    setMoveNoteVisible(true); 
} },
```

Repeat the same change in `TreeSection` (~line 523) and `SubjectCard` (~line 561).

### STEP 2 — Disable the Confirm button visually when null
Find the `moveSubmitBtn` (~line 1081):

```tsx
<TouchableOpacity 
  style={[styles.moveSubmitBtn, { 
    backgroundColor: targetSubject ? colors.primary : colors.textTertiary,
    opacity: isMoving ? 0.6 : 1,
  }]}
  onPress={() => {
    if (!targetSubject || isMoving) return;
    handleMoveNoteAction();
  }}
```

Replace with:

```tsx
<TouchableOpacity 
  disabled={!targetSubject || isMoving}
  style={[styles.moveSubmitBtn, { 
    backgroundColor: targetSubject ? colors.primary : colors.border,
    opacity: !targetSubject ? 0.5 : (isMoving ? 0.6 : 1),
  }]}
  onPress={() => {
    if (!targetSubject || isMoving) {
      Alert.alert('Pick a destination', 'Tap a folder above (or \"Main Dashboard\") before confirming.');
      return;
    }
    handleMoveNoteAction();
  }}
```

### STEP 3 — Make `handleMoveNoteAction` work for **both** notes and folders

The current function (line 339) uses `.update({ parent_id })` which is correct for both. **But** you need to avoid moving a folder into itself. Replace the whole function with:

```tsx
const handleMoveNoteAction = async () => {
  if (!moveTarget || !targetSubject) return;

  // 🛡️ Safety: can't move a folder into itself (or its own descendants)
  if (moveTarget.id === targetSubject) {
    Alert.alert('Invalid', 'Cannot move a folder into itself.');
    return;
  }

  setIsMoving(true);
  try {
    const { error } = await supabase
      .from('user_note_nodes')
      .update({ parent_id: targetSubject === 'root' ? null : targetSubject })
      .eq('id', moveTarget.id);

    if (error) {
      // Our DB trigger fires here on cyclic moves
      if (error.message?.includes('descendant')) {
        Alert.alert('Invalid Move', 'You cannot move a folder into one of its sub-folders.');
      } else {
        throw error;
      }
      return;
    }

    setMoveNoteVisible(false);
    setMoveTarget(null);
    setTargetSubject(null);               // 🆕 reset for next time
    setActionNote(null);
    refresh();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {
    console.error(e);
    Alert.alert('Error', 'Could not move item.');
  } finally {
    setIsMoving(false);
  }
};
```

### STEP 4 — When dragging a note onto a folder card, auto-move

Right now your `DraggableNoteCard.panGesture.onEnd` (line 413) always opens the modal. Use the `folderLayouts.value` map you already maintain to auto-hit-test:

```tsx
.onEnd((e) => {
  'worklet';
  isPressed.value = false;

  if (hasDragged.value) {
    // Find folder under finger
    const x = e.absoluteX;
    const y = e.absoluteY;
    let hitFolderId: string | null = null;
    const layouts = folderLayouts.value;
    for (const [id, box] of Object.entries(layouts)) {
      if (id === note.id) continue;
      if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        hitFolderId = id;
        break;
      }
    }

    if (hitFolderId) {
      // Drop on folder → auto-move
      runOnJS(moveNoteToFolder)(note.note_id, hitFolderId);
    } else {
      // Drop on empty space → show picker
      runOnJS(setMoveTarget)(note);
      runOnJS(setMoveNoteVisible)(true);
      runOnJS(setTargetSubject)(null);   // 🆕 reset
    }
  }

  offset.value = { x: 0, y: 0 };
}),
```

### STEP 5 — Also show the `moveNoteToFolder` success toast

Your existing `moveNoteToFolder` (line 375) is good. Just one tweak — it updates `parent_id` by `note_id`, but `user_note_nodes.id` is the canonical key. Change:

```tsx
.eq('note_id', noteId);
```

to:

```tsx
.eq('note_id', noteId)
.eq('user_id', session?.user?.id);   // 🆕 RLS guard
```

## 🧪 How to test
1. **Long-press a folder → Move Folder** → modal opens with **no** row highlighted.
2. Tap \"Confirm Move\" → you get an Alert \"Pick a destination\". ✅
3. Pick a destination → folder moves.
4. Try to move a folder into its own sub-folder → you see *\"Cannot move a folder into one of its sub-folders\"*. ✅
5. Inside a sub-folder: **drag a note onto a visible folder card** → it moves instantly (haptic feedback). ✅
6. Drag a note **outside** any folder → picker modal opens (you still get choice).

## ⚠️ Common pitfalls
- The DB trigger (SQL above) is your safety net — do NOT skip it.
- After moving, always call `refresh()` — otherwise the UI shows stale hierarchy.
- If `vaultData.allFolders` doesn't include deeply nested folders, check `useNotesPilotVault.ts` — it may need to recurse further.
"