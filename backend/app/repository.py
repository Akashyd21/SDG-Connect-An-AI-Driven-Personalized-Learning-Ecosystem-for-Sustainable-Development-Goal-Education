from typing import Any
from uuid import UUID

from supabase import Client, create_client

from .config import Settings


class ActivityRepository:
    """Supabase data access. SQL filtering and vector ranking happen in Postgres RPC."""

    def __init__(self, settings: Settings):
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        self.client: Client = create_client(
            settings.supabase_url, settings.supabase_service_role_key
        )

    def match_activities(
        self, profile: dict[str, Any], embedding: list[float], limit: int
    ) -> list[dict[str, Any]]:
        result = self.client.rpc(
            "match_activities",
            {
                "query_embedding": embedding,
                "wanted_sdgs": profile["sdg_interests"],
                "wanted_department": profile["department"],
                "wanted_difficulty": profile["skill_level"],
                "max_hours": profile["available_hours"],
                "result_limit": limit,
            },
        ).execute()
        return result.data or []

    def retrieve_rag_documents(
        self, profile: dict[str, Any], embedding: list[float], limit: int = 6
    ) -> list[dict[str, Any]]:
        """Retrieve grounding knowledge, never an activity assignment."""
        result = self.client.rpc(
            "match_rag_documents",
            {
                "query_embedding": embedding,
                "wanted_sdgs": profile["sdg_interests"],
                "wanted_department": profile["department"],
                "result_limit": limit,
            },
        ).execute()
        return result.data or []

    def create_pending_activity(self, activity: dict[str, Any], student_id: str) -> dict[str, Any]:
        payload = {**activity, "source": "ai_generated", "approval_status": "pending", "requested_by": student_id}
        result = self.client.table("activities").insert(payload).execute()
        return result.data[0]

    def list_pending_activities(self, limit: int = 100) -> list[dict[str, Any]]:
        result = (
            self.client.table("activities")
            .select("*")
            .eq("approval_status", "pending")
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return []
        profiles = (
            self.client.table("profiles")
            .select("id,name,usn,department")
            .eq("role", "student")
            .execute()
        ).data or []
        profile_by_id = {profile["id"]: profile for profile in profiles}
        result = []
        for row in rows:
            profile = profile_by_id.get(row.get("requested_by"))
            if profile:
                result.append({
                    **row,
                    "requested_by_name": profile.get("name"),
                    "requested_by_usn": profile.get("usn"),
                    "requested_by_department": profile.get("department"),
                })
        return result

    def list_student_activities(self, student_id: str, limit: int = 100) -> list[dict[str, Any]]:
        profile = (
            self.client.table("profiles")
            .select("id")
            .eq("id", student_id)
            .eq("role", "student")
            .limit(1)
            .execute()
        ).data or []
        if not profile:
            return []
        result = (
            self.client.table("activities")
            .select("*")
            .eq("requested_by", student_id)
            .in_("approval_status", ["pending", "approved", "rejected"])
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    def list_students_by_department(self, department: str) -> list[dict[str, Any]]:
        department = " ".join(department.strip().split())
        profiles = (
            self.client.table("profiles")
            .select("id,name,usn,department,email,points,tasks_completed_count,ongoing_tasks_count,avatar,skills,interests")
            .eq("role", "student")
            .ilike("department", department)
            .order("name")
            .execute()
        ).data or []
        if not profiles:
            return []

        student_ids = [profile["id"] for profile in profiles]
        activities = (
            self.client.table("activities")
            .select("requested_by,approval_status")
            .in_("requested_by", student_ids)
            .execute()
        ).data or []
        ongoing = (
            self.client.table("ongoing_tasks")
            .select("student_id,status")
            .in_("student_id", student_ids)
            .execute()
        ).data or []

        activity_statuses: dict[str, set[str]] = {}
        for activity in activities:
            activity_statuses.setdefault(activity["requested_by"], set()).add(activity["approval_status"])
        ongoing_statuses: dict[str, set[str]] = {}
        for task in ongoing:
            ongoing_statuses.setdefault(task["student_id"], set()).add(task["status"])

        result = []
        for profile in profiles:
            student_id = profile["id"]
            statuses = activity_statuses.get(student_id, set())
            active_work = ongoing_statuses.get(student_id, set()) - {"completed"}
            if (profile.get("tasks_completed_count") or 0) > 0:
                workflow_status = "completed"
            elif active_work:
                workflow_status = "in_progress"
            elif "approved" in statuses:
                workflow_status = "approved"
            else:
                workflow_status = "not_started"
            result.append({**profile, "workflow_status": workflow_status})
        return result

    def add_feedback(self, feedback: dict[str, Any]) -> None:
        self.client.table("activity_feedback").insert(feedback).execute()

    def active_assignment(self, student_id: str) -> dict[str, Any] | None:
        """Return the student's current workflow record, if it exists."""
        try:
            UUID(student_id)
        except ValueError:
            # Demo/local-storage users are not Supabase Auth users.
            return None
        result = (
            self.client.table("ongoing_tasks")
            .select("id, activity_id, status, deadline")
            .eq("student_id", student_id)
            .in_("status", ["assigned", "enrolled", "in-progress", "submitted", "needs_review"])
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def approve_activity(self, activity_id: str, approved: bool, note: str | None) -> None:
        status = "approved" if approved else "rejected"
        self.client.table("activities").update(
            {"approval_status": status, "reviewer_note": note}
        ).eq("id", activity_id).execute()

    def update_activity(self, activity_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        payload = {key: value for key, value in changes.items() if value is not None}
        if not payload:
            raise ValueError("At least one activity field is required")
        result = self.client.table("activities").update(payload).eq("id", activity_id).execute()
        if not result.data:
            raise ValueError("Activity was not found")
        return result.data[0]
