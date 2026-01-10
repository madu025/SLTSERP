-- ==========================================
-- SLTSERP Test Users - Direct SQL Insert
-- ==========================================
-- ✅ READY TO USE - Just copy and run in pgAdmin!
-- Password for all users: Admin@123
-- ==========================================

BEGIN;

-- 1. Super Admin
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'admin',
    'admin@nexuserp.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Super Admin',
    'SUPER_ADMIN',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

-- 2. Test Admin
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'testadmin',
    'testadmin@test.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Test Admin',
    'ADMIN',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

-- 3. OSP Manager
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'ospmanager',
    'osp@test.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Test OSP Manager',
    'OSP_MANAGER',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

-- 4. Area Manager
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'areamanager',
    'area@test.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Test Area Manager',
    'AREA_MANAGER',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

-- 5. Stores Manager
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'storesmanager',
    'stores@test.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Test Stores Manager',
    'STORES_MANAGER',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

-- 6. Area Coordinator
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'coordinator',
    'coordinator@test.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Test Area Coordinator',
    'AREA_COORDINATOR',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

-- 7. QC Officer
INSERT INTO "User" (id, username, email, password, name, role, "createdAt", "updatedAt")
VALUES (
    gen_random_uuid(),
    'qcofficer',
    'qc@test.com',
    '$2b$10$Y74ddvqyWEMZltMqT4pQu..oNljpQXgMYE5ikjKNQTZggT0yLMIBde',
    'Test QC Officer',
    'QC_OFFICER',
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    password = EXCLUDED.password,
    role = EXCLUDED.role,
    "updatedAt" = NOW();

COMMIT;

-- ==========================================
-- ✅ Verify users were created:
-- ==========================================
SELECT username, name, role, email 
FROM "User" 
ORDER BY 
    CASE role
        WHEN 'SUPER_ADMIN' THEN 1
        WHEN 'ADMIN' THEN 2
        WHEN 'OSP_MANAGER' THEN 3
        WHEN 'AREA_MANAGER' THEN 4
        WHEN 'STORES_MANAGER' THEN 5
        WHEN 'AREA_COORDINATOR' THEN 6
        WHEN 'QC_OFFICER' THEN 7
        ELSE 99
    END;
