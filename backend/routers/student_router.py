from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from models.database import get_db, User, StudentTwin, QuizSession, LearningEvent, Concept
from auth import get_current_user
from twin_engine import get_twin_summary, process_quiz_result, refresh_twin
from twin_engine.forgetting_curve import simulate_study_impact
from twin_engine.recommendation_engine import CURRICULUM_GRAPH, get_recommendations, get_learning_path

router = APIRouter(prefix="/student", tags=["student"])


def _get_twin_or_404(user: User, db: Session) -> StudentTwin:
    twin = db.query(StudentTwin).filter(StudentTwin.user_id == user.id).first()
    if not twin:
        raise HTTPException(status_code=404, detail="Digital twin not found")
    return twin


def _twin_to_dict(twin: StudentTwin) -> dict:
    return {
        "knowledge_graph": twin.knowledge_graph,
        "forgetting_params": twin.forgetting_params,
        "learning_style": twin.learning_style,
        "confidence_score": twin.confidence_score,
        "pace_percentile": twin.pace_percentile,
        "attention_span": twin.attention_span,
        "motivation_trend": twin.motivation_trend,
        "risk_scores": twin.risk_scores,
        "predicted_mastery": twin.predicted_mastery,
        "overall_risk": twin.overall_risk,
    }


@router.get("/twin")
def get_student_twin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    twin = _get_twin_or_404(current_user, db)
    twin_data = _twin_to_dict(twin)
    summary = get_twin_summary(twin_data)
    return {
        "student": {"id": current_user.id, "name": current_user.name, "email": current_user.email},
        "twin": {
            "learning_style": twin.learning_style,
            "confidence": round(twin.confidence_score * 100, 1),
            "pace": round(twin.pace_percentile * 100, 1),
            "attention_span": twin.attention_span,
            "motivation": round((twin.motivation_trend + 1) * 50, 1),
            "overall_risk": twin.overall_risk,
            "last_updated": twin.last_updated.isoformat() if twin.last_updated else None,
        },
        **summary,
    }


