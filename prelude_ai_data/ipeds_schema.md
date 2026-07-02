# IPEDS / NCES Schema (Prelude AI)

Use IPEDS to supplement institution-level data when College Scorecard is missing fields or for cross-checking.

## Source
- URL: <https://nces.ed.gov/ipeds/use-the-data>
- Owner: NCES (U.S. Department of Education)

## Institution-level domains
- Admissions
- Enrollment
- SAT/ACT or test profile fields (where reported)
- Tuition and required fees
- Room and board
- Financial aid
- Graduation rates
- Degrees/certificates awarded
- Institution descriptors

## CSV / table ingestion notes
- Keep original variable names where possible.
- Map institution identity to `unitid` when available.
- Preserve reporting year and survey component metadata.

## Usage rules
1. Use IPEDS for official institution-level metrics and validation.
2. Prefer College Scorecard as primary comparison source, then backfill from IPEDS.
3. Do not infer values from nearby institutions.
4. If values conflict, surface both source tags and recommend verifying current school disclosures.
5. Include source metadata in retrieval context:
   - source_id: `ipeds`
   - source_name: `NCES IPEDS`
   - source_url: `https://nces.ed.gov/ipeds/use-the-data`
