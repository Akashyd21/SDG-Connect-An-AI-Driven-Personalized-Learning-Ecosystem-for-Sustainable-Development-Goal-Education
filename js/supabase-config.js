// Browser-safe Supabase configuration.
// Use the publishable/anon key here, never the service-role key.
window.SDG_SUPABASE_CONFIG = {
  url: "https://wykhqezorpuiywtsjzrn.supabase.co",
  publishableKey: "sb_publishable_d6lBAMJAzDr9z99tGr_vkA_dkHmqz6F",
  // Set window.SDG_API_BASE_URL before this file in production, or replace
  // this value with the Railway API URL. Relative /api works with a Vercel
  // reverse proxy and keeps local development unchanged.
  apiBaseUrl: window.SDG_API_BASE_URL || "http://127.0.0.1:8000",
  // Keep false while testing the real FastAPI + RAG + Ollama path. This avoids
  // silently replacing a backend failure with a simulated local task.
  allowLocalAiFallback: false
};
