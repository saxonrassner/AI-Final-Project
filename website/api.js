// api.js

const API_URL = "http://127.0.0.1:5000";

/**
 * Sends the family's meal planning information to the backend.
 * @param {Object} mealRequest - The object created by mealPlanner.js
 * @returns {Promise<Object>} The response from the backend
 */
async function requestMealPlan(mealRequest) {

    try {

        const response = await fetch(`${API_URL}/mealplan`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(mealRequest)

        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();

        return data;

    } catch (error) {

        console.error("Error requesting meal plan:", error);

        return {
            success: false,
            message: "Unable to connect to the server."
        };

    }

}
