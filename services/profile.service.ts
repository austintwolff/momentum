import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

interface UpdateProfileParams {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
}

/**
 * Upload an avatar image to Supabase Storage.
 * Returns the public URL of the uploaded image.
 */
export async function uploadAvatar(
  userId: string,
  localUri: string
): Promise<string> {
  // Generate a unique filename
  const fileExt = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${userId}/${Date.now()}.${fileExt}`;
  const contentType = fileExt === 'png' ? 'image/png' : 'image/jpeg';

  let uploadData: ArrayBuffer | Blob;

  if (Platform.OS === 'web') {
    // On web, fetch the blob directly
    const response = await fetch(localUri);
    uploadData = await response.blob();
  } else {
    // On native, read as base64 and convert to ArrayBuffer
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });
    uploadData = decode(base64);
  }

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, uploadData, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Update the user's profile in the database.
 */
export async function updateProfileInDatabase(
  params: UpdateProfileParams
): Promise<void> {
  const { userId, displayName, avatarUrl } = params;

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (displayName !== undefined) {
    updateData.display_name = displayName;
  }

  if (avatarUrl !== undefined) {
    updateData.avatar_url = avatarUrl;
  }

  const { error } = await (supabase
    .from('profiles') as any)
    .update(updateData)
    .eq('id', userId);

  if (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}
