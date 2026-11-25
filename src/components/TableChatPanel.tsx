import React, { useEffect, useRef, useState } from 'react';
import { Send, Smile, X } from 'lucide-react';
import {
  ChatMessage,
  MOCK_EMOJIS,
  QUICK_TAUNTS,
} from '../shared/types';

interface TableChatPanelProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentPlayerId: string;
  onSendMessage: (text: string, emoji?: string) => void;
  onSendReaction: (emoji: string, taunt?: string) => void;
}

export const TableChatPanel: React.FC<TableChatPanelProps> = ({
  open,
  onClose,
  messages,
  currentPlayerId,
  onSendMessage,
  onSendReaction,
}) => {
  const [draft, setDraft] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned && !selectedEmoji) return;
    onSendMessage(cleaned, selectedEmoji ?? undefined);
    setDraft('');
    setSelectedEmoji(null);
  };

  return (
    <aside
      aria-label="Table chat and mocking emojis"
      className="fixed right-0 top-14 bottom-0 z-40 w-full sm:w-80 lg:static lg:top-auto lg:bottom-auto lg:h-full lg:w-80 flex flex-col bg-[#0E1B15]/98 lg:bg-[#0E1B15] border-l border-[#D4AF37]/20 shadow-2xl lg:shadow-none shrink-0"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#FAF7F0]">Table Banter</h2>
          <p className="text-[11px] text-[#9AA89F]">Tap an emoji to mock on the felt</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat panel"
          className="p-1.5 rounded-lg text-[#9AA89F] hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Mock Emoji Grid */}
      <div className="px-3.5 py-3 border-b border-white/10 bg-[#0B1510]">
        <div className="grid grid-cols-4 gap-1.5">
          {MOCK_EMOJIS.map((item) => (
            <button
              key={item.emoji}
              type="button"
              onClick={() => onSendReaction(item.emoji, item.defaultTaunt)}
              title={`${item.label}: "${item.defaultTaunt}"`}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[#14261E] hover:bg-[#1C352A] border border-white/5 hover:border-[#D4AF37]/40 transition-transform active:scale-95"
            >
              <span className="text-xl leading-none">{item.emoji}</span>
              <span className="mt-1 text-[10px] text-[#A8B6AD] truncate max-w-full">
                {item.label}
              </span>
            </button>
          ))}
        </div>

        {/* One-tap cheeky taunts */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {QUICK_TAUNTS.map((taunt) => (
            <button
              key={taunt}
              type="button"
              onClick={() => onSendReaction('😈', taunt)}
              className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-[#D4AF37]/20 text-[11px] text-[#CBD6CF] hover:text-[#FAF7F0] border border-white/5 transition-colors whitespace-nowrap"
            >
              {taunt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Message Log */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 text-[#829288]">
            <Smile className="w-6 h-6 opacity-60" />
            <p className="mt-2 text-xs">
              Send a message or fire a mocking emoji to taunt your opponents.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentPlayerId;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-[#8B9A91] px-1">
                  <span className={isMe ? 'text-[#D4AF37]' : 'text-[#C5D1C9] font-medium'}>
                    {isMe ? 'You' : msg.senderName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{timeStr}</span>
                </div>
                <div
                  className={`mt-1 max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed break-words ${
                    isMe
                      ? 'bg-[#1D3B2C] text-[#FAF7F0] border border-[#D4AF37]/25'
                      : 'bg-[#14241C] text-[#E4EAE6] border border-white/10'
                  }`}
                >
                  {msg.emoji && (
                    <span className="text-lg align-middle mr-1.5 leading-none">{msg.emoji}</span>
                  )}
                  {msg.text && <span className="align-middle">{msg.text}</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 bg-[#0B1510] flex flex-col gap-2"
      >
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {MOCK_EMOJIS.map((item) => (
            <button
              key={`pick-${item.emoji}`}
              type="button"
              onClick={() =>
                setSelectedEmoji((prev) => (prev === item.emoji ? null : item.emoji))
              }
              aria-label={`Attach ${item.label} emoji`}
              className={`w-7 h-7 rounded-md flex items-center justify-center text-sm shrink-0 transition-colors ${
                selectedEmoji === item.emoji
                  ? 'bg-[#D4AF37]/30 ring-1 ring-[#D4AF37]'
                  : 'hover:bg-white/10'
              }`}
            >
              {item.emoji}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={selectedEmoji ? `Taunt with ${selectedEmoji}...` : 'Message the table...'}
            maxLength={220}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#14261E] border border-white/10 text-xs text-[#FAF7F0] placeholder:text-[#7E8D83] focus:outline-none focus:border-[#D4AF37]/70"
          />
          <button
            type="submit"
            disabled={!draft.trim() && !selectedEmoji}
            aria-label="Send message"
            className="p-2 rounded-lg bg-[#D4AF37] text-[#0B1410] hover:bg-[#E2C152] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
