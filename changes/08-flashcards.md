"# 🟠 Part 8 — Flashcards: PGRST116, sectionMap.get, Image Upload, Options

## 🔍 Diagnosis

### Issue A — Options clipping & \"moves to next without showing\"
`app/flashcards/review.tsx` renders front-of-card with `numberOfLines` cap and a fixed height, so when the card has 4 options stitched into the question, the bottom 2 get clipped. Also, after `hard/good/easy/perfect` the `currentIndex++` runs **before** the SM-2 update returns → the user sees a blank card.

### Issue B — `PGRST116: zero rows`
In `src/services/FlashcardService.ts` line 172:
```ts
.from('user_cards').select('*').eq('user_id', userId).eq('card_id', cardId).single();
```
`.single()` **errors** if there are 0 rows. For a brand-new card you haven't reviewed yet, the row doesn't exist. Replace with `.maybeSingle()` (returns `null`).

### Issue C — `sectionMap.get is not a function`
`app/flashcards.tsx` line ~183 stores `sectionsMap` via `Object.fromEntries(...)` (a plain object) but later somewhere reads `.get(...)` like a Map. The plain object doesn't have `.get`. We'll convert at read-site.

### Issue D — No image upload
`FlashcardService.ts` accepts `front_image_url`/`back_image_url` but there's no UI to pick + upload. We'll add it.

## 🗄️ SQL — Storage bucket

```sql
-- Run in Supabase → Storage → create bucket via dashboard, OR via SQL:
INSERT INTO storage.buckets (id, name, public) 
VALUES ('flashcard-images', 'flashcard-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY \"users upload own flashcard images\"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'flashcard-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY \"anyone reads flashcard images\"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'flashcard-images');
```

## 📁 Files to change
- `src/services/FlashcardService.ts` (one liner)
- `app/flashcards.tsx` (sectionMap fix)
- `app/flashcards/review.tsx` (clipping + image render)
- `app/flashcards/new.tsx` (add image picker — snippet)
- `src/services/ImageUpload.ts` (full rewrite)

## 💻 Code

### STEP 1 — Replace `.single()` with `.maybeSingle()`
`src/services/FlashcardService.ts` line **172**:

```ts
// BEFORE
.from('user_cards').select('*').eq('user_id', userId).eq('card_id', cardId).single();

// AFTER
.from('user_cards').select('*').eq('user_id', userId).eq('card_id', cardId).maybeSingle();
```

If the result is `null` (first review of this card), insert a fresh row instead of updating:

```ts
const { data: existing } = await supabase
  .from('user_cards').select('*').eq('user_id', userId).eq('card_id', cardId).maybeSingle();

if (!existing) {
  await supabase.from('user_cards').insert({
    user_id: userId, card_id: cardId, ease_factor: 2.5,
    interval: 0, repetitions: 0, due_at: new Date().toISOString(),
  });
}
// then run your SM-2 update on the (now guaranteed) row
```

### STEP 2 — Fix `sectionMap.get`
`app/flashcards.tsx` — wherever you read `sectionMap.get(subject)`, replace with object access:

```tsx
// OLD (crashes)
const sections = sectionMap.get(item.name) || [];

// NEW
const sections = (sectionsMap[item.name]) || [];   // sectionsMap is a plain object
```

If you'd rather keep the `.get()` API, convert at read-site:

```tsx
const sectionMapView = useMemo(
  () => new Map(Object.entries(sectionsMap || {})),
  [sectionsMap]
);
// then sectionMapView.get(item.name)
```

### STEP 3 — Stop clipping in review screen
`app/flashcards/review.tsx`. Find the front-card container (look for `numberOfLines` on a `<Text>`):

