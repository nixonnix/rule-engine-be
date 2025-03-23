import { callLlama } from "../bedrock.js";

class TestDataAgent {
  async test(rule) {
    const prompt = `
      You are a rule testing agent.

      Generate **test cases** based on this rule: ${rule}.

      Then, ask the user:
      - "Would you like to enter manual test data?" (yes/no)

      Return:
      {
        "testResults": ["Pass", "Pass", "Fail"],
        "askForManualTest": true/false
      }
    `;
    return await callLlama(prompt);
  }
}

export const testDataAgent = new TestDataAgent();
