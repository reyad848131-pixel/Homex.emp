import { v2 as cloudinary } from "cloudinary";

// Cloudinary holds the production photos (separate from our app/DB so storage
// stays light). Configured from env vars added in Vercel after creating a
// (free) Cloudinary account:
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
let configured = false;
function ensure() {
  if (configured) return true;
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) return false;
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  configured = true;
  return true;
}

export function cloudinaryReady(): boolean {
  return ensure();
}

// Upload a data URL (base64) image. Returns the secure URL + publicId (needed to
// delete later). Images are delivered auto-optimized (format/quality) via the
// stored URL transformations when we request them.
export async function uploadPhoto(dataUrl: string, folder = "homex/items"): Promise<{ url: string; publicId: string }> {
  if (!ensure()) throw new Error("Cloudinary not configured");
  const res = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: "image",
    // Cap stored size and strip metadata — a second safety net on top of the
    // client-side compression.
    transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto:good" }],
  });
  return { url: res.secure_url, publicId: res.public_id };
}

export async function deletePhoto(publicId: string): Promise<void> {
  if (!ensure()) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: "image" }); }
  catch (e) { console.error("Cloudinary destroy failed:", e); }
}
