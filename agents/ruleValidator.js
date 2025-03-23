import { callLlama } from "../bedrock.js";

class RuleValidator {
  async validate(userInput) {
    console.log("🔄 Validating rule input...");

    const validationPrompt = `
      You are a **Rule Validation Agent** responsible for validating user-defined rules.  
      **ONLY RETURN JSON**.  

      **🚀 Strict Guidelines:**
      - **DO NOT** return explanations, comments, or Markdown.
      - **DO NOT** include unnecessary formatting like triple quotes.
      - **DO NOT** return Python-like pseudo-code.
      - **DO NOT** include phrases like "Here is the output."
      - **ONLY return JSON in the exact format below.**

      **🔹 Validation Rules:**
      1️⃣ **Credit Score Constraint:** Must be between **300 and 900**.
         - If \`score > 900\`, return an error.
         - If \`score < 300\`, return an error.
      2️⃣ **Age Constraint:** Must be between **0 and 100**.
         - If \`age < 0\`, return an error.
         - If \`age < 18\` and approval is requested, return an error.
      3️⃣ **Logical Consistency:**
         - No contradictory conditions (e.g., \`age < 18 and age > 60\` together).
      4️⃣ **Ensure all necessary fields are provided:**
         - If the lender name is **missing**, return an error.
         - If \`if-then\` conditions are incomplete, return an error.

      **User Rule Input:**  
      "${userInput}"

      **🔹 STRICT JSON RESPONSE FORMAT (DO NOT ADD ANY TEXT OUTSIDE JSON):**
      {
        "isValid": true | false,
        "issues": ["Credit score cannot exceed 900", "Age cannot be negative"],
        "suggestion": "Please provide a valid credit score (300-900) and a valid age (0-100)."
      }
    `;

    try {
      const rawResponse = await callLlama(validationPrompt);
      console.log("✅ Raw Llama 3 Validation Response:", rawResponse);

      // **Extract only JSON from the response using a stricter regex**
      const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        console.error("❌ Llama 3 response does not contain valid JSON.");
        return {
          response: "Validation failed. Could not extract JSON response.",
        };
      }

      const validationResponse = JSON.parse(jsonMatch[0]); // Extract pure JSON

      if (!validationResponse || typeof validationResponse !== "object") {
        return { response: "Validation failed. Please try again." };
      }

      if (!validationResponse.isValid) {
        return {
          response: `⚠️ Validation Issues:\n${validationResponse.issues.join(
            "\n"
          )}\n\n🔹 Suggestion: ${validationResponse.suggestion}`,
        };
      }

      return { response: "✅ Rule is valid. Proceeding to rule generation." };
    } catch (error) {
      console.error("❌ Rule Validation Error:", error);
      return { response: "Validation failed due to an error." };
    }
  }
}

export const ruleValidator = new RuleValidator();
