from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db, User, StudentTwin, QuizSession
from auth import get_current_user
from twin_engine.recommendation_engine import CURRICULUM_GRAPH
from datetime import datetime, timedelta

router = APIRouter(prefix="/parent", tags=["parent"])


@router.get("/dashboard")
def parent_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # For demo: parent sees "Alex" (first student)
    student = db.query(User).filter(User.role == "student").first()
    if not student:
        return {"error": "No student found"}

    twin = db.query(StudentTwin).filter(StudentTwin.user_id == student.id).first()
    if not twin:
        return {"error": "No twin found"}

    risk_scores = twin.risk_scores or {}
    knowledge_graph = twin.knowledge_graph or {}

    alerts = []
    for cid, risk in risk_scores.items():
        if risk > 0.55:
            concept = next((c for c in CURRICULUM_GRAPH if str(c["id"]) == cid), None)
            if concept:
                severity = "critical" if risk > 0.75 else "high" if risk > 0.60 else "medium"
                alerts.append({
                    "concept": concept["name"],
                    "emoji": concept["emoji"],
                    "risk": round(risk * 100, 1),
                    "severity": severity,
                    "plain_message": _plain_alert(concept["name"], risk, severity),
                    "action": _recommended_action(severity),
                })
    alerts.sort(key=lambda x: x["risk"], reverse=True)

    # Weekly activity (mock last 7 days)
    sessions = (
        db.query(QuizSession)
        .filter(
            QuizSession.user_id == student.id,
            QuizSession.completed_at >= datetime.utcnow() - timedelta(days=7)
        )
        .order_by(QuizSession.completed_at.asc())
        .all()
    )

    avg_mastery = sum(knowledge_graph.values()) / len(knowledge_graph) if knowledge_graph else 0

    weekly_scores = []
    for s in sessions:
        concept_name = next((c["name"] for c in CURRICULUM_GRAPH if c["id"] == s.concept_id), "Quiz")
        weekly_scores.append({
            "date": s.completed_at.strftime("%a"),
            "score": round(s.score * 100, 1),
            "concept": concept_name,
        })

    return {
        "parent": {"name": current_user.name},
        "child": {
            "name": student.name,
            "overall_risk": twin.overall_risk,
            "avg_mastery": round(avg_mastery * 100, 1),
            "confidence": round(twin.confidence_score * 100, 1),
            "motivation": round((twin.motivation_trend + 1) * 50, 1),
            "learning_style": twin.learning_style,
        },
        "alerts": alerts[:4],
        "weekly_scores": weekly_scores,
        "total_quizzes_this_week": len(sessions),
        "avg_score_this_week": round(sum(s.score * 100 for s in sessions) / len(sessions), 1) if sessions else 0,
    }


def _plain_alert(concept: str, risk: float, severity: str) -> str:
    if severity == "critical":
        return f"Your child is at serious risk of falling behind in {concept}. Immediate attention is needed."
    elif severity == "high":
        return f"Your child is struggling with {concept}. Extra practice sessions are recommended."
    else:
        return f"Your child's progress in {concept} is slowing down. A gentle review would help."


def _recommended_action(severity: str) -> str:
    if severity == "critical":
        return "Contact the teacher and schedule a tutoring session immediately."
    elif severity == "high":
        return "Encourage 20 minutes of focused practice daily for the next week."
    else:
        return "Ask your child to do a quick review quiz before bed."
