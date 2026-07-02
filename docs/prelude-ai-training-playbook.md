# Prelude AI training playbook

This is the working plan for making Prelude AI feel trained, useful, and reliable without training a model from scratch.

## Summary

Prelude AI should use a **RAG-style** setup:

1. Collect trusted Prelude admissions guidance.
2. Store that guidance in curated markdown and official datasets.
3. Retrieve the most relevant facts for each user question.
4. Add safe student profile context such as grade, intended major, GPA, interests, and goals.
5. Send the final grounded prompt to the model.
6. Log failures and feedback so admins can improve the knowledge base.

This is better than fine-tuning for the current product because admissions information changes often and school-specific facts need to stay grounded in official sources.

## Research notes

### OpenAI implementation direction

OpenAI's current file-search guidance describes a knowledge-base approach where models search uploaded files before answering. The tool uses vector stores and supports semantic and keyword search. This is useful for admissions knowledge because Prelude can update the source files without retraining a model.

Relevant OpenAI docs:

- https://developers.openai.com/api/docs/guides/tools-file-search
- https://developers.openai.com/api/docs/guides/retrieval
- https://developers.openai.com/api/docs/guides/embeddings
- https://developers.openai.com/api/docs/guides/model-optimization

Key product decision:

- Use **prompting + retrieval + curated knowledge** first.
- Use fine-tuning later only if Prelude has many high-quality examples and wants stricter response style or classification behavior.

### Admissions source baseline

Prelude AI should treat these as trusted baseline sources:

- Federal Student Aid: https://studentaid.gov
- FAFSA: https://studentaid.gov/h/apply-for-aid/fafsa
- Common App: https://www.commonapp.org
- Common App essay prompts: https://www.commonapp.org/apply/essay-prompts/
- College Scorecard: https://collegescorecard.ed.gov
- BigFuture: https://bigfuture.collegeboard.org
- College Board: https://www.collegeboard.org
- O*NET: https://www.onetonline.org
- BLS Occupational Outlook Handbook: https://www.bls.gov/ooh/

## What this branch changed

### 1. Re-enabled open-ended Prelude AI chat

`api/chat.js` was returning `410 guided_assistant_only`, so the UI could show a generic error even when the chat box was working. This branch restores the `/api/chat` path for open-ended messages while keeping the mentor questionnaire path.

### 2. Added safer request handling

The API now:

- validates `message`
- limits message length
- trims conversation history
- sanitizes client-provided profile fields
- keeps OpenAI API keys server-side
- maps errors through the existing `chatErrors` layer

### 3. Expanded profile personalization

`server/rag/promptBuilder.js` now includes more student context in the prompt:

- grade
- intended major / focus
- GPA
- interests
- goals
- role
- plan

The prompt also tells the model not to treat client-provided profile fields as verified official records.

### 4. Expanded admissions knowledge

`prelude_dataset_kit/knowledge/AGENT_KNOWLEDGE.md` now includes stronger guidance for:

- FAFSA and financial aid
- college lists
- application timelines
- essays
- extracurriculars
- computer science profiles
- summer programs
- leadership
- testing
- majors and careers
- transfers and international students
- parent guidance

## Recommended next build step

Add admin feedback logging so the team can improve the AI over time.

Suggested database table:

```prisma
model AiFeedback {
  id             String   @id @default(cuid())
  userId         String?
  message        String
  response       String
  rating         String?  // up, down, neutral
  correction     String?
  category       String?
  createdAt      DateTime @default(now())
}
```

Suggested admin flow:

1. Admin sees recent AI chats.
2. Admin marks answers as good or bad.
3. Admin writes a corrected answer when needed.
4. Corrections are periodically turned into updates for `AGENT_KNOWLEDGE.md` or eval examples.

## Suggested future semantic retrieval upgrade

The repo already has local structured retrieval for public datasets. For richer Prelude knowledge retrieval, add one of these:

### Option A: Hosted OpenAI File Search

Use OpenAI vector stores for the curated markdown files. This is the fastest path if Prelude is okay with hosted retrieval.

### Option B: Local vector database

Use embeddings with pgvector or SQLite vector extension if Prelude wants more control.

Recommended first version:

- Keep structured College Scorecard / O*NET retrieval local.
- Use curated markdown in the prompt for now.
- Later move long knowledge docs into vector search when they get too large for prompt context.

## Production checklist

- Set `AI_PROVIDER=openai` in production.
- Set `OPENAI_API_KEY` server-side only.
- Do not use `VITE_OPENAI_API_KEY`.
- Set `OPENAI_MODEL` to the desired model.
- Confirm `/api/chat` returns 200 locally before deployment.
- Check server logs for `UPSTREAM_ERROR`, `DATABASE_NOT_FOUND`, or `NOT_CONFIGURED`.
- Keep `.env` out of git.
- Do not allow Prelude AI to promise admissions results, scholarships, prices, or exact deadlines without verified sources.
