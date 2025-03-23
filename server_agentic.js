import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { executorAgent } from "./executorAgent.js";
import { connectDB } from "./db.js";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB before starting server
await connectDB();

// API Route: Process User Input (Updated to /chat)
app.post("/chat", async (req, res) => {
  const { userInput } = req.body;
  if (!userInput) {
    return res.status(400).json({ error: "User input is required" });
  }

  console.log("🔹 Received Input:", userInput);
  try {
    const response = await executorAgent.execute(userInput);
    return res.json({ response });
  } catch (error) {
    console.error("❌ Error processing request:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Health Check Route
app.get("/", (req, res) => {
  res.send("🚀 Rule Execution API is Running!");
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
