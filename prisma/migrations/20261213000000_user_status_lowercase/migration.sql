-- A few old accounts hold status 'ACTIVE'. Every status comparison in the code is case-insensitive now, but the list
-- counts and filters are simpler (and indexes usable) when the stored values agree.
UPDATE "User" SET "status" = lower("status") WHERE "status" <> lower("status");
