from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "SDG Campus Recommendation API"
    supabase_url: str = ""
    # Publishable/anon key is safe for the auth proxy. Keep the service-role
    # key server-only for repository operations.
    supabase_publishable_key: str = ""
    supabase_service_role_key: str = ""
    llm_provider: str = "ollama"
    ollama_base_url: str = "http://127.0.0.1:11434/v1"
    ollama_api_key: str = ""
    ollama_model: str = "gemma4:31b-cloud"
    openai_api_key: str = ""
    llm_model: str = "gpt-5-mini"
    embedding_model: str = "BAAI/bge-large-en-v1.5"
    embedding_dimensions: int = 1024
    # Keep assignment requests independent of Hugging Face availability once
    # the configured embedding model has been downloaded to the local cache.
    embedding_local_files_only: bool = True
    recommendation_limit: int = 10
    rate_limit: str = "30/minute"
    # Comma-separated for local development with either hostname.
    frontend_origin: str = "http://localhost:5500,http://127.0.0.1:5500"


@lru_cache
def get_settings() -> Settings:
    return Settings()
