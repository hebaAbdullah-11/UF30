# UF30 institutional enrollment and impact reports

## Privacy boundary

- Institutional enrollment stores no name, email, diagnosis, health information, or UF30 introduction answers.
- A participant receives a random bearer token. The database stores only its SHA-256 hash; the token is not included in the institutional report.
- Impact submissions are limited to on-time completion (0–100%), punctuality (0–100%), manager rating (1–5), and participant satisfaction (1–5), at baseline, after session four, and after two months.
- The manager API returns the institution's enrollment count and averages only. Phase results with fewer than 10 submissions are suppressed, including the count. No endpoint returns participant records or individual scores to an institution.
- UF30's existing device-local introduction and workspace are separate from these institutional records and from AFTA data.
- The enrollment code and participant token are credentials. Share the enrollment code only with the intended cohort; participants should keep their private token for future survey stages.

## Enabling an institution

No institution or participant results are seeded by this change. The additive schema migration is provided but has **not been applied** to any database. The API remains unavailable for institutional records until the migration is applied to the intended database and an institution is configured.

1. Review `lib/db/migrations/uf30-institutional-impact.sql` and apply it only to the intended development or deployment database through the project's approved migration process.
2. Create an `uf30_institutions` row with a unique slug, verified Arabic and English names, the agreed discount percentage, and `invitation_code_hash` set to the lowercase hexadecimal SHA-256 digest of a high-entropy invitation code. Do not store the clear-text invitation code.
3. After the institution representative has an existing AFTA account, create one `uf30_institution_members` row using that account's internal `auth_users.id` and the institution ID. Membership is the only authorization for the protected report; ordinary signed-in participants receive 403.
4. Send the invitation code to participants through the institution's private channel. Enrollment can be completed directly with UF30 without sending a name or email to the institution.

The schema limits one reporting institution per manager account. There is intentionally no public API for granting institutional roles or changing discounts.

## Data residency

Saudi Arabia data residency has **not been verified** from the active deployment or database configuration. Do not claim that the application, database, backups, or AI services are hosted in Saudi Arabia. Verify each relevant provider's actual region and contractual terms before making a residency claim. This task did not publish the app or change production settings.
