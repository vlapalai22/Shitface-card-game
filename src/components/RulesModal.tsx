import React from 'react';
import { X } from 'lucide-react';
import { PlayingCard } from './PlayingCard';
import type { Card } from '../shared/types';

interface RulesModalProps {
  open: boolean;
  onClose: () => void;
}

const DEMO_CARDS: { card: Card; title: string; detail: string }[] = [
  {
    card: { id: 'demo-2', rank: '2', suit: 'diamonds' },
    title: '2 — Pile Reset',
    detail: 'Wild special playable on any card (even on a 7). Resets the table so the next player may play anything.',
  },
  {
    card: { id: 'demo-7', rank: '7', suit: 'spades' },
    title: '7 — Special Lower Rule',
    detail: 'Playable on 7 or lower (or after a 2). Forces the next player to play 7 or lower (3–7), or a wild 2 or 10.',
  },
  {
    card: { id: 'demo-10', rank: '10', suit: 'hearts' },
    title: '10 — Burn Pile',
    detail: 'Wild special playable on any card. Burns the entire discard pile out of the game and gives you another turn immediately.',
  },
];

export const RulesModal: React.FC<RulesModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#112019] border border-[#D4AF37]/25 shadow-2xl p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <h2
              id="rules-modal-title"
              className="font-display text-2xl sm:text-3xl font-semibold text-[#FAF7F0] tracking-tight"
            >
              Palace Rules — Classic + 7
            </h2>
            <p className="mt-1 text-sm text-[#B8C4BC]">
              First player to shed their hand, face-up, and face-down cards claims the Palace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="p-2 rounded-lg text-[#B8C4BC] hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-[#D8E0DA]">
          <section>
            <h3 className="font-display text-lg font-semibold text-[#FAF7F0]">
              01. Deal & Opening Swap
            </h3>
            <p className="mt-1.5 text-[#B8C4BC]">
              Each player receives 3 hidden <strong className="text-[#FAF7F0]">face-down</strong>{' '}
              cards, 3 visible <strong className="text-[#FAF7F0]">face-up</strong> cards on top of
              them, and 3 cards in <strong className="text-[#FAF7F0]">hand</strong>. Before play
              starts, swap cards between your hand and face-up row to place your strongest cards
              (2s, 10s, 7s, Aces) on top, then click <strong className="text-[#FAF7F0]">Lock Setup</strong>.
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-[#FAF7F0]">
              02. Special Cards & Four-of-a-Kind
            </h3>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {DEMO_CARDS.map((item) => (
                <div
                  key={item.card.id}
                  className="rounded-xl bg-[#0C1712] border border-white/10 p-4 flex flex-col items-center text-center"
                >
                  <PlayingCard card={item.card} size="sm" />
                  <h4 className="mt-3 font-semibold text-[#FAF7F0]">{item.title}</h4>
                  <p className="mt-1 text-xs text-[#A8B6AD] leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[#B8C4BC]">
              <strong className="text-[#FAF7F0]">Four of a Kind:</strong> Placing 4 consecutive
              cards of the same rank onto the discard pile (all at once or completing the 4th on
              top of earlier cards) also <strong className="text-[#FAF7F0]">burns</strong> the pile
              and awards an immediate extra turn.
            </p>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-[#FAF7F0]">
              03. Turns, Multi-Plays & Picking Up
            </h3>
            <ul className="mt-2 space-y-1.5 text-[#B8C4BC] list-disc pl-5">
              <li>
                Standard rank order runs <span className="font-mono-tabular text-[#FAF7F0]">3 → 4 → 5 → 6 → 7 → 8 → 9 → J → Q → K → A</span>.
              </li>
              <li>
                Play one or multiple cards of the <strong className="text-[#FAF7F0]">same rank</strong> equal to or higher than the top card (unless a 7 is active, which requires 7 or lower).
              </li>
              <li>
                While the draw deck has cards, your hand automatically refills back up to 3 after playing.
              </li>
              <li>
                If you cannot legally beat the pile, click <strong className="text-[#FAF7F0]">Pick Up Pile</strong> to take the entire discard stack into your hand.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-display text-lg font-semibold text-[#FAF7F0]">
              04. End-Game Palace Cards
            </h3>
            <p className="mt-1.5 text-[#B8C4BC]">
              Once the draw deck and your hand are empty, play from your 3{' '}
              <strong className="text-[#FAF7F0]">face-up</strong> cards. When those are cleared,
              click one hidden <strong className="text-[#FAF7F0]">face-down</strong> card per turn
              to flip it blind. If it legally beats the pile, it stays; if not, you scoop the pile
              plus that flipped card back into your hand.
            </p>
          </section>
        </div>

        <div className="mt-7 pt-5 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-[#0B1410] text-sm font-semibold hover:bg-[#E2C152] transition-colors whitespace-nowrap shrink-0"
          >
            Back to Salon
          </button>
        </div>
      </div>
    </div>
  );
};
