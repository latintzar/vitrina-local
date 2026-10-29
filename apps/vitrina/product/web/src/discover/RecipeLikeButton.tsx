import type { MouseEvent } from 'react';
import { Heart } from 'lucide-react';

export function RecipeLikeButton({
  liked,
  onPress,
  className = '',
  size = 20,
  'aria-label': ariaLabel,
}: {
  liked: boolean;
  onPress: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  size?: number;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel ?? (liked ? 'Remove from saved recipes' : 'Save recipe')}
      aria-pressed={liked}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPress(e);
      }}
    >
      <Heart
        size={size}
        strokeWidth={2}
        fill={liked ? 'currentColor' : 'none'}
        aria-hidden
      />
    </button>
  );
}
