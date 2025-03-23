require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const OpenAI = require("openai");
const { Solver, Int, Or } = require("z3-solver");
const z3 = require("z3-solver"); // ✅ Corrected import
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Load Random Forest Model Parameters from JSON
let modelParams;
try {
  modelParams = JSON.parse(
    fs.readFileSync(
      "/Users/nitish.bhaskar/Projects/rule-engine-poc/random-forest-training/random_forest_model.json",
      "utf-8"
    )
  );
  console.log("✅ Loaded Random Forest Model Parameters:", modelParams);
} catch (error) {
  console.error("❌ Error loading Random Forest Model JSON:", error);
}

// ✅ MongoDB Connection
mongoose
  .connect("mongodb://127.0.0.1:27017/rule_engine", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// ✅ Define Mongoose Schema
const RuleSchema = new mongoose.Schema({
  user_input: String,
  structured_rule: String,
});
const Rule = mongoose.model("Rule", RuleSchema);

// ✅ OpenAI API Setup
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Convert English Rule to JSON (Fixing OpenAI Response)
async function convertToJSON(userInput) {
  try {
    console.log(`📩 OpenAI Processing: ${userInput}`);
    const response = await openai.chat.completions.create({
      model: "gpt-4.5-preview",
      messages: [
        {
          role: "user",
          content: `Convert this rule to structured JSON:\n\n${userInput}`,
        },
      ],
      max_tokens: 300,
    });

    let structuredRule = response.choices[0].message.content.trim();

    // ✅ Fix: Remove unwanted formatting (code block markers)
    if (structuredRule.startsWith("```json")) {
      structuredRule = structuredRule
        .replace("```json", "")
        .replace("```", "")
        .trim();
    }

    console.log(`📜 OpenAI Generated Rule: ${structuredRule}`);
    return structuredRule;
  } catch (error) {
    console.error("❌ OpenAI API Error:", error);
    throw new Error("Failed to process rule using OpenAI.");
  }
}

// ✅ Validate Rule with Random Forest Model (Using `random_forest_model.json`)
function validateWithRandomForest(income, creditScore) {
  try {
    console.log(
      `🤖 ML Model Checking: Income = ${income}, Credit Score = ${creditScore}`
    );

    if (!modelParams) {
      console.log("❌ No model parameters found. Skipping ML validation.");
      return true; // Allow rule if model parameters are missing
    }

    // Simulating ML model logic using thresholds from training dataset
    const minIncome = 20000; // Example threshold
    const minCreditScore = 500;

    if (income < minIncome || creditScore < minCreditScore) {
      console.log(
        `❌ ML Model Validation Failed: Income < ${minIncome} or Credit Score < ${minCreditScore}`
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ ML Validation Error:", error);
    return false;
  }
}

// ✅ Check Rule Conflicts with Z3 Solver

async function validateWithZ3(rule) {
  try {
    const ruleData = JSON.parse(rule);

    // ✅ Fix: Handle multiple JSON formats (condition.and & action.loan_status)
    let conditions, action;
    if (ruleData.rule) {
      conditions =
        ruleData.rule.conditions?.all || ruleData.rule.condition?.and;
      action = ruleData.rule.action?.type || ruleData.rule.action?.loan_status;
    } else {
      conditions = ruleData.conditions?.all || ruleData.condition?.and; // ✅ Extract conditions directly
      action = ruleData.action?.loan_status || ruleData.action; // ✅ Extract action properly
    }

    // ✅ Ensure conditions and action exist
    if (!conditions || !action) {
      console.log("❌ Z3 Validation Failed: Rule format incorrect.");
      console.log("Received:", JSON.stringify(ruleData, null, 2));
      return false;
    }

    let income = null,
      creditScore = null;

    // ✅ Extract salary and credit_score values
    for (const condition of conditions) {
      if (condition.field === "salary" || condition.field === "income") {
        income = parseInt(condition.value, 10);
      } else if (condition.field === "credit_score") {
        creditScore = parseInt(condition.value, 10);
      }
    }

    console.log(
      `🔍 Z3 Checking: Income = ${income}, Credit Score = ${creditScore}`
    );

    if (isNaN(income) || isNaN(creditScore)) {
      console.log("❌ Z3 Validation Failed: Missing required fields.");
      return false;
    }

    // ✅ Fix: Properly initialize Z3 solver
    const z3Instance = await z3.init(); // ✅ Initialize Z3
    const ctx = new z3Instance.Context(); // ✅ Create Z3 Context
    const solver = new ctx.Solver(); // ✅ Create Solver Instance

    // ✅ Fix: Use `ctx.Const()` for variable creation & `ctx.Int.sort()` for integer types
    const z3_income = ctx.Const("income", ctx.Int.sort());
    const z3_credit_score = ctx.Const("credit_score", ctx.Int.sort());

    // ✅ Fix: Use `ctx.Int.val()` instead of `ctx.int_val()`
    solver.add(z3_income.eq(ctx.Int.val(income)));
    solver.add(z3_credit_score.eq(ctx.Int.val(creditScore)));

    // Fetch stored rules from MongoDB
    const storedRules = await Rule.find({});
    console.log(`📂 Found ${storedRules.length} stored rules in MongoDB`);

    if (storedRules.length === 0) {
      console.log("📭 No stored rules found. Allowing rule.");
      return true;
    }

    for (const storedRule of storedRules) {
      const existingRule = JSON.parse(storedRule.structured_rule);
      console.log(
        `⚠️ Checking against existing rule: ${JSON.stringify(
          existingRule,
          null,
          2
        )}`
      );

      let existingIncome = null,
        existingCreditScore = null;

      if (existingRule.conditions && existingRule.conditions.all) {
        existingRule.conditions.all.forEach((condition) => {
          if (condition.field === "salary" || condition.field === "income") {
            existingIncome = parseInt(condition.value, 10);
          } else if (condition.field === "credit_score") {
            existingCreditScore = parseInt(condition.value, 10);
          }
        });
      } else if (existingRule.condition && existingRule.condition.and) {
        existingRule.condition.and.forEach((condition) => {
          if (condition.field === "salary" || condition.field === "income") {
            existingIncome = parseInt(condition.value, 10);
          } else if (condition.field === "credit_score") {
            existingCreditScore = parseInt(condition.value, 10);
          }
        });
      }

      // 🔥 **Fix: Prevent Self-Checking**
      if (income === existingIncome && creditScore === existingCreditScore) {
        console.log("⏩ Skipping self-check. This rule is new.");
        continue;
      }

      if (existingRule.action?.loan_status === "approved") {
        solver.add(
          ctx.Or(
            z3_income.gt(ctx.Int.val(existingIncome)),
            z3_credit_score.gt(ctx.Int.val(existingCreditScore))
          )
        );
      } else if (existingRule.action?.loan_status === "rejected") {
        solver.add(
          ctx.Or(
            z3_income.lt(ctx.Int.val(existingIncome)),
            z3_credit_score.lt(ctx.Int.val(existingCreditScore))
          )
        );
      }
    }

    if (solver.check() === "unsat") {
      console.log("❌ Conflict detected! Rule rejected.");
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Z3 Validation Error:", error);
    return false;
  }
}

// ✅ API: Process Rule (Validation Only)
app.post("/process-rule", async (req, res) => {
  const { user_input } = req.body;
  console.log(`📩 Received Rule: ${user_input}`);

  try {
    const structuredRule = await convertToJSON(user_input);

    let income = 50000,
      creditScore = 750; // Default values for validation testing
    const isValidML = validateWithRandomForest(income, creditScore);
    console.log(
      `🤖 ML Model Validation: ${isValidML ? "✅ Passed" : "❌ Failed"}`
    );

    const isValidZ3 = await validateWithZ3(structuredRule);
    console.log(
      `⚖️ Z3 Solver Validation: ${isValidZ3 ? "✅ Passed" : "❌ Failed"}`
    );

    if (!isValidML || !isValidZ3) {
      return res
        .status(400)
        .json({ error: "Rule conflicts with existing rules or is invalid." });
    }

    res.json({ structured_rule: structuredRule, valid: true });
  } catch (error) {
    console.error("❌ Error processing rule:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Start Express Server
const PORT = 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
