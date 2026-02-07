const CLOUD_NAME = "dhnrq5mub";
const IMAGE_PRESET = "laundrix_image";
const MAX_IMAGE_MB = 3;

export async function uploadAudio(
  uri: string,
  channel: string
): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();

  if (blob.size > 10 * 1024 * 1024) {
    throw new Error("Audio must be smaller than 10MB");
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: `voice-${Date.now()}.m4a`,
    type: "audio/m4a",
  } as any);

  formData.append("upload_preset", "laundrix_audio");
  formData.append("folder", `voices/${channel}`);

  const upload = await fetch(
    "https://api.cloudinary.com/v1_1/dhnrq5mub/video/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await upload.json();
  if (!data.secure_url) {
    throw new Error("Cloudinary upload failed");
  }

  return data.secure_url;
}

export async function uploadImage(
  uri: string,
  folder = "avatars"
): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();

  if (blob.size > MAX_IMAGE_MB * 1024 * 1024) {
    throw new Error("Image must be smaller than 3MB");
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: `image-${Date.now()}.jpg`,
    type: blob.type || "image/jpeg",
  } as any);

  formData.append("upload_preset", IMAGE_PRESET);
  formData.append("folder", folder);

  const upload = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await upload.json();

  if (!upload.ok || !data.secure_url) {
    throw new Error(
      data?.error?.message ?? "Image upload failed"
    );
  }

  return data.secure_url as string;
}