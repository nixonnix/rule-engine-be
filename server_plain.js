import express from "express";
import { callLlama } from "./bedrock.js"; // Import Bedrock interaction function

const app = express();
app.use(express.json());

// ✅ API: Simple Chat with Llama 3
app.post("/chat", async (req, res) => {
  const { userInput } = req.body;
  console.log(`🔹 Received Input: ${userInput}`);

  try {
    // 🔄 Send user message directly to Llama 3 in AWS Bedrock
    const llamaResponseRaw = await callLlama(userInput);
    console.log("✅ Raw Llama 3 Response:", llamaResponseRaw);

    // 🔄 Extract the actual response text
    let llamaResponse =
      typeof llamaResponseRaw === "object" && llamaResponseRaw.generation
        ? llamaResponseRaw.generation
        : String(llamaResponseRaw);

    console.log("✅ Processed Llama 3 Response:", llamaResponse);

    // ✅ Return AI response as plain text
    return res.json({ response: llamaResponse });
  } catch (error) {
    console.error("❌ Bedrock Chat Error:", error);
    return res.json({ response: "⚠️ AI request failed." });
  }
});

// ✅ Start Server
app.listen(5000, () =>
  console.log("🚀 Server running at http://localhost:5000")
);
