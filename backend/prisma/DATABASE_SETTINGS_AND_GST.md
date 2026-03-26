# Database: GST and organization settings

## No migration required

GST enabled/disabled and GST number use **existing** columns. No new migration is needed.

---

## Where things are stored

### 1. **GST number (GSTIN)**

| Table         | Column  | Type     | Notes                                      |
|---------------|---------|----------|--------------------------------------------|
| `organizations` | `gstin` | `String?` | Organization’s GSTIN. Required in app when GST is enabled. |

- Already in schema.
- Updated via `PATCH /organizations/settings` with body `{ gstin: "24AAAAA0000A1Z5" }`.
- Returned by `GET /me` in `organization.gstin`.

### 2. **GST enabled / disabled**

| Table         | Column   | Type  | Notes                                      |
|---------------|----------|-------|--------------------------------------------|
| `organizations` | `settings` | `Json?` | JSON object. Includes `gstEnabled: boolean`. |

- Stored inside the existing `organizations.settings` JSON column.
- No new column: `gstEnabled` is a key in the `settings` JSON.
- Updated via `PATCH /organizations/settings` with body `{ settings: { gstEnabled: true } }`.
- Returned by `GET /me` in `organization.settings.gstEnabled`.

### 3. **Other settings in `organizations.settings`**

All of these live in the same `organizations.settings` JSON column:

| Key                     | Type     | Purpose                                      |
|-------------------------|----------|----------------------------------------------|
| `currency`              | string   | e.g. `"INR"`                                 |
| `defaultTaxRates`       | number[] | e.g. `[0, 5, 12, 18, 28]`                    |
| `defaultGstRatePercent` | number   | Default GST % for estimate lines             |
| `estimateValidityDays`  | number   | Validity period for estimates                |
| `lowStockThreshold`     | number   | Low-stock alert threshold                    |
| `invoiceDefaultFormat`  | string   | `"proforma"` or `"tax"`                      |
| `logoUrl`               | string?  | Logo URL for invoice/letterhead             |
| `gstEnabled`            | boolean  | When true, tax and GSTIN are used in app     |

---

## Backend validation (already updated)

In `backend/src/routes/organizations.ts`, the `settings` object in the PATCH body is validated and merged into `organizations.settings`. The schema now includes:

- `logoUrl` (optional, nullable)
- `gstEnabled` (optional boolean)

so both are accepted and persisted in the existing `settings` JSON column.

---

## Summary

- **GST number:** `organizations.gstin` (existing column).
- **GST enabled/disabled:** `organizations.settings.gstEnabled` (existing `settings` JSON).
- **Other app settings:** same `organizations.settings` JSON.
- **No new tables or columns;** no new migration is required for GST or these settings.
