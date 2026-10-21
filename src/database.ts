import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

if (!process.env.DATABASE_URL) throw new Error('A private DATABASE_URL reference is required.');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 4, connectionTimeoutMillis: 5000 });
export const prisma = new PrismaClient({ adapter, log: [] });

export async function readNotes() {
  const rows = await prisma.releaseNote.findMany({
    where: { id: { in: [1, 2, 3] } },
    orderBy: { id: 'asc' },
    select: { id: true, title: true, summary: true },
  });
  return rows;
}
