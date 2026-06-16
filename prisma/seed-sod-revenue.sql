-- Insert default SOD revenue configuration
INSERT INTO "SODRevenueConfig" (
    id,
    "rtomId",
    "revenuePerSOD",
    "effectiveFrom",
    "effectiveTo",
    "circularRef",
    notes,
    "isActive",
    "createdAt",
    "updatedAt"
) VALUES (
    gen_random_uuid()::text,
    NULL,
    10500,
    NULL,
    NULL,
    NULL,
    'Default revenue per SOD for all RTOMs',
    true,
    NOW(),
    NOW()
) ON CONFLICT DO NOTHING;
