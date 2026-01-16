-- Create a Publication on the Primary DB to allow data sharing
DROP PUBLICATION IF EXISTS slts_erp_pub;
CREATE PUBLICATION slts_erp_pub FOR ALL TABLES;
