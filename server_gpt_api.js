require("dotenv").config();
const express = require("express");
const { OpenAI } = require("openai");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Define Mongoose Schema
const RuleSchema = new mongoose.Schema({
  structured_rule: String,
  created_at: { type: Date, default: Date.now },
});
const Rule = mongoose.model("Rule", RuleSchema);

// ✅ Fetch Stored Rules from MongoDB
async function getStoredRules() {
  try {
    const rules = await Rule.find();
    return rules.map((rule) => JSON.parse(rule.structured_rule));
  } catch (error) {
    console.error("❌ Error fetching rules from MongoDB:", error);
    return [];
  }
}

// ✅ Process Rule API (GPT-4.5 Handles Everything)
app.post("/process-rule", async (req, res) => {
  try {
    const userInput = req.body.user_input;
    console.log(`📩 Received User Input: ${userInput}`);

    // ✅ Fetch stored rules from MongoDB for conflict checking
    const storedRules = await getStoredRules();

    // ✅ AI Prompt for Rule Processing
    const constraintPrompt = `
      Convert the following rule into structured JSON and enforce these constraints:
      - Allowed fields: credit_score, income, age, income_source.
      - Credit score must be between 600 and 900.
      - Age must be a positive number.
      - Income must be a positive number and must specify (monthly/yearly) and (individual/family).
      - Income source must be Salaried, Self Employed, or Others.
      - **Detect vague terms and request user clarification.**
      - **Check for conflicts with existing rules in MongoDB.**

      **Existing Rules in Database:**
      ${JSON.stringify(storedRules, null, 2)}

      If the new rule contradicts existing rules, provide a warning and suggest corrections.

      **User Input:** "${userInput}"
    `;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4.5-preview",
      messages: [{ role: "user", content: constraintPrompt }],
    });

    // ✅ Extract AI response
    let structuredRuleText = aiResponse.choices[0].message.content.trim();

    // ✅ Detect if AI returned text instead of JSON
    if (
      !structuredRuleText.startsWith("{") &&
      !structuredRuleText.includes("```json")
    ) {
      console.error("❌ AI Returned Text Instead of JSON");
      return res.status(400).json({
        error: "AI requires clarification before structuring the rule.",
        clarification_message: structuredRuleText,
      });
    }

    // ✅ Extract JSON part from AI response if wrapped in triple backticks
    const jsonMatch = structuredRuleText.match(/```json\s*([\s\S]*?)\s*```/);
    structuredRuleText = jsonMatch ? jsonMatch[1] : structuredRuleText;

    // ✅ Fix bad escape sequences
    structuredRuleText = structuredRuleText.replace(/\\(?!["\\/bfnrt])/g, ""); // Remove bad escapes
    structuredRuleText = structuredRuleText.replace(
      /"\s*:\s*"\s*([^"]*?)\s*"/g,
      '": "$1"'
    ); // Fix quotes
    structuredRuleText = structuredRuleText.replace(/\s*\\n\s*/g, " "); // Remove unexpected newlines

    // ✅ Remove trailing commas (invalid JSON)
    structuredRuleText = structuredRuleText
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");

    let structuredRule;
    try {
      structuredRule = JSON.parse(structuredRuleText);
    } catch (error) {
      console.error("❌ JSON Parsing Error:", error);
      console.log("🔍 Raw AI Response After Cleanup:", structuredRuleText);
      return res.status(500).json({ error: "Invalid JSON format from AI." });
    }

    console.log(
      `📜 AI Generated Rule: ${JSON.stringify(structuredRule, null, 2)}`
    );

    // ✅ Handle AI-Suggested Fixes
    if (structuredRule.errors) {
      console.log("❌ AI Found Issues:", structuredRule.errors);
      return res.status(400).json({ errors: structuredRule.errors });
    }

    // ✅ Save Rule to MongoDB
    const newRule = new Rule({
      structured_rule: JSON.stringify(structuredRule),
    });
    await newRule.save();
    console.log("✅ Rule saved successfully!");

    res.json({ structured_rule: structuredRule, valid: true });
  } catch (error) {
    console.error("❌ Error processing rule:", error);
    res.status(500).json({ error: "Failed to process rule" });
  }
});

// ✅ Fetch All Rules from MongoDB
app.get("/get-rules", async (req, res) => {
  try {
    const rules = await Rule.find(); // Fetch all rules from MongoDB
    res.status(200).json({ rules });
  } catch (error) {
    console.error("❌ Error fetching rules from DB:", error);
    res.status(500).json({ error: "Failed to retrieve rules." });
  }
});

// ✅ Check Loan Eligibility API
// ✅ Check Loan Eligibility API
app.post("/check-loan-eligibility", async (req, res) => {
  const user = req.body;

  if (!user) {
    return res.status(400).json({ error: "User details are required." });
  }

  console.log(`📩 Received User Details:`, user);

  try {
    // 🔹 Step 1: Fetch all rules from MongoDB
    const rules = await Rule.find();
    if (!rules.length) {
      return res.status(400).json({ error: "No rules found in the database." });
    }

    let matchedRule = null;

    // 🔹 Step 2: Check User Against Each Rule
    for (const rule of rules) {
      let ruleData = rule.structured_rule;

      // ✅ Fix: Parse `structured_rule` if it is stored as a string
      if (typeof ruleData === "string") {
        try {
          ruleData = JSON.parse(ruleData);
        } catch (err) {
          console.error("❌ Error parsing rule JSON:", err.message);
          continue;
        }
      }

      const conditions = ruleData.conditions;
      let isEligible = true;

      // 🔹 Step 3: Validate Each Condition
      for (const conditionField in conditions) {
        const condition = conditions[conditionField];

        // ✅ Handle Age Condition
        if (conditionField === "age") {
          if (condition.greater_than && user.age <= condition.greater_than) {
            isEligible = false;
          }
          if (
            condition.less_than_equal_to &&
            user.age > condition.less_than_equal_to
          ) {
            isEligible = false;
          }
        }

        // ✅ Handle Credit Score Condition
        if (conditionField === "credit_score") {
          if (condition.greater_than && user.score <= condition.greater_than) {
            isEligible = false;
          }
          if (condition.less_than && user.score >= condition.less_than) {
            isEligible = false;
          }
        }

        // ✅ Handle Income Source Condition
        if (conditionField === "income_source") {
          if (user.occupation.toLowerCase() !== condition.toLowerCase()) {
            isEligible = false;
          }
        }
      }

      // ✅ If user matches a rule, store it
      if (isEligible) {
        matchedRule = ruleData; // Store the parsed rule
        break;
      }
    }

    // 🔹 Step 4: Determine Loan Decision
    if (matchedRule) {
      console.log("✅ User Matched Rule:", matchedRule);
      return res.status(200).json({
        loan_status: matchedRule.action.loan_status,
        matched_rule: matchedRule,
      });
    } else {
      console.log("❌ No Matching Rule Found");
      return res.status(200).json({ loan_status: "Pending Review" });
    }
  } catch (error) {
    console.error("❌ Error processing loan eligibility:", error);
    res.status(500).json({ error: "Failed to check loan eligibility." });
  }
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
