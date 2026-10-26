import { createHash } from "node:crypto";
import sharp from "sharp";

export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export class MediaError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function mediaOwnerKey(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}
export function assertMediaOwner(userId: string, objectPath: string, kind: "image" | "audio") {
  const prefix = `/objects/chat/${mediaOwnerKey(userId)}/${kind}/`;
  const name = objectPath.startsWith(prefix) ? objectPath.slice(prefix.length) : "";
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|webm|mp4|ogg|wav|mp3)$/.test(name)) {
    throw new MediaError("That attachment is not available to this account.", 404);
  }
}
export async function validateChatImage(buffer: Buffer) {
  try {
    const image = sharp(buffer, { limitInputPixels: 25_000_000, animated: false, failOn: "error" });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || !metadata.width || !metadata.height) {
      throw new Error("Unsupported image.");
    }
    // Strip metadata, bound model input, and fully decode rather than trusting the extension.
    return await image.rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new MediaError("This image could not be read. Use a valid JPG, PNG, or WebP image.");
  }
}
