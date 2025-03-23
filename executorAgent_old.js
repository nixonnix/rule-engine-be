import { callLlama } from "./bedrock.js";
import { ruleValidator } from "./agents/ruleValidator.js";
import { ruleGenerator } from "./agents/ruleGenerator.js";
import { testDataAgent } from "./agents/testDataAgent.js";
import { ruleStorageAgent } from "./agents/ruleStorageAgent.js";
import { connectDB } from "./db.js";

// Connect to MongoDB
await connectDB();

class ExecutorAgent {
  constructor() {
    this.memory = []; // Stores conversation history
  }

  async execute(userInput) {
    console.log("🔄 Processing user input...");

    // Step 1: Ask Llama what to do next
    const prompt = `
      You are an AI-powered **Executor Agent** responsible for dynamically routing tasks to sub-agents.
      Analyze the user's input and determine the next best step.

      ## User Input:
      ${userInput}

      ## Conversation History:
      ${JSON.stringify(this.memory)}

      ### Decision-Making Instructions:
      - If user input is **missing details** (e.g., 'income = 50000' but no unit), ask the user for clarification.
      - If the input is **complete but needs validation**, pass control to the **Rule Validator Agent**.
      - If validation is **successful**, move to the **Rule Generator Agent**.
      - If rule generation is **complete**, move to the **Test Data Agent**.
      - If testing is **successful**, ask if the user wants to save the rule.
      - If the user **agrees to save**, pass control to the **Rule Storage Agent**.
      - If there is a **conflict in storage**, return the reason and ask the user if they want to modify the rule.

      ### Response Format:
      {
        "nextStep": "validator" | "generator" | "test" | "storage" | "askUser",
        "message": "Ask user about missing income unit" | "Proceed to rule validation"
      }
    `;

    // Get decision from Llama 3
    const decision = await callLlama(prompt);
    console.log("🤖 Decision from Executor Llama:", decision);

    this.memory.push({ step: "Decision", response: decision });

    // Parse Llama's JSON response
    const decisionData = JSON.parse(decision);

    if (decisionData.nextStep === "askUser") {
      return decisionData.message; // Ask user for clarification
    }

    // Step 2: Call the next agent based on decision
    if (decisionData.nextStep === "validator") {
      console.log("✅ Passing input to Rule Validator Agent...");
      return await ruleValidator.validate(userInput);
    }

    if (decisionData.nextStep === "generator") {
      console.log("📝 Generating Rule...");
      return await ruleGenerator.generate(userInput);
    }

    if (decisionData.nextStep === "test") {
      console.log("🔍 Running Test Data...");
      return await testDataAgent.test(userInput);
    }

    if (decisionData.nextStep === "storage") {
      console.log("💾 Storing Rule in MongoDB...");
      return await ruleStorageAgent.store(userInput);
    }

    return "No valid next step found.";
  }
}

export const executorAgent = new ExecutorAgent();