```tsx
// BEFORE
<View style={{ height: 360 }}>
  <Text numberOfLines={6}>{currentCard.front}</Text>
  ...
</View>

// AFTER
<ScrollView style={{ maxHeight: 480, flexGrow: 0 }} contentContainerStyle={{ padding: 16 }}>
  <Text style={{ fontSize: 16, lineHeight: 24, color: colors.textPrimary }}>
    {currentCard.front}
  </Text>
  {currentCard.front_options && Object.entries(currentCard.front_options).map(([k, v]) => (
    <View key={k} style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
      <Text style={{ fontWeight: '900', color: colors.primary }}>{k}.</Text>
      <Text style={{ flex: 1, color: colors.textPrimary }}>{v as string}</Text>
    </View>
  ))}
  {currentCard.front_image_url && (
    <Image source={{ uri: currentCard.front_image_url }} resizeMode=\"contain\" style={{ width: '100%', height: 200, marginTop: 12, borderRadius: 8 }} />
  )}
</ScrollView>
```

### STEP 4 — Don't increment index until SM-2 returns

Find your `handleRate(level)`:

```tsx
const handleRate = async (level: 'hard' | 'good' | 'easy' | 'perfect') => {
  if (rating) return;
  setRating(true);
  try {
    await FlashcardSvc.recordReview(session!.user.id, currentCard.id, level);
    setShowAnswer(false);
    setCurrentIndex(i => i + 1);   // ← move AFTER await
  } catch (err) {
    Alert.alert('Error', 'Could not save review.');
  } finally {
    setRating(false);
  }
};
```

### STEP 5 — Image upload service (`src/services/ImageUpload.ts`, FULL FILE)

```ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';

export async function pickAndUploadFlashcardImage(userId: string): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (res.canceled || !res.assets[0]) return null;

  // Resize to max 1024px to save storage
  const compressed = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('flashcard-images')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: false });

  if (error) {
    console.error('Upload failed', error);
    return null;
  }

  const { data } = supabase.storage.from('flashcard-images').getPublicUrl(path);
  return data.publicUrl;
}
```

### STEP 6 — Wire it into `app/flashcards/new.tsx`

```tsx
import { pickAndUploadFlashcardImage } from '../../src/services/ImageUpload';

// Inside the form:
<TouchableOpacity
  onPress={async () => {
    const url = await pickAndUploadFlashcardImage(session!.user.id);
    if (url) setFrontImageUrl(url);
  }}
  style={{ padding: 12, borderRadius: 8, backgroundColor: colors.primary }}
>
  <Text style={{ color: '#fff', fontWeight: '700' }}>
    {frontImageUrl ? 'Change Front Image' : 'Add Front Image'}
  </Text>
</TouchableOpacity>

{frontImageUrl && (
  <Image source={{ uri: frontImageUrl }} style={{ width: 120, height: 120, borderRadius: 8, marginTop: 8 }} />
)}
```

When submitting the card:

```tsx
await FlashcardSvc.createFlashcard({
  user_id: session!.user.id,
  front: frontText,
  back: backText,
  front_image_url: frontImageUrl,
  back_image_url: backImageUrl,
  // ...rest
});
```

## 🧪 How to test
1. **Subject Hierarchy** screen no longer crashes when expanding a subject. ✅
2. **Revise All** → flashcard shows the question PLUS its 4 options. ✅
3. Tap \"Show Answer\" → answer + image render fully (no clipping).
4. Rate **Easy** on a card you've never reviewed → no PGRST116 error, card moves to next. ✅
5. Create a new flashcard → tap \"Add Front Image\" → pick photo → upload completes → image preview appears.
6. Open the new card in review mode → image renders.

## ⚠️ Common pitfalls
- `atob` is not in React Native's global by default. If you get `ReferenceError: atob`, add `import { decode as atob } from 'base-64';` and `npx expo install base-64`.
- `expo-file-system`'s `EncodingType` import path is `expo-file-system` (no submodule) in SDK 54.
- Storage RLS policies are easy to forget — without them, uploads return 403.
- `getPublicUrl` works only because we set `public: true` on the bucket. If you switch to private, swap to `createSignedUrl`.
"