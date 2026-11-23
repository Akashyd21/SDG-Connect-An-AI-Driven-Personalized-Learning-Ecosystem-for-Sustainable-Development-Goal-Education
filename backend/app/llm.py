import json
import re

from openai import OpenAI
from pydantic import ValidationError

from .config import Settings
from .schemas import Activity, ChatRequest, ChatResponse, StudentProfile


class LLMActivityGenerator:
    """Provider adapter for Ollama's OpenAI-compatible API or OpenAI."""

    def __init__(self, settings: Settings):
        self.provider = settings.llm_provider.lower().strip()
        if self.provider == "ollama":
            is_cloud = "ollama.com" in settings.ollama_base_url.lower()
            if is_cloud and not settings.ollama_api_key:
                raise RuntimeError("OLLAMA_API_KEY is required for Ollama Cloud")
            self.client = OpenAI(
                base_url=settings.ollama_base_url,
                # Local Ollama ignores the key; Cloud uses the real API key.
                api_key=settings.ollama_api_key or "ollama",
            )
            self.model = settings.ollama_model
        elif self.provider == "openai":
            if not settings.openai_api_key:
                raise RuntimeError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
            self.client = OpenAI(api_key=settings.openai_api_key)
            self.model = settings.llm_model
        else:
            raise RuntimeError(f"Unsupported LLM_PROVIDER: {settings.llm_provider}")

    def generate(self, profile: StudentProfile, rag_context: list[dict[str, object]]) -> Activity:
        # Local import avoids a module cycle: the service owns the prompt contract.
        from .services import build_llm_prompt

        messages = [
            {
                "role": "system",
                "content": (
                    "You create one brand-new, safe, measurable university SDG activity. "
                    "Return only valid JSON. Do not use Markdown or add commentary."
                ),
            },
            {"role": "user", "content": build_llm_prompt(profile, rag_context)},
        ]

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                request = {
                    "model": self.model,
                    "temperature": 0.2,
                    "messages": messages,
                }
                # Ollama supports JSON mode on compatible models. The retry below
                # also supports older/local models that reject response_format.
                if attempt == 0:
                    request["response_format"] = {"type": "json_object"}
                response = self.client.chat.completions.create(**request)
                content = response.choices[0].message.content or ""
                payload = self._normalize_activity_payload(self._parse_json(content), profile)
                parsed = Activity.model_validate(payload)
                return parsed.model_copy(
                    update={"id": None, "source": "ai_generated", "approval_status": "pending"}
                )
            except (ValidationError, json.JSONDecodeError, ValueError, TypeError) as exc:
                last_error = exc
                messages.append({
                    "role": "user",
                    "content": (
                        "Your previous response was not valid Activity JSON. "
                        "Return exactly one JSON object matching every required field."
                    ),
                })
            except Exception as exc:
                last_error = exc
                if attempt == 0:
                    continue

        detail = str(last_error) if last_error else "No response was returned"
        raise RuntimeError(
            f"Dynamic task generation failed using {self.provider}/{self.model}: {detail}"
        ) from last_error

    @staticmethod
    def _parse_json(content: str) -> dict[str, object]:
        """Parse plain JSON or a fenced JSON response from a local model."""
        cleaned = content.strip()
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            start, end = cleaned.find("{"), cleaned.rfind("}")
            if start < 0 or end <= start:
                raise
            parsed = json.loads(cleaned[start : end + 1])
        if not isinstance(parsed, dict):
            raise ValueError("LLM response must be a JSON object")
        return parsed

    @staticmethod
    def _normalize_activity_payload(payload: dict[str, object], profile: StudentProfile) -> dict[str, object]:
        """Normalize reasonable model field variations before strict validation."""
        normalized = dict(payload)

        def as_list(value: object, fallback: list[str]) -> list[str]:
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]
            if isinstance(value, str) and value.strip():
                return [part.strip() for part in re.split(r"\n|;|,", value) if part.strip()]
            return fallback

        if "title" not in normalized:
            normalized["title"] = normalized.get("activity_name") or normalized.get("name")
        if "description" not in normalized:
            normalized["description"] = normalized.get("activity_description") or normalized.get("summary")

        if "sdgs" not in normalized:
            sdg_value = normalized.get("sdg_id") or normalized.get("goal_id") or normalized.get("sdg")
            if sdg_value is not None:
                normalized["sdgs"] = sdg_value if isinstance(sdg_value, list) else [sdg_value]

        if "steps" not in normalized:
            steps = normalized.get("objectives") or normalized.get("actions") or normalized.get("deliverables")
            if isinstance(steps, list):
                normalized["steps"] = steps

        if "hours" not in normalized:
            normalized["hours"] = normalized.get("estimated_hours") or normalized.get("time_required")
        if "difficulty" not in normalized:
            normalized["difficulty"] = profile.skill_level
        if "department" not in normalized:
            normalized["department"] = profile.department
        if "why_it_fits" not in normalized:
            normalized["why_it_fits"] = (
                f"This activity matches the student's {profile.department} department, "
                f"skills ({', '.join(profile.skills)}), and selected SDGs ({', '.join(map(str, profile.sdg_interests))})."
            )

        description = str(normalized.get("description") or "").strip()
        normalized["problem_statement"] = str(
            normalized.get("problem_statement") or
            f"The university needs a practical {profile.department} intervention that addresses an identified sustainability challenge and produces measurable evidence."
        ).strip()
        normalized["teaching_goals"] = as_list(
            normalized.get("teaching_goals"),
            [f"Apply {profile.skill_level}-level skills to a measurable SDG problem.", "Explain the sustainability impact of the completed work."]
        )
        normalized["sdg_relation"] = str(
            normalized.get("sdg_relation") or
            f"This activity supports SDG {', '.join(map(str, profile.sdg_interests))} through the described student deliverable."
        ).strip()
        normalized["matched_skills"] = as_list(normalized.get("matched_skills"), profile.skills[:3])
        normalized["matched_interests"] = as_list(
            normalized.get("matched_interests"),
            [f"SDG {goal}" for goal in profile.sdg_interests]
        )
        normalized["required_tools"] = as_list(normalized.get("required_tools"), ["A computer, internet access, and the tools required by the activity steps."])
        normalized["requirements"] = as_list(
            normalized.get("requirements"),
            ["Complete all activity steps.", "Record the approach and relevant sustainability impact."]
        )
        normalized["deliverables"] = as_list(
            normalized.get("deliverables"),
            ["A completed project output.", "A GitHub repository or project summary as appropriate."]
        )
        normalized["submission_instructions"] = str(
            normalized.get("submission_instructions") or
            "Submit the GitHub repository URL, project summary, and optional live demo or notebook URL."
        ).strip()
        normalized["evaluation_criteria"] = as_list(
            normalized.get("evaluation_criteria"),
            ["Alignment with the selected SDGs.", "Quality and completeness of the project deliverable.", "Clarity of the submitted summary."]
        )

        return normalized

    def chat(self, request: ChatRequest) -> ChatResponse:
        if not self._is_platform_question(request.message):
            return ChatResponse(
                reply=(
                    "I can help only with this platform: your SDG activities, task assignment, "
                    "faculty approval, progress, submissions, quizzes, games, profile skills, "
                    "and account navigation. Please ask a platform-related question."
                )
            )
        messages = [
            {
                "role": "system",
                "content": (
                    "You are SustainAI Mentor, a helpful university sustainability assistant. "
                    "Answer naturally and specifically using the student's department, skills, "
                    "SDG interests, assigned activity, and ongoing work. Explain how SDG courses "
                    "are important, how an assigned project supports an SDG, how to use the platform, "
                    "how to enroll, and what information is required for submission. Do not claim to "
                    "have performed actions you did not perform. Do not describe milestone tracking or "
                    "automated verification because those features are not part of the current workflow. "
                    "Do not browse the web or answer general questions unrelated to this platform. Keep "
                    "answers concise and practical."
                ),
            },
            {"role": "system", "content": f"Student context: {request.student}"},
        ]
        for item in request.history[-12:]:
            role = "assistant" if item.get("sender") == "ai" else "user"
            messages.append({"role": role, "content": item.get("text", "")})
        messages.append({"role": "user", "content": request.message})

        response = self.client.chat.completions.create(
            model=self.model,
            temperature=0.4,
            messages=messages,
        )
        reply = response.choices[0].message.content or "I could not generate a response."
        return ChatResponse(reply=reply)

    @staticmethod
    def _is_platform_question(message: str) -> bool:
        terms = (
            "sdg", "activity", "task", "assignment", "enroll", "approval", "faculty", "student",
            "progress", "submit", "submission", "quiz", "game", "profile", "course", "learning",
            "skill", "interest", "department", "leaderboard", "dashboard", "account", "login",
            "logout", "ollama", "ai mentor", "chatbot", "project", "tool", "requirement"
        )
        text = message.lower()
        return any(term in text for term in terms)
