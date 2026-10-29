/**
 * Composer — rounded input with animated placeholders that cycle
 * through food + DIY prompts. Enter-to-send; shift-enter for
 * multiline. Tuned for Vitrina's two beachhead categories
 * (food + DIY), with native voice-note capture.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { ArrowUp, Mic, Plus, Trash2 } from 'lucide-react';
import { BRAND_COLORS, Button } from '@scope/ui';
import { AttachmentSheet } from './AttachmentSheet';
import { useVoiceRecorder } from './useVoiceRecorder';

// Short, single-line, all-food placeholders. The composer is 44px tall
// by default and we DO NOT want it to start at two lines just because a
// placeholder wraps. Keep each <30 chars so it fits in one line on a
// 360px viewport with the leading "Try: ".
const PLACEHOLDERS = [
  'shakshuka for two',
  'tomato risotto tonight',
  'gluten-free bread',
  'pairings for manchego',
  'pasta carbonara',
  'thai green curry',
  'sunday roast for four',
  'easy weeknight dinner',
];

interface StagedFile {
  id: string;
  file: File;
  preview: string;
}

let nextFileId = 0;

export function Composer({
  onSend,
  onSendVoice,
  disabled,
  autoFocus,
  seedText,
  onSeedConsumed,
  inThread = false,
}: {
  onSend: (text: string, photoFiles?: File[]) => void;
  onSendVoice?: (blob: Blob, duration: number, waveform: number[], photoFiles?: File[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** External seed (e.g. starter chip on landing). Fills the input;
   *  caller should clear via onSeedConsumed after we accept it. */
  seedText?: string | null;
  onSeedConsumed?: () => void;
  /** True when the composer is rendered below an active chat thread.
   *  In that mode we drop the cycling food/DIY example placeholders
   *  (they're meant for the empty Landing surface) and just show a
   *  quiet "Reply…" hint so the bar feels like a normal chat input. */
  inThread?: boolean;
}) {
  const [text, setText] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [kbPad, setKbPad] = useState(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const {
    isRecording,
    elapsed,
    waveformData,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceRecorder();

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 3800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
  }, [autoFocus]);

  // Accept an external seed (starter prompt chip on landing). Fills
  // the textarea but does NOT submit — user can edit before sending.
  useEffect(() => {
    if (!seedText) return;
    setText(seedText);
    onSeedConsumed?.();
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    });
  }, [seedText, onSeedConsumed]);

  // Auto-grow the textarea: starts at 1 line, grows up to 10, then
  // the textarea itself scrolls. Larger ceiling than before so a
  // multi-paragraph message doesn't feel cramped.
  const MAX_LINES = 10;
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 20;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBot = parseFloat(cs.paddingBottom) || 0;
    const maxH = lineHeight * MAX_LINES + padTop + padBot;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, [text]);

  useEffect(() => {
    if (!isRecording || !waveContainerRef.current) return;
    const measure = () => {
      const el = waveContainerRef.current;
      if (!el) return;
      const w = el.getBoundingClientRect().width;
      const cvs = waveCanvasRef.current;
      if (!cvs) return;
      const dpr = window.devicePixelRatio || 1;
      const h = el.getBoundingClientRect().height || 30;
      if (cvs.width !== Math.round(w * dpr) || cvs.height !== Math.round(h * dpr)) {
        cvs.width = Math.round(w * dpr);
        cvs.height = Math.round(h * dpr);
      }
    };
    const id = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(waveContainerRef.current);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [isRecording]);

  useEffect(() => {
    const cvs = waveCanvasRef.current;
    if (!cvs || !isRecording) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = cvs.width / dpr;
    const ch = cvs.height / dpr;
    // Bar geometry copied from Leo casa's ChatInput so the waveform
    // reads identically. Wider bars + slightly larger gap = the
    // recognisable terracotta wave that doesn't try to be too dense.
    const BAR_W = 2.5;
    const BAR_GAP = 2;
    const maxVis = Math.max(10, Math.floor((cw + BAR_GAP) / (BAR_W + BAR_GAP)));
    const bars = waveformData.slice(-maxVis);

    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    const n = bars.length;
    const totalW = n * BAR_W + Math.max(0, n - 1) * BAR_GAP;
    const startX = cw - totalW;
    for (let j = 0; j < n; j++) {
      const amp = bars[j] ?? 0;
      const bh = Math.max(3, Math.round(4 + amp * (ch - 8)));
      const op = amp < 0.04 ? 0.18 : 0.38 + amp * 0.62;
      const x = startX + j * (BAR_W + BAR_GAP);
      const y = (ch - bh) / 2;
      ctx.globalAlpha = op;
      ctx.fillStyle = BRAND_COLORS.terracotta;
      ctx.beginPath();
      const r = Math.min(1.5, bh / 2);
      if (ctx.roundRect) {
        ctx.roundRect(x, y, BAR_W, bh, r);
      } else {
        ctx.rect(x, y, BAR_W, bh);
      }
      ctx.fill();
    }
    ctx.restore();
  }, [waveformData, isRecording]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      setKbPad(keyboardHeight > 80 ? 12 : 0);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const consumeStaged = (): File[] => {
    const files = staged.map((s) => s.file);
    staged.forEach((s) => URL.revokeObjectURL(s.preview));
    setStaged([]);
    return files;
  };

  const submit = useCallback(() => {
    const t = text.trim();
    if ((!t && staged.length === 0) || disabled) return;
    const photos = consumeStaged();
    setText('');
    onSend(t, photos.length ? photos : undefined);
    inputRef.current?.focus();
  }, [disabled, onSend, staged, text]);

  const handleStopRecording = useCallback(async () => {
    const rawSnapshot = [...waveformData];
    const { blob, duration } = await stopRecording();
    if (blob.size > 0) {
      const TARGET = 20;
      const trimmed = rawSnapshot.filter((v) => v > 0);
      const src = trimmed.length >= TARGET ? trimmed : rawSnapshot;
      const step = src.length / TARGET;
      const snapshot = Array.from({ length: TARGET }, (_, i) => src[Math.floor(i * step)] ?? 0);
      const photos = consumeStaged();
      onSendVoice?.(blob, duration, snapshot, photos.length ? photos : undefined);
    }
  }, [onSendVoice, staged, stopRecording, waveformData]);

  const stageFiles = useCallback((files: File[]) => {
    const newStaged: StagedFile[] = files.map((f) => ({
      id: `sf-${++nextFileId}`,
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setStaged((prev) => [...prev, ...newStaged]);
  }, []);

  const removeStaged = useCallback((id: string) => {
    setStaged((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length) stageFiles(files);
    },
    [stageFiles],
  );

  const hasText = text.trim().length > 0;
  const hasStaged = staged.length > 0;

  // Padding-bottom: the parent wrap in ChatPage is fixed at
  // `bottom: 50px + env(safe-area-inset-bottom)` (keyboard down) or
  // `bottom: env(safe-area-inset-bottom)` (keyboard up), so the wrap
  // already eats the iOS home-indicator inset. Re-adding it here was
  // doubling the cushion (~34px on iPhone), which Peter sees as "too
  // much padding between input bar and footer tab bar". Use a plain
  // 8/10 px gap and let the wrap own safe-area.
  const pbStyle = kbPad > 0 ? { paddingBottom: '8px' } : { paddingBottom: '10px' };

  return (
    <div className="vitrina-composer">
      <div className="vitrina-composer-pad" style={pbStyle}>
        {error ? (
          <p className="vitrina-composer-error" role="alert">
            {error}
          </p>
        ) : null}

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFileInput} />
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={handleFileInput} />
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" multiple hidden onChange={handleFileInput} />

        <div className="vitrina-composer-row">
          <div className={`vitrina-composer-bar ${isRecording ? 'vitrina-composer-bar-recording' : ''}`}>
            {hasStaged && (
              <div className="vitrina-composer-staged">
                {staged.map((s) => (
                  <div key={s.id} className="vitrina-composer-staged-item">
                    <img src={s.preview} alt={s.file.name} />
                    {!isRecording && (
                      <Button
                        type="button"
                        className="vitrina-composer-remove-file"
                        aria-label={`Remove ${s.file.name}`}
                        onClick={() => removeStaged(s.id)}
                      >
                        <Trash2 size={10} />
                      </Button>
                    )}
                  </div>
                ))}
                {!isRecording && (
                  <Button
                    type="button"
                    className="vitrina-composer-add-more"
                    aria-label="Add more"
                    onClick={() => setSheetOpen(true)}
                  >
                    <Plus size={20} />
                  </Button>
                )}
              </div>
            )}

            <div
              className="vitrina-composer-input-row"
              onClick={(e) => {
                if (isRecording) return;
                if ((e.target as HTMLElement).closest('button, textarea, input')) return;
                inputRef.current?.focus();
              }}
            >
              {!isRecording && (
                <Button
                  type="button"
                  disabled={disabled}
                  className="vitrina-composer-plus"
                  aria-label="Add attachment"
                  onClick={() => setSheetOpen(true)}
                >
                  <Plus size={26} strokeWidth={1.8} />
                </Button>
              )}

              {!isRecording && (
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={
                    hasStaged
                      ? 'Add a note'
                      : inThread
                        ? 'Reply…'
                        : `Try: "${PLACEHOLDERS[placeholderIdx]}"`
                  }
                  disabled={disabled}
                  className="vitrina-composer-input"
                  autoComplete="off"
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  enterKeyHint="send"
                  spellCheck
                />
              )}

              {isRecording && (
                <div className="vitrina-recording-row">
                  <span className="vitrina-recording-dot" aria-hidden="true" />
                  <span className="vitrina-recording-time">
                    {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
                  </span>
                  <div ref={waveContainerRef} className="vitrina-wave-container">
                    <canvas ref={waveCanvasRef} className="vitrina-wave-canvas" aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {isRecording && (
            <Button
              type="button"
              className="vitrina-composer-discard"
              aria-label="Discard recording"
              onClick={() => cancelRecording()}
            >
              <Trash2 size={18} />
            </Button>
          )}

          <Button
            type="button"
            disabled={disabled}
            className={`vitrina-composer-action ${isRecording ? 'vitrina-composer-action-recording' : hasText ? 'vitrina-composer-action-send' : 'vitrina-composer-action-mic'}`}
            aria-label={isRecording ? 'Send voice' : hasText ? 'Send message' : 'Record voice'}
            onClick={() => {
              if (isRecording) {
                void handleStopRecording();
                return;
              }
              if (hasText || hasStaged) {
                submit();
                return;
              }
              void startRecording();
            }}
          >
            {isRecording || hasText ? <ArrowUp size={20} strokeWidth={2.5} /> : <Mic size={20} />}
          </Button>
        </div>

        <AttachmentSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onTakePhoto={() => cameraRef.current?.click()}
          onChooseGallery={() => galleryRef.current?.click()}
          onChooseFile={() => fileRef.current?.click()}
        />
      </div>

      <style>{`
        .vitrina-composer {
          position: relative;
          flex-shrink: 0;
        }
        .vitrina-composer-pad {
          position: relative;
          padding: 6px 0 4px;
        }
        .vitrina-composer-error {
          margin: 0 0 8px;
          padding: 0 4px;
          color: var(--color-red, #C2410C);
          font-size: 0.78rem;
        }
        .vitrina-composer-row {
          display: flex;
          align-items: flex-end;
          gap: 6px;
        }
        .vitrina-composer-bar {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          border: 0;
          /* 6px corners, always — see DESIGN intent: rounded but not
             pill-shaped, so the bar can grow to multiple lines without
             warping into a stadium. */
          border-radius: 6px;
          background: var(--color-card);
          overflow: hidden;
          cursor: text;
          transition: box-shadow 160ms ease;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 7%, transparent);
        }
        .vitrina-composer-bar:focus-within {
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-terracotta, #DA654D) 40%, transparent), 0 12px 34px -30px rgba(60, 45, 30, 0.5);
        }
        .vitrina-composer-bar-recording {
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-terracotta, #DA654D) 35%, transparent);
        }
        .vitrina-composer-staged {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 8px 4px;
          overflow-x: auto;
        }
        .vitrina-composer-staged-item {
          position: relative;
          flex-shrink: 0;
        }
        .vitrina-composer-staged-item img,
        .vitrina-composer-add-more {
          width: 56px;
          height: 56px;
          border-radius: 6px;
        }
        .vitrina-composer-staged-item img {
          object-fit: cover;
          display: block;
        }
        .vitrina-composer-remove-file {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          min-width: 20px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-ink) 80%, transparent);
          color: white;
          padding: 0;
        }
        .vitrina-composer-add-more {
          flex-shrink: 0;
          border: 1px dashed var(--color-border);
          background: transparent;
          color: var(--color-ink-light);
        }
        .vitrina-composer-input-row {
          display: flex;
          align-items: flex-end;
          min-height: 44px;
          /* Constant height — Leo casa parity. The bar must not jump
             when the user starts/stops recording; the waveform draws
             inside the same 44px slot the textarea occupies. */
          /* Clicking anywhere in the bar (gaps included) focuses the
             textarea. */
          cursor: text;
        }
        .vitrina-composer-plus {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          min-width: 44px;
          background: transparent;
          color: var(--color-ink-light);
          padding: 0;
          border: 0 !important;
          box-shadow: none !important;
        }
        .vitrina-composer-input {
          flex: 1 1 auto;
          min-width: 0;
          width: 100%;
          align-self: stretch;
          border: 0;
          outline: 0;
          box-shadow: none;
          background: transparent;
          color: var(--color-ink);
          min-height: 44px;
          /* Vertical padding centres the cursor on a 44px row;
             right padding balances the textarea against the action
             button gap. JS controls the actual height. */
          padding: 11px 12px 11px 0;
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.4;
          font-family: inherit;
          resize: none;
          overflow-y: hidden;
          display: block;
          appearance: none;
          -webkit-appearance: none;
        }
        .vitrina-composer-input::placeholder {
          color: var(--color-ink-light);
          opacity: 0.7;
        }
        .vitrina-recording-row {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          min-height: 44px;
          height: 44px;
          padding: 0 12px;
        }
        .vitrina-recording-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--color-red, #EF4444);
          flex-shrink: 0;
          animation: vitrinaRecDot 1.1s ease-in-out infinite;
        }
        .vitrina-recording-time {
          color: var(--color-ink-light);
          font-size: 0.78rem;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }
        .vitrina-wave-container {
          flex: 1;
          min-width: 0;
          align-self: stretch;
          overflow: hidden;
          display: flex;
          align-items: center;
          mask-image: linear-gradient(90deg, rgba(0,0,0,0.1) 0, rgba(0,0,0,0.5) 14px, rgba(0,0,0,1) 36px);
          -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,0.1) 0, rgba(0,0,0,0.5) 14px, rgba(0,0,0,1) 36px);
        }
        .vitrina-wave-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }
        .vitrina-composer-discard,
        .vitrina-composer-action {
          width: 44px;
          height: 44px;
          min-width: 44px;
          /* 6px corners across the app — the mic/send button is no
             longer a circle. */
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 0 !important;
          box-shadow: none !important;
          /* Anchor to the bottom of the row so the input can grow
             upwards and these buttons stay put. */
          align-self: flex-end;
        }
        .vitrina-composer-discard {
          background: color-mix(in srgb, var(--color-ink) 6%, transparent);
          color: var(--color-ink-light);
        }
        .vitrina-composer-action {
          color: white;
        }
        .vitrina-composer-action-recording,
        .vitrina-composer-action-mic {
          background: var(--color-terracotta, #DA654D);
        }
        .vitrina-composer-action-send {
          background: var(--color-ink);
        }
        @keyframes vitrinaRecDot {
          0%, 100% { opacity: 0.48; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
