import { Rule } from "../models/Rule.js";
import { callLlama } from "../bedrock.js";

class RuleStorageAgent {
  async store(ruleJson) {
    try {
      const existingRule = await Rule.findOne({
        lender: ruleJson.lender,
        criteria: ruleJson.criteria,
      });
      if (existingRule) {
        console.log("🚫 Rule already exists in MongoDB.");
        return {
          success: false,
          message: "Rule already exists for this lender.",
        };
      }

      const prompt = `
        You are a rule storage manager.
        Check if this rule contradicts existing rules in the database.
        
        ## Rule to Validate:
        ${JSON.stringify(ruleJson)}

        If contradiction is found, return:
        {
          "success": false,
          "message": "New rule contradicts existing rules: {conflicts}"
        }

        If no contradiction, return:
        {
          "success": true
        }
      `;

      const validationResult = await callLlama(prompt);
      const validation = JSON.parse(validationResult);

      if (!validation.success) {
        console.log("⚠️ Rule contradicts existing rules.");
        return validation;
      }

      const rule = new Rule(ruleJson);
      await rule.save();
      console.log("✅ Rule stored in MongoDB.");
      return { success: true, message: "Rule saved successfully." };
    } catch (error) {
      console.error("❌ Error saving rule:", error);
      return { success: false, message: "Error storing rule." };
    }
  }
}

export const ruleStorageAgent = new RuleStorageAgent();
