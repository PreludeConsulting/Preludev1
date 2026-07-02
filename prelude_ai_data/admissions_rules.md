# Prelude AI Verified Data Rules

## Core rule
When answering with numbers or school-specific claims, use only retrieved verified data. If no verified source was retrieved, say you do not have verified data and recommend checking the official source.

## Source routing policy
- College-specific facts -> College Scorecard or IPEDS.
- Common App essay prompts -> Common App official page.
- FAFSA/federal aid -> StudentAid.gov.
- Career outcomes -> BLS OOH (metrics) and O*NET (tasks/skills/fit).

## Must not invent
- Acceptance rates
- SAT/ACT ranges
- Tuition/net price
- Scholarships
- Application deadlines
- Common App prompt text

## Response metadata
- Store retrieved source labels with each answer.
- Include source_id, source_name, source_url, category, and title in chunk metadata.

## Missing-data protocol
If requested details are not available in retrieved verified context:
1. Explicitly state verified data is unavailable.
2. Recommend the official source URL.
3. Offer to continue with non-numeric strategy guidance.
