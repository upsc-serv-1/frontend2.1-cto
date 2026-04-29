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
