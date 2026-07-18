import { requireMembership } from "@/lib/league";
import { loadMessages } from "@/lib/chat";
import ChatRoom from "@/components/chat/ChatRoom";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireMembership(id);
  const initial = await loadMessages(id, membership);
  const gifsEnabled = Boolean(process.env.TENOR_API_KEY);

  return (
    <div className="flex flex-col gap-3">
      <ChatRoom leagueId={id} initial={initial} gifsEnabled={gifsEnabled} />
      {!gifsEnabled && (
        <p className="text-xs text-slate-600">
          💡 GIF search lights up when a free Tenor API key is set (TENOR_API_KEY).
        </p>
      )}
    </div>
  );
}
