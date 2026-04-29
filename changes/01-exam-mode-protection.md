"# 🔴 Part 1 — Exam Mode Unintended Exits (Navigation Protection)

## 🔍 Diagnosis — the real bug

Open `app/unified/engine.tsx` and look at lines **255–277**. Here is what your code does today:

```tsx
// Line 255
usePreventRemove(
  !isNavigatingAway.current && (arenaMode === 'exam'),   // ← uses arenaMode
  ({ action }) => { ... }
);

// Line 277
const arenaMode = (params.mode as 'learning' | 'exam') || 'learning';  // ← declared AFTER
```

### Why it silently fails

In JavaScript, `const` and `let` are in the **Temporal Dead Zone (TDZ)** until the line where they're declared. Using `arenaMode` **before** the `const arenaMode = …` line throws a `ReferenceError: Cannot access 'arenaMode' before initialization`. React catches this and unmounts the hook, so `usePreventRemove` **never arms itself**. Result → iOS swipe-back, Android back-button, and tablet gestures all exit instantly.

You also only offer **Cancel** and **Discard** — the requirement is a **3-way prompt**: *Cancel / Exit without saving / Save & Exit*.

## 🎯 Goal
1. Move `arenaMode` declaration **above** `usePreventRemove`.
2. Change the `Alert` to have **3 buttons**.
3. Make sure the hook is active for `mode === 'exam'` only (learning mode stays free).

## 🗄️ SQL changes
**None.** This is pure frontend.

## 📁 File to change
`app/unified/engine.tsx` — snippet edit around lines **245–310**.

## 💻 Code (snippet)

### STEP 1 — Move `arenaMode` up
Find this block (line ~251–255):

```tsx
  const navigation = useNavigation();
  const isNavigatingAway = useRef(false);
  const sessionStartRef = useRef<number>(Date.now());

  // Prevent accidental exit during formal exams (gesture/back button)
  usePreventRemove(
```

Replace with:

```tsx
  const navigation = useNavigation();
  const isNavigatingAway = useRef(false);
  const sessionStartRef = useRef<number>(Date.now());

  // 🆕 Declare arenaMode FIRST — fixes TDZ crash
  const arenaMode = (params.mode as 'learning' | 'exam') || 'learning';

  // Prevent accidental exit during formal exams (gesture/back button)
  usePreventRemove(
```

### STEP 2 — Delete the duplicate declaration
Now scroll down to line ~277 and **DELETE** this line (it's the duplicate):

```tsx
  const arenaMode = (params.mode as 'learning' | 'exam') || 'learning';
```

### STEP 3 — Replace the Alert with a 3-button prompt

Find the full `usePreventRemove(...)` block and replace it with:

```tsx
  usePreventRemove(
    !isNavigatingAway.current && arenaMode === 'exam',
    ({ data }) => {
      // data.action = the navigation action the OS wants to perform
      Alert.alert(
        'Exit Exam?',
        'Your attempt is in progress. What would you like to do?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {}, // Stay on screen
          },
          {
            text: 'Exit without saving',
            style: 'destructive',
            onPress: () => {
              isNavigatingAway.current = true;
              navigation.dispatch(data.action);
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              try {
                // reuse your existing save function
                await commitManualSave(customTestName || 'Exam Session');
              } catch (e) {
                console.warn('Save on exit failed', e);
              } finally {
                isNavigatingAway.current = true;
                navigation.dispatch(data.action);
              }
            },
          },
        ],
        { cancelable: false } // ⚠️ prevents outside-tap-to-dismiss on Android
      );
    }
  );
```

> **Why `cancelable: false`?** On Android, tapping outside the alert would dismiss it and let the back-gesture proceed. We block that.

> **Why `data.action`, not `{ action }`?** Expo Router v6 + React Navigation 7 changed the signature. The callback now receives `{ data }` where `data.action` is what you dispatch. Your current `{ action }` destructure is wrong for RN-Nav 7 and silently breaks.

### STEP 4 — Also guard the hardware back button on Android

Add this `useEffect` right after the `usePreventRemove` block:

```tsx
  useEffect(() => {
    if (arenaMode !== 'exam') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // Returning true = we've \"handled\" back; navigation.dispatch in the Alert will actually do the exit
      if (!isNavigatingAway.current) {
        // Manually trigger the same flow
        navigation.dispatch({ type: 'GO_BACK' } as any);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [arenaMode]);
```

Add the import at the top of the file (if not already present):

```tsx
import { BackHandler } from 'react-native';
```

## 🧪 How to test
1. Start a test in **Exam mode** (`mode=exam` param).
2. **iOS:** swipe from the left edge → you should see the 3-button Alert.
3. **Android phone:** press hardware back button → same Alert.
4. **Android tablet:** 3-finger back gesture → same Alert.
5. Tap **Cancel** → you stay in the quiz.
6. Tap **Save & Exit** → an attempt row appears in Supabase `attempts` table and you're taken back.
7. Tap **Exit without saving** → no `attempts` row created, you're taken back.

## ⚠️ Common pitfalls
- Don't remove the `isNavigatingAway.current = true` line — without it, after `Save & Exit` navigates back the `usePreventRemove` re-fires and you get stuck in a loop.
- In **learning mode** the hook is *disabled* by the boolean — that's intentional; learning sessions shouldn't be guarded.
- If you test on **Expo Go**, the pre-v54 versions of `expo-router` had a bug where `usePreventRemove` was a no-op. You're on v54 — you're fine.
"