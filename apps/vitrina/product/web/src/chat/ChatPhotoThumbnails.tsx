/**
 * Photo strip above a user text or voice bubble — same behaviour as
 * `apps/scope/product/web/src/components/chat/ChatMessage.tsx` PhotoThumbnails.
 */

import { useState } from 'react';
import { Button } from '@scope/ui';
import { X } from 'lucide-react';

export function ChatPhotoThumbnails({ urls }: { urls: string[] }) {
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  if (!urls.length) return null;

  return (
    <>
      <div
        className={`vitrina-chat-photos ${urls.length === 1 ? 'vitrina-chat-photos--single' : ''}`}
      >
        {urls.map((url, i) => (
          <Button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setViewUrl(url)}
            className="vitrina-chat-photos__thumb"
          >
            <img src={url} alt={`Attachment ${i + 1}`} />
          </Button>
        ))}
      </div>

      {viewUrl ? (
        <div
          className="vitrina-chat-photos-lightbox"
          onClick={() => setViewUrl(null)}
          role="dialog"
          aria-modal="true"
          aria-label="View photo"
        >
          <Button
            type="button"
            onClick={() => setViewUrl(null)}
            className="vitrina-chat-photos-lightbox__close"
            aria-label="Close"
          >
            <X size={22} />
          </Button>
          <img
            src={viewUrl}
            alt="Full size"
            className="vitrina-chat-photos-lightbox__img"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      <style>{`
        .vitrina-chat-photos {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }
        .vitrina-chat-photos--single {
          max-width: 200px;
        }
        .vitrina-chat-photos__thumb {
          padding: 0;
          border: 0;
          border-radius: 6px;
          overflow: hidden;
          background: transparent;
          box-shadow: none;
          cursor: pointer;
        }
        .vitrina-chat-photos__thumb:focus-visible {
          outline: 2px solid var(--color-terracotta, #da654d);
          outline-offset: 2px;
        }
        .vitrina-chat-photos__thumb img {
          display: block;
          object-fit: cover;
          width: 64px;
          height: 64px;
        }
        .vitrina-chat-photos--single .vitrina-chat-photos__thumb img {
          width: 100%;
          max-height: 200px;
          height: auto;
        }
        .vitrina-chat-photos-lightbox {
          position: fixed;
          inset: 0;
          z-index: 120;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.82);
        }
        .vitrina-chat-photos-lightbox__close {
          position: absolute;
          top: max(1rem, env(safe-area-inset-top, 1rem));
          right: 1rem;
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
          border: 0;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .vitrina-chat-photos-lightbox__close:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .vitrina-chat-photos-lightbox__img {
          max-width: 90vw;
          max-height: 85vh;
          object-fit: contain;
          border-radius: 6px;
        }
      `}</style>
    </>
  );
}
