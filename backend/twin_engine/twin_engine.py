"""
Digital Twin Engine — core orchestrator.
Maintains and updates the digital twin state for each student.
"""
from datetime import datetime, timedelta
from typing import Dict, Any
from .knowledge_tracer import update_twin_mastery, mastery_level
from .forgetting_curve import (
    compute_retrievability, update_stability,
    compute_concept_risk, predict_days_to_master,
    simulate_study_impact, build_retention_curve
)
from .recommendation_engine import CURRICULUM_GRAPH, get_recommendations, get_learning_path


def build_default_twin(user_id: int) -> dict:
    """Creates initial twin state for a new student."""
    knowledge_graph = {}
    forgetting_params = {}
    risk_scores = {}
    predicted_mastery = {}

    for concept in CURRICULUM_GRAPH:
        cid = str(concept["id"])
        # Start with zero mastery
        knowledge_graph[cid] = 0.0
        forgetting_params[cid] = {
            "stability": 1.0,  # 1 day
            "last_review": (datetime.utcnow() - timedelta(days=7)).isoformat(),
        }
        risk_scores[cid] = 0.0
        predicted_mastery[cid] = {"days_to_master": 30, "projected_score": 0}

    return {
        "knowledge_graph": knowledge_graph,
        "forgetting_params": forgetting_params,
        "learning_style": "visual",
        "confidence_score": 0.5,
        "pace_percentile": 0.5,
        "attention_span": 25,
        "motivation_trend": 0.0,
        "risk_scores": risk_scores,
        "predicted_mastery": predicted_mastery,
        "overall_risk": "low",
    }


def refresh_twin(twin_data: dict) -> dict:
    """
    Recomputes all dynamic twin fields:
    - Retrievability (forgetting curves)
    - Risk scores
    - Predicted mastery dates
    - Overall risk level
    """
    knowledge_graph = twin_data["knowledge_graph"]
    forgetting_params = twin_data["forgetting_params"]
    pace = twin_data.get("pace_percentile", 0.5)
    risk_scores = {}
    predicted_mastery = {}

    for concept in CURRICULUM_GRAPH:
        cid = str(concept["id"])
        mastery = knowledge_graph.get(cid, 0.0)
        fp = forgetting_params.get(cid, {"stability": 1.0, "last_review": datetime.utcnow().isoformat()})

        last_review = datetime.fromisoformat(fp["last_review"])
        days_since = max(0, (datetime.utcnow() - last_review).days)
        stability = fp.get("stability", 1.0)
        retrievability = compute_retrievability(stability, days_since)

        risk = compute_concept_risk(mastery, retrievability, days_since)
        days_to_master = predict_days_to_master(mastery, pace, concept["difficulty"])
        proj_score = min(100, int(mastery * 100 + days_to_master * pace * 1.5))

        risk_scores[cid] = risk
        predicted_mastery[cid] = {
            "days_to_master": days_to_master,
            "projected_score": proj_score,
            "retrievability": round(retrievability * 100, 1),
        }

    # Overall risk
    high_risk = sum(1 for r in risk_scores.values() if r > 0.65)
    medium_risk = sum(1 for r in risk_scores.values() if 0.40 < r <= 0.65)

    if high_risk >= 3:
        overall_risk = "critical"
    elif high_risk >= 1:
        overall_risk = "high"
    elif medium_risk >= 2:
        overall_risk = "medium"
    else:
        overall_risk = "low"

    twin_data["risk_scores"] = risk_scores
    twin_data["predicted_mastery"] = predicted_mastery
    twin_data["overall_risk"] = overall_risk
    twin_data["last_updated"] = datetime.utcnow().isoformat()
    return twin_data


