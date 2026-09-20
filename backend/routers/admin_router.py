from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db, User, StudentTwin, QuizSession
from auth import get_current_user
from twin_engine.recommendation_engine import CURRICULUM_GRAPH

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard")
def admin_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    total_users = db.query(User).count()
    total_students = db.query(User).filter(User.role == "student").count()
    total_teachers = db.query(User).filter(User.role == "teacher").count()
    total_quizzes = db.query(QuizSession).count()

    all_twins = db.query(StudentTwin).all()
    risk_dist = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for twin in all_twins:
        risk_dist[twin.overall_risk] = risk_dist.get(twin.overall_risk, 0) + 1

    # Concept-wise average mastery across all students
    concept_stats = []
    for concept in CURRICULUM_GRAPH:
        cid = str(concept["id"])
        masteries = [t.knowledge_graph.get(cid, 0.0) for t in all_twins if t.knowledge_graph]
        avg = sum(masteries) / len(masteries) if masteries else 0
        concept_stats.append({
            "concept": concept["name"],
            "emoji": concept["emoji"],
            "avg_mastery": round(avg * 100, 1),
            "struggling": sum(1 for m in masteries if m < 0.40),
        })

    avg_quiz_score = 0
    sessions = db.query(QuizSession).all()
    if sessions:
        avg_quiz_score = round(sum(s.score for s in sessions) / len(sessions) * 100, 1)

    return {
        "stats": {
            "total_users": total_users,
            "total_students": total_students,
            "total_teachers": total_teachers,
            "total_quizzes": total_quizzes,
            "avg_quiz_score": avg_quiz_score,
        },
        "risk_distribution": risk_dist,
        "concept_stats": concept_stats,
        "users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "joined": u.created_at.isoformat() if u.created_at else None,
            }
            for u in db.query(User).order_by(User.created_at.desc()).all()
        ],
    }