@router.get("/quiz/{concept_id}")
def get_quiz(
    concept_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    concept = db.query(Concept).filter(Concept.id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    twin = _get_twin_or_404(current_user, db)
    mastery = twin.knowledge_graph.get(str(concept_id), 0.0)

    # Generate questions adapted to mastery level
    questions = _generate_questions(concept, mastery)
    return {
        "concept_id": concept_id,
        "concept_name": concept.name,
        "emoji": concept.emoji,
        "difficulty": concept.difficulty,
        "mastery": round(mastery * 100, 1),
        "questions": questions,
    }


class QuizSubmission(BaseModel):
    concept_id: int
    responses: List[bool]
    time_taken_seconds: int


@router.post("/quiz/submit")
def submit_quiz(
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    twin = _get_twin_or_404(current_user, db)
    twin_data = _twin_to_dict(twin)

    correct = sum(submission.responses)
    total = len(submission.responses)
    score = correct / total if total > 0 else 0.0

    # Update twin via ML models
    updated_twin_data = process_quiz_result(
        twin_data, submission.concept_id, submission.responses, submission.time_taken_seconds
    )

    # Persist updated twin
    twin.knowledge_graph = updated_twin_data["knowledge_graph"]
    twin.forgetting_params = updated_twin_data["forgetting_params"]
    twin.confidence_score = updated_twin_data["confidence_score"]
    twin.pace_percentile = updated_twin_data["pace_percentile"]
    twin.motivation_trend = updated_twin_data["motivation_trend"]
    twin.risk_scores = updated_twin_data["risk_scores"]
    twin.predicted_mastery = updated_twin_data["predicted_mastery"]
    twin.overall_risk = updated_twin_data["overall_risk"]
    twin.last_updated = datetime.utcnow()

    # Log quiz session
    quiz_session = QuizSession(
        user_id=current_user.id,
        concept_id=submission.concept_id,
        questions_answered=total,
        correct_answers=correct,
        time_taken_seconds=submission.time_taken_seconds,
        score=score,
    )
    db.add(quiz_session)

    # Log event
    event = LearningEvent(
        user_id=current_user.id,
        event_type="quiz_completed",
        concept_id=submission.concept_id,
        event_metadata={"score": score, "correct": correct, "total": total},
    )
    db.add(event)
    db.commit()

    # Return feedback
    new_mastery = updated_twin_data["knowledge_graph"].get(str(submission.concept_id), 0.0)
    return {
        "score": round(score * 100, 1),
        "correct": correct,
        "total": total,
        "new_mastery": round(new_mastery * 100, 1),
        "new_risk": round(updated_twin_data["risk_scores"].get(str(submission.concept_id), 0.0) * 100, 1),
        "twin_updated": True,
        "feedback": _generate_feedback(score, new_mastery),
    }


class SimulationRequest(BaseModel):
    concept_id: int
    minutes_per_day: float
    days: int


@router.post("/simulate")
def run_simulation(
    req: SimulationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    twin = _get_twin_or_404(current_user, db)
    concept = next((c for c in CURRICULUM_GRAPH if c["id"] == req.concept_id), None)
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    cid = str(req.concept_id)
    mastery = twin.knowledge_graph.get(cid, 0.0)
    fp = twin.forgetting_params.get(cid, {"stability": 2.0})
    stability = fp.get("stability", 2.0)

    # Base scenario (no study)
    base = simulate_study_impact(mastery, stability, 0, req.days, concept["difficulty"])

    # Expected (requested minutes)
    expected = simulate_study_impact(mastery, stability, req.minutes_per_day, req.days, concept["difficulty"])

    # Best case (1.5x)
    best = simulate_study_impact(mastery, stability, req.minutes_per_day * 1.5, req.days, concept["difficulty"])

    # Worst case (0.5x)
    worst = simulate_study_impact(mastery, stability, req.minutes_per_day * 0.5, req.days, concept["difficulty"])

    return {
        "concept": concept["name"],
        "emoji": concept["emoji"],
        "current_mastery": round(mastery * 100, 1),
        "scenarios": {
            "no_study": base,
            "expected": expected,
            "best_case": best,
            "worst_case": worst,
        },
        "recommendation": _sim_recommendation(expected["projected_score"], mastery),
    }


@router.get("/history")
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sessions = (
        db.query(QuizSession)
        .filter(QuizSession.user_id == current_user.id)
        .order_by(QuizSession.completed_at.desc())
        .limit(20)
        .all()
    )
    concepts = {c["id"]: c for c in CURRICULUM_GRAPH}
    return [
        {
            "concept_id": s.concept_id,
            "concept_name": concepts.get(s.concept_id, {}).get("name", "Unknown"),
            "emoji": concepts.get(s.concept_id, {}).get("emoji", "📚"),
            "score": round(s.score * 100, 1),
            "correct": s.correct_answers,
            "total": s.questions_answered,
            "date": s.completed_at.isoformat(),
        }
        for s in sessions
    ]


def _generate_questions(concept: Concept, mastery: float) -> list:
    """Generates adaptive quiz questions based on concept and mastery."""
    question_banks = {
        "Arithmetic": [
            {"q": "What is 15 × 8?", "options": ["120", "125", "110", "130"], "answer": 0},
            {"q": "Simplify: 144 ÷ 12", "options": ["12", "14", "10", "11"], "answer": 0},
            {"q": "What is 37 + 58?", "options": ["95", "85", "97", "90"], "answer": 0},
            {"q": "What is 25% of 200?", "options": ["50", "40", "60", "45"], "answer": 0},
            {"q": "What is the LCM of 4 and 6?", "options": ["12", "24", "6", "8"], "answer": 0},
        ],
        "Algebra": [
            {"q": "Solve: 2x + 5 = 13", "options": ["x = 4", "x = 3", "x = 5", "x = 6"], "answer": 0},
            {"q": "Expand: (x + 3)²", "options": ["x² + 6x + 9", "x² + 9", "x² + 3x + 9", "x² + 6x"], "answer": 0},
            {"q": "If f(x) = 3x - 2, what is f(5)?", "options": ["13", "15", "12", "10"], "answer": 0},
            {"q": "Factor: x² - 9", "options": ["(x-3)(x+3)", "(x-9)(x+1)", "(x-3)²", "(x+3)²"], "answer": 0},
            {"q": "Solve: x² - 5x + 6 = 0", "options": ["x = 2, 3", "x = -2, -3", "x = 1, 6", "x = -1, 6"], "answer": 0},
        ],
        "Geometry": [
            {"q": "Area of a circle with r=7 (use π≈3.14)?", "options": ["153.86", "144.0", "163.5", "150.2"], "answer": 0},
            {"q": "Sum of interior angles of a hexagon?", "options": ["720°", "540°", "360°", "900°"], "answer": 0},
            {"q": "Pythagorean: a=3, b=4, find c?", "options": ["5", "7", "6", "4.5"], "answer": 0},
            {"q": "Volume of cube with side 4?", "options": ["64", "48", "16", "32"], "answer": 0},
            {"q": "What is the circumference of circle with d=10?", "options": ["31.4", "28.4", "34.2", "30.0"], "answer": 0},
        ],
        "Trigonometry": [
            {"q": "What is sin(90°)?", "options": ["1", "0", "-1", "0.5"], "answer": 0},
            {"q": "What is cos(0°)?", "options": ["1", "0", "-1", "0.5"], "answer": 0},
            {"q": "If tan(θ) = 1, what is θ?", "options": ["45°", "30°", "60°", "90°"], "answer": 0},
            {"q": "What is sin²(θ) + cos²(θ)?", "options": ["1", "0", "2", "-1"], "answer": 0},
            {"q": "Period of sin(x)?", "options": ["2π", "π", "4π", "π/2"], "answer": 0},
        ],
        "Calculus": [
            {"q": "d/dx of x³?", "options": ["3x²", "x²", "3x³", "x⁴/4"], "answer": 0},
            {"q": "lim(x→0) of sin(x)/x?", "options": ["1", "0", "∞", "-1"], "answer": 0},
            {"q": "d/dx of e^x?", "options": ["e^x", "xe^x", "e^(x-1)", "1/e^x"], "answer": 0},
            {"q": "What is d/dx of ln(x)?", "options": ["1/x", "x", "ln(x)", "e^x"], "answer": 0},
            {"q": "d/dx of sin(x)?", "options": ["cos(x)", "-sin(x)", "-cos(x)", "sin(x)"], "answer": 0},
        ],
        "Integration": [
            {"q": "∫ x² dx = ?", "options": ["x³/3 + C", "x³ + C", "2x + C", "x²/2 + C"], "answer": 0},
            {"q": "∫ cos(x) dx = ?", "options": ["sin(x) + C", "-sin(x) + C", "cos(x) + C", "tan(x) + C"], "answer": 0},
            {"q": "∫ e^x dx = ?", "options": ["e^x + C", "xe^x + C", "e^(x+1) + C", "1/e^x + C"], "answer": 0},
            {"q": "∫₀¹ x dx = ?", "options": ["0.5", "1", "0", "2"], "answer": 0},
            {"q": "∫ 1/x dx = ?", "options": ["ln|x| + C", "x + C", "-1/x² + C", "e^x + C"], "answer": 0},
        ],
        "Statistics": [
            {"q": "Mean of [2, 4, 6, 8, 10]?", "options": ["6", "5", "7", "8"], "answer": 0},
            {"q": "What is the median of [3, 1, 4, 1, 5]?", "options": ["3", "1", "4", "5"], "answer": 0},
            {"q": "Standard deviation measures?", "options": ["Spread", "Center", "Skewness", "Mode"], "answer": 0},
            {"q": "P(A∪B) = P(A) + P(B) when events are?", "options": ["Mutually exclusive", "Independent", "Exhaustive", "Complementary"], "answer": 0},
            {"q": "What distribution is bell-shaped?", "options": ["Normal", "Uniform", "Binomial", "Poisson"], "answer": 0},
        ],
        "Linear Algebra": [
            {"q": "Determinant of [[1,2],[3,4]]?", "options": ["-2", "2", "10", "-10"], "answer": 0},
            {"q": "What is the identity matrix property?", "options": ["AI = A", "A+I = A", "A-I = 0", "AI = I"], "answer": 0},
            {"q": "Rank of a zero matrix?", "options": ["0", "1", "n", "undefined"], "answer": 0},
            {"q": "Dot product of [1,0] and [0,1]?", "options": ["0", "1", "-1", "2"], "answer": 0},
            {"q": "Eigenvalue equation: Av = ?", "options": ["λv", "v/λ", "A+v", "0"], "answer": 0},
        ],
    }

    bank = question_banks.get(concept.name, question_banks["Arithmetic"])

    # Shuffle options while keeping correct answer tracked
    import random
    selected = random.sample(bank, min(5, len(bank)))
    result = []
    for i, q in enumerate(selected):
        opts = q["options"][:]
        correct_text = opts[q["answer"]]
        random.shuffle(opts)
        result.append({
            "id": i + 1,
            "question": q["q"],
            "options": opts,
            "correct_index": opts.index(correct_text),
        })
    return result


def _generate_feedback(score: float, mastery: float) -> str:
    if score >= 0.9:
        return "🌟 Excellent! Your twin's knowledge state has been significantly updated."
    elif score >= 0.7:
        return "👍 Good work! Keep reviewing to reinforce retention."
    elif score >= 0.5:
        return "📚 Decent attempt. Your twin predicts you need more practice."
    else:
        return "⚠️ Your twin detects knowledge gaps. Reviewing prerequisite concepts is recommended."


def _sim_recommendation(projected_score: int, current_mastery: float) -> str:
    if projected_score >= 85:
        return "🎯 At this study rate, you're on track to master this concept. Keep it up!"
    elif projected_score >= 70:
        return "📈 Good progress expected. Consider increasing study time slightly for faster mastery."
    else:
        return "⚠️ Your twin predicts you'll still struggle. Consider studying more or requesting help."
