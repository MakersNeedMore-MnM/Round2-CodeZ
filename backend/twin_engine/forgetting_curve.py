import math
from datetime import datetime, timedelta
from typing import Dict


def compute_retrievability(stability: float, days_since_review: float) -> float:
    """Ebbinghaus forgetting curve: R = e^(-t/S)"""
    if stability <= 0:
        return 0.0
    return math.exp(-days_since_review / stability)


def update_stability(old_stability: float, retrievability: float, grade: float) -> float:
    """
    SM-2 inspired stability update.
    grade: 0.0 (forgot) to 1.0 (perfect recall)
    """
    if grade < 0.6:
        # Failed — reset stability
        return max(0.5, old_stability * 0.3)
    else:
        # Passed — increase stability
        factor = 1 + (grade - 0.6) * 2.5
        return old_stability * factor


def get_next_review_date(stability: float, target_retention: float = 0.80) -> int:
    """
    Returns days until next review to maintain target retention.
    R_target = e^(-t/S) => t = -S * ln(R_target)
    """
    if stability <= 0:
        return 1
    days = -stability * math.log(target_retention)
    return max(1, int(days))


def compute_concept_risk(
    mastery: float,
    retrievability: float,
    days_since_review: int,
    upcoming_reviews: int = 0
) -> float:
    """
    Computes risk score 0-1 for a concept.
    High mastery + high retention = low risk
    """
    mastery_risk = 1.0 - mastery
    retention_risk = 1.0 - retrievability
    staleness_risk = min(1.0, days_since_review / 30.0)
    risk = (mastery_risk * 0.4 + retention_risk * 0.4 + staleness_risk * 0.2)
    # Review sessions reduce risk
    risk = max(0.0, risk - upcoming_reviews * 0.05)
    return round(min(1.0, risk), 3)


def predict_days_to_master(mastery: float, pace: float, difficulty: float) -> int:
    """
    Rough estimate of days to reach >0.85 mastery.
    """
    if mastery >= 0.85:
        return 0
    gap = 0.85 - mastery
    daily_gain = pace * (1.0 - difficulty * 0.5) * 0.05
    if daily_gain <= 0:
        return 999
    return max(1, int(gap / daily_gain))


def build_retention_curve(
    stability: float,
    last_review: datetime,
    days: int = 30
) -> list:
    """Returns daily retrievability values for charting."""
    curve = []
    for d in range(days + 1):
        days_elapsed = (datetime.utcnow() - last_review).days + d
        r = compute_retrievability(stability, max(0, days_elapsed))
        curve.append({"day": d, "retention": round(r * 100, 1)})
    return curve


def simulate_study_impact(
    mastery: float,
    stability: float,
    minutes_per_day: float,
    days: int,
    difficulty: float = 0.5
) -> dict:
    """
    Simulates what happens if student studies X minutes/day for Y days.
    Returns projected mastery, retention, and score.
    """
    # Effective daily learning gain
    efficiency = min(1.0, minutes_per_day / 45.0)  # 45min = optimal session
    daily_gain = efficiency * (1.0 - difficulty * 0.4) * 0.04

    sim_mastery = mastery
    sim_stability = stability
    trajectory = []

    for d in range(days + 1):
        retrievability = compute_retrievability(sim_stability, d)
        trajectory.append({
            "day": d,
            "mastery": round(sim_mastery * 100, 1),
            "retention": round(retrievability * 100, 1),
        })
        # Daily review + gain
        sim_mastery = min(1.0, sim_mastery + daily_gain * retrievability)
        sim_stability = update_stability(sim_stability, retrievability, min(1.0, sim_mastery))

    projected_score = int(sim_mastery * 100)
    return {
        "projected_score": projected_score,
        "projected_mastery": round(sim_mastery * 100, 1),
        "projected_retention": round(compute_retrievability(sim_stability, 0) * 100, 1),
        "trajectory": trajectory,
    }
