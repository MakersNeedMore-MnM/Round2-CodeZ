"""
Recommendation Engine — Next-Best-Concept ranking.
Considers mastery, risk, prerequisites, and learning path progression.
"""
from typing import List, Dict, Optional


CURRICULUM_GRAPH = [
    {"id": 1, "name": "Arithmetic",    "subject": "Mathematics", "difficulty": 0.15, "prerequisites": [],  "emoji": "🔢", "description": "Basic number operations"},
    {"id": 2, "name": "Algebra",       "subject": "Mathematics", "difficulty": 0.30, "prerequisites": [1], "emoji": "🔡", "description": "Variables and equations"},
    {"id": 3, "name": "Geometry",      "subject": "Mathematics", "difficulty": 0.40, "prerequisites": [1], "emoji": "📐", "description": "Shapes and spatial reasoning"},
    {"id": 4, "name": "Trigonometry",  "subject": "Mathematics", "difficulty": 0.55, "prerequisites": [2, 3], "emoji": "📏", "description": "Angles and periodic functions"},
    {"id": 5, "name": "Calculus",      "subject": "Mathematics", "difficulty": 0.75, "prerequisites": [2, 4], "emoji": "∫", "description": "Limits, derivatives, and integrals"},
    {"id": 6, "name": "Integration",   "subject": "Mathematics", "difficulty": 0.85, "prerequisites": [5], "emoji": "∬", "description": "Advanced integral techniques"},
    {"id": 7, "name": "Statistics",    "subject": "Mathematics", "difficulty": 0.50, "prerequisites": [2], "emoji": "📊", "description": "Data analysis and probability"},
    {"id": 8, "name": "Linear Algebra","subject": "Mathematics", "difficulty": 0.65, "prerequisites": [2], "emoji": "🔷", "description": "Vectors and matrices"},
]


def prerequisites_met(concept: dict, knowledge_graph: dict, threshold: float = 0.60) -> bool:
    """Check if student has sufficient mastery of prerequisites."""
    for prereq_id in concept["prerequisites"]:
        mastery = knowledge_graph.get(str(prereq_id), 0.0)
        if mastery < threshold:
            return False
    return True


def score_concept_for_recommendation(
    concept: dict,
    knowledge_graph: dict,
    risk_scores: dict,
    pace: float,
) -> float:
    """
    Scores a concept for recommendation priority.
    Higher score = recommend sooner.
    """
    concept_id = str(concept["id"])
    mastery = knowledge_graph.get(concept_id, 0.0)
    risk = risk_scores.get(concept_id, 0.0)

    # Already mastered — lower priority
    if mastery >= 0.90:
        return -1.0

    # Prerequisites not met — not eligible yet
    if not prerequisites_met(concept, knowledge_graph):
        return -2.0

    # Score: high risk + medium mastery = urgent
    urgency = risk * 0.5 + (1.0 - mastery) * 0.3 + concept["difficulty"] * pace * 0.2
    return round(urgency, 4)


def get_recommendations(
    knowledge_graph: dict,
    risk_scores: dict,
    pace: float = 0.5,
    top_k: int = 5
) -> List[dict]:
    """Returns top-k recommended concepts with reasons."""
    scored = []
    for concept in CURRICULUM_GRAPH:
        score = score_concept_for_recommendation(concept, knowledge_graph, risk_scores, pace)
        mastery = knowledge_graph.get(str(concept["id"]), 0.0)
        risk = risk_scores.get(str(concept["id"]), 0.0)
        if score > -1.0:
            reason = _generate_reason(mastery, risk, concept)
            scored.append({
                **concept,
                "mastery": round(mastery * 100, 1),
                "risk": round(risk * 100, 1),
                "priority_score": score,
                "reason": reason,
                "mastery_level": _mastery_label(mastery),
                "eligible": prerequisites_met(concept, knowledge_graph),
            })

    scored.sort(key=lambda x: x["priority_score"], reverse=True)
    return scored[:top_k]


def _generate_reason(mastery: float, risk: float, concept: dict) -> str:
    if risk > 0.7:
        return f"⚠️ High risk of falling behind in {concept['name']} — immediate practice needed"
    elif risk > 0.45:
        return f"📉 Retention is declining in {concept['name']} — review soon"
    elif mastery < 0.40:
        return f"🌱 Building foundational skills in {concept['name']}"
    elif mastery < 0.75:
        return f"📈 Progress in {concept['name']} — you're getting closer to mastery"
    else:
        return f"✨ Nearly mastered {concept['name']} — one more review to lock it in"


def _mastery_label(mastery: float) -> str:
    if mastery >= 0.85: return "Mastered"
    elif mastery >= 0.65: return "Proficient"
    elif mastery >= 0.40: return "Developing"
    elif mastery >= 0.20: return "Emerging"
    else: return "Novice"


def get_learning_path(knowledge_graph: dict) -> List[dict]:
    """Returns ordered learning path showing progress through curriculum."""
    path = []
    for concept in CURRICULUM_GRAPH:
        cid = str(concept["id"])
        mastery = knowledge_graph.get(cid, 0.0)
        prereqs_done = all(knowledge_graph.get(str(p), 0.0) >= 0.60 for p in concept["prerequisites"])
        path.append({
            **concept,
            "mastery": round(mastery * 100, 1),
            "mastery_level": _mastery_label(mastery),
            "unlocked": len(concept["prerequisites"]) == 0 or prereqs_done,
            "completed": mastery >= 0.85,
        })
    return path
