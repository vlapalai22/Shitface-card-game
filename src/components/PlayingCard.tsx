import React, { useState } from 'react';
import type { Card, Rank, Suit } from '../shared/types';

export const CARD_BACK_IMAGE = '/src/assets/images/royal_card_back_1795605614663.jpg';

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_LABEL: Record<Suit, string> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

function getSpecialMeta(rank: Rank): { label: string; colorClass: string } | null {
  if (rank === '2') {
    return { label: 'RESET', colorClass: 'text-emerald-800' };
  }
  if (rank === '7') {
    return { label: '≤ 7', colorClass: 'text-amber-700' };
  }
  if (rank === '10') {
    return { label: 'BURN', colorClass: 'text-rose-800' };
  }
  return null;
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<
  CardSize,
  {
    frame: string;
    rank: string;
    cornerSuit: string;
    centerSuit: string;
    special: string;
  }
> = {
  xs: {
    frame: 'w-11 h-16 rounded-md',
    rank: 'text-[11px] leading-none',
    cornerSuit: 'text-[10px] leading-none',
    centerSuit: 'text-lg leading-none',
    special: 'text-[7px] tracking-wider',
  },
  sm: {
    frame: 'w-14 h-20 rounded-lg',
    rank: 'text-xs leading-none',
    cornerSuit: 'text-[11px] leading-none',
    centerSuit: 'text-2xl leading-none',
    special: 'text-[8px] tracking-wider',
  },
  md: {
    frame: 'w-[74px] h-[106px] sm:w-[82px] sm:h-[118px] rounded-lg',
    rank: 'text-sm sm:text-base leading-none',
    cornerSuit: 'text-xs sm:text-sm leading-none',
    centerSuit: 'text-3xl sm:text-4xl leading-none',
    special: 'text-[9px] tracking-wider',
  },
  lg: {
    frame: 'w-[86px] h-[124px] sm:w-[96px] sm:h-[138px] rounded-xl',
    rank: 'text-base sm:text-lg leading-none',
    cornerSuit: 'text-sm leading-none',
    centerSuit: 'text-4xl sm:text-5xl leading-none',
    special: 'text-[10px] tracking-wider',
  },
};

interface PlayingCardProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: CardSize;
  selected?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  size = 'md',
  selected = false,
  playable = false,
  dimmed = false,
  interactive = false,
  onClick,
  onDoubleClick,
  className = '',
  ariaLabel,
}) => {
  const [backImgFailed, setBackImgFailed] = useState(false);
  const styles = SIZE_CLASSES[size];

  const baseInteractive = interactive
    ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B3B24]'
    : 'cursor-default';

  const elevationClass = selected
    ? '-translate-y-4 ring-2 ring-[#D4AF37] shadow-[0_14px_28px_rgba(0,0,0,0.55)]'
    : playable && interactive
      ? 'hover:-translate-y-2.5 ring-1 ring-[#D4AF37]/75 shadow-[0_8px_18px_rgba(0,0,0,0.42)]'
      : 'shadow-[0_6px_14px_rgba(0,0,0,0.38)]';

  const opacityClass = dimmed ? 'opacity-50 saturate-50' : 'opacity-100';

  if (faceDown || !card) {
    const content = (
      <div
        className={`relative overflow-hidden select-none border border-[#FAF7F0]/80 bg-[#0E3F27] transition-transform duration-150 ease-out ${styles.frame} ${elevationClass} ${opacityClass} ${baseInteractive} ${className}`}
      >
        {!backImgFailed ? (
          <img
            src={CARD_BACK_IMAGE}
            alt="Face-down Palace card"
            referrerPolicy="no-referrer"
            onError={() => setBackImgFailed(true)}
            className="h-full w-full object-cover pointer-events-none"
          />
        ) : (
          <div className="h-full w-full p-1 bg-[#FAF7F0]">
            <div className="h-full w-full rounded-[4px] bg-[#0B3B24] border border-[#D4AF37]/70 flex items-center justify-center">
              <div className="w-4 h-4 rotate-45 border border-[#D4AF37]/80" />
            </div>
          </div>
        )}
      </div>
    );

    if (interactive) {
      return (
        <button
          type="button"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          aria-label={ariaLabel ?? 'Flip face-down card'}
          className="block p-0 bg-transparent border-0 text-left"
        >
          {content}
        </button>
      );
    }

    return content;
  }

  const red = isRedSuit(card.suit);
  const symbol = SUIT_SYMBOL[card.suit];
  const suitColor = red ? 'text-[#C81E2B]' : 'text-[#18181B]';
  const special = getSpecialMeta(card.rank);
  const specialSurface =
    card.rank === '7'
      ? 'bg-gradient-to-b from-[#FFFDF7] to-[#FEF3D6] border-amber-400/80'
      : card.rank === '10'
        ? 'bg-gradient-to-b from-[#FFFDF9] to-[#FCE9E9] border-rose-400/75'
        : card.rank === '2'
          ? 'bg-gradient-to-b from-[#FFFDF9] to-[#E6F6EE] border-emerald-500/70'
          : 'bg-[#FAF7F0] border-[#DFD8C8]';

  const cardBody = (
    <div
      className={`relative select-none border transition-transform duration-150 ease-out ${styles.frame} ${specialSurface} ${elevationClass} ${opacityClass} ${baseInteractive} ${className}`}
    >
      {/* Top-left rank + suit */}
      <div className={`absolute top-1.5 left-1.5 flex flex-col items-center font-bold ${suitColor}`}>
        <span className={styles.rank}>{card.rank}</span>
        <span className={`${styles.cornerSuit} mt-0.5`}>{symbol}</span>
      </div>

      {/* Center pip + optional special role subtitle */}
      <div className="h-full w-full flex flex-col items-center justify-center pointer-events-none">
        <span className={`${styles.centerSuit} ${suitColor}`}>{symbol}</span>
        {special && (
          <span
            className={`mt-0.5 font-mono font-semibold ${styles.special} ${special.colorClass}`}
          >
            {special.label}
          </span>
        )}
      </div>

      {/* Bottom-right inverted rank + suit */}
      <div
        className={`absolute bottom-1.5 right-1.5 flex flex-col items-center font-bold rotate-180 ${suitColor}`}
      >
        <span className={styles.rank}>{card.rank}</span>
        <span className={`${styles.cornerSuit} mt-0.5`}>{symbol}</span>
      </div>
    </div>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        aria-label={ariaLabel ?? `${card.rank} of ${SUIT_LABEL[card.suit]}`}
        aria-pressed={selected}
        className="block p-0 bg-transparent border-0 text-left"
      >
        {cardBody}
      </button>
    );
  }

  return cardBody;
};
