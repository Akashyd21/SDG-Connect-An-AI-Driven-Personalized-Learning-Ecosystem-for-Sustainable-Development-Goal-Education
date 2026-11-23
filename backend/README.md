# SDG recommendation backend

This service adds the guarded assignment-agent layer to the existing frontend.

Run these migrations in order: `supabase/001_activity_recommendations.sql`,
`supabase/002_frontend_platform.sql`, `supabase/003_assignment_agent.sql`, then
`supabase/004_dynamic_rag_generation.sql`. The fourth migration creates the
knowledge-only RAG table and retrieval RPC. It does not create activity tasks.
If Supabase signup reports `Database error saving new user`, also run
`supabase/005_auth_profile_trigger_fix.sql`.

## Run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

For Railway, use the included `Procfile` and configure the service variables
from `.env.example`. Set `FRONTEND_ORIGIN` to the deployed Vercel URL (plus any
local development URLs). For the static frontend on Vercel, set
`window.SDG_API_BASE_URL` to the Railway public API URL before loading
`js/supabase-config.js`, or replace its local default during deployment.

After the existing migrations, run `supabase/006_priority_alignment.sql` once.
It adds profile availability fields, detailed activity fields, and the new
submission status without deleting the legacy columns needed by older records.

The backend supports both local Ollama and Ollama Cloud. For local Ollama, use
`http://127.0.0.1:11434/v1` and leave `OLLAMA_API_KEY` empty. For Ollama Cloud,
use `https://ollama.com/v1`, set `OLLAMA_API_KEY`, and choose a cloud model such
as `gemma4:31b-cloud`. Keep the key in the backend `.env` file only. The backend
calls Ollama's OpenAI-compatible endpoint and validates every generated activity
against the Pydantic `Activity` schema before saving it.

For local mode, separately run `ollama pull qwen3:14b` and `ollama serve`.
For Cloud mode, no local model download or Ollama server is required.

## Populate RAG embeddings

The migrations create knowledge documents, but vector columns are initially
empty. After applying the migrations and configuring `.env`, run:

```powershell
cd backend
python -m scripts.embed_knowledge
```

This uses the local `BAAI/bge-large-en-v1.5` SentenceTransformers model and
stores normalized 1024-dimensional vectors in both `rag_documents` and existing
`activities`. Use `--force` after changing the embedding model or source text.
The model dimension must remain 1024 because the current Supabase columns use
`vector(1024)`.

`POST /agent/assign` accepts `student_id`, `department`, `skills`,
`sdg_interests`, `skill_level`, and `available_hours`. The backend embeds the
profile, retrieves SDG/department/task-design knowledge through
`match_rag_documents`, and asks the LLM to generate one new validated activity.
The generated record is saved with `source=ai_generated` and remains `pending`
until admin approval. The agent blocks a second active Supabase assignment.

## LLM choices

Keep the LLM behind the provider adapter in `app/llm.py`. Ollama is the default;
OpenAI remains available by setting `LLM_PROVIDER=openai` and supplying
`OPENAI_API_KEY`. The adapter requests JSON, parses fenced or plain JSON, and
retries once when the model output fails schema validation. Do not let the LLM
choose final SDG eligibility or approval status; those rules remain enforced in
Python/Postgres.
