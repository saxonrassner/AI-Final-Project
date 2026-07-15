// ============================================================
// MealSync AI
// script.js
// Frontend logic only.
// AI requests are handled by api.js -> Flask backend.
// ============================================================

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
let members = [];

// ------------------------------------------------------------
// DOM References
// ------------------------------------------------------------
const nameInput = document.getElementById("name");
const dietSelect = document.getElementById("diet");
const allergiesInput = document.getElementById("allergies");
const preferencesInput = document.getElementById("preferences");

const addMemberBtn = document.getElementById("addMember");
const memberListEl = document.getElementById("memberList");

const budgetAmountInput = document.getElementById("budgetAmount");

const generateBtn = document.getElementById("generateMealPlan");

const mealPlanEl = document.getElementById("mealPlan");
const groceryListEl = document.getElementById("groceryList");
const breakfastInput = document.getElementById("breakfast");
const lunchInput = document.getElementById("lunch");
const dinnerInput = document.getElementById("dinner");

// ------------------------------------------------------------
// Member Management
// ------------------------------------------------------------
function addMember() {

    const name = nameInput.value.trim();
    const diet = dietSelect.value;
    const allergies = allergiesInput.value.trim();
    const preferences = preferencesInput.value.trim();

    if (!name) {
        alert("Please enter a name.");
        return;
    }

    members.push({
        id: Date.now(),
        name: name,
        diet: diet || "None",
        allergies: allergies || "None",
        preferences: preferences || "None"
    });

    nameInput.value = "";
    dietSelect.value = "";
    allergiesInput.value = "";
    preferencesInput.value = "";

    renderMembers();
}

function removeMember(id) {

    members = members.filter(member => member.id !== id);

    renderMembers();

}

function renderMembers() {

    if (members.length === 0) {

        memberListEl.innerHTML =
            `<p class="empty">No members added yet.</p>`;

        return;
    }

    memberListEl.innerHTML = members.map(member => `

        <div class="member-card">

            <div class="member-info">

                <strong>${escapeHtml(member.name)}</strong>

                <span>Diet: ${escapeHtml(member.diet)}</span>

                <span>Allergies: ${escapeHtml(member.allergies)}</span>

                <span>Favorites: ${escapeHtml(member.preferences)}</span>

            </div>

            <button
                class="remove-member"
                data-id="${member.id}">
                ✕
            </button>

        </div>

    `).join("");

    document.querySelectorAll(".remove-member").forEach(button => {

        button.addEventListener("click", function () {

            removeMember(Number(this.dataset.id));

        });

    });

}

// ------------------------------------------------------------
// Generate Meal Plan
// ------------------------------------------------------------
async function generateMealPlan() {

    if (members.length === 0) {

        alert("Please add at least one group member.");

        return;

    }

    setLoadingState(true);

    const mealRequest = {

        groupName: "My Group",

        participants: members,

        budget: {
          targetPerPerson: Number(budgetAmountInput.value) || null
        }

    };

    try {

        const response = await requestMealPlan(mealRequest);

        if (response.error) {
    throw new Error(
        response.details
            ? `${response.error}\n\n${JSON.stringify(response.details, null, 2)}`
            : response.error
    );
}

        renderMealPlan(response);

        renderGroceryList(response.groceryList);

    }

    catch (error) {

        console.error(error);

        mealPlanEl.innerHTML = `
            <p class="empty">
                ${escapeHtml(error.message)}
            </p>
        `;

        groceryListEl.innerHTML = `
            <p class="empty">
                Grocery list will appear here.
            </p>
        `;

    }

    finally {

        setLoadingState(false);

    }

}

