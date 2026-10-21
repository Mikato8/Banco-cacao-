import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

// Prisma's native engine hits P1001 on this host against Neon;
// node-pg + driver adapter works reliably with the pooler URL.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
