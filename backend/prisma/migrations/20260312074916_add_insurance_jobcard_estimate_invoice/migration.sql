-- AlterTable
ALTER TABLE "estimate_lines" ADD COLUMN     "insurance_payable_mode" TEXT,
ADD COLUMN     "insurance_payable_value" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "bill_to_type" TEXT DEFAULT 'customer';

-- AlterTable
ALTER TABLE "job_cards" ADD COLUMN     "insurance_company_id" TEXT;

-- CreateIndex
CREATE INDEX "job_cards_insurance_company_id_idx" ON "job_cards"("insurance_company_id");

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_insurance_company_id_fkey" FOREIGN KEY ("insurance_company_id") REFERENCES "insurance_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
