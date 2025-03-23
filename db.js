import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const mongoURI =
  process.env.MONGO_URI || "mongodb://localhost:27017/rule_engine";

export const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Define Rule Schema
const ruleSchema = new mongoose.Schema({
  lender: String,
  rule_json: Object, // Store structured rule as JSON
  expression: String, // Store human-readable expression
  created_at: { type: Date, default: Date.now },
});

export const Rule = mongoose.model("Rule", ruleSchema);
