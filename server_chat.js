import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { Ollama } from "@langchain/community/llms/ollama";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Load Llama 3 Locally via Ollama
const model = new Ollama({ model: "llama3" });

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  const response = await model.call(message);
  res.json({ response });
});

app.listen(3000, () => console.log("Chatbot API running on port 3000"));
