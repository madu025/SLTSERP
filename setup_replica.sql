-- Create a Subscription on the Replica DB to listen to Primary DB
DROP SUBSCRIPTION IF EXISTS slts_erp_sub;
CREATE SUBSCRIPTION slts_erp_sub 
  CONNECTION 'host=aws-1-ap-southeast-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.prbyiuyzcsfyduajmajx password=@Maduranga89' 
  PUBLICATION slts_erp_pub;
