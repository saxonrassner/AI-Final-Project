/* ============================================================
   MealSync AI — script.js
   ============================================================
   IMPORTANT: Set your Anthropic API key below. Since this key
   will be shipped to every visitor's browser, see the security
   note at the bottom of this file before you deploy.
   ============================================================ */

const ANTHROPIC_API_KEY = "API_URL"; // <-- put your key here
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
let members = [];

// ------------------------------------------------------------
// DOM references
// ------------------------------------------------------------
const nameInput = document.getElementById("name");
const dietSelect = document.getElementById("diet");
const allergiesInput = document.getElementById("allergies");
const preferencesInput = document.getElementById("preferences");
const addMemberBtn = document.getElementById("addMember");
const memberListEl = document.getElementById("memberList");

const budgetSelect = document.getElementById("budget");
const budgetAmountInput = document.getElementById("budgetAmount");

const generateBtn = document.getElementById("generateMealPlan");
const mealPlanEl = document.getElementById("mealPlan");
const groceryListEl = document.getElementById("groceryList");

// ------------------------------------------------------------
// Member management
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
        name,
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
    members = members.filter((m) => m.id !== id);
    renderMembers();
}

function renderMembers() {
    if (members.length === 0) {
        memberListEl.innerHTML = `<p class="empty">No members added yet.</p>`;
        return;
    }

    memberListEl.innerHTML = members
        .map(
            (m) => `
        <div class="member-card" data-id="${m.id}">
            <div class="member-info">
                <strong>${escapeHtml(m.name)}</strong>
                <span>Diet: ${escapeHtml(m.diet)}</span>
                <span>Allergies: ${escapeHtml(m.allergies)}</span>
                <span>Favorites: ${escapeHtml(m.preferences)}</span>
            </div>
            <button class="remove-member" data-id="${m.id}">✕</button>
        </div>
    `
        )
        .join("");

    document.querySelectorAll(".remove-member").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            const id = Number(e.currentTarget.getAttribute("data-id"));
            removeMember(id);
        });
    });
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ------------------------------------------------------------
// Meal plan generation
// ------------------------------------------------------------
async function generateMealPlan() {
    if (members.length === 0) {
        alert("Add at least one group member first.");
        return;
    }

    const budgetLevel = budgetSelect.value;
    const budgetAmount = budgetAmountInput.value.trim();

    setLoadingState(true);

    try {
        const prompt = buildPrompt(members, budgetLevel, budgetAmount);
        const response = await callClaude(prompt);
        const data = parseModelJson(response);
        renderMealPlan(data.mealPlan);
        renderGroceryList(data.groceryList);
    } catch (err) {
        console.error(err);
        mealPlanEl.innerHTML = `<p class="empty">Something went wrong generating your meal plan. Please try again.</p>`;
        groceryListEl.innerHTML = `<p class="empty">Grocery list will appear here.</p>`;
    } finally {
        setLoadingState(false);
    }
}

function buildPrompt(members, budgetLevel, budgetAmount) {
    const budgetText = budgetAmount
        ? `Target budget: approximately $${budgetAmount} per person for the week.`
        : budgetLevel
        ? `Budget level: ${budgetLevel}.`
        : "No specific budget constraint given.";

    const memberText = members
        .map(
            (m, i) =>
                `${i + 1}. ${m.name} — Diet: ${m.diet}; Allergies: ${m.allergies}; Favorite foods: ${m.preferences}`
        )
        .join("\n");

    return `You are a meal planning assistant. Create a 7-day meal plan (breakfast, lunch, dinner) for the following group of people, respecting each person's diet, allergies, and preferences. Where diets conflict, suggest shared meals that work for everyone when possible, and note substitutions when needed.

Group members:
${memberText}

${budgetText}

Respond with ONLY valid JSON (no markdown fences, no commentary) matching exactly this shape:

{
  "mealPlan": [
    {
      "day": "Monday",
      "breakfast": "string",
      "lunch": "string",
      "dinner": "string",
      "notes": "string (any substitutions or per-person notes, or empty string)"
    }
  ],
  "groceryList": [
    { "category": "Produce", "items": ["item 1", "item 2"] },
    { "category": "Proteins", "items": ["item 1"] }
  ]
}

Include all 7 days. Keep meal descriptions concise (under 12 words each).`;
}

async function callClaude(prompt) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
            model: ANTHROPIC_MODEL,
            max_tokens: 4000,
            messages: [{ role: "user", content: prompt }]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API request failed: ${res.status} ${errText}`);
    }

    const data = await res.json();
    return data.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .filter(Boolean)
        .join("\n");
}

function parseModelJson(text) {
    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
}

// ------------------------------------------------------------
// Rendering results
// ------------------------------------------------------------
function renderMealPlan(mealPlan) {
    if (!mealPlan || mealPlan.length === 0) {
        mealPlanEl.innerHTML = `<p class="empty">No meal plan generated.</p>`;
        return;
    }

    mealPlanEl.innerHTML = mealPlan
        .map(
            (day) => `
        <div class="day-card">
            <h3>${escapeHtml(day.day)}</h3>
            <ul>
                <li><strong>Breakfast:</strong> ${escapeHtml(day.breakfast)}</li>
                <li><strong>Lunch:</strong> ${escapeHtml(day.lunch)}</li>
                <li><strong>Dinner:</strong> ${escapeHtml(day.dinner)}</li>
            </ul>
            ${day.notes ? `<p class="day-notes">${escapeHtml(day.notes)}</p>` : ""}
        </div>
    `
        )
        .join("");
}

function renderGroceryList(groceryList) {
    if (!groceryList || groceryList.length === 0) {
        groceryListEl.innerHTML = `<p class="empty">No grocery list generated.</p>`;
        return;
    }

    groceryListEl.innerHTML = groceryList
        .map(
            (cat) => `
        <div class="grocery-category">
            <h3>${escapeHtml(cat.category)}</h3>
            <ul>
                ${cat.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
        </div>
    `
        )
        .join("");
}

function setLoadingState(isLoading) {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? "Generating..." : "Generate Meal Plan";

    if (isLoading) {
        mealPlanEl.innerHTML = `<p class="empty">Generating your meal plan...</p>`;
        groceryListEl.innerHTML = `<p class="empty">Generating your grocery list...</p>`;
    }
}

// ------------------------------------------------------------
// Event listeners
// ------------------------------------------------------------
addMemberBtn.addEventListener("click", addMember);
generateBtn.addEventListener("click", generateMealPlan);

/* ============================================================
   SECURITY NOTE
   ============================================================
   Putting ANTHROPIC_API_KEY directly in this client-side file
   means anyone who opens the page can view your key (e.g. via
   browser dev tools) and use it at your expense. This is fine
   for a private/local prototype, but for anything public-facing
   the safer pattern is to proxy requests through a small backend
   (serverless function, etc.) that holds the key server-side and
   the browser calls instead. Keeping it here as requested — just
   flagging it so it's a deliberate choice.
   ============================================================ */
