import { callLlama } from "../bedrock.js";

class RuleGenerator {
  async generate(query) {
    const prompt = `
      You are a structured rule generator for lending policies. 

      Rules **must include the lender name**.

      ## Example Format:
      {
        "lender": "AXIS",
        "criteria": {
          "age": { "min": 25, "max": 55 },
          "salary": { "min": 50000, "unit": "INR/month" },
          "cibilScore": { "min": 750 }
        }
      }

      Now generate a structured rule for: "${query}"
    `;
    return await callLlama(prompt);
  }
}

export const ruleGenerator = new RuleGenerator();
