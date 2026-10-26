# Chat voice and image inputs

Both `/organize-thoughts` and `/declutter` use the same media composer.

## User flow

- **Voice:** select the microphone, allow browser permission, record, then stop.
  Preview the clip with the audio player, discard/re-record, or select Transcribe.
  Speech-to-text is appended to the editable text draft. It is **never sent
  automatically**. Review/edit it and select Send, or use the chat's existing
  keyboard send shortcut.
- **Image:** select the attachment control and choose a JPG, PNG, or WebP.
  Preview, replace, or remove it. Send with text, transcribed text, or by itself.
- Canceling a recording or transcription does not send a message.
- Recordings are limited to two minutes; each image/recording is limited to 8 MB.
  Images are limited to 25 million pixels and normalized to at most 2048×2048
  for model inspection. Original private image objects remain available to chat.
- Recording requires HTTPS (or localhost), a supported MediaRecorder browser,
  a microphone, and permission. Browsers or embedding pages can block microphone
  access; an error is displayed instead of discarding the user's draft.

## Services and configuration

No additional API key is needed for this project's managed integration.

- Existing `AI_INTEGRATIONS_OPENAI_API_KEY` and
  `AI_INTEGRATIONS_OPENAI_BASE_URL`: Replit AI Integrations for OpenAI.
- Completed recordings use `gpt-4o-mini-transcribe` as a batch transcription step.
  There is no voice-response/TTS service and no automatic speech-to-speech mode.
- The existing `gpt-5.4-mini` chat model receives actual normalized image data in
  `image_url` content parts. The model, prompts for ordinary text, authentication,
  and guided tools are retained.
- App Storage was provisioned through Replit. It supplies
  `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, and
  `PUBLIC_OBJECT_SEARCH_PATHS`. Do not put credentials in browser code.
- AI usage is billed through the existing Replit AI integration; private media
  uses App Storage. Publish the updated app to enable the new code on the live site.

## Storage and privacy

The browser requests a signed upload URL, then uploads directly to private App
Storage. Metadata endpoints and image serving require the existing session.
Owner-scoped paths are checked on every read, before accessing storage. The
server sends validated image bytes to the AI provider, not merely a filename or
an inaccessible private URL. SVG/HTML uploads are not supported.

Image message metadata is stored within the existing JSONB response field:
`image: { objectPath, contentType }`. No new database tables, migrations, resets,
account changes, or modifications to older messages are required. History
reloads fetch the image through the authenticated API. Image-related follow-ups
can inspect the most recent image; unavailable old images do not disable text
chat. Earlier textual context remains available.

Audio is uploaded only when Transcribe is selected and deleted after the server
attempts transcription. Raw audio is not stored in chat history; only text the
user explicitly sends becomes a chat message. Uploads abandoned before
transcription or message submission can remain as private, unreferenced storage
objects. No background deletion of existing user files is performed.

Request/error logs do not include message text, image bytes, signed URLs,
recordings, transcriptions, passwords, or credentials.

## Verification

- `pnpm --filter @workspace/api-server test`: includes media validation,
  cross-account isolation, persisted message contracts and AI input regressions.
- `pnpm run typecheck`
- `pnpm --filter @workspace/mindful-companion build`
- `src/services/chat-media-smoke.ts` is an opt-in live storage/provider check with
  synthetic files and no account/database writes. It checks actual image
  understanding, audio transcription, text responses, and cross-account rejection,
  then removes only its own generated objects.
- Browser tests use synthetic authentication/history and deterministic API
  responses to exercise recording controls, preview/edit/send, image attachments,
  errors, retries, reloads, and mobile layouts without altering real accounts.
