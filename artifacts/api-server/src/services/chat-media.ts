import { randomUUID } from "node:crypto";
import { createSignedUploadUrl, deleteObject, downloadObject } from "../lib/supabaseStorage";
import { openai } from "@workspace/integrations-openai-ai-server";
import { MAX_MEDIA_BYTES, MediaError, mediaOwnerKey, assertMediaOwner, validateChatImage } from "./chat-media-policy.ts";
export { MAX_MEDIA_BYTES, MediaError, assertMediaOwner, validateChatImage } from "./chat-media-policy.ts";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const audioTypes: Record<string, string> = {
  "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3",
};
export async function createMediaUpload(userId: string, input: {kind: "image" | "audio"; contentType: string; size: number}) {
  const type = input.contentType.toLowerCase().split(";")[0].trim();
  const extension = input.kind === "image"
    ? (imageTypes.has(type) ? ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[type] : undefined)
    : audioTypes[type];
  if (!extension || input.size < 1 || input.size > MAX_MEDIA_BYTES) {
    throw new MediaError("Use a supported file up to 8 MB.");
  }
  const entity = `chat/${mediaOwnerKey(userId)}/${input.kind}/${randomUUID()}.${extension}`;
  return { uploadURL: await createSignedUploadUrl(entity), objectPath: `/objects/${entity}` };
}
async function readMedia(userId: string, objectPath: string, kind: "image" | "audio") {
  assertMediaOwner(userId, objectPath, kind);
  const key = objectPath.replace(/^\/objects\//, "");
  let buffer: Buffer | null;
  try {
    buffer = await downloadObject(key, MAX_MEDIA_BYTES);
  } catch (error) {
    if (error instanceof RangeError) throw new MediaError("The attachment exceeds 8 MB.");
    throw error;
  }
  if (!buffer) throw new MediaError("That attachment is not available to this account.", 404);
  if (!buffer.length) throw new MediaError("The attachment is empty or exceeds 8 MB.");
  return { key, buffer };
}
export async function loadChatImage(userId: string, objectPath: string) {
  const { buffer } = await readMedia(userId, objectPath, "image");
  return validateChatImage(buffer);
}
export async function transcribeChatRecording(userId: string, objectPath: string) {
  const { buffer, key } = await readMedia(userId, objectPath, "audio");
  try {
    const header = buffer.subarray(0, 16);
    const plausibleAudio = header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ||
      header.toString("ascii", 4, 8) === "ftyp" ||
      ["RIFF", "OggS"].includes(header.toString("ascii", 0, 4)) ||
      header.toString("ascii", 0, 3) === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
    if (buffer.length < 100 || !plausibleAudio) throw new MediaError("The recording is empty or unreadable. Please record again.");
    const extension = objectPath.split(".").pop()!;
    const result = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: new File([new Uint8Array(buffer)], `recording.${extension}`),
      response_format: "json",
    }, { timeout: 60_000, maxRetries: 0 });
    const text = result.text?.trim();
    if (!text) throw new MediaError("No speech was detected. Please record again.");
    return text;
  } finally {
    // Voice is a temporary draft, not a permanent recording attached to chat.
    await deleteObject(key).catch(() => undefined);
  }
}
