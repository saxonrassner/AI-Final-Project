import json
import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
WEBSITE_DIR = BASE_DIR.parent / "website"

app = Flask(__name__, static_folder=str(WEBSITE_DIR))
CORS(app)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# You can change the model later in one place.
OPENROUTER_MODEL = os.getenv(
    "OPENROUTER_MODEL",
    "openai/gpt-4.1-mini",
)


def create_meal_plan_prompt(group_data: dict[str, Any]) -> str:
    """Create the prompt sent to the AI model."""

    return f"""
You are the optimization engine for MealSync AI.

MealSync AI creates shared meal plans for groups while respecting allergies,
dietary restrictions, preferences, budget, preparation time, and nutrition goals.

Your main goal is to maximize the number of people who can eat the same base meal.
Use substitutions or optional toppings only when necessary.

GROUP INFORMATION:
{json.dumps(group_data, indent=2)}

RULES:
1. Never include a confirmed allergen in a meal served to that participant.
2. Respect vegetarian, vegan, gluten-free, halal, kosher, and other required restrictions.
3. Maximize how many participants can share each base meal.
4. Prefer optional toppings or small substitutions over completely separate meals.
5. Reuse ingredients across meals to reduce cost and food waste.
6. Stay within the requested budget and preparation time.
7. Consider dislikes, favorite foods, cuisines, and nutrition goals.
8. Do not claim that a meal diagnoses, treats, prevents, or cures a medical condition.
9. Clearly explain any conflicts and how they were resolved.
10. Return JSON only. Do not use markdown or code fences.

Return exactly this JSON structure:

{{
  "planSummary": {{
    "groupName": "string",
    "totalParticipants": 0,
    "sharedMealPercentage": 0,
    "substitutionCount": 0,
    "compatibilityScore": 0,
    "estimatedBudget": "string",
    "ingredientReuseScore": 0
  }},
  "conflictSummary": {{
    "hardConstraints": ["string"],
    "softConstraints": ["string"],
    "resolvedConflicts": ["string"],
    "remainingChallenges": ["string"]
  }},
  "meals": [
    {{
      "day": 1,
      "mealType": "Dinner",
      "name": "string",
      "description": "string",
      "servings": 0,
      "prepMinutes": 0,
      "estimatedCost": "low",
      "compatibilityScore": 0,
      "sharedByCount": 0,
      "sharedByPercentage": 0,
      "dietaryLabels": ["string"],
      "ingredients": [
        {{
          "name": "string",
          "quantity": "string"
        }}
      ],
      "instructions": ["string"],
      "substitutions": [
        {{
          "participantOrCategory": "string",
          "originalIngredient": "string",
          "replacement": "string",
          "reason": "string"
        }}
      ],
      "selectionReason": ["string"]
    }}
  ],
  "groceryList": [
    {{
      "category": "Produce",
      "items": [
        {{
          "name": "string",
          "quantity": "string",
          "substitutionOnly": false
        }}
      ]
    }}
  ]
}}
""".strip()


def parse_model_json(content: str) -> dict[str, Any]:
    """Safely parse JSON returned by the model."""

    cleaned = content.strip()

    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "", 1)
        cleaned = cleaned.replace("```", "")
        cleaned = cleaned.strip()

    parsed = json.loads(cleaned)

    if not isinstance(parsed, dict):
        raise ValueError("AI response was not a JSON object.")

    return parsed


@app.get("/")
def home():
    return send_from_directory(WEBSITE_DIR, "index.html")


@app.get("/<path:filename>")
def website_files(filename):
    return send_from_directory(WEBSITE_DIR, filename)


@app.post("/generate-plan")
def generate_plan():
    """Receive group information and generate a meal plan."""

    if not OPENROUTER_API_KEY:
        return (
            jsonify(
                {
                    "error": "OPENROUTER_API_KEY is missing.",
                    "details": (
                        "Create backend/.env and add "
                        "OPENROUTER_API_KEY=your_key_here"
                    ),
                }
            ),
            500,
        )

    group_data = request.get_json(silent=True)

    if not group_data:
        return (
            jsonify(
                {
                    "error": "No group information was provided.",
                }
            ),
            400,
        )

    prompt = create_meal_plan_prompt(group_data)

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are a careful meal-planning optimization "
                            "assistant. Return valid JSON only."
                        ),
                    },
                    {
                        "role": "user",
                        "content": prompt,
                    },
                ],
                "response_format": {
                    "type": "json_object",
                },
                "temperature": 0.3,
            },
            timeout=90,
        )

        response.raise_for_status()
        response_data = response.json()

        content = response_data["choices"][0]["message"]["content"]
        meal_plan = parse_model_json(content)

        return jsonify(meal_plan)

    except requests.Timeout:
        return (
            jsonify(
                {
                    "error": "The AI request timed out. Please try again.",
                }
            ),
            504,
        )

    except requests.RequestException as exc:
        error_details = str(exc)

        if exc.response is not None:
            try:
                error_details = exc.response.json()
            except ValueError:
                error_details = exc.response.text

        return (
            jsonify(
                {
                    "error": "OpenRouter request failed.",
                    "details": error_details,
                }
            ),
            502,
        )

    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        return (
            jsonify(
                {
                    "error": "The AI returned an invalid response.",
                    "details": str(exc),
                }
            ),
            502,
        )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
