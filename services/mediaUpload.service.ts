// services/mediaUpload.service.ts
import axios from 'axios';

const CLOUD_NAME = 'dhnrq5mub';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

const PRESETS: Record<MediaType, string> = {
  audio: 'laundrix_audio',
  image: 'laundrix_image',
  video: 'laundrix_video',
  file: 'laundrix_file',
};

const MAX_SIZES: Record<MediaType, number> = {
  audio: 10 * 1024 * 1024,  // 10 MB
  image: 3 * 1024 * 1024,   // 3 MB
  video: 50 * 1024 * 1024,  // 50 MB
  file: 10 * 1024 * 1024,   // 10 MB
};

const MIME_TYPES: Record<MediaType, string> = {
  audio: 'audio/m4a',
  image: 'image/jpeg',
  video: 'video/mp4',
  file: 'application/octet-stream',
};

// Cloudinary resource type mapping
// Note: Cloudinary treats audio files as 'video' resource type
const RESOURCE_TYPES: Record<MediaType, string> = {
  audio: 'video',
  image: 'image',
  video: 'video',
  file: 'raw',
};

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
  duration?: number;
  width?: number;
  height?: number;
};

export type MediaType = 'audio' | 'image' | 'video' | 'file';

export async function uploadMedia(
  uri: string,
  type: MediaType,
  folder?: string
): Promise<CloudinaryUploadResult> {
  const res = await fetch(uri);
  const blob = await res.blob();

  if (blob.size > MAX_SIZES[type]) {
    throw new Error(`${type} must be smaller than ${MAX_SIZES[type] / (1024 * 1024)}MB`);
  }

  const formData = new FormData();
  const filename = uri.split('/').pop() || `${type}_${Date.now()}`;

  formData.append('file', {
    uri,
    type: blob.type || MIME_TYPES[type],
    name: filename,
  } as any);

  formData.append('upload_preset', PRESETS[type]);
  formData.append('folder', folder || `chat_${type}s`);

  if (type === 'image') {
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');
  }

  try {
    const response = await axios.post(
      `${CLOUDINARY_URL}/${RESOURCE_TYPES[type]}/upload`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000, // 2 min for large videos
      }
    );
    return response.data;
  } catch (error) {
    console.error(`[mediaUpload] ${type} upload failed:`, error);
    throw new Error(`Failed to upload ${type} to Cloudinary`);
  }
}

export async function uploadMultipleMedia(
  items: Array<{ uri: string; type: MediaType }>,
  folder?: string,
  onProgress?: (progress: number) => void
): Promise<CloudinaryUploadResult[]> {
  const results: CloudinaryUploadResult[] = [];

  for (let i = 0; i < items.length; i++) {
    results.push(await uploadMedia(items[i].uri, items[i].type, folder));
    onProgress?.(((i + 1) / items.length) * 100);
  }

  return results;
}
