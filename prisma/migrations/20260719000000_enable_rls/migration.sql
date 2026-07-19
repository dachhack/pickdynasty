-- Enable Row Level Security on every table, with NO policies.
--
-- Why: on Supabase, the public schema is also exposed through PostgREST
-- (/rest/v1) to anyone holding the anon key — which ships in the browser
-- bundle once Supabase Auth is enabled. RLS with no policies makes that
-- surface deny-all. The app itself is unaffected: Prisma connects as the
-- role that owns these tables, and table owners bypass RLS.
--
-- When client-side reads arrive (e.g. Supabase Realtime chat), add explicit
-- membership-scoped policies for exactly the tables involved.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "League" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FantasyLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Slate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Game" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pick" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TiebreakerGuess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MessageReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MoneyEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
