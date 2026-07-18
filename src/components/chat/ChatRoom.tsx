"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  deleteMessage,
  fetchMessages,
  sendMessage,
  toggleMessageReaction,
} from "@/actions/chat";
import type { MessageView } from "@/lib/chat";
import { tapHaptic } from "@/components/boards/celebrate";

const POLL_MS = 10_000;

const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type GifResult = { id: string; url: string; preview: string };

export default function ChatRoom({
  leagueId,
  initial,
  gifsEnabled,
}: {
  leagueId: string;
  initial: MessageView[];
  gifsEnabled: boolean;
}) {
  const [messages, setMessages] = useState<MessageView[]>(initial);
  const [text, setText] = useState("");
  const [attachedGif, setAttachedGif] = useState<string | null>(null);
  const [gifPanel, setGifPanel] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, startSend] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setMessages(await fetchMessages(leagueId));
    } catch {
      // Transient poll failure (offline, session refresh) — try again next tick.
    }
  }, [leagueId]);

  // Poll + refresh on focus. Realtime upgrade swaps this for a Supabase channel.
  useEffect(() => {
    const interval = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  // Stick to the bottom when new messages arrive (if already near it).
  const count = messages.length;
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 200;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [count]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  function send() {
    const body = text.trim();
    if ((!body && !attachedGif) || sending) return;
    tapHaptic();
    setError("");
    startSend(async () => {
      const result = await sendMessage({ leagueId, body, gifUrl: attachedGif });
      if (result.ok) {
        setMessages((prev) => [...prev, result.message]);
        setText("");
        setAttachedGif(null);
        setGifPanel(false);
      } else {
        setError(result.error);
      }
    });
  }

  async function searchGifs(q: string) {
    setGifLoading(true);
    try {
      const res = await fetch(`/api/gifs?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setGifResults(data.results ?? []);
    } catch {
      setGifResults([]);
    }
    setGifLoading(false);
  }

  function onReact(messageId: string, emoji: string) {
    tapHaptic();
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              reactions: m.reactions.map((r) =>
                r.emoji === emoji
                  ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) }
                  : r
              ),
            }
          : m
      )
    );
    toggleMessageReaction({ leagueId, messageId, emoji }).catch(() => refresh());
  }

  function onDelete(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    deleteMessage({ leagueId, messageId }).catch(() => refresh());
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-xl border border-slate-800 bg-slate-900/40">
      <div ref={listRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">
            No messages yet — start the trash talk. 🗑️🔥
          </p>
        )}
        <div className="flex flex-col gap-4">
          {messages.map((m) => (
            <div key={m.id} className="group flex gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `${m.author?.color ?? "#334155"}33` }}
              >
                {m.author?.emoji ?? "👻"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-500">
                  <span className="font-semibold" style={{ color: m.author?.color }}>
                    {m.author?.name ?? "Departed member"}
                  </span>{" "}
                  · {timeFmt.format(new Date(m.createdAt))}
                  {m.canDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(m.id)}
                      className="ml-2 hidden text-red-400 hover:underline group-hover:inline"
                    >
                      delete
                    </button>
                  )}
                </p>
                {m.body && <p className="mt-0.5 text-sm text-slate-200">{m.body}</p>}
                {m.gifUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.gifUrl}
                    alt="GIF"
                    className="mt-1 max-h-48 rounded-lg border border-slate-800"
                  />
                )}
                <div className="mt-1 flex gap-1">
                  {m.reactions.map((r) => (
                    <button
                      key={r.emoji}
                      type="button"
                      title={r.who}
                      onClick={() => onReact(m.id, r.emoji)}
                      className={`rounded-full border px-1.5 py-0.5 text-xs transition-all active:scale-90 ${
                        r.mine
                          ? "border-indigo-500 bg-indigo-950/60"
                          : r.count > 0
                            ? "border-slate-700"
                            : "border-transparent opacity-0 group-hover:opacity-60 hover:!opacity-100"
                      }`}
                    >
                      {r.emoji}
                      {r.count > 0 && <span className="ml-0.5 text-slate-400">{r.count}</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>

      {gifPanel && (
        <div className="border-t border-slate-800 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchGifs(gifQuery);
            }}
            className="flex gap-2"
          >
            <input
              className="input"
              placeholder="Search Tenor GIFs…"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              autoFocus
            />
            <button className="btn-ghost shrink-0 !text-xs">Search</button>
          </form>
          <div className="mt-2 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {gifLoading && <p className="col-span-full text-xs text-slate-500">Searching…</p>}
            {gifResults.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setAttachedGif(g.url);
                  setGifPanel(false);
                }}
                className="overflow-hidden rounded-lg border border-slate-800 hover:border-indigo-500"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt="GIF option" className="h-20 w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-slate-800 p-3">
        {attachedGif && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachedGif} alt="Attached GIF" className="h-14 rounded border border-slate-700" />
            <button type="button" onClick={() => setAttachedGif(null)} className="btn-danger">
              ✕ Remove
            </button>
          </div>
        )}
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          {gifsEnabled && (
            <button
              type="button"
              onClick={() => setGifPanel((v) => !v)}
              className={`btn-ghost shrink-0 !px-3 ${gifPanel ? "!border-indigo-500" : ""}`}
              title="Attach a GIF"
            >
              GIF
            </button>
          )}
          <input
            className="input"
            placeholder="Talk your talk…"
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="button" onClick={send} disabled={sending} className="btn shrink-0">
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
