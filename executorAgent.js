import { ChatBedrock } from "@langchain/community/chat_models/bedrock";
import {
  AgentExecutor,
  initializeAgentExecutorWithOptions,
} from "langchain/agents";
import { BufferMemory } from "langchain/memory";
import dotenv from "dotenv";
import { ruleValidator } from "./agents/ruleValidator.js";
import { ruleGenerator } from "./agents/ruleGenerator.js";
import { testDataAgent } from "./agents/testDataAgent.js";
import { ruleStorageAgent } from "./agents/ruleStorageAgent.js";
import { connectDB } from "./db.js";

dotenv.config();

// Connect to MongoDB
await connectDB();

// Llama 3 Setup in Langchain.js
const model = new ChatBedrock({
  region: process.env.AWS_REGION || "us-east-1",
  model: "meta.llama3-70b-instruct-v1:0",
  temperature: 0.3,
  topP: 0.9,
});

// Memory to retain conversation context
const memory = new BufferMemory({ memoryKey: "chat_history" });

// Define Tools (Agents)
const tools = [
  {
    name: "validator",
    description: "Validates user input and ensures logical correctness.",
    func: async (input) => await ruleValidator.validate(input),
  },
  {
    name: "generator",
    description: "Generates structured JSON for rule creation.",
    func: async (input) => await ruleGenerator.generate(input),
  },
  {
    name: "test",
    description: "Runs test data against generated rules.",
    func: async (input) => await testDataAgent.test(input),
  },
  {
    name: "storage",
    description: "Stores the validated rule in MongoDB.",
    func: async (input) => await ruleStorageAgent.store(input),
  },
];

// Initialize the agent executor with memory
const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  verbose: true,
  memory: memory,
});

class ExecutorAgent {
  constructor() {
    this.memory = memory;
  }

  async execute(userInput) {
    console.log("🔄 Asking Llama 3 what to do next...");

    // Enforce validation before moving forward
    const validationResponse = await ruleValidator.validate(userInput);

    if (!validationResponse.response.startsWith("✅")) {
      console.log("❌ Validation failed. Returning issues to user.");
      return validationResponse; // Stops execution if validation fails
    }

    try {
      const response = await executor.call({ input: userInput });
      console.log("🤖 Decision from Llama 3:", response);
      return response;
    } catch (error) {
      console.error("❌ Executor Agent Error:", error);
      return { response: "AI Decision Error. Please try again." };
    }
  }
}

export const executorAgent = new ExecutorAgent();
