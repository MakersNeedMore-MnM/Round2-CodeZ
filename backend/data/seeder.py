"""
Seeder — generates synthetic demo data for all user personas.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from auth import hash_password
from models.database import SessionLocal, create_tables, User, StudentTwin, Concept, QuizSession, LearningEvent
from twin_engine import build_default_twin, refresh_twin
from twin_engine.recommendation_engine import CURRICULUM_GRAPH


def seed():
    create_tables()
    db = SessionLocal()

    # Clear existing data
    db.query(LearningEvent).delete()
    db.query(QuizSession).delete()
    db.query(StudentTwin).delete()
    db.query(Concept).delete()
    db.query(User).delete()
    db.commit()

    # --- Seed Concepts ---
    for c in CURRICULUM_GRAPH:
        concept = Concept(
            id=c["id"],
            name=c["name"],
            subject=c["subject"],
            difficulty=c["difficulty"],
            prerequisites=c["prerequisites"],
            description=c["description"],
            emoji=c["emoji"],
        )
        db.add(concept)
    db.commit()

    # --- Seed Users ---
    users_data = [
        # Students
        {"email": "alex@demo.com", "name": "Alex Rivera", "role": "student", "password": "demo123",
         "twin_profile": "struggling"},
        {"email": "priya@demo.com", "name": "Priya Sharma", "role": "student", "password": "demo123",
         "twin_profile": "visual_learner"},
        {"email": "james@demo.com", "name": "James Okafor", "role": "student", "password": "demo123",
         "twin_profile": "average"},
        # Teacher
        {"email": "ms.chen@demo.com", "name": "Ms. Linda Chen", "role": "teacher", "password": "demo123"},
        # Parent
        {"email": "parent@demo.com", "name": "Maria Rivera", "role": "parent", "password": "demo123"},
        # Admin
        {"email": "admin@demo.com", "name": "Admin User", "role": "admin", "password": "demo123"},
    ]

    created_users = {}
    for ud in users_data:
        user = User(
            email=ud["email"],
            name=ud["name"],
            role=ud["role"],
            hashed_password=hash_password(ud["password"]),
        )
        db.add(user)
        db.flush()
        created_users[ud["email"]] = (user.id, ud.get("twin_profile"))

    db.commit()

    # --- Seed Twins for students ---
    twin_profiles = {
        "struggling": {
            "knowledge_graph": {"1": 0.75, "2": 0.50, "3": 0.45, "4": 0.20, "5": 0.12, "6": 0.05, "7": 0.35, "8": 0.10},
            "forgetting_days": [0, 2, 5, 14, 21, 30, 7, 25],
            "stabilities": [8.0, 5.0, 4.0, 1.5, 1.0, 0.5, 3.0, 1.2],
            "learning_style": "kinesthetic",
            "confidence_score": 0.35,
            "pace_percentile": 0.38,
            "attention_span": 18,
            "motivation_trend": -0.3,
        },
        "visual_learner": {
            "knowledge_graph": {"1": 0.95, "2": 0.88, "3": 0.82, "4": 0.70, "5": 0.60, "6": 0.30, "7": 0.75, "8": 0.55},
            "forgetting_days": [0, 1, 0, 3, 5, 12, 2, 6],
            "stabilities": [15.0, 12.0, 11.0, 9.0, 7.0, 4.0, 10.0, 8.0],
            "learning_style": "visual",
            "confidence_score": 0.78,
            "pace_percentile": 0.72,
            "attention_span": 35,
            "motivation_trend": 0.4,
        },
        "average": {
            "knowledge_graph": {"1": 0.85, "2": 0.70, "3": 0.65, "4": 0.48, "5": 0.35, "6": 0.10, "7": 0.55, "8": 0.30},
            "forgetting_days": [0, 1, 3, 8, 10, 20, 5, 12],
            "stabilities": [12.0, 8.0, 7.0, 5.0, 3.5, 1.0, 6.0, 4.0],
            "learning_style": "reading",
            "confidence_score": 0.55,
            "pace_percentile": 0.55,
            "attention_span": 25,
            "motivation_trend": 0.1,
        },
    }

    for email, (user_id, profile_key) in created_users.items():
        if profile_key is None:
            continue

        profile = twin_profiles[profile_key]
        twin_data = build_default_twin(user_id)

        # Apply profile
        twin_data["knowledge_graph"] = profile["knowledge_graph"]
        twin_data["learning_style"] = profile["learning_style"]
        twin_data["confidence_score"] = profile["confidence_score"]
        twin_data["pace_percentile"] = profile["pace_percentile"]
        twin_data["attention_span"] = profile["attention_span"]
        twin_data["motivation_trend"] = profile["motivation_trend"]

        # Set forgetting params
        for i, concept in enumerate(CURRICULUM_GRAPH):
            cid = str(concept["id"])
            days_ago = profile["forgetting_days"][i] if i < len(profile["forgetting_days"]) else 7
            stability = profile["stabilities"][i] if i < len(profile["stabilities"]) else 3.0
            twin_data["forgetting_params"][cid] = {
                "stability": stability,
                "last_review": (datetime.utcnow() - timedelta(days=days_ago)).isoformat(),
            }

        # Refresh computed fields
        twin_data = refresh_twin(twin_data)

        twin = StudentTwin(
            user_id=user_id,
            knowledge_graph=twin_data["knowledge_graph"],
            forgetting_params=twin_data["forgetting_params"],
            learning_style=twin_data["learning_style"],
            confidence_score=twin_data["confidence_score"],
            pace_percentile=twin_data["pace_percentile"],
            attention_span=twin_data["attention_span"],
            motivation_trend=twin_data["motivation_trend"],
            risk_scores=twin_data["risk_scores"],
            predicted_mastery=twin_data["predicted_mastery"],
            overall_risk=twin_data["overall_risk"],
        )
        db.add(twin)

    db.commit()
    db.close()
    print("[OK] Database seeded successfully!")
    print("Demo accounts:")
    print("  alex@demo.com / demo123    (student — high risk)")
    print("  priya@demo.com / demo123   (student — high performer)")
    print("  james@demo.com / demo123   (student — average)")
    print("  ms.chen@demo.com / demo123 (teacher)")
    print("  parent@demo.com / demo123  (parent)")
    print("  admin@demo.com / demo123   (admin)")


if __name__ == "__main__":
    seed()
