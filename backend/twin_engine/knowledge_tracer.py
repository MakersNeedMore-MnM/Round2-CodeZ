"""
Bayesian Knowledge Tracing (BKT) model.
Estimates probability that a student has mastered a concept
based on their response history.
"""
from typing import List


# Default BKT parameters (can be tuned per concept)
DEFAULT_PARAMS = {
    "p_init": 0.2,   # P(know) at start
    "p_learn": 0.15, # P(learn | not know)
    "p_slip": 0.1,   # P(wrong | know)
    "p_guess": 0.2,  # P(right | not know)
}


def update_knowledge(p_know: float, correct: bool, params: dict = None) -> float:
    """
    BKT update step.
    Returns updated P(know) after one observation.
    """
    p = params or DEFAULT_PARAMS
    p_slip = p["p_slip"]
    p_guess = p["p_guess"]
    p_learn = p["p_learn"]

    if correct:
        # Posterior: P(know | correct)
        p_right_know = 1.0 - p_slip
        p_right_not_know = p_guess
    else:
        # Posterior: P(know | wrong)
        p_right_know = p_slip
        p_right_not_know = 1.0 - p_guess

    numerator = p_right_know * p_know
    denominator = numerator + p_right_not_know * (1.0 - p_know)
    p_know_given_obs = numerator / denominator if denominator > 0 else p_know

    # Learning update
    p_know_next = p_know_given_obs + (1.0 - p_know_given_obs) * p_learn
    return min(1.0, max(0.0, p_know_next))


def trace_knowledge(response_history: List[bool], p_init: float = None, params: dict = None) -> float:
    """
    Runs BKT over a history of responses.
    Returns current mastery estimate.
    """
    p = params or DEFAULT_PARAMS
    p_know = p_init if p_init is not None else p["p_init"]

    for correct in response_history:
        p_know = update_knowledge(p_know, correct, p)
    return round(p_know, 4)


def mastery_level(p_know: float) -> str:
    """Human-readable mastery level."""
    if p_know >= 0.85:
        return "mastered"
    elif p_know >= 0.65:
        return "proficient"
    elif p_know >= 0.40:
        return "developing"
    elif p_know >= 0.20:
        return "emerging"
    else:
        return "novice"


def update_twin_mastery(knowledge_graph: dict, concept_id: str, responses: List[bool]) -> dict:
    """Updates knowledge graph for a concept after a quiz."""
    current = knowledge_graph.get(str(concept_id), DEFAULT_PARAMS["p_init"])
    updated = trace_knowledge(responses, p_init=current)
    knowledge_graph[str(concept_id)] = updated
    return knowledge_graph
