import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, Mic, Square, X, RotateCcw, ImagePlus, Trash2, Replace, AudioLines, Loader2 } from 'lucide-react';
import { customFetch } from '@workspace/api-client-react';
import { useI18n, type Language } from '@/lib/i18n';

type ImageDescriptor = { objectPath: string; contentType: string };

export type ChatMediaComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (image?: ImageDescriptor) => void;
  disabled: boolean;
  isSending: boolean;
  placeholder: string;
  section: string;
  userBubbleClass: string;
  interactiveFreeText: boolean;
  resetKey?: number;
  onBusyChange?: (busy: boolean) => void;
};

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SECONDS = 120;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const COPY: Record<string, Record<Language, string>> = {
  mic: { ar: 'تسجيل صوتي', en: 'Record voice' },
  stop: { ar: 'إيقاف التسجيل', en: 'Stop recording' },
  cancel: { ar: 'إلغاء', en: 'Cancel' },
  cancelRecording: { ar: 'إلغاء التسجيل', en: 'Cancel recording' },
  recordAgain: { ar: 'سجّل مرة أخرى', en: 'Record again' },
  discardAudio: { ar: 'حذف التسجيل', en: 'Discard recording' },
  transcribe: { ar: 'حوّل إلى نص', en: 'Transcribe' },
  uploadingAudio: { ar: 'جاري رفع الصوت...', en: 'Uploading audio...' },
  transcribing: { ar: 'جاري التحويل إلى نص...', en: 'Transcribing...' },
  cancelTranscribe: { ar: 'إلغاء التحويل', en: 'Cancel transcription' },
  recording: { ar: 'جاري التسجيل', en: 'Recording' },
  waitingPermission: { ar: 'بانتظار إذن الميكروفون...', en: 'Waiting for microphone permission...' },
  audioReady: { ar: 'التسجيل جاهز. استمع ثم حوّله إلى نص.', en: 'Recording ready. Listen, then transcribe.' },
  transcriptAdded: { ar: 'أضيف النص إلى الرسالة. راجعه قبل الإرسال.', en: 'Transcript added to your message. Review it before sending.' },
  attachImage: { ar: 'إرفاق صورة', en: 'Attach image' },
  replaceImage: { ar: 'استبدال الصورة', en: 'Replace image' },
  removeImage: { ar: 'إزالة الصورة', en: 'Remove image' },
  imagePreview: { ar: 'معاينة الصورة المرفقة', en: 'Attached image preview' },
  uploadingImage: { ar: 'جاري رفع الصورة...', en: 'Uploading image...' },
  errPermission: { ar: 'لم يُسمح بالوصول إلى الميكروفون. فعّله من إعدادات المتصفح.', en: 'Microphone access was not allowed. Enable it in your browser settings.' },
  errNoMic: { ar: 'لم نجد ميكروفونًا متاحًا.', en: 'No microphone was found.' },
  errUnsupported: { ar: 'التسجيل الصوتي غير مدعوم في هذا المتصفح.', en: 'Voice recording is not supported in this browser.' },
  errEmpty: { ar: 'التسجيل فارغ. حاول مرة أخرى.', en: 'The recording was empty. Please try again.' },
  errAudioSize: { ar: 'التسجيل أكبر من 8 ميغابايت.', en: 'The recording is larger than 8 MB.' },
  errRecord: { ar: 'تعذر التسجيل الآن. حاول مرة أخرى.', en: 'Recording failed. Please try again.' },
  errTranscribe: { ar: 'تعذر تحويل الصوت إلى نص. حاول مرة أخرى.', en: 'We could not transcribe that. Please try again.' },
  errNoSpeech: { ar: 'لم نلتقط كلامًا واضحًا. جرّب التسجيل مرة أخرى.', en: 'No clear speech was detected. Try recording again.' },
  errImageType: { ar: 'اختر صورة JPEG أو PNG أو WebP.', en: 'Choose a JPEG, PNG, or WebP image.' },
  errImageSize: { ar: 'الصورة أكبر من 8 ميغابايت.', en: 'The image is larger than 8 MB.' },
  errImageDecode: { ar: 'تعذر قراءة هذه الصورة.', en: 'This image could not be read.' },
  errUpload: { ar: 'تعذر رفع الصورة. ما زالت مسودتك هنا، حاول مرة أخرى.', en: 'The image could not be uploaded. Your draft is still here, try again.' },
  maxNote: { ar: 'الحد الأقصى دقيقتان', en: 'Max 2 minutes' },
};

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((c) => MediaRecorder.isTypeSupported?.(c)) ?? '';
}

