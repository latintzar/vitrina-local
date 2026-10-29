/**
 * VitrinaVoiceBubble — voice note message bubble, Leo casa parity.
 *
 * Why this exists in Vitrina rather than reusing `@scope/ui`'s
 * `VoiceNoteBubble`:
 *   • Vitrina overrides user message bubbles to dark ink + cream
 *     text (see `.leo-chat-user` rules in ChatPage). The shared
 *     `VoiceNoteBubble` is hard-coded to terracotta which clashes
 *     with that styling.
 *   • Leo casa's voice note bubble has a noticeably larger play
 *     button (~36px disc) than the @scope/ui one (20px bare icon).
 *   • The shared bubble wraps the transcript in a `<Button>` whose
 *     base classes (`inline-flex items-center`) caused the
 *     transcript text to appear centred / cramped inside Vitrina's
 *     dark bubble.
 *
 * Behaviour matches Leo casa:
 *   • Tap the play disc to play the recorded audio (object URL).
 *   • Static, downsampled waveform (~20 bars) drawn as rounded white
 *     bars sized by amplitude.
 *   • Duration shown right-aligned.
 *   • Transcript shown italic underneath, left-aligned, collapsible
 *     past ~90 chars.
 */

import { useCallback, useRef, useState } from 'react';

interface VitrinaVoiceBubbleProps {
  durationSec: number;
  /** Amplitude values 0–1; falls back to a soft sine pattern. */
  waveform?: number[];
  /** Transcript text. Shows "Transcribing…" while undefined. */
  transcript?: string;
  /** Object URL for playback. Only valid for the current session. */
  audioUrl?: string;
}

const fmtDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const PlayGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M8 5.14v13.72c0 .9.95 1.46 1.74 1.04l11.13-6.86c.79-.42.79-1.66 0-2.08L9.74 4.1A1.18 1.18 0 0 0 8 5.14z" />
  </svg>
);

const PauseGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <rect x="6" y="4.5" width="4.2" height="15" rx="1.6" />
    <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.6" />
  </svg>
);

export function VitrinaVoiceBubble({
  durationSec,
  waveform,
  transcript,
  audioUrl,
}: VitrinaVoiceBubbleProps) {
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bars = waveform?.length
    ? waveform
    : Array.from({ length: 22 }, (_, i) => 0.32 + 0.22 * Math.sin(i * 0.7));

  const transcriptLine = (transcript || '').trim();
  const COLLAPSE_AT = 96;
  const showExpand = transcriptLine.length > COLLAPSE_AT;
  const visibleTranscript =
    showExpand && !expanded
      ? `${transcriptLine.slice(0, COLLAPSE_AT)}…`
      : transcriptLine;

  const handlePlayPause = useCallback(() => {
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
      audioRef.current.addEventListener('pause', () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play().catch(() => setPlaying(false));
      setPlaying(true);
    }
  }, [audioUrl, playing]);

  return (
    <div className="vitrina-voice-bubble">
      <div className="vitrina-voice-bubble__row">
        <button
          type="button"
          className="vitrina-voice-bubble__play"
          onClick={handlePlayPause}
          disabled={!audioUrl}
          aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        >
          {playing ? <PauseGlyph /> : <PlayGlyph />}
        </button>
        <div className="vitrina-voice-bubble__bars" aria-hidden>
          {bars.map((v, i) => (
            <span
              key={i}
              className="vitrina-voice-bubble__bar"
              style={{
                height: `${Math.max(6, 6 + v * 22)}px`,
                opacity: Math.max(0.45, 0.4 + v * 0.6),
              }}
            />
          ))}
        </div>
        <span className="vitrina-voice-bubble__time" aria-hidden>
          {fmtDuration(durationSec)}
        </span>
      </div>
      {transcriptLine ? (
        <button
          type="button"
          className="vitrina-voice-bubble__transcript"
          onClick={() => showExpand && setExpanded((e) => !e)}
          aria-expanded={showExpand ? expanded : undefined}
        >
          <span>"{visibleTranscript}"</span>
          {showExpand ? (
            <span className="vitrina-voice-bubble__more">
              {expanded ? 'less' : 'more'}
            </span>
          ) : null}
        </button>
      ) : (
        <p className="vitrina-voice-bubble__transcribing">Transcribing…</p>
      )}
      <style>{`
        .vitrina-voice-bubble {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-self: flex-end;
          width: fit-content;
          max-width: min(78%, 320px);
          padding: 10px 12px 11px;
          border-radius: 6px 6px 4px 6px;
          background: #2a2420;
          color: #f4ede1;
          box-shadow: 0 12px 30px -22px rgba(42, 36, 32, 0.8);
        }
        .vitrina-voice-bubble__row {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }
        .vitrina-voice-bubble__play {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          padding: 0;
          border: 0;
          border-radius: 999px;
          background: rgba(244, 237, 225, 0.16);
          color: #f4ede1;
          cursor: pointer;
          transition: background 140ms ease, transform 120ms ease;
        }
        .vitrina-voice-bubble__play:hover {
          background: rgba(244, 237, 225, 0.24);
        }
        .vitrina-voice-bubble__play:active {
          transform: scale(0.94);
        }
        .vitrina-voice-bubble__play:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .vitrina-voice-bubble__bars {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 2px;
          height: 30px;
        }
        .vitrina-voice-bubble__bar {
          flex: 1;
          min-width: 2px;
          border-radius: 999px;
          background: currentColor;
        }
        .vitrina-voice-bubble__time {
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
          font-size: 0.72rem;
          color: rgba(244, 237, 225, 0.78);
        }
        .vitrina-voice-bubble__transcript {
          appearance: none;
          background: transparent;
          border: 0;
          padding: 0;
          margin: 0;
          color: rgba(244, 237, 225, 0.85);
          font: inherit;
          font-style: italic;
          font-size: 0.82rem;
          line-height: 1.42;
          text-align: left;
          width: 100%;
          cursor: ${'pointer'};
          display: block;
        }
        .vitrina-voice-bubble__transcript:focus-visible {
          outline: 2px solid rgba(244, 237, 225, 0.4);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .vitrina-voice-bubble__more {
          margin-left: 6px;
          font-style: normal;
          font-size: 0.68rem;
          color: rgba(244, 237, 225, 0.55);
        }
        .vitrina-voice-bubble__transcribing {
          margin: 0;
          color: rgba(244, 237, 225, 0.6);
          font-style: italic;
          font-size: 0.82rem;
          line-height: 1.42;
        }
      `}</style>
    </div>
  );
}
