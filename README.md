# TwinLearn

TwinLearn is an AI-powered digital twin learning platform that creates a living model of a student to track knowledge state, forgetting patterns, learning progress, and learning behavior.

## Features

* Student digital twin with knowledge and learning state
* Knowledge mastery tracking
* Forgetting curve and retention analysis
* Concept risk calculation
* Predicted days to mastery
* Personalized concept recommendations
* Learning path based on prerequisites
* Study impact simulation
* Quiz sessions and learning events
* Student, teacher, parent, and admin roles
* User authentication and registration
* Dashboard for different user roles
* Demo accounts with predefined student profiles

## Project Structure

```text
TwinLearn/
├── backend/
│   ├── auth.py
│   ├── main.py
│   ├── data/
│   │   └── seeder.py
│   ├── models/
│   │   ├── database.py
│   │   └── __init__.py
│   ├── routers/
│   │   ├── admin_router.py
│   │   ├── auth_router.py
│   │   ├── parent_router.py
│   │   ├── student_router.py
│   │   ├── teacher_router.py
│   │   └── __init__.py
│   └── twin_engine/
│       ├── forgetting_curve.py
│       ├── knowledge_tracer.py
│       ├── recommendation_engine.py
│       ├── twin_engine.py
│       └── __init__.py
├── frontend/
│   ├── static/
│   │   ├── css/
│   │   │   └── app.css
│   │   └── js/
│   │       └── app.js
│   └── templates/
│       └── index.html
└── twinlearn.db
```

## Backend

The backend is built with FastAPI and provides the API, authentication, database operations, role-based routers, and learning engine.

The main backend components are:

* `auth.py` handles password hashing, password verification, and access tokens.
* `main.py` creates the FastAPI application and registers the application routers.
* `models/database.py` defines the database models and SQLite database connection.
* `routers/` contains separate API routes for authentication, students, teachers, parents, and admins.
* `twin_engine/` contains the digital twin, knowledge tracing, forgetting curve, and recommendation logic.
* `data/seeder.py` creates the concepts, demo users, and student twin data.

## Digital Twin

The student twin stores information including:

* Knowledge mastery for concepts
* Forgetting parameters
* Learning style
* Confidence score
* Learning pace
* Attention span
* Motivation trend
* Concept risk scores
* Predicted mastery
* Overall learning risk

## Learning Engine

The learning engine includes:

### Knowledge Tracer

Tracks and updates the student's knowledge state based on learning activity.

### Forgetting Curve

Calculates retrievability and models how retention changes over time.

### Recommendation Engine

Ranks concepts based on mastery, risk, prerequisites, difficulty, and learning pace to generate recommended learning concepts.

### Study Impact Simulation

Simulates the effect of studying for a selected number of minutes per day over a selected number of days and provides projected mastery, retention, and score.

## Frontend

The frontend provides the user interface for the TwinLearn application.

It includes:

* Landing page
* Login and registration
* Student dashboard
* Teacher dashboard
* Parent dashboard
* Admin dashboard
* Learning recommendations
* Quiz functionality
* Learning progress
* Study simulation

## Database

TwinLearn uses SQLite for data storage.

The database contains information for:

* Users
* Student twins
* Concepts
* Quiz sessions
* Learning events

## Demo Accounts

All demo accounts use the password `demo123`.

| Role    | Email                                       |
| ------- | ------------------------------------------- |
| Student | [alex@demo.com](mailto:alex@demo.com)       |
| Student | [priya@demo.com](mailto:priya@demo.com)     |
| Student | [james@demo.com](mailto:james@demo.com)     |
| Teacher | [ms.chen@demo.com](mailto:ms.chen@demo.com) |
| Parent  | [parent@demo.com](mailto:parent@demo.com)   |
| Admin   | [admin@demo.com](mailto:admin@demo.com)     |

The three student accounts contain different predefined learning profiles.

## Running the Project

Open a terminal in the `TwinLearn/backend` directory and start the FastAPI application.

```bash
uvicorn main:app --reload
```

The application runs at:

```text
http://localhost:8000
```

The API health endpoint is:

```text
http://localhost:8000/api/health
```

The frontend is served by the FastAPI application.

## Seeding Demo Data

To reset and populate the database with the predefined concepts, users, and student profiles, run:

```bash
python data/seeder.py
```

This clears the existing learning data and creates the demo data again.
