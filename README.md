# TwinLearn

TwinLearn is a digital learning platform that creates a dynamic digital twin for students based on their learning activity. It tracks learning progress, mastery, confidence, pace, motivation, and risk to provide personalized learning recommendations and support for students, teachers, and parents.

## Problem Statement

Students have different learning patterns, levels of understanding, and learning speeds. Traditional learning systems mainly focus on scores and completed activities, making it difficult to identify learning gaps and predict when a student may struggle with a concept.

TwinLearn addresses this problem by maintaining a digital representation of a student's learning state and using learning data to track mastery, predict learning risks, recommend learning paths, and provide personalized support.

## Key Features

* Digital twin for each student that tracks mastery, confidence, learning pace, motivation, and risk
* Knowledge tracing to update student mastery based on quiz performance
* Forgetting curve to estimate concept retention and identify concepts that may require review
* Personalized learning recommendations and learning paths
* AI-adaptive quizzing based on the student's current mastery level
* Simulation mode for projecting learning outcomes based on study time and duration
* Predictive risk alerts for concepts where students may face difficulties
* Student dashboard for tracking learning progress
* Teacher dashboard for monitoring students and class-level risks
* Parent dashboard for viewing student progress
* Admin dashboard for managing users and viewing analytics
* Authentication and role-based access for students, teachers, parents, and administrators

## Tech Stack

### Backend

* Python
* FastAPI
* SQLAlchemy
* SQLite
* JWT Authentication
* Bcrypt

### Frontend

* HTML
* CSS
* JavaScript

## How to Run

### 1. Clone the repository

```bash
git clone <repository-url>
cd TwinLearn
```

### 2. Navigate to the backend

```bash
cd backend
```

### 3. Install the required packages

```bash
pip install fastapi uvicorn sqlalchemy python-jose passlib bcrypt
```

### 4. Start the application

```bash
uvicorn main:app --reload
```

### 5. Open the application

Open the following URL in your browser:

```text
http://localhost:8000
```

The application provides separate interfaces for students, teachers, parents, and administrators based on the user's role.

## Team Members

* Bharat
* Hitakshi
* Swastika
* Pallavi
