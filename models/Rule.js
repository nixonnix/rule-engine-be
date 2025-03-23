import mongoose from "mongoose";

const RuleSchema = new mongoose.Schema({
  lender: { type: String, required: true },
  criteria: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Rule = mongoose.model("Rule", RuleSchema);
