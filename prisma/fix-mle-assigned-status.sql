-- One-off (2026-09-01): mirror the portal for MLE202609010060741 (JG PERERA).
-- Portal iShamp shows CON_STATUS=ASSIGNED (screenshot); DB had the old mapper's
-- collapse value. Mapper fix is in this deploy; this row is set directly so the
-- pending table shows ASSIGNED without waiting for the next sync cycle.
UPDATE "ServiceOrder"
SET "sltsStatus" = 'ASSIGNED', "updatedAt" = now()
WHERE "soNum" = 'MLE202609010060741';
