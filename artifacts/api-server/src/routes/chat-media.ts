import { Router, type IRouter } from "express";
import { RequestChatMediaUploadBody, TranscribeChatAudioBody } from "@workspace/api-zod";
import { getSessionUserId } from "../lib/session";
import { createMediaUpload, loadChatImage, MediaError, transcribeChatRecording } from "../services/chat-media";
import { errorInfo } from "../lib/error-info";

const router: IRouter = Router();
// Bound AI transcription concurrency per account without logging user content.
const activeTranscriptions = new Set<string>();
router.use("/chat-media", (req, res, next) => {
  if (!getSessionUserId(req)) { res.status(401).json({ error: "Sign in to use attachments." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  next();
});
router.post("/chat-media/uploads", async (req, res) => {
  const body = RequestChatMediaUploadBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Use a supported file up to 8 MB." }); return; }
  try {
    res.json(await createMediaUpload(getSessionUserId(req)!, body.data));
  } catch (error) {
    if (!(error instanceof MediaError)) req.log.warn({ event: "media_upload_unavailable", ...errorInfo(error) }, "Unable to prepare upload");
    res.status(error instanceof MediaError ? error.status : 503).json({ error: error instanceof MediaError ? error.message : "Uploading is temporarily unavailable." });
  }
});
router.post("/chat-media/transcribe", async (req, res) => {
  const userId = getSessionUserId(req)!;
  const body = TranscribeChatAudioBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Choose a recording first." }); return; }
  if (activeTranscriptions.has(userId)) { res.status(429).json({ error: "A recording is already being transcribed." }); return; }
  activeTranscriptions.add(userId);
  try {
    res.json({ text: await transcribeChatRecording(userId, body.data.objectPath) });
  } catch (error) {
    req.log.warn({ event: "audio_transcription_failed", ...errorInfo(error) }, "Unable to transcribe recording");
    res.status(error instanceof MediaError ? error.status : 503).json({ error: error instanceof MediaError ? error.message : "Transcription is temporarily unavailable. Your recording has not been sent to the agent." });
  } finally {
    activeTranscriptions.delete(userId);
  }
});
router.get("/chat-media/image", async (req, res) => {
  const path = typeof req.query.objectPath === "string" ? req.query.objectPath : "";
  try {
    const image = await loadChatImage(getSessionUserId(req)!, path);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.type("image/jpeg").send(image);
  } catch (error) {
    res.status(error instanceof MediaError ? error.status : 404).json({ error: "That image could not be loaded." });
  }
});
export default router;
