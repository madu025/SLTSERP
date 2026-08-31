-- Migration: add_document_counter
-- Adds the `DocumentCounter` table used for atomic, per-period sequential
-- document numbering (MIN | MRN | GRN | ISS | GRN-IR | ISS-IR | MRN-IR ...).
-- Additive-only: safe to apply/roll back independently.

-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentCounter" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentCounter_type_period_key" ON "DocumentCounter"("type", "period");