// ------------------------------------------------------------
// Utility
// ------------------------------------------------------------
function escapeHtml(text) {

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}
// ------------------------------------------------------------
// Render Meal Plan
// ------------------------------------------------------------
function renderMealPlan(data) {

    if (!data.meals || data.meals.length === 0) {

        mealPlanEl.innerHTML =
            `<p class="empty">No meal plan generated.</p>`;

        return;

    }

    let html = "";

    // Optional summary
    if (data.planSummary) {

        html += `
            <div class="day-card">

                <h3>Plan Summary</h3>

                <p><strong>Participants:</strong> ${data.planSummary.totalParticipants}</p>

                <p><strong>Compatibility:</strong> ${data.planSummary.compatibilityScore}%</p>

                <p><strong>Shared Meals:</strong> ${data.planSummary.sharedMealPercentage}%</p>

                <p><strong>Estimated Budget:</strong> ${escapeHtml(data.planSummary.estimatedBudget)}</p>

            </div>
        `;

    }

    data.meals.forEach(meal => {

        html += `

            <div class="day-card">

                <h3>
                    Day ${meal.day} - ${escapeHtml(meal.mealType)}
                </h3>

                <p>
                    <strong>${escapeHtml(meal.name)}</strong>
                </p>

                <p>
                    ${escapeHtml(meal.description)}
                </p>

                <br>

                <p>
                    <strong>Prep Time:</strong>
                    ${meal.prepMinutes} minutes
                </p>

                <p>
                    <strong>Estimated Cost:</strong>
                    ${escapeHtml(meal.estimatedCost)}
                </p>

                <p>
                    <strong>Servings:</strong>
                    ${meal.servings}
                </p>

        `;

        if (meal.ingredients && meal.ingredients.length > 0) {

            html += "<h4>Ingredients</h4><ul>";

            meal.ingredients.forEach(item => {

                html += `
                    <li>
                        ${escapeHtml(item.quantity)}
                        ${escapeHtml(item.name)}
                    </li>
                `;

            });

            html += "</ul>";

        }

        if (meal.instructions && meal.instructions.length > 0) {

            html += "<h4>Instructions</h4><ol>";

            meal.instructions.forEach(step => {

                html += `
                    <li>${escapeHtml(step)}</li>
                `;

            });

            html += "</ol>";

        }

        if (meal.substitutions && meal.substitutions.length > 0) {

            html += "<h4>Substitutions</h4><ul>";

            meal.substitutions.forEach(sub => {

                html += `
                    <li>

                        <strong>${escapeHtml(sub.participantOrCategory)}</strong>:
                        Replace
                        ${escapeHtml(sub.originalIngredient)}
                        with
                        ${escapeHtml(sub.replacement)}

                    </li>
                `;

            });

            html += "</ul>";

        }

        html += "</div>";

    });

    mealPlanEl.innerHTML = html;

}

// ------------------------------------------------------------
// Render Grocery List
// ------------------------------------------------------------
function renderGroceryList(groceryList) {

    if (!groceryList || groceryList.length === 0) {

        groceryListEl.innerHTML =
            `<p class="empty">No grocery list generated.</p>`;

        return;

    }

    let html = "";

    groceryList.forEach(category => {

        html += `

            <div class="grocery-category">

                <h3>${escapeHtml(category.category)}</h3>

                <ul>

        `;

        category.items.forEach(item => {

            html += `

                <li>

                    ${escapeHtml(item.quantity)}
                    ${escapeHtml(item.name)}

                    ${item.substitutionOnly
                        ? " (Substitution Only)"
                        : ""}

                </li>

            `;

        });

        html += `
                </ul>
            </div>
        `;

    });

    groceryListEl.innerHTML = html;

}

// ------------------------------------------------------------
// Loading State
// ------------------------------------------------------------
function setLoadingState(isLoading) {

    generateBtn.disabled = isLoading;

    generateBtn.textContent = isLoading
        ? "Generating..."
        : "Generate Meal Plan";

    if (isLoading) {

        mealPlanEl.innerHTML = `
            <p class="empty">
                Generating your meal plan...
            </p>
        `;

        groceryListEl.innerHTML = `
            <p class="empty">
                Generating your grocery list...
            </p>
        `;

    }

}

// ------------------------------------------------------------
// Event Listeners
// ------------------------------------------------------------
addMemberBtn.addEventListener("click", addMember);

generateBtn.addEventListener("click", generateMealPlan);
