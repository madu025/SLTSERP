-- Stores Executive: the post between the Stores Manager and the Stores Officers. It reviews (adjusts the quantities of) the material requests of the
-- stores before the approval, and does the stock adjustments with the Stores Manager.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STORES_EXECUTIVE' AFTER 'STORES_MANAGER';
