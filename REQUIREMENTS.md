# Smart Garage – Functional Requirements (FR) Mapping

This document maps implemented UI and types to the requested functional requirements. **API integration is pending** for all modules.

---

## 3.3 Job Card Management

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-020 | Service Advisor shall create a new Job Card with: Customer details, Vehicle details, Complaints, Photos, Odometer reading | **Create Job Card** screen: form with customer (name, phone, email), vehicle (reg no, make, model, year), complaints, odometer, photo placeholders. Types: `JobCard`, `Customer`, `Vehicle` in `src/types/models.ts`. |
| FR-021 | System shall track job stages: Pending → Work In Progress → Delivered | **Job list** filter + **Job detail** stage strip and “Mark as…” button. Type: `JobStage`. |
| FR-022 | Mechanic shall update job progress from mobile | Job detail “Mark as [next stage]” button; ready for API. |
| FR-023 | System shall allow uploading photos to job card | Create Job Card + Job detail: “Add photo” placeholders; ready for `expo-image-picker` + API. |

---

## 3.4 Mechanic Assignment

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-030 | Service Advisor shall assign job to a mechanic | **Job detail**: “Mechanic assignment” section with mechanic chips. Types: `Mechanic`, `JobCard.assignedMechanicId`. |
| FR-031 | System shall display mechanic job queue | Placeholder: mechanic list in Job detail; dedicated “Mechanic queue” screen can be added. |
| FR-032 | Mechanic shall update task status: assigned → started → completed | Types: `MechanicTask`, `MechanicTaskStatus`. UI: stage progression on Job detail (mechanic flow can reuse same screen). |

---

## 3.5 Estimate & Approval

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-040 | System shall generate estimates using parts & labour | Types: `Estimate`, `EstimateLine` (part/labour). **More → Estimates** placeholder screen. |
| FR-041 | Estimate shall be sent to customer via WhatsApp link | Placeholder; API + deep link to be integrated. |
| FR-042 | Customer shall approve/reject estimate online | Type: `EstimateStatus`. Customer flow can be web; mobile can show status. |
| FR-043 | Status change must be logged | Backend responsibility; mobile can display status. |

---

## 3.6 Inventory Management

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-050 | System shall maintain a parts stock list | Type: `Part`. **More → Inventory** placeholder screen. |
| FR-051 | System shall deduct stock when used in Job Card | Backend + optional “parts used” on Job Card; types ready. |
| FR-052 | System shall alert low stock items | Type: `Part.minQuantity`; UI to show low-stock list when API is ready. |
| FR-053 | System shall provide inventory reports | Placeholder under Inventory; API pending. |

---

## 3.7 Billing & Invoicing

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-060 | System shall generate invoices from Job Card | Type: `Invoice`. **Billing** tab: invoice list (mock). |
| FR-061 | Invoice shall include: Parts amount, Labour amount, Taxes, Discounts, Total amount | Type: `Invoice` has all fields. |
| FR-062 | Invoice shall be downloadable as PDF | Billing screen: “PDF” action; link to API when ready. |
| FR-063 | System shall generate unique invoice numbers | Type: `Invoice.invoiceNumber`; backend to generate. |
| FR-064 | Customer shall receive invoice link via WhatsApp | Billing screen: “Send link” action; API pending. |

---

## 3.8 Payments

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-070 | System shall generate payment links (via Razorpay) | Type: `Payment`, `Payment.razorpayOrderId`. **More → Payments** placeholder. |
| FR-071 | Payment status must sync with invoice | Type: `Payment.status`; backend sync. |
| FR-072 | System shall support: UPI, Cash, Card, Bank transfer | Type: `PaymentMethod`. |

---

## 3.9 Reporting & Analytics

| ID     | Requirement | Mobile UI / Types |
|--------|-------------|--------------------|
| FR-080 | Daily summary: Jobs completed, In-progress jobs, Payments collected | Types: `DailySummary`. **Dashboard** stat cards (mock). |
| FR-081 | Revenue breakdown (parts vs labour) | Type: `RevenueBreakdown`. **More → Reports** placeholder. |
| FR-082 | System shall track mechanic performance | Type: `MechanicPerformance`. Reports placeholder. |

---

## Next steps for API integration

1. **Job Cards**: POST/GET job cards, PATCH stage and assigned mechanic, upload photos.
2. **Estimates**: CRUD estimates, send WhatsApp link, web approval flow + webhook for status.
3. **Inventory**: GET parts, PATCH stock; low-stock endpoint; deduct on job parts usage.
4. **Billing**: Generate invoice from job, GET invoices, PDF URL, WhatsApp send.
5. **Payments**: Create Razorpay order, webhook for status, record payment method.
6. **Reports**: Endpoints for daily summary, revenue breakdown, mechanic performance.
