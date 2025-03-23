import { tool } from "@langchain/core/tools";
import { Rule } from "./db.js"; // Import Rule model

export const saveRuleTool = tool(
  async (input) => {
    console.log(
      "✅ In saveRuleTool - Received Input:",
      JSON.stringify(input, null, 2)
    );

    try {
      // ✅ Ensure correct field naming (`rules` instead of `rule_json`)
      if (!input || !input.lender || !input.rule) {
        console.error("❌ Missing or invalid rule JSON:", input);
        return "Error: Rule data is missing or incorrect.";
      }

      // Uncomment this if you want to actually save the rule in MongoDB
      const newRule = await Rule.create({
        lender: input.lender,
        rule_json: input.rule, // ✅ Use 'rule' as the correct field
        expression: input.expression, // Optional
      });

      console.log(
        `✅ Rule ${newRule} for lender ${input.lender} has been successfully saved.`
      );

      return `Rule for lender ${input.lender} has been successfully saved in the database.`;
    } catch (error) {
      console.error("❌ Error saving rule:", error);
      return "An error occurred while saving the rule. Please try again.";
    }
  },
  {
    name: "save_rule",
    description: "Saves a new lending rule in the MongoDB database.",
    schema: {
      lender: "name",
      rule: "object", // ✅ Changed from `rule_json` to `rules`
    },
  }
);
