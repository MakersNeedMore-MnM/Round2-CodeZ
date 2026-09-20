from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from models.database import get_db, User, StudentTwin
from auth import verify_password, hash_password, create_access_token
from twin_engine import build_default_twin, refresh_twin

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    name: str
    role: str
    password: str


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id), "role": user.role, "name": user.name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    }


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=req.email,
        name=req.name,
        role=req.role,
        hashed_password=hash_password(req.password),
    )
    db.add(user)
    db.flush()

    if req.role == "student":
        twin_data = build_default_twin(user.id)
        twin_data = refresh_twin(twin_data)
        twin = StudentTwin(
            user_id=user.id,
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
    token = create_access_token({"sub": str(user.id), "role": user.role, "name": user.name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.name, "role": user.role},
    }
