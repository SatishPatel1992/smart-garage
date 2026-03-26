-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT DEFAULT 'staff',
    "organization_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "gstin" TEXT,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "registration_no" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "vin" TEXT,
    "type" TEXT,
    "fuel" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "type" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_cards" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "job_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "complaints" TEXT NOT NULL,
    "odometer_reading" INTEGER NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'pending',
    "assigned_mechanic_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_photos" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanic_tasks" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "mechanic_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanic_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "estimate_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_amount" DECIMAL(12,2) NOT NULL,
    "valid_until" DATE,
    "sent_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_lines" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_revisions" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "lines_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "job_card_id" TEXT NOT NULL,
    "estimate_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "format" TEXT DEFAULT 'tax',
    "parts_amount" DECIMAL(12,2) NOT NULL,
    "labour_amount" DECIMAL(12,2) NOT NULL,
    "tax_amount" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pdf_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "razorpay_order_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "credit_note_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "frequency" TEXT NOT NULL,
    "next_due_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "min_quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "price" DECIMAL(12,2) NOT NULL,
    "cost_price" DECIMAL(12,2),
    "vendor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "part_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "reference_id" TEXT,
    "reference_label" TEXT,
    "unit_cost" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "insurance_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "default_unit_price" DECIMAL(12,2) NOT NULL,
    "default_tax_rate_percent" DECIMAL(5,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "sequences_organization_id_name_idx" ON "sequences"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_organization_id_name_year_key" ON "sequences"("organization_id", "name", "year");

-- CreateIndex
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE INDEX "vehicles_customer_id_idx" ON "vehicles"("customer_id");

-- CreateIndex
CREATE INDEX "vehicles_registration_no_idx" ON "vehicles"("registration_no");

-- CreateIndex
CREATE INDEX "vehicles_deleted_at_idx" ON "vehicles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_customer_id_registration_no_key" ON "vehicles"("customer_id", "registration_no");

-- CreateIndex
CREATE INDEX "reminders_customer_id_idx" ON "reminders"("customer_id");

-- CreateIndex
CREATE INDEX "reminders_vehicle_id_idx" ON "reminders"("vehicle_id");

-- CreateIndex
CREATE INDEX "reminders_due_date_idx" ON "reminders"("due_date");

-- CreateIndex
CREATE INDEX "reminders_organization_id_idx" ON "reminders"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_job_number_key" ON "job_cards"("job_number");

-- CreateIndex
CREATE INDEX "job_cards_customer_id_idx" ON "job_cards"("customer_id");

-- CreateIndex
CREATE INDEX "job_cards_vehicle_id_idx" ON "job_cards"("vehicle_id");

-- CreateIndex
CREATE INDEX "job_cards_stage_idx" ON "job_cards"("stage");

-- CreateIndex
CREATE INDEX "job_cards_created_at_idx" ON "job_cards"("created_at");

-- CreateIndex
CREATE INDEX "job_cards_organization_id_idx" ON "job_cards"("organization_id");

-- CreateIndex
CREATE INDEX "job_cards_deleted_at_idx" ON "job_cards"("deleted_at");

-- CreateIndex
CREATE INDEX "job_photos_job_card_id_idx" ON "job_photos"("job_card_id");

-- CreateIndex
CREATE INDEX "mechanics_organization_id_idx" ON "mechanics"("organization_id");

-- CreateIndex
CREATE INDEX "mechanic_tasks_job_card_id_idx" ON "mechanic_tasks"("job_card_id");

-- CreateIndex
CREATE INDEX "mechanic_tasks_mechanic_id_idx" ON "mechanic_tasks"("mechanic_id");

-- CreateIndex
CREATE UNIQUE INDEX "mechanic_tasks_job_card_id_mechanic_id_key" ON "mechanic_tasks"("job_card_id", "mechanic_id");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimate_number_key" ON "estimates"("estimate_number");

-- CreateIndex
CREATE INDEX "estimates_job_card_id_idx" ON "estimates"("job_card_id");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimates_created_at_idx" ON "estimates"("created_at");

-- CreateIndex
CREATE INDEX "estimate_lines_estimate_id_idx" ON "estimate_lines"("estimate_id");

-- CreateIndex
CREATE INDEX "estimate_revisions_estimate_id_idx" ON "estimate_revisions"("estimate_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_job_card_id_idx" ON "invoices"("job_card_id");

-- CreateIndex
CREATE INDEX "invoices_estimate_id_idx" ON "invoices"("estimate_id");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_credit_note_number_key" ON "credit_notes"("credit_note_number");

-- CreateIndex
CREATE INDEX "credit_notes_invoice_id_idx" ON "credit_notes"("invoice_id");

-- CreateIndex
CREATE INDEX "recurring_contracts_customer_id_idx" ON "recurring_contracts"("customer_id");

-- CreateIndex
CREATE INDEX "recurring_contracts_next_due_date_idx" ON "recurring_contracts"("next_due_date");

-- CreateIndex
CREATE INDEX "recurring_contracts_organization_id_idx" ON "recurring_contracts"("organization_id");

-- CreateIndex
CREATE INDEX "vendors_organization_id_idx" ON "vendors"("organization_id");

-- CreateIndex
CREATE INDEX "parts_organization_id_idx" ON "parts"("organization_id");

-- CreateIndex
CREATE INDEX "parts_vendor_id_idx" ON "parts"("vendor_id");

-- CreateIndex
CREATE INDEX "parts_code_idx" ON "parts"("code");

-- CreateIndex
CREATE INDEX "parts_name_idx" ON "parts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "parts_organization_id_code_key" ON "parts"("organization_id", "code");

-- CreateIndex
CREATE INDEX "stock_movements_part_id_idx" ON "stock_movements"("part_id");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements"("created_at");

-- CreateIndex
CREATE INDEX "service_items_type_idx" ON "service_items"("type");

-- CreateIndex
CREATE INDEX "service_items_name_idx" ON "service_items"("name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sequences" ADD CONSTRAINT "sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_assigned_mechanic_id_fkey" FOREIGN KEY ("assigned_mechanic_id") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanics" ADD CONSTRAINT "mechanics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_tasks" ADD CONSTRAINT "mechanic_tasks_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mechanic_tasks" ADD CONSTRAINT "mechanic_tasks_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "mechanics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_lines" ADD CONSTRAINT "estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_revisions" ADD CONSTRAINT "estimate_revisions_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_card_id_fkey" FOREIGN KEY ("job_card_id") REFERENCES "job_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_contracts" ADD CONSTRAINT "recurring_contracts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
