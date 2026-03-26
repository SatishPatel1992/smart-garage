# Smart Garage – Database Schema

PostgreSQL schema via Prisma, aligned with the mobile app domain (FR-020–FR-082).

## Design principles

- **Scalable**: Optional `organizationId` on core entities for multi-tenant (multiple garages). Single tenant = one organization.
- **Reliable**: Foreign keys, unique constraints on business keys (job number, invoice number, etc.), indexes on filters and joins.
- **Audit-friendly**: `createdAt`/`updatedAt` where relevant; estimate revisions and invoice lines for history.
- **Standards**: camelCase in Prisma, `snake_case` in DB via `@map`; UUID primary keys; `Decimal` for money.

## Entity overview

| Area | Tables | Notes |
|------|--------|--------|
| **Auth** | `User`, `RefreshToken` | JWT auth; optional link to `Organization`. |
| **Multi-tenant** | `Organization`, `Sequence` | Sequence stores per-year counters for JC-*, INV-*, EST-*, CN-*. |
| **CRM** | `Customer`, `Vehicle`, `Reminder` | Customers own vehicles; reminders by customer/vehicle. |
| **Jobs** | `JobCard`, `JobPhoto`, `Mechanic`, `MechanicTask` | Job → customer, vehicle, mechanic; photos stored by path. |
| **Estimates** | `Estimate`, `EstimateLine`, `EstimateRevision` | One estimate per job (current); revisions store line snapshot as JSON. |
| **Invoicing** | `Invoice`, `InvoiceLine`, `Payment`, `CreditNote` | Invoice from estimate; lines copied for audit; credit notes reduce paid amount. |
| **Recurring** | `RecurringContract` | AMC; next due date advanced when invoice is generated. |
| **Inventory** | `Vendor`, `Part`, `StockMovement` | Parts linked to vendor; movements (purchase / issue_to_job / return). |
| **Lookups** | `InsuranceCompany`, `ServiceItem` | Dropdowns for estimate (insurance, parts/labour catalogue). |

## Sequences

Use the `Sequence` table to generate human-readable numbers per year:

- `job_number` + year → e.g. 1, 2, 3 → JC-2025-001
- `estimate_number` + year → EST-2025-001
- `invoice_number` + year → INV-2025-001
- `credit_note_number` + year (or per invoice) → CN-2025-001

Increment in a transaction and zero-pad when formatting.

## Files & storage

- **Job photos**: `JobPhoto.filePath` = relative path (e.g. `uploads/jobs/{jobId}/{filename}`). Replace with S3 key later.
- **Invoice PDF**: `Invoice.pdfUrl` = optional URL after server-side or client-side generation.

## Setup

```bash
cd backend
cp .env.example .env   # set DATABASE_URL
npx prisma generate
npx prisma migrate dev --name init
```

## Env

```env
DATABASE_URL="postgresql://user:password@localhost:5432/smart_garage?schema=public"
```
