# College Scorecard Schema (Prelude AI)

Use College Scorecard as the default verified college-comparison source.

## Source
- URL: <https://collegescorecard.ed.gov/>
- Owner: U.S. Department of Education

## Core institution-level fields (target)
- `unitid`
- `school.name`
- `school.city`
- `school.state`
- `school.locale`
- `school.ownership` (public/private/for-profit)
- `latest.admissions.admission_rate.overall`
- `latest.admissions.sat_scores.*` (where available)
- `latest.admissions.act_scores.*` (where available)
- `latest.cost.avg_net_price.overall`
- `latest.cost.tuition.in_state`
- `latest.cost.tuition.out_of_state`
- `latest.completion.rate_suppressed.overall` (or unsuppressed equivalent)
- `latest.student.retention_rate.four_year.full_time_pooled`
- `latest.aid.median_debt.completers.overall`
- `latest.earnings.10_yrs_after_entry.median`

## Program-level / field-of-study fields (target)
- CIP code and title
- institution + program identifier
- median earnings by field (where available)
- median debt by field (where available)
- credential level

## Usage rules
1. Use this source for verified school-level stats whenever possible.
2. If a requested metric is missing/suppressed, say "verified value not available."
3. Never fabricate acceptance rates, SAT/ACT ranges, net price, debt, or earnings.
4. Include source metadata in retrieval context:
   - source_id: `college_scorecard`
   - source_name: `College Scorecard`
   - source_url: `https://collegescorecard.ed.gov/`