def process_quiz_result(twin_data: dict, concept_id: int, responses: list, time_taken: int) -> dict:
    """
    Updates twin after a quiz session.
    - Updates knowledge graph via BKT
    - Updates forgetting curve stability
    - Updates pace and confidence
    """
    cid = str(concept_id)
    correct_count = sum(responses)
    total = len(responses)
    grade = correct_count / total if total > 0 else 0.0

    # BKT update
    twin_data["knowledge_graph"] = update_twin_mastery(
        twin_data["knowledge_graph"], concept_id, responses
    )

    # Forgetting curve update
    fp = twin_data["forgetting_params"].get(cid, {"stability": 1.0})
    old_stability = fp.get("stability", 1.0)
    last_review_str = fp.get("last_review", datetime.utcnow().isoformat())
    last_review = datetime.fromisoformat(last_review_str)
    days_elapsed = max(0, (datetime.utcnow() - last_review).days)
    retrievability = compute_retrievability(old_stability, days_elapsed)

    new_stability = update_stability(old_stability, retrievability, grade)
    twin_data["forgetting_params"][cid] = {
        "stability": new_stability,
        "last_review": datetime.utcnow().isoformat(),
    }

    # Confidence update
    twin_data["confidence_score"] = round(
        twin_data.get("confidence_score", 0.5) * 0.7 + grade * 0.3, 3
    )

    # Pace: faster completion = higher pace
    expected_time = 120  # seconds per question
    actual_time_per_q = time_taken / total if total > 0 else expected_time
    pace_signal = min(1.0, expected_time / max(1, actual_time_per_q))
    twin_data["pace_percentile"] = round(
        twin_data.get("pace_percentile", 0.5) * 0.8 + pace_signal * 0.2, 3
    )

    # Motivation trend
    trend_delta = (grade - 0.5) * 0.1
    twin_data["motivation_trend"] = round(
        max(-1.0, min(1.0, twin_data.get("motivation_trend", 0.0) + trend_delta)), 3
    )

    # Refresh all computed fields
    return refresh_twin(twin_data)


def get_twin_summary(twin_data: dict, concept_id: int = 5) -> dict:
    """Returns a summary dict for the dashboard."""
    cid = str(concept_id)
    knowledge_graph = twin_data["knowledge_graph"]
    fp = twin_data["forgetting_params"]
    risk_scores = twin_data["risk_scores"]

    # Concept retention curve for Calculus (default)
    c_fp = fp.get(cid, {"stability": 7.0, "last_review": datetime.utcnow().isoformat()})
    retention_curve = build_retention_curve(
        stability=c_fp.get("stability", 7.0),
        last_review=datetime.fromisoformat(c_fp.get("last_review", datetime.utcnow().isoformat())),
        days=21
    )

    # Radar chart data (5 dimensions)
    mastery_vals = list(knowledge_graph.values())
    avg_mastery = sum(mastery_vals) / len(mastery_vals) if mastery_vals else 0

    radar = [
        {"dimension": "Knowledge", "value": round(avg_mastery * 100, 1)},
        {"dimension": "Confidence", "value": round(twin_data.get("confidence_score", 0.5) * 100, 1)},
        {"dimension": "Pace",       "value": round(twin_data.get("pace_percentile", 0.5) * 100, 1)},
        {"dimension": "Retention",  "value": round(sum(
            compute_retrievability(
                fp.get(cid, {}).get("stability", 1.0),
                max(0, (datetime.utcnow() - datetime.fromisoformat(
                    fp.get(cid, {}).get("last_review", datetime.utcnow().isoformat())
                )).days)
            ) for cid in knowledge_graph.keys()
        ) / max(1, len(knowledge_graph)) * 100, 1)},
        {"dimension": "Motivation", "value": round((twin_data.get("motivation_trend", 0.0) + 1) * 50, 1)},
    ]

    # Top risk alerts
    alerts = []
    for concept in CURRICULUM_GRAPH:
        ccid = str(concept["id"])
        risk = risk_scores.get(ccid, 0.0)
        pm = twin_data.get("predicted_mastery", {}).get(ccid, {})
        if risk > 0.50:
            severity = "critical" if risk > 0.75 else "high" if risk > 0.60 else "medium"
            days_to_master = pm.get("days_to_master", 30)
            alerts.append({
                "concept": concept["name"],
                "emoji": concept["emoji"],
                "risk": round(risk * 100, 1),
                "severity": severity,
                "message": f"Predicted to struggle in {days_to_master} days without reinforcement" if risk > 0.65
                           else f"Retention declining — review {concept['name']} soon",
            })
    alerts.sort(key=lambda x: x["risk"], reverse=True)

    return {
        "overall_risk": twin_data.get("overall_risk", "low"),
        "radar": radar,
        "alerts": alerts[:4],
        "retention_curve": retention_curve,
        "knowledge_graph": {
            str(c["id"]): {
                "name": c["name"],
                "emoji": c["emoji"],
                "mastery": round(knowledge_graph.get(str(c["id"]), 0.0) * 100, 1),
                "risk": round(risk_scores.get(str(c["id"]), 0.0) * 100, 1),
            }
            for c in CURRICULUM_GRAPH
        },
        "recommendations": get_recommendations(knowledge_graph, risk_scores, twin_data.get("pace_percentile", 0.5)),
        "learning_path": get_learning_path(knowledge_graph),
        "confidence": round(twin_data.get("confidence_score", 0.5) * 100, 1),
        "pace": round(twin_data.get("pace_percentile", 0.5) * 100, 1),
        "motivation": round((twin_data.get("motivation_trend", 0.0) + 1) * 50, 1),
    }
