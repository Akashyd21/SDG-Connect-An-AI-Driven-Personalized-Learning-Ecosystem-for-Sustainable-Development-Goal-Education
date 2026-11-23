import json
from datetime import date, timedelta
from typing import Any

from sentence_transformers import SentenceTransformer

from .config import Settings
from .llm import LLMActivityGenerator
from .repository import ActivityRepository
from .schemas import Activity, AssignmentResponse, RecommendationResponse, StudentProfile


class Recommender:
    def __init__(self, settings: Settings, repository: ActivityRepository):
        self.settings = settings
        self.repository = repository
        provider = settings.llm_provider.lower().strip()
        llm_ready = provider == "ollama" or (provider == "openai" and bool(settings.openai_api_key))
        self.llm = LLMActivityGenerator(settings) if llm_ready else None
        self._encoder: SentenceTransformer | None = None

    @property
    def encoder(self) -> SentenceTransformer:
        if self._encoder is None:
            self._encoder = SentenceTransformer(
                self.settings.embedding_model,
                local_files_only=self.settings.embedding_local_files_only,
            )
        return self._encoder

    def recommend(self, profile: StudentProfile) -> RecommendationResponse:
        query = (
            f"Department: {profile.department}. Skills: {', '.join(profile.skills)}. "
            f"SDGs: {profile.sdg_interests}. Level: {profile.skill_level}. "
            f"Available hours: {profile.available_hours}."
        )
        vector = self.encoder.encode(query, normalize_embeddings=True).tolist()
        if not self.llm:
            raise RuntimeError(
                "LLM generation is required for dynamic assignments. "
                "Configure Ollama or set LLM_PROVIDER=openai with OPENAI_API_KEY."
            )

        profile_data = profile.model_dump()
        context = self.repository.retrieve_rag_documents(profile_data, vector)
        if not context:
            context = self._default_rag_context(profile)

        # RAG supplies grounding knowledge only. The LLM creates a new activity
        # for this student; no pre-created activity is selected or reused.
        generated = self.llm.generate(profile, context)
        self._validate_generated_activity(generated, profile)
        queued = self.repository.create_pending_activity(
            generated.model_dump(exclude={"id", "score"}), profile.student_id
        )
        return RecommendationResponse(
            student_id=profile.student_id,
            activities=[Activity.model_validate(queued)],
            generated_activity_queued=True,
        )

    @staticmethod
    def _default_rag_context(profile: StudentProfile) -> list[dict[str, str]]:
        """Bootstrap grounding rules until the RAG table has documents."""
        return [
            {
                "title": "SDG task design rules",
                "content": (
                    "Create a measurable activity tied to the selected SDGs with a clear "
                    "deliverable, realistic steps, evidence requirements, and impact metric."
                ),
            },
            {
                "title": "Department adaptation rules",
                "content": (
                    f"Adapt the task to {profile.department}, skills ({', '.join(profile.skills)}), "
                    f"level ({profile.skill_level}), and {profile.available_hours} available hours."
                ),
            },
            {
                "title": "Submission rules",
                "content": (
                    "Use coding submission for software, data, AI, IoT, or programming work; "
                    "otherwise use field submission with evidence and location."
                ),
            },
        ]

    @staticmethod
    def _validate_generated_activity(activity: Activity, profile: StudentProfile) -> None:
        if not set(activity.sdgs).issubset(set(profile.sdg_interests)):
            raise RuntimeError("Generated activity contains an SDG outside the student's interests")
        if activity.hours > profile.available_hours:
            raise RuntimeError("Generated activity exceeds the student's available hours")
        if activity.department.lower() not in {profile.department.lower(), "all departments"}:
            raise RuntimeError("Generated activity department does not match the student")


class ActiveAssignmentError(RuntimeError):
    """Raised when a student requests a second task before finishing the first."""


class AssignmentAgent:
    """Guarded assignment workflow around RAG retrieval and LLM generation."""

    DEADLINE_DAYS = {"beginner": 14, "intermediate": 10, "advanced": 7}

    def __init__(self, recommender: Recommender, repository: ActivityRepository):
        self.recommender = recommender
        self.repository = repository

    def assign(self, profile: StudentProfile) -> AssignmentResponse:
        if self.repository.active_assignment(profile.student_id):
            raise ActiveAssignmentError("Complete the current assigned task before requesting a new task")
        recommendation = self.recommender.recommend(profile)
        if not recommendation.activities:
            raise RuntimeError("No suitable activity was found and generation is unavailable")

        deadline = date.today() + timedelta(days=self.DEADLINE_DAYS[profile.skill_level])
        activity = recommendation.activities[0].model_copy(update={"deadline": deadline})
        status = "approval_pending" if recommendation.generated_activity_queued else "assigned"
        message = (
            "An AI-generated activity is waiting for faculty approval."
            if status == "approval_pending"
            else "A new activity was generated from the student's profile and RAG context."
        )
        return AssignmentResponse(
            student_id=profile.student_id,
            activities=[activity],
            generated_activity_queued=recommendation.generated_activity_queued,
            status=status,
            deadline=deadline,
            message=message,
        )


def build_llm_prompt(profile: StudentProfile, candidates: list[dict[str, Any]]) -> str:
    """Prompt contract for an LLM adapter using structured JSON output."""
    return json.dumps(
        {
            "task": "Generate one brand-new SDG activity for this student using the retrieved context.",
            "rules": [
                "Return exactly one JSON object with these keys: title, description, sdgs, steps, difficulty, hours, why_it_fits, department, submission_type, problem_statement, teaching_goals, sdg_relation, matched_skills, matched_interests, required_tools, requirements, deliverables, submission_instructions, evaluation_criteria.",
                "Use the exact key names above. Do not use alternatives such as sdg_id, objectives, activity_name, or estimated_hours.",
                "Every detailed field must be present and specific: problem_statement, teaching_goals, sdg_relation, matched_skills, matched_interests, required_tools, requirements, deliverables, submission_instructions, and evaluation_criteria. Use arrays for list fields, not one paragraph.",
                "The description must explain the complete task, expected student action, and intended sustainability outcome in enough detail for the student to begin work.",
                "Keep SDGs within the student's selected SDG interests.",
                "Adapt examples, tools, and deliverables to the department and skill level.",
                "Set submission_type to coding for software, data, AI, IoT, or programming work; otherwise set it to field.",
                "Do not copy or reference a pre-created activity. Do not include an id.",
            ],
            "student": profile.model_dump(),
            "rag_context": candidates,
        }
    )
