/** Opt-in provider/storage smoke test. Synthetic files only; no account or DB writes. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { createMediaUpload, loadChatImage, transcribeChatRecording } from "./chat-media";
import { ObjectStorageService } from "../lib/objectStorage";
import { getAgentResponse } from "./ai/agent-client";

const userId = `synthetic-media-smoke-${randomUUID()}`;
const objects: string[] = [];
async function upload(kind: "image" | "audio", buffer: Buffer, contentType: string) {
  const result = await createMediaUpload(userId, { kind, contentType, size: buffer.length });
  objects.push(result.objectPath);
  const put = await fetch(result.uploadURL, {
    method: "PUT", headers: { "Content-Type": contentType }, body: new Uint8Array(buffer),
  });
  assert.ok(put.ok, "Direct signed storage upload must succeed");
  return result.objectPath;
}
try {
  const audioPath = process.argv[2];
  assert.ok(audioPath, "Pass the synthetic voice fixture MP3 path");
  const source = Buffer.from('<svg width="600" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="600" height="300" fill="white"/><circle cx="110" cy="145" r="70" fill="#145bfa"/><text x="210" y="160" font-family="sans-serif" font-size="48" fill="black">ORBIT 472</text></svg>');
  const png = await sharp(source).png().toBuffer();
  await mkdir("generated-artifacts/chat-media", { recursive: true });
  await writeFile("generated-artifacts/chat-media/vision-fixture.png", png);
  const imagePath = await upload("image", png, "image/png");
  const verified = await loadChatImage(userId, imagePath);
  await assert.rejects(loadChatImage("different-synthetic-owner", imagePath));
  const imageAnswer = await getAgentResponse("organize_thoughts", "What word and number are in this image, and what color is the shape?", [], {
    language: "en", imageDataUrl: `data:image/jpeg;base64,${verified.toString("base64")}`,
  });
  assert.ok(imageAnswer.type !== "continue_flow" && imageAnswer.type !== "flowchart");
  assert.match(imageAnswer.message, /ORBIT/i);
  assert.match(imageAnswer.message, /472/);
  assert.match(imageAnswer.message, /blue/i);
  const recording = await upload("audio", await readFile(audioPath), "audio/mpeg");
  const transcription = await transcribeChatRecording(userId, recording);
  assert.match(transcription, /calm morning/i);
  assert.match(transcription, /three|3/i);
  const voiceAnswer = await getAgentResponse("organize_thoughts", transcription, [], { language: "en" });
  assert.ok(voiceAnswer.type !== "continue_flow" && voiceAnswer.type !== "flowchart" && voiceAnswer.message.trim());
  console.log(JSON.stringify({
    passed: true, imageUnderstood: { word: "ORBIT", number: "472", color: "blue" },
    transcriptionMatchedSyntheticSpeech: true, voiceTextAcceptedByAgent: true,
    crossAccountReadRejected: true, databaseWrites: 0,
  }));
} finally {
  const storage = new ObjectStorageService();
  for (const object of objects) {
    await storage.getObjectEntityFile(object).then((file) => file.delete({ ignoreNotFound: true })).catch(() => undefined);
  }
}
