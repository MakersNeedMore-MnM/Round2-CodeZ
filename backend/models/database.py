from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "twinlearn.db").replace("\\", "/")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    role = Column(String)  # student, teacher, parent, admin
    hashed_password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    twin = relationship("StudentTwin", back_populates="user", uselist=False)
    quiz_sessions = relationship("QuizSession", back_populates="user")
    learning_events = relationship("LearningEvent", back_populates="user")


class StudentTwin(Base):
    __tablename__ = "student_twins"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    knowledge_graph = Column(JSON)          # {concept_id: mastery_0_to_1}
    forgetting_params = Column(JSON)        # {concept_id: {stability, retrievability, last_review}}
    learning_style = Column(String)         # visual, auditory, reading, kinesthetic
    confidence_score = Column(Float, default=0.5)
    pace_percentile = Column(Float, default=0.5)
    attention_span = Column(Integer, default=25)  # minutes
    motivation_trend = Column(Float, default=0.0) # -1 to +1
    risk_scores = Column(JSON)              # {concept_id: risk_0_to_1}
    predicted_mastery = Column(JSON)        # {concept_id: {days_to_master, projected_score}}
    overall_risk = Column(String, default="low")  # low, medium, high, critical
    last_updated = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="twin")


class Concept(Base):
    __tablename__ = "concepts"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    subject = Column(String)
    difficulty = Column(Float)  # 0.0 - 1.0
    prerequisites = Column(JSON)  # [concept_id, ...]
    description = Column(Text)
    emoji = Column(String, default="📚")


class QuizSession(Base):
    __tablename__ = "quiz_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    concept_id = Column(Integer, ForeignKey("concepts.id"))
    questions_answered = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    time_taken_seconds = Column(Integer, default=0)
    score = Column(Float, default=0.0)
    completed_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="quiz_sessions")


class LearningEvent(Base):
    __tablename__ = "learning_events"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    event_type = Column(String)  # quiz_completed, concept_reviewed, session_start, session_end
    concept_id = Column(Integer, nullable=True)
    event_metadata = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="learning_events")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
