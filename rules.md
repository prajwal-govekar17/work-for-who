# Rules: WorkForWho

## Engineering Rules
1. **Surgical Changes:** Modify only what is necessary.
2. **Mobile First:** The UI must be usable on low-end mobile devices.
3. **Privacy First:** Never expose worker identity. Anonymize reports in public views.
4. **Validation:** Every AI extraction must be traceable back to the raw report (internally).

## AI Workflow Rules
1. **Prompt Versioning:** Keep prompts in code, not just in the Gemini console.
2. **Structured Output:** Always use JSON schema for AI extraction to ensure DB compatibility.
3. **Fallback:** If AI fails to identify a company, mark for human/community review.

## Architecture Rules
1. **Supabase for Everything:** Use Supabase for Auth, DB, and Storage.
2. **Serverless AI:** Keep AI logic in Next.js API routes.
3. **No Overengineering:** Avoid complex state management unless absolutely necessary.
