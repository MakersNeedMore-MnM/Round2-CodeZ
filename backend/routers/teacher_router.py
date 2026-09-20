from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db, User, StudentTwin, QuizSession
from auth import get_current_user
from twin_engine.recommendation_engine import CURRICULUM_GRAPH

router = APIRouter(prefix="/teacher", tags=["teacher"])


@router.get("/dashboard")
def teacher_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    students = db.query(User).filter(User.role == "student").all()
    student_data = []

    for student in students:
        twin = db.query(StudentTwin).filter(StudentTwin.user_id == student.id).first()
        if not twin:
            continue

        risk_scores = twin.risk_scores or {}
        knowledge_graph = twin.knowledge_graph or {}

        high_risk_concepts = [
            {"name": next((c["name"] for c in CURRICULUM_GRAPH if str(c["id"]) == cid), cid),
             "emoji": next((c["emoji"] for c in CURRICULUM_GRAPH if str(c["id"]) == cid), "📚"),
             "risk": round(r * 100, 1)}
            for cid, r in risk_scores.items() if r > 0.55
        ]
        high_risk_concepts.sort(key=lambda x: x["risk"], reverse=True)

        avg_mastery = sum(knowledge_graph.values()) / len(knowledge_graph) if knowledge_graph else 0

        recent_sessions = (
            db.query(QuizSession)
            .filter(QuizSession.user_id == student.id)
            .order_by(QuizSession.completed_at.desc())
            .limit(3)
            .all()
        )
        recent_scores = [round(s.score * 100, 1) for s in recent_sessions]

        student_data.append({
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "overall_risk": twin.overall_risk,
            "avg_mastery": round(avg_mastery * 100, 1),
            "confidence": round(twin.confidence_score * 100, 1),
            "motivation": round((twin.motivation_trend + 1) * 50, 1),
            "learning_style": twin.learning_style,
            "high_risk_concepts": high_risk_concepts[:3],
            "recent_scores": recent_scores,
            "alerts_count": len([r for r in risk_scores.values() if r > 0.55]),
        })

    # Class-wide stats
    risk_distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for s in student_data:
        risk_distribution[s["overall_risk"]] = risk_distribution.get(s["overall_risk"], 0) + 1

    # Concept mastery heatmap
    concept_mastery = {}
    for concept in CURRICULUM_GRAPH:
        cid = str(concept["id"])
        masteries = []
        for student in students:
            twin = db.query(StudentTwin).filter(StudentTwin.user_id == student.id).first()
            if twin and twin.knowledge_graph:
                masteries.append(twin.knowledge_graph.get(cid, 0.0))
        avg = sum(masteries) / len(masteries) if masteries else 0
        concept_mastery[concept["name"]] = {
            "avg_mastery": round(avg * 100, 1),
            "emoji": concept["emoji"],
            "struggling_count": sum(1 for m in masteries if m < 0.40),
        }

    return {
        "teacher": {"id": current_user.id, "name": current_user.name},
        "class_size": len(student_data),
        "students": student_data,
        "risk_distribution": risk_distribution,
        "concept_mastery": concept_mastery,
        "high_risk_count": sum(1 for s in student_data if s["overall_risk"] in ["high", "critical"]),
    }


@router.get("/student/{student_id}")
def get_student_detail(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    student = db.query(User).filter(User.id == student_id, User.role == "student").first()
    if not student:
        return {"error": "Student not found"}
    twin = db.query(StudentTwin).filter(StudentTwin.user_id == student_id).first()
    if not twin:
        return {"error": "Twin not found"}

    knowledge_graph = twin.knowledge_graph or {}
    risk_scores = twin.risk_scores or {}

    concepts_detail = []
    for concept in CURRICULUM_GRAPH:
        cid = str(concept["id"])
        mastery = knowledge_graph.get(cid, 0.0)
        risk = risk_scores.get(cid, 0.0)
        pm = (twin.predicted_mastery or {}).get(cid, {})
        concepts_detail.append({
            "id": concept["id"],
            "name": concept["name"],
            "emoji": concept["emoji"],
            "mastery": round(mastery * 100, 1),
            "risk": round(risk * 100, 1),
            "days_to_master": pm.get("days_to_master", 30),
            "retrievability": pm.get("retrievability", 50),
        })

    return {
        "student": {"id": student.id, "name": student.name, "email": student.email},
        "twin": {
            "overall_risk": twin.overall_risk,
            "learning_style": twin.learning_style,
            "confidence": round(twin.confidence_score * 100, 1),
            "pace": round(twin.pace_percentile * 100, 1),
            "motivation": round((twin.motivation_trend + 1) * 50, 1),
        },
        "concepts": concepts_detail,
    }
