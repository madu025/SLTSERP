-- Hard DB guard against duplicate material-usage lines. The bridge push and an
-- ERP-side sync raced on AN202607230049085 (2026-09-01): both interleaved the
-- rollback-then-create cycle and inserted the same Drop Wire line twice.
-- Expression index - Prisma cannot declare COALESCE indexes in schema files.
CREATE UNIQUE INDEX "uq_sod_material_usage_line"
    ON "SODMaterialUsage" ("serviceOrderId", "itemId", "usageType",
        COALESCE("batchId"::text, ''), COALESCE("serialNumber", ''));
