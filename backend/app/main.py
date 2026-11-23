from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from .config import Settings, get_settings
from .repository import ActivityRepository
from .schemas import (
    ActivityEditRequest, ApprovalRequest, AssignmentResponse, AuthLoginRequest, AuthResponse,
    AuthSignupRequest, ChatRequest, ChatResponse, FeedbackRequest,
    RecommendationResponse, StudentProfile,
)
from .llm import LLMActivityGenerator
from .services import ActiveAssignmentError, AssignmentAgent, Recommender
from supabase import Client, create_client

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="SDG Campus Recommendation API", version="1.0.0")
configured_origins = [
    origin.strip()
    for origin in get_settings().frontend_origin.split(",")
    if origin.strip()
]
allowed_origins = sorted(set(configured_origins + [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@lru_cache
def get_repository() -> ActivityRepository:
    return ActivityRepository(get_settings())


@lru_cache
def get_recommender() -> Recommender:
    settings = get_settings()
    return Recommender(settings, get_repository())


@lru_cache
def get_llm() -> LLMActivityGenerator:
    return LLMActivityGenerator(get_settings())


@lru_cache
def get_assignment_agent() -> AssignmentAgent:
    return AssignmentAgent(get_recommender(), get_repository())


@lru_cache
def get_auth_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required")
    return create_client(settings.supabase_url, settings.supabase_publishable_key)


def _auth_response(auth_data, role: str) -> AuthResponse:
    session = auth_data.session
    if not session or not auth_data.user:
        raise HTTPException(status_code=409, detail="Account created. Confirm your email before signing in.")
    client = get_auth_client()
    profile = client.table("profiles").select("*").eq("id", auth_data.user.id).eq("role", role).single().execute()
    if not profile.data:
        raise HTTPException(status_code=500, detail="Authentication succeeded but the user profile is missing")
    return AuthResponse(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
        user=profile.data,
    )


@app.post("/auth/signup", response_model=AuthResponse)
@limiter.limit("10/minute")
def auth_signup(request: Request, payload: AuthSignupRequest) -> AuthResponse:
    try:
        client = get_auth_client()
        metadata = payload.model_dump(exclude={"password", "email"})
        auth_data = client.auth.sign_up({
            "email": str(payload.email),
            "password": payload.password,
            "options": {"data": metadata},
        })
        return _auth_response(auth_data, payload.role)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/auth/login", response_model=AuthResponse)
@limiter.limit("20/minute")
def auth_login(request: Request, payload: AuthLoginRequest) -> AuthResponse:
    try:
        client = get_auth_client()
        identifier = payload.identifier.strip()
        email = identifier
        if payload.role == "student" and "@" not in identifier:
            lookup = client.rpc("lookup_student_email", {"input_usn": identifier.upper()}).execute()
            email = lookup.data or ""
        if not email:
            raise HTTPException(status_code=401, detail="Student account not found")
        auth_data = client.auth.sign_in_with_password({"email": email, "password": payload.password})
        return _auth_response(auth_data, payload.role)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid credentials") from exc


@app.get("/health")
def health() -> dict[str, str]:
    settings = get_settings()
    provider = settings.llm_provider.lower().strip()
    return {
        "status": "ok",
        "llm_provider": provider,
        "llm_model": settings.ollama_model if provider == "ollama" else settings.llm_model,
    }


@app.get("/health/config")
def health_config() -> dict[str, object]:
    """Safe integration diagnostics; never returns secrets."""
    settings = get_settings()
    provider = settings.llm_provider.lower().strip()
    return {
        "status": "ok",
        "frontend_origins": allowed_origins,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_service_role_key),
        "llm_provider": provider,
        "llm_model": settings.ollama_model if provider == "ollama" else settings.llm_model,
        "ollama_cloud_key_configured": bool(settings.ollama_api_key),
        "embedding_model": settings.embedding_model,
        "embedding_dimensions": settings.embedding_dimensions,
    }


@app.post("/recommendations", response_model=RecommendationResponse)
@limiter.limit(get_settings().rate_limit)
def recommendations(
    request: Request,
    profile: StudentProfile,
    recommender: Recommender = Depends(get_recommender),
) -> RecommendationResponse:
    try:
        return recommender.recommend(profile)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/agent/assign", response_model=AssignmentResponse)
@limiter.limit(get_settings().rate_limit)
def assign_activity(
    request: Request,
    profile: StudentProfile,
    agent: AssignmentAgent = Depends(get_assignment_agent),
) -> AssignmentResponse:
    try:
        return agent.assign(profile)
    except ActiveAssignmentError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/chat", response_model=ChatResponse)
@limiter.limit(get_settings().rate_limit)
def chat(
    request: Request,
    payload: ChatRequest,
    llm: LLMActivityGenerator = Depends(get_llm),
) -> ChatResponse:
    try:
        return llm.chat(payload)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Chat service unavailable: {exc}") from exc


@app.post("/feedback", status_code=204)
@limiter.limit(get_settings().rate_limit)
def feedback(
    request: Request,
    payload: FeedbackRequest,
    repository: ActivityRepository = Depends(get_repository),
) -> None:
    repository.add_feedback(payload.model_dump())


@app.patch("/admin/activities/{activity_id}/approval", status_code=204)
def approve_activity(
    activity_id: str,
    payload: ApprovalRequest,
    repository: ActivityRepository = Depends(get_repository),
) -> None:
    # Protect this route with Supabase Auth/JWT middleware before production use.
    repository.approve_activity(activity_id, payload.approved, payload.reviewer_note)


@app.patch("/admin/activities/{activity_id}")
def edit_activity(
    activity_id: str,
    payload: ActivityEditRequest,
    repository: ActivityRepository = Depends(get_repository),
) -> dict[str, object]:
    """Update the activity brief before or during faculty review."""
    try:
        return repository.update_activity(activity_id, payload.model_dump(exclude_unset=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/admin/activities/pending")
def pending_activities(
    repository: ActivityRepository = Depends(get_repository),
) -> list[dict[str, object]]:
    """Return AI-generated activities waiting for faculty review.

    This prototype endpoint is intentionally read-only. Production deployment
    should add faculty JWT/role verification before exposing admin routes.
    """
    return repository.list_pending_activities()


@app.get("/activities/student/{student_id}")
def student_activities(
    student_id: str,
    repository: ActivityRepository = Depends(get_repository),
) -> list[dict[str, object]]:
    return repository.list_student_activities(student_id)


@app.get("/admin/students")
def students_by_department(
    department: str,
    repository: ActivityRepository = Depends(get_repository),
) -> list[dict[str, object]]:
    return repository.list_students_by_department(department)
