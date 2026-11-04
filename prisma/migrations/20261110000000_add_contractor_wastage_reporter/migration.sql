-- Who reported a contractor wastage, so the approver can be required to be someone else (segregation of duties).
ALTER TABLE "ContractorWastage" ADD COLUMN "reportedById" UUID;