function baseType(mime: string) {
  return mime.split(';')[0] || 'audio/webm';
}

function decodeImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => (img.naturalWidth > 0 && img.naturalHeight > 0 && img.naturalWidth * img.naturalHeight <= 25_000_000 ? resolve() : reject(new Error('decode')));
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

async function uploadBlob(kind: 'image' | 'audio', blob: Blob, contentType: string, signal: AbortSignal): Promise<string> {
  const res = await customFetch<{ uploadURL: string; objectPath: string }>('/api/chat-media/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, contentType, size: blob.size }),
    signal,
  });
  const put = await fetch(res.uploadURL, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType }, signal });
  if (!put.ok) throw new Error('upload');
  return res.objectPath;
}

type AudioPhase = 'idle' | 'permission' | 'recording' | 'ready' | 'uploading' | 'transcribing';

export function ChatMediaComposer({
  value, onChange, onSend, disabled, isSending, placeholder, section, userBubbleClass, interactiveFreeText, resetKey, onBusyChange,
}: ChatMediaComposerProps) {
  const { lang, t } = useI18n();
  const c = (k: string) => COPY[k]?.[lang] ?? k;

  const mounted = useRef(true);
  const [audioPhase, setAudioPhase] = useState<AudioPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [audio, setAudio] = useState<{ blob: Blob; url: string; type: string } | null>(null);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const localize = (message: string | null) => {
      if (!message) return message;
      return Object.values(COPY).find((copy) => copy.ar === message || copy.en === message)?.[lang] ?? message;
    };
    setNotice(localize);
    setError(localize);
  }, [lang]);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const imageAbortRef = useRef<AbortController | null>(null);
  const uploadedImageRef = useRef<ImageDescriptor | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBusyRef = useRef(onBusyChange);
  onBusyRef.current = onBusyChange;
  const audioUrlRef = useRef<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const sendGuard = useRef(false);
  const recordingGeneration = useRef(0);
  const permissionPending = useRef(false);
  const imageGeneration = useRef(0);
  const [decodingImage, setDecodingImage] = useState(false);

  const busy = audioPhase !== 'idle' && audioPhase !== 'ready' || uploadingImage || decodingImage;
  useEffect(() => { onBusyRef.current?.(busy); }, [busy]);

  const stopTimer = () => { if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; } };
  const stopTracks = () => { streamRef.current?.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; };

  const setAudioClip = useCallback((next: { blob: Blob; url: string; type: string } | null) => {
    if (audioUrlRef.current && audioUrlRef.current !== next?.url) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = next?.url ?? null;
    setAudio(next);
  }, []);
  const setImageClip = useCallback((next: { file: File; url: string } | null) => {
    if (imageUrlRef.current && imageUrlRef.current !== next?.url) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = next?.url ?? null;
    uploadedImageRef.current = null;
    setImage(next);
  }, []);

  const hardReset = useCallback(() => {
    recordingGeneration.current++;
    permissionPending.current = false;
    imageGeneration.current++;
    discardRef.current = true;
    abortRef.current?.abort(); abortRef.current = null;
    imageAbortRef.current?.abort(); imageAbortRef.current = null;
    try { if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    stopTimer(); stopTracks();
  }, []);

  // resetKey: clear local media
  const firstReset = useRef(true);
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return; }
    hardReset();
    setAudioClip(null); setImageClip(null);
    setAudioPhase('idle'); setUploadingImage(false); setDecodingImage(false); setError(null); setNotice(null); setElapsed(0);
    sendGuard.current = false;
  }, [resetKey, hardReset, setAudioClip, setImageClip]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      hardReset();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      onBusyRef.current?.(false);
    };
  }, [hardReset]);

  useEffect(() => { if (!isSending) sendGuard.current = false; }, [isSending]);

  const startRecording = async () => {
    if (disabled || isSending || busy || permissionPending.current) return;
    const generation = ++recordingGeneration.current;
    permissionPending.current = true;
    setError(null); setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { permissionPending.current = false; setError(c('errUnsupported')); return; }
    setAudioClip(null);
    setAudioPhase('permission');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (!mounted.current || generation !== recordingGeneration.current) return;
      permissionPending.current = false;
      const name = (err as DOMException)?.name;
      setError(name === 'NotAllowedError' || name === 'SecurityError' ? c('errPermission') : name === 'NotFoundError' ? c('errNoMic') : c('errRecord'));
      setAudioPhase('idle');
      return;
    }
    if (!mounted.current || generation !== recordingGeneration.current) { stream.getTracks().forEach((tr) => tr.stop()); return; }
    permissionPending.current = false;
    streamRef.current = stream;
    const mime = pickMimeType();
    let rec: MediaRecorder;
    try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); }
    catch { stopTracks(); setError(c('errUnsupported')); setAudioPhase('idle'); return; }
    chunksRef.current = []; discardRef.current = false;
    let total = 0;
    rec.ondataavailable = (e) => {
      if (e.data?.size) {
        chunksRef.current.push(e.data); total += e.data.size;
        if (total > MAX_BYTES && rec.state === 'recording') rec.stop();
      }
    };
    rec.onstop = () => {
      stopTimer(); stopTracks();
      if (!mounted.current || discardRef.current) return;
      const type = baseType(rec.mimeType || mime);
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size === 0) { setError(c('errEmpty')); setAudioPhase('idle'); return; }
      if (blob.size > MAX_BYTES) { setError(c('errAudioSize')); setAudioPhase('idle'); return; }
      setAudioClip({ blob, url: URL.createObjectURL(blob), type });
      setAudioPhase('ready'); setNotice(c('audioReady'));
    };
    rec.onerror = () => { discardRef.current = true; stopTimer(); stopTracks(); if (mounted.current) { setError(c('errRecord')); setAudioPhase('idle'); } };
    recorderRef.current = rec;
    try { rec.start(1000); } catch { stopTracks(); setError(c('errRecord')); setAudioPhase('idle'); return; }
    setElapsed(0); setAudioPhase('recording');
    const started = Date.now();
    timerRef.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setElapsed(s);
      if (s >= MAX_SECONDS && rec.state === 'recording') rec.stop();
    }, 250);
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };

  const cancelRecording = () => {
    recordingGeneration.current++;
    permissionPending.current = false;
    discardRef.current = true;
    const rec = recorderRef.current;
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { /* ignore */ }
    recorderRef.current = null;
    stopTimer(); stopTracks();
    setAudioPhase('idle'); setElapsed(0); setNotice(null);
  };

  const discardAudio = () => { setAudioClip(null); setAudioPhase('idle'); setNotice(null); setError(null); };

  const transcribe = async () => {
    if (disabled || isSending || !audio || audioPhase !== 'ready') return;
    setError(null); setNotice(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      setAudioPhase('uploading');
      const objectPath = await uploadBlob('audio', audio.blob, audio.type, ctrl.signal);
      if (ctrl.signal.aborted || !mounted.current) return;
      setAudioPhase('transcribing');
      const res = await customFetch<{ text: string }>('/api/chat-media/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectPath }), signal: ctrl.signal,
      });
      if (ctrl.signal.aborted || !mounted.current) return;
      const text = (res?.text ?? '').trim();
      if (!text) { setError(c('errNoSpeech')); setAudioPhase('ready'); return; }
      const current = valueRef.current;
      onChangeRef.current(current.trim() ? `${current.replace(/\s+$/, '')}\n${text}` : text);
      setAudioClip(null); setAudioPhase('idle'); setNotice(c('transcriptAdded'));
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      if (ctrl.signal.aborted || !mounted.current) return;
      setError(c('errTranscribe')); setAudioPhase('ready');
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  };

  const cancelTranscribe = () => {
    abortRef.current?.abort(); abortRef.current = null;
    setAudioPhase(audio ? 'ready' : 'idle');
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    const generation = ++imageGeneration.current;
    setError(null);
    if (!IMAGE_TYPES.includes(file.type)) { setError(c('errImageType')); return; }
    if (!file.size) { setError(c('errImageDecode')); return; }
    if (file.size > MAX_BYTES) { setError(c('errImageSize')); return; }
    const url = URL.createObjectURL(file);
    setDecodingImage(true);
    try { await decodeImage(url); } catch { URL.revokeObjectURL(url); if (mounted.current && generation === imageGeneration.current) { setError(c('errImageDecode')); setDecodingImage(false); } return; }
    if (!mounted.current || generation !== imageGeneration.current) { URL.revokeObjectURL(url); return; }
    setDecodingImage(false);
    setImageClip({ file, url });
  };

  const imageLocked = uploadingImage || decodingImage || audioPhase === 'uploading' || audioPhase === 'transcribing';
  const recordingLocked = audioPhase === 'permission' || audioPhase === 'recording';
  const canSend = !disabled && !isSending && !busy && !recordingLocked && (!!value.trim() || !!image);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend || sendGuard.current) return;
    sendGuard.current = true;
    setError(null); setNotice(null);
    if (!image) { onSend(); return; }
    let desc = uploadedImageRef.current;
    if (!desc) {
      const ctrl = new AbortController(); imageAbortRef.current = ctrl;
      const current = image;
      setUploadingImage(true);
      try {
        const objectPath = await uploadBlob('image', current.file, current.file.type, ctrl.signal);
        if (ctrl.signal.aborted || !mounted.current) { sendGuard.current = false; return; }
        desc = { objectPath, contentType: current.file.type };
        if (imageUrlRef.current === current.url) uploadedImageRef.current = desc;
      } catch {
        sendGuard.current = false;
        if (!ctrl.signal.aborted && mounted.current) setError(c('errUpload'));
        return;
      } finally {
        if (imageAbortRef.current === ctrl) imageAbortRef.current = null;
        if (mounted.current) setUploadingImage(false);
      }
    }
    onSend(desc);
  };

  const statusText = audioPhase === 'permission' ? c('waitingPermission')
    : audioPhase === 'recording' ? `${c('recording')} ${formatTime(elapsed)}`
    : audioPhase === 'uploading' ? c('uploadingAudio')
    : audioPhase === 'transcribing' ? c('transcribing')
    : uploadingImage ? c('uploadingImage') : notice;

  const iconBtn = 'inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-background/70 px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45';
  const hasPanel = !!image || audioPhase !== 'idle' || !!audio;

  return (
    <form onSubmit={submit} className="relative flex flex-col gap-2 rounded-[2rem] border border-border bg-card p-2 shadow-[0_2px_20px_-4px_hsl(var(--foreground)/.05)] focus-within:ring-2 focus-within:ring-ring" data-testid={`form-${section}-composer`}>
      {hasPanel && (
        <div className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto overscroll-contain px-1 pt-1">
          {image && (
            <div className="flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-primary/15 bg-primary/5 p-2" data-testid={`preview-${section}-image`}>
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-background">
                <img src={image.url} alt={c('imagePreview')} className={`h-full w-full object-cover transition-opacity ${uploadingImage ? 'opacity-50' : ''}`} />
                {uploadingImage && <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-foreground" aria-hidden />}
              </div>
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" dir="auto">{image.file.name}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={imageLocked || isSending} className={iconBtn} aria-label={c('replaceImage')} title={c('replaceImage')} data-testid={`button-${section}-image-replace`}>
                  <Replace className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setImageClip(null)} disabled={imageLocked || isSending} className={iconBtn} aria-label={c('removeImage')} title={c('removeImage')} data-testid={`button-${section}-image-remove`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {(audioPhase === 'permission' || audioPhase === 'recording') && (
            <div className="flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-destructive/20 bg-destructive/5 p-2">
              <span className="relative ms-2 flex h-3 w-3" aria-hidden>
                {audioPhase === 'recording' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/50" />}
                <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold tabular-nums text-foreground" data-testid={`text-${section}-record-timer`}>
                {audioPhase === 'recording' ? `${formatTime(elapsed)} / ${formatTime(MAX_SECONDS)}` : c('waitingPermission')}
              </span>
              <button type="button" onClick={cancelRecording} className={iconBtn} aria-label={c('cancelRecording')} data-testid={`button-${section}-record-cancel`}>
                <X className="h-4 w-4" /><span className="hidden sm:inline">{c('cancel')}</span>
              </button>
              <button type="button" onClick={stopRecording} disabled={audioPhase !== 'recording'} className={`${iconBtn} border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90`} aria-label={c('stop')} data-testid={`button-${section}-record-stop`}>
                <Square className="h-4 w-4 fill-current" /><span className="hidden sm:inline">{c('stop')}</span>
              </button>
            </div>
          )}

          {audio && (audioPhase === 'ready' || audioPhase === 'uploading' || audioPhase === 'transcribing') && (
            <div className="flex flex-col gap-2 rounded-[1.5rem] border border-accent/25 bg-accent/10 p-2" data-testid={`preview-${section}-audio`}>
              {/* The user's own just-recorded voice note; it is transcribed below, so no caption track exists. */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={audio.url} controls className="h-11 w-full min-w-0" aria-label={c('audioReady')} />
              <div className="flex flex-wrap items-center justify-end gap-2">
                {audioPhase === 'ready' ? (
                  <>
                    <button type="button" onClick={discardAudio} className={iconBtn} aria-label={c('discardAudio')} title={c('discardAudio')} data-testid={`button-${section}-audio-discard`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { void startRecording(); }} disabled={disabled} className={iconBtn} data-testid={`button-${section}-record-again`}>
                      <RotateCcw className="h-4 w-4" />{c('recordAgain')}
                    </button>
                    <button type="button" onClick={() => { void transcribe(); }} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${userBubbleClass}`} data-testid={`button-${section}-transcribe`}>
                      <AudioLines className="h-4 w-4" />{c('transcribe')}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground" data-testid={`status-${section}-transcribe-progress`}>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      {audioPhase === 'uploading' ? c('uploadingAudio') : c('transcribing')}
                    </span>
                    <button type="button" onClick={cancelTranscribe} className={iconBtn} data-testid={`button-${section}-transcribe-cancel`}>
                      <X className="h-4 w-4" />{c('cancelTranscribe')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void pickImage(f); }}
          data-testid={`input-${section}-image-file`}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || imageLocked || isSending} className={`${iconBtn} border-transparent bg-transparent px-0`} aria-label={image ? c('replaceImage') : c('attachImage')} title={c('attachImage')} data-testid={`button-${section}-image-picker`}>
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          disabled={disabled || isSending}
          maxLength={12000}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="max-h-32 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-[15px] outline-none placeholder:text-muted-foreground/60"
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); }
            else if (e.key === 'Enter' && !e.shiftKey && !interactiveFreeText) { e.preventDefault(); void submit(); }
          }}
          data-testid={`input-${section}-message`}
        />
        <button
          type="button"
          onClick={() => { void startRecording(); }}
          disabled={disabled || isSending || busy || recordingLocked || audioPhase === 'ready'}
          className={`${iconBtn} border-transparent bg-transparent px-0`}
          aria-label={c('mic')}
          title={`${c('mic')} · ${c('maxNote')}`}
          data-testid={`button-${section}-microphone`}
        >
          <Mic className="h-5 w-5 text-muted-foreground" />
        </button>
        <button
          type="submit"
          disabled={!canSend}
          aria-label={isSending || uploadingImage ? t('sending') : t('send')}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all disabled:opacity-50 ${userBubbleClass} hover:scale-105 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          data-testid={`button-${section}-send`}
        >
          {isSending || uploadingImage ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Send className="h-5 w-5 rtl:rotate-180" />
          )}
        </button>
      </div>

      <div className="px-3" aria-live="polite" role="status" data-testid={`status-${section}-media`}>
        {statusText && !error && <p className="pb-1 text-xs text-muted-foreground" dir="auto">{statusText}</p>}
      </div>
      {error && (
        <p className="px-3 pb-1 text-xs text-destructive" role="alert" dir="auto" data-testid={`status-${section}-media-error`}>{error}</p>
      )}
    </form>
  );
}

export default ChatMediaComposer;
