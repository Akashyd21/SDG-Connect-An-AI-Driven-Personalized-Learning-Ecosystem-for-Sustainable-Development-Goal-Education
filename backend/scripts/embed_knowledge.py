"""Generate and store vector embeddings for RAG knowledge and activities.

Run from the backend directory:
    python -m scripts.embed_knowledge

Use --force when the embedding model or source text changes.
"""

from __future__ import annotations

import argparse
from typing import Any

from sentence_transformers import SentenceTransformer
from supabase import Client, create_client

from app.config import get_settings


def build_rag_text(row: dict[str, Any]) -> str:
    return "\n".join(
        value for value in [
            f"Title: {row.get('title', '')}",
            f"Department: {row.get('department', '')}",
            f"SDGs: {', '.join(map(str, row.get('sdgs') or []))}",
            f"Content: {row.get('content', '')}",
        ] if value
    )


def build_activity_text(row: dict[str, Any]) -> str:
    steps = row.get("steps") or []
    return "\n".join(
        value for value in [
            f"Title: {row.get('title', '')}",
            f"Department: {row.get('department', '')}",
            f"SDGs: {', '.join(map(str, row.get('sdgs') or []))}",
            f"Difficulty: {row.get('difficulty', '')}",
            f"Hours: {row.get('hours', '')}",
            f"Description: {row.get('description', '')}",
            f"Steps: {', '.join(map(str, steps))}",
            f"Why it fits: {row.get('why_it_fits', '')}",
        ] if value
    )


def fetch_rows(client: Client, table: str, force: bool) -> list[dict[str, Any]]:
    query = client.table(table).select("*")
    if not force:
        query = query.is_("embedding", "null")
    result = query.execute()
    return result.data or []


def embed_table(
    client: Client,
    encoder: SentenceTransformer,
    table: str,
    rows: list[dict[str, Any]],
    text_builder,
) -> int:
    if not rows:
        print(f"{table}: no rows require embedding")
        return 0

    texts = [text_builder(row) for row in rows]
    vectors = encoder.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    expected_dimensions = encoder.get_sentence_embedding_dimension()

    for row, vector in zip(rows, vectors):
        values = vector.tolist()
        if len(values) != expected_dimensions:
            raise RuntimeError(f"Unexpected embedding dimension for {table}: {len(values)}")
        client.table(table).update({"embedding": values}).eq("id", row["id"]).execute()

    print(f"{table}: embedded {len(rows)} row(s) with {expected_dimensions} dimensions")
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Re-embed rows that already have vectors")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")

    encoder = SentenceTransformer(
        settings.embedding_model,
        local_files_only=settings.embedding_local_files_only,
    )
    dimensions = encoder.get_sentence_embedding_dimension()
    if dimensions != settings.embedding_dimensions:
        raise RuntimeError(
            f"Embedding model produces {dimensions} dimensions, but the database is configured for "
            f"{settings.embedding_dimensions}. Use a matching model or migrate the vector columns."
        )

    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    rag_rows = fetch_rows(client, "rag_documents", args.force)
    activity_rows = fetch_rows(client, "activities", args.force)
    embed_table(client, encoder, "rag_documents", rag_rows, build_rag_text)
    embed_table(client, encoder, "activities", activity_rows, build_activity_text)


if __name__ == "__main__":
    main()
