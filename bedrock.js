import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import dotenv from "dotenv";

dotenv.config();

// ✅ AWS Client Setup
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ✅ Correct Model ID for Llama 3
const LLAMA_MODEL_ID = "meta.llama3-70b-instruct-v1:0";

// async function callLlama(prompt) {
//   try {
//     console.log("🔄 Sending request to Llama 3...");

//     // ✅ Correct Request Format
//     const command = new InvokeModelCommand({
//       modelId: LLAMA_MODEL_ID,
//       body: JSON.stringify({
//         prompt, // 🔹 Ensure input follows expected format
//         temperature: 0.3,
//         top_p: 0.9,
//         max_gen_len: 1024, // 🔹 Limit output to avoid overuse
//       }),
//       contentType: "application/json", // 🔹 Required for AWS Bedrock
//     });

//     const response = await client.send(command);
//     const rawOutput = Buffer.from(response.body).toString("utf-8").trim();

//     console.log("✅ Raw Llama 3 Response:", rawOutput);

//     // ✅ Extract JSON from response (if present)
//     const jsonMatch = rawOutput.match(/\{[\s\S]*?\}/);
//     if (jsonMatch) {
//       try {
//         return JSON.parse(jsonMatch[0]); // Return structured JSON response
//       } catch (jsonError) {
//         console.error("❌ Failed to parse JSON:", jsonError);
//       }
//     }

//     return rawOutput; // Return as plain text if JSON is not found
//   } catch (error) {
//     console.error("❌ AWS Bedrock API Error:", error);
//     return { error: "⚠️ AI request failed." };
//   }
// }

async function callLlama(userInput) {
  try {
    // const systemPrompt = `
    //   YOu are an AI assistant that will help credit risk managers and helps them create
    //   rules for risk management, lender selection, etc.
    //   They will input rules which will evaluate a borrowers attributes against limits and thresholds they
    //   set and create a json for those rules which can then be parsed and applied on the actual borrower data.
    //   An example input from the risk manager may be
    //   ((age > 18 and age < 65 and income > 10,000) or (age > 35 and income between 50000 and 100000))
    //   then eligible for a loan, else not.
    //   You will have to elicit more details like whether the income is monthly or annual.
    //   You will also need to validate whether the limits are logical, for example age cannot be more than 100 and so on.
    //   You should also ask explicitly about the lender for which the rule is set up during your conversation.
    //   You will carry on the conversation in simple English.
    //   Finally when the risk manager is done and satisfied with their inputs,
    //   you will generate some test and show the results of running the test data against the rule.
    //   Once the risk manager is satisfied with the test inputs, you should ask the risk manager whether to save this rule.
    //   If the manager chose to save the rule, you will be creating a JSON of rules mapped to the lender.
    //   You should be displaying the JSON output and expression output of the rules to lender.
    // `;

    const systemPrompt = "";

    console.log("🔄 Sending request to Llama 3...");

    const command = new InvokeModelCommand({
      modelId: LLAMA_MODEL_ID,
      body: JSON.stringify({
        prompt: `${systemPrompt}\nUser Input: ${userInput}`, // Embedding system prompt
        // prompt: `${fullPrompt}`,
        temperature: 0.3,
        top_p: 0.9,
        max_gen_len: 1024,
      }),
      contentType: "application/json",
    });

    const response = await client.send(command);
    const rawOutput = Buffer.from(response.body).toString("utf-8").trim();

    console.log("✅ Raw Llama 3 Response:", rawOutput);
    return rawOutput;
  } catch (error) {
    console.error("❌ AWS Bedrock API Error:", error);
    return { error: "⚠️ AI request failed." };
  }
}

export { callLlama };
