from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator


class AuthSignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["student", "faculty"]
    department: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=16)
    usn: str | None = Field(default=None, max_length=40)
    skills: list[str] = Field(default_factory=list, max_length=30)
    interests: list[str] = Field(default_factory=list, max_length=30)
    skill_level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    available_hours: float = Field(default=4, gt=0, le=40)
    designation: str | None = Field(default=None, max_length=120)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not all((any(char.isupper() for char in value),
                    any(char.islower() for char in value),
                    any(char.isdigit() for char in value),
                    any(not char.isalnum() for char in value))):
            raise ValueError("Password must contain uppercase, lowercase, number, and special character")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        import re
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
            raise ValueError("Enter a valid email address")
        return value.lower()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        digits = "".join(char for char in value if char.isdigit())
        if len(digits) == 10 and digits[0] in "6789":
            return "+91" + digits
        if len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
            return "+" + digits
        raise ValueError("Phone must contain a valid Indian 10-digit number")


class AuthLoginRequest(BaseModel):
    identifier: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=128)
    role: Literal["student", "faculty"]


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int | None = None
    user: dict[str, object]


class StudentProfile(BaseModel):
    student_id: str
    department: str = Field(min_length=2, max_length=120)
    skills: list[str] = Field(min_length=1, max_length=30)
    sdg_interests: list[int] = Field(min_length=1, max_length=17)
    skill_level: Literal["beginner", "intermediate", "advanced"] = "intermediate"
    available_hours: float = Field(default=4, gt=0, le=40)

    @field_validator("sdg_interests")
    @classmethod
    def valid_sdgs(cls, values: list[int]) -> list[int]:
        if any(goal < 1 or goal > 17 for goal in values):
            raise ValueError("SDG interests must be between 1 and 17")
        return sorted(set(values))


class Activity(BaseModel):
    id: str | None = None
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=4000)
    sdgs: list[int] = Field(min_length=1, max_length=17)
    steps: list[str] = Field(min_length=1, max_length=12)
    difficulty: Literal["beginner", "intermediate", "advanced"]
    hours: float = Field(gt=0, le=40)
    why_it_fits: str = Field(min_length=10, max_length=1000)
    department: str
    source: Literal["catalog", "ai_generated"] = "catalog"
    approval_status: Literal["approved", "pending"] = "approved"
    submission_type: Literal["coding", "field"] = "field"
    problem_statement: str | None = None
    teaching_goals: list[str] = Field(default_factory=list)
    sdg_relation: str | None = None
    matched_skills: list[str] = Field(default_factory=list)
    matched_interests: list[str] = Field(default_factory=list)
    required_tools: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    deliverables: list[str] = Field(default_factory=list)
    submission_instructions: str | None = None
    evaluation_criteria: list[str] = Field(default_factory=list)
    deadline: date | None = None
    score: float | None = None


class RecommendationResponse(BaseModel):
    student_id: str
    activities: list[Activity]
    generated_activity_queued: bool = False


class AssignmentResponse(RecommendationResponse):
    status: Literal["assigned", "approval_pending"] = "assigned"
    deadline: date
    message: str


class FeedbackRequest(BaseModel):
    student_id: str
    activity_id: str
    event: Literal["started", "completed", "skipped"]
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class ApprovalRequest(BaseModel):
    approved: bool
    reviewer_note: str | None = Field(default=None, max_length=1000)


class ActivityEditRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    description: str | None = Field(default=None, min_length=10, max_length=4000)
    problem_statement: str | None = Field(default=None, max_length=4000)
    teaching_goals: list[str] | None = Field(default=None, max_length=20)
    sdg_relation: str | None = Field(default=None, max_length=2000)
    required_tools: list[str] | None = Field(default=None, max_length=30)
    requirements: list[str] | None = Field(default=None, max_length=30)
    steps: list[str] | None = Field(default=None, max_length=12)
    deliverables: list[str] | None = Field(default=None, max_length=30)
    submission_instructions: str | None = Field(default=None, max_length=4000)
    evaluation_criteria: list[str] | None = Field(default=None, max_length=30)
    difficulty: Literal["beginner", "intermediate", "advanced"] | None = None
    hours: float | None = Field(default=None, gt=0, le=40)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    student: dict[str, object] = Field(default_factory=dict)
    history: list[dict[str, str]] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str
