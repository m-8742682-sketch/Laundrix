// services/chatMediaUpload.ts
import axios from 'axios';

const CLOUD_NAME = 'dhnrq5mub';
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`;

// Upload presets for different media types
const PRESETS = {
  audio: 'laundrix_audio',
  image: 'laundrix_image',
  video: 'laundrix_video', // You'll need to create this in Cloudinary
  file: 'laundrix_file',   // You'll need to create this in Cloudinary
};

const MAX_SIZES = {
  audio: 10 * 1024 * 1024,  // 10MB
  image: 3 * 1024 * 1024,   // 3MB
  video: 50 * 1024 * 1024,  // 50MB
  file: 10 * 1024 * 1024,   // 10MB
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

/**
 * Upload any media type to Cloudinary
 */
export async function uploadMedia(
  uri: string,
  type: MediaType,
  folder?: string
): Promise<CloudinaryUploadResult> {
  // Check file size first
  const res = await fetch(uri);
  const blob = await res.blob();
  
  if (blob.size > MAX_SIZES[type]) {
    throw new Error(`${type} must be smaller than ${MAX_SIZES[type] / (1024 * 1024)}MB`);
  }

  const formData = new FormData();
  const filename = uri.split('/').pop() || `${type}_${Date.now()}`;
  
  // Map type to correct mime type and resource type
  const mimeTypes: Record<MediaType, string> = {
    audio: 'audio/m4a',
    image: blob.type || 'image/jpeg',
    video: 'video/mp4',
    file: blob.type || 'application/octet-stream',
  };

  const resourceTypes: Record<MediaType, string> = {
    audio: 'video', // Cloudinary treats audio as video resource
    image: 'image',
    video: 'video',
    file: 'raw',
  };

  formData.append('file', {
    uri,
    type: mimeTypes[type],
    name: filename,
  } as any);

  formData.append('upload_preset', PRESETS[type]);
  formData.append('folder', folder || `chat_${type}s`);

  // Auto-optimize images
  if (type === 'image') {
    formData.append('quality', 'auto');
    formData.append('fetch_format', 'auto');
  }

  try {
    const response = await axios.post(
      `${CLOUDINARY_URL}/${resourceTypes[type]}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 min for large videos
      }
    );

    return response.data;
  } catch (error) {
    console.error(`[chatMediaUpload] ${type} upload failed:`, error);
    throw new Error(`Failed to upload ${type} to Cloudinary`);
  }
}

/**
 * Upload multiple media files
 */
export async function uploadMultipleMedia(
  items: Array<{ uri: string; type: MediaType }>,
  folder?: string,
  onProgress?: (progress: number) => void
): Promise<CloudinaryUploadResult[]> {
  const results: CloudinaryUploadResult[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const result = await uploadMedia(items[i].uri, items[i].type, folder);
    results.push(result);
    onProgress?.(((i + 1) / items.length) * 100);
  }
  
  return results;
}

// Backward compatibility - keep existing function names
export const uploadAudio = (uri: string, folder?: string) => uploadMedia(uri, 'audio', folder);
export const uploadImage = (uri: string, folder?: string) => uploadMedia(uri, 'image', folder);
export const uploadVideo = (uri: string, folder?: string) => uploadMedia(uri, 'video', folder);
export const uploadFile = (uri: string, folder?: string) => uploadMedia(uri, 'file', folder);