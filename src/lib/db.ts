import { PrismaClient } from "@prisma/client";

// Venue.logo is raw image bytes — omit it globally so ordinary venue
// queries stay light. The logo-serving route re-selects it explicitly.
const makeClient = () =>
  new PrismaClient({ omit: { venue: { logo: true } } });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof makeClient>;
};

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
