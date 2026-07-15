// ============================================================
// api.js
// Handles communication between the frontend and Flask backend.
// ============================================================

const API_URL = "";

/**
 * Sends the family's meal planning information to the backend.
 *
 * @param {Object} mealRequest - The meal planning request object.
 * @returns {Promise<Object>} The JSON response from the backend.
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
            throw new Error(data.error || `Server Error: ${response.status}`);
        }

        return data;

    } catch (error) {

        console.error("Error requesting meal plan:", error);

        return {
            success: false,
            error: error.message || "Unable to connect to the backend."
        };

    }
}
