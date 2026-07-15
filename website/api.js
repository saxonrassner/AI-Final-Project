const API_URL = "http://127.0.0.1:5000";

/**
 * Sends group meal-planning information to the backend.
 * @param {Object} mealRequest - The object created by mealPlanner.js
 * @returns {Promise<Object>} The meal plan returned by the backend
 */
async function requestMealPlan(mealRequest) {
    try {
        const response = await fetch(`${API_URL}/generate-plan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(mealRequest)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data?.details ||
                data?.error ||
                `Server error: ${response.status}`
            );
        }

        return data;
    } catch (error) {
        console.error("Error requesting meal plan:", error);

        return {
            success: false,
            error: "Unable to generate the meal plan.",
            details: error.message
        };
    }
}
