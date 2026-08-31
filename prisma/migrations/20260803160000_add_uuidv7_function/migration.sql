-- Migration: Add Native PostgreSQL UUID v7 Generator Function
-- Description: Enables time-ordered 128-bit sequential UUID v7 generation in PostgreSQL for optimal B-Tree index performance and 16-byte storage.

-- Ensure pgcrypto extension is available for random byte generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create or Replace uuid_generate_v7() Function
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
  timestamp_ms bigint;
  uuid_bytes bytea;
BEGIN
  -- 1. Get current Unix timestamp in milliseconds (48-bit timestamp)
  timestamp_ms := floor(extract(epoch from clock_timestamp()) * 1000);
  
  -- 2. Construct 16-byte binary payload:
  -- - 48 bits (6 bytes): millisecond timestamp
  -- - 4 bits: version 7 (0111)
  -- - 12 bits: random / sequence
  -- - 2 bits: variant (10)
  -- - 62 bits: random payload
  uuid_bytes := set_bit(
                  set_bit(
                    overlay(
                      gen_random_bytes(16) placing substring(int8send(timestamp_ms) from 3 for 6) from 1 for 6
                    ),
                    48, 0
                  ),
                  49, 1
                );
  
  -- 3. Return formatted hex string cast to native PostgreSQL UUID
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, extensions, pg_temp;

-- Comment on function for database documentation



COMMENT ON FUNCTION uuid_generate_v7() IS 'Generates a time-ordered sequential RFC 9562 compliant UUID v7 for high-performance primary keys.';
