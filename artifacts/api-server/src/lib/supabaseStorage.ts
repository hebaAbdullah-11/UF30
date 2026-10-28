// Private Supabase Storage bucket for chat attachments, used from the server only.
// The bucket has no storage policies, so only the service-role key (server) and
// short-lived signed upload URLs can reach its objects.

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "chat-media";

export class StorageUnavailableError extends Error {}

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageUnavailableError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.");
  return { base: `${url}/storage/v1`, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

const encodePath = (key: string) => key.split("/").map(encodeURIComponent).join("/");

function failure(response: Response, action: string) {
  return new StorageUnavailableError(`Storage ${action} failed with status ${response.status}.`);
}

/** A URL the browser can PUT the file to once, valid for two hours. */
export async function createSignedUploadUrl(key: string) {
  const { base, headers } = config();
  const response = await fetch(`${base}/object/upload/sign/${BUCKET}/${encodePath(key)}`, { method: "POST", headers });
  if (!response.ok) throw failure(response, "upload signing");
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) throw new StorageUnavailableError("Storage upload signing returned no URL.");
  return `${base}${payload.url}`;
}

/** Reads an object, refusing anything larger than maxBytes. Returns null if it does not exist. */
export async function downloadObject(key: string, maxBytes: number): Promise<Buffer | null> {
  const { base, headers } = config();
  const response = await fetch(`${base}/object/${BUCKET}/${encodePath(key)}`, { headers });
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok || !response.body) throw failure(response, "download");
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) throw new RangeError("Object exceeds the size limit.");
  const chunks: Buffer[] = [];
  let size = 0;
  // Enforce the bound on actual bytes too, not only the declared length.
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new RangeError("Object exceeds the size limit.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string) {
  const { base, headers } = config();
  const response = await fetch(`${base}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [key] }),
  });
  if (!response.ok) throw failure(response, "delete");
}
