import { executorAgent } from "./executorAgent.js";

async function runExecutor() {
  const userInput = "Applicants must have income 50000 and CIBIL score 750.";
  const result = await executorAgent.execute(userInput);
  console.log("Response:", result);
}

runExecutor();
