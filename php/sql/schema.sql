-- Compatible con el schema Prisma existente (nombres de tabla PascalCase).
-- Si ya corriste el seed Node, no hace falta recrear.

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'CLIENT',
  "cacaoBalance" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "cacaoPrice" INTEGER NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "sellerId" TEXT REFERENCES "User"("id"),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "amountCacao" INTEGER NOT NULL,
  "amountMxn" INTEGER,
  "note" TEXT,
  "meta" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "fromUserId" TEXT REFERENCES "User"("id"),
  "toUserId" TEXT REFERENCES "User"("id")
);

CREATE TABLE IF NOT EXISTS "Redemption" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "productId" TEXT NOT NULL REFERENCES "Product"("id"),
  "cacaoPaid" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ledgerId" TEXT NOT NULL UNIQUE REFERENCES "LedgerEntry"("id")
);

CREATE INDEX IF NOT EXISTS idx_ledger_from ON "LedgerEntry"("fromUserId");
CREATE INDEX IF NOT EXISTS idx_ledger_to ON "LedgerEntry"("toUserId");
CREATE INDEX IF NOT EXISTS idx_product_active ON "Product"("active");
