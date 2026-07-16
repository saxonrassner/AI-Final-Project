"""
pricing.py
Loads the local grocery_prices.json price list and matches AI-generated
ingredient names against it, so MealSync AI can show real prices instead
of the model's guessed "low/medium/high" cost labels.
"""

import difflib
import json
import os
import re
from typing import Any, Optional

PRICE_FILE = os.path.join(os.path.dirname(__file__), "grocery_prices.json")

with open(PRICE_FILE, "r") as f:
    _PRICE_LIST = json.load(f)

# name.lower() -> {category, name, unit, price}
PRICE_LOOKUP: dict[str, dict[str, Any]] = {
    item["name"].lower(): item for item in _PRICE_LIST
}
PRICE_NAMES = list(PRICE_LOOKUP.keys())

# Matches a fraction/decimal at the start of a quantity string, e.g.
# "2 lbs", "1.5 cups", "1/2 tsp", "1 1/2 cups"
_LEADING_NUMBER_RE = re.compile(
    r"^\s*(\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
)


def _parse_leading_number(text: str) -> Optional[float]:
    match = _LEADING_NUMBER_RE.match(text)
    if not match:
        return None

    token = match.group(1)

    if " " in token:  # mixed number, e.g. "1 1/2"
        whole, frac = token.split(" ")
        num, denom = frac.split("/")
        return float(whole) + (float(num) / float(denom))

    if "/" in token:  # plain fraction, e.g. "1/2"
        num, denom = token.split("/")
        return float(num) / float(denom)

    return float(token)


def find_price_match(
    ingredient_name: str, cutoff: float = 0.5
) -> Optional[dict[str, Any]]:
    """Fuzzy-match an AI ingredient name to an entry in the price list."""

    if not ingredient_name:
        return None

    key = ingredient_name.strip().lower()

    # Exact match first.
    if key in PRICE_LOOKUP:
        return PRICE_LOOKUP[key]

    matches = difflib.get_close_matches(key, PRICE_NAMES, n=1, cutoff=cutoff)

    if matches:
        return PRICE_LOOKUP[matches[0]]

    return None


def estimate_line_price(
    ingredient_name: str, quantity_text: str
) -> dict[str, Any]:
    """
    Best-effort dollar estimate for one ingredient/grocery line.

    quantity_text is a free-form AI string like "2 lbs" or "1 bunch",
    so this multiplies the price-list unit price by any leading number
    it can parse and otherwise assumes a quantity of 1 unit.
    """

    match = find_price_match(ingredient_name)

    if not match:
        return {
            "matchedItem": None,
            "unitPrice": None,
            "unit": None,
            "lineTotal": None,
            "priceSource": "unmatched",
        }

    multiplier = _parse_leading_number(quantity_text or "") or 1.0
    line_total = round(match["price"] * multiplier, 2)

    return {
        "matchedItem": match["name"],
        "unitPrice": match["price"],
        "unit": match["unit"],
        "lineTotal": line_total,
        "priceSource": "local_price_list",
    }


def apply_pricing(meal_plan: dict[str, Any]) -> dict[str, Any]:
    """
    Walk the AI's meal_plan JSON and attach real prices from the local
    price list wherever an ingredient/grocery item name can be matched.
    Overwrites meal.estimatedCost and planSummary.estimatedBudget with
    real dollar figures computed from those matches.
    """

    grand_total = 0.0
    any_matches = False

    # --- Price each meal's ingredients, roll up into meal.estimatedCost ---
    for meal in meal_plan.get("meals", []):
        meal_total = 0.0
        meal_has_match = False

        for ingredient in meal.get("ingredients", []):
            priced = estimate_line_price(
                ingredient.get("name", ""), ingredient.get("quantity", "")
            )
            ingredient.update(priced)

            if priced["lineTotal"] is not None:
                meal_total += priced["lineTotal"]
                meal_has_match = True

        if meal_has_match:
            meal["estimatedCost"] = f"${meal_total:.2f}"
        else:
            meal["estimatedCost"] = "Price unavailable"

    # --- Price the grocery list, roll up into category + grand totals ---
    for category in meal_plan.get("groceryList", []):
        category_total = 0.0
        category_has_match = False

        for item in category.get("items", []):
            priced = estimate_line_price(
                item.get("name", ""), item.get("quantity", "")
            )
            item.update(priced)

            if priced["lineTotal"] is not None:
                category_total += priced["lineTotal"]
                category_has_match = True
                any_matches = True

        category["categoryTotal"] = (
            f"${category_total:.2f}" if category_has_match else "N/A"
        )
        grand_total += category_total

    meal_plan["groceryTotal"] = f"${grand_total:.2f}" if any_matches else "N/A"

    if "planSummary" in meal_plan and any_matches:
        meal_plan["planSummary"]["estimatedBudget"] = (
            f"${grand_total:.2f} (local price list)"
        )

    return meal_plan
