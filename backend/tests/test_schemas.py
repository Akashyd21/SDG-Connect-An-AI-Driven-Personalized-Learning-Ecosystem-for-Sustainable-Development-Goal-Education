import pytest
from pydantic import ValidationError

from app.schemas import StudentProfile


def test_profile_normalizes_sdgs():
    profile = StudentProfile(
        student_id="s1",
        department="Computer Science",
        skills=["Python"],
        sdg_interests=[13, 7, 13],
    )
    assert profile.sdg_interests == [7, 13]


def test_profile_rejects_invalid_sdg():
    with pytest.raises(ValidationError):
        StudentProfile(
            student_id="s1",
            department="Computer Science",
            skills=["Python"],
            sdg_interests=[18],
        )
