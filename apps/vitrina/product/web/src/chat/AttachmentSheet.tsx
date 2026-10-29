import { useEffect, useRef } from 'react';
import { Camera, FileText, Image } from 'lucide-react';
import { Button } from '@scope/ui';

interface AttachmentSheetProps {
  open: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  onChooseFile: () => void;
}

export function AttachmentSheet({
  open,
  onClose,
  onTakePhoto,
  onChooseGallery,
  onChooseFile,
}: AttachmentSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const options = [
    { label: 'Take photo', icon: Camera, action: onTakePhoto },
    { label: 'Photo library', icon: Image, action: onChooseGallery },
    { label: 'Choose file', icon: FileText, action: onChooseFile },
  ];

  return (
    <div
      className="vitrina-attachment-sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Add attachment"
      onClick={onClose}
    >
      <div ref={sheetRef} className="vitrina-attachment-card" onClick={(event) => event.stopPropagation()}>
        {options.map(({ label, icon: Icon, action }, i) => (
          <Button
            key={label}
            type="button"
            disabled
            className={`vitrina-attachment-option ${i > 0 ? 'vitrina-attachment-option-bordered' : ''}`}
            onClick={() => action()}
          >
            <Icon size={22} aria-hidden />
            {label}
          </Button>
        ))}
        <p className="vitrina-attachment-note">Attachments are shown for parity with the chat composer and unlock with cart media support.</p>
      </div>
      <Button type="button" className="vitrina-attachment-cancel" onClick={onClose}>
        Cancel
      </Button>

      <style>{`
        .vitrina-attachment-sheet {
          position: fixed;
          inset: 0;
          z-index: 70;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          padding: 14px;
          background: rgba(20, 29, 45, 0.22);
        }
        .vitrina-attachment-card {
          width: min(420px, 100%);
          border-radius: var(--r, 6px);
          background: var(--color-card);
          box-shadow: 0 24px 80px -48px rgba(31, 75, 150, 0.65);
          overflow: hidden;
        }
        .vitrina-attachment-option {
          width: 100%;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 14px;
          padding: 14px 18px;
          border-radius: 0;
          background: transparent;
          color: var(--color-ink);
          font-size: 0.95rem;
        }
        .vitrina-attachment-option svg {
          color: var(--color-ink-light);
          flex-shrink: 0;
        }
        .vitrina-attachment-option:disabled {
          opacity: 0.58;
        }
        .vitrina-attachment-option-bordered {
          border-top: 1px solid var(--color-border);
        }
        .vitrina-attachment-note {
          margin: 0;
          padding: 12px 18px 14px;
          border-top: 1px solid var(--color-border);
          color: var(--color-ink-light);
          font-size: 0.84rem;
          line-height: 1.4;
        }
        .vitrina-attachment-cancel {
          width: min(420px, 100%);
          min-height: 48px;
          margin-top: 8px;
          border-radius: var(--r, 6px);
          background: var(--color-card);
          color: var(--color-ink-light);
          box-shadow: 0 18px 50px -36px rgba(31, 75, 150, 0.55);
        }
      `}</style>
    </div>
  );
}
