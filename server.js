import express from "express";
import { ChatBedrockConverse } from "@langchain/aws";
import {
  Command,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
import { z } from "zod";
import dotenv from "dotenv";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { connectDB } from "./db.js"; // Import MongoDB connection
import { saveRuleTool } from "./saveRuleTool.js"; // Import tool
import cors from "cors"; // Import cors package
import { Rule } from "./db.js"; // ✅ already exported from your MongoDB file

dotenv.config();

// Add multiple tools here
const tools = [saveRuleTool]; // Add future tools like createRuleTool here
const toolNode = new ToolNode(tools);

const app = express();
const port = process.env.PORT || 5000;

// ✅ Step 1: Allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "https://rule-engine-ui-jet.vercel.app",
];

// ✅ Step 2: CORS middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  })
);

// ✅ Step 3: Manually set headers (especially for OPTIONS preflight)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Credentials", "true");
  }

  // Handle OPTIONS request quickly
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// ✅ JSON middleware
app.use(express.json());

// ✅ JSON Middleware
app.use(express.json());

// ✅ Handle Preflight OPTIONS Request
app.options("*", (req, res) => {
  res.sendStatus(200);
});

// Connect to MongoDB before starting server
connectDB();
// app.listen(port, () => {
//   console.log(`Server running on port ${port}`);
// });

// Initialize AWS Bedrock Converse Model
const model = new ChatBedrockConverse({
  model: "meta.llama3-70b-instruct-v1:0",
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  temperature: 0.1,
  top_p: 0.9,
  maxTokens: 2048,
});

// Weather Tool
// const getWeather = tool(
//   (input) => {
//     if (["sf", "san francisco"].includes(input.location.toLowerCase())) {
//       return "It's 60 degrees and foggy.";
//     } else {
//       return "It's 90 degrees and sunny.";
//     }
//   },
//   {
//     name: "get_weather",
//     description: "Call to get the current weather.",
//     schema: z.object({
//       location: z.string().describe("Location to get the weather for."),
//     }),
//   }
// );

// const tools = [getWeather];
// const toolNode = new ToolNode(tools);

// const makeAgentNode = ({
//   name,
//   destinations,
//   systemPrompt,
//   useTools = false,
// }) => {
//   return async (state) => {
//     const possibleDestinations = ["__end__", ...destinations];

//     const responseSchema = z.object({
//       response: z.string(),
//       goto: z.enum(possibleDestinations),
//     });

//     const messages = [
//       { role: "system", content: systemPrompt },
//       ...(state?.messages || []),
//     ];

//     console.log("-- messages ---", messages);

//     let rawResponse;
//     const lastMessage =
//       state.messages?.[state.messages.length - 1]?.content || "";

//     // **Only call getWeather if the user asks about the weather**
//     const isWeatherQuery = /weather|temperature|forecast/i.test(lastMessage);

//     if (useTools && isWeatherQuery) {
//       try {
//         console.log("Detected weather-related query. Fetching weather...");

//         const messageWithSingleToolCall = new AIMessage({
//           content: "",
//           tool_calls: [
//             {
//               name: "get_weather",
//               args: { location: lastMessage },
//               id: "tool_call_id",
//               type: "tool_call",
//             },
//           ],
//         });

//         const toolResponse = await toolNode.invoke({
//           messages: [messageWithSingleToolCall],
//         });

//         console.log("-- Tool Response ---", toolResponse);

//         if (toolResponse?.messages && Array.isArray(toolResponse.messages)) {
//           rawResponse = {
//             content:
//               toolResponse.messages[0]?.content || "No response from tool.",
//           };
//         } else {
//           rawResponse = { content: "Unexpected tool response format." };
//         }
//       } catch (error) {
//         console.error("Error invoking tool:", error);
//         rawResponse = { content: "Error retrieving tool response." };
//       }
//     } else {
//       // **If the query is not about weather, proceed with the normal travel agent model**
//       rawResponse = await model.invoke(messages);
//     }

//     console.log("-- Raw LLM Response ---", rawResponse);

//     const responseText =
//       typeof rawResponse.content === "string"
//         ? rawResponse.content
//         : JSON.stringify(rawResponse.content);

//     const jsonMatch = responseText.match(/\{.*\}/s);
//     let parsedResponse;

//     if (jsonMatch) {
//       try {
//         parsedResponse = responseSchema.parse(JSON.parse(jsonMatch[0]));
//       } catch (error) {
//         console.error("Error parsing JSON response:", error);
//         parsedResponse = { response: responseText, goto: "__end__" };
//       }
//     } else {
//       console.warn("No structured JSON detected, falling back to plain text.");
//       parsedResponse = { response: responseText, goto: "__end__" };
//     }

//     return new Command({
//       goto: parsedResponse.goto,
//       update: {
//         messages: {
//           role: "assistant",
//           content: parsedResponse.response,
//           name,
//         },
//       },
//     });
//   };
// };

// const extractJsonFromMessage = (messageContent) => {
//   try {
//     console.log("Checking AIMessage for JSON:", messageContent);

//     // Extract JSON inside triple backticks OR after "JSON Output:"
//     const jsonMatch =
//       messageContent.match(/```json([\s\S]*?)```/i) ||
//       messageContent.match(/JSON Output:\s*([\s\S]*)/i);

//     if (jsonMatch && jsonMatch[1]) {
//       let jsonString = jsonMatch[1].trim();

//       // Remove unwanted sections like "Expression Output:"
//       jsonString = jsonString.split("Expression Output:")[0].trim();

//       console.log("Extracted raw JSON string:", jsonString);

//       return JSON.parse(jsonString); // ✅ Ensure it's valid JSON
//     }

//     console.warn("No valid JSON detected in AI message.");
//     return null;
//   } catch (error) {
//     console.error("Error parsing extracted JSON:", error);
//     return null;
//   }
// };

const extractJsonFromMessage = (messageContent) => {
  try {
    console.log("Checking AIMessage for JSON:", messageContent);

    // ✅ First, extract JSON inside triple backticks (handles `json`, `JSON`, `Json`)
    const backtickMatch = messageContent.match(
      /```(?:json|JSON|Json)?([\s\S]*?)```/i
    );

    if (backtickMatch && backtickMatch[1]) {
      let jsonString = backtickMatch[1].trim();
      console.log("Extracted JSON from backticks:", jsonString);
      return JSON.parse(jsonString); // ✅ Convert to object
    }

    // ✅ Second, extract JSON from plain text (detects first valid `{...}` structure)
    const jsonMatch = messageContent.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      let jsonString = jsonMatch[0].trim();
      console.log("Extracted JSON from plain text:", jsonString);
      return JSON.parse(jsonString);
    }

    console.warn("No valid JSON detected in AI message.");
    return null;
  } catch (error) {
    console.error("Error parsing extracted JSON:", error);
    return null;
  }
};

const makeAgentNode = ({
  name,
  destinations,
  systemPrompt,
  useTools = false,
  tools = [],
}) => {
  return async (state) => {
    const possibleDestinations = ["__end__", ...destinations];

    console.log(" ------------------- name --------------------- ", name);

    const responseSchema = z.object({
      response: z.string(),
      goto: z.enum(possibleDestinations),
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...(state?.messages || []),
    ];

    let rawResponse;
    const lastMessage =
      state.messages?.[state.messages.length - 1]?.content || "";

    console.log(
      " ------------------- lastMessage --------------------- ",
      lastMessage
    );

    // ✅ Extract the latest JSON from AI messages
    let ruleData = null;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const message = state.messages[i];

      if (message.name === "rule_creator") {
        const extractedData = extractJsonFromMessage(message.content);
        console.log(" ---------- extractedData ------------ ", extractedData);

        // ✅ Check if valid JSON is found before breaking
        if (extractedData && (extractedData.rules || extractedData.rule)) {
          ruleData = extractedData;

          // ✅ Ensure the `conditions` array expands properly (fixes [Object] placeholders)
          if (ruleData.rule?.conditions) {
            ruleData.rule.conditions = JSON.parse(
              JSON.stringify(ruleData.rule.conditions)
            );
          }

          console.log(
            "-------- Extracted Rule Data (Fixed) --------",
            JSON.stringify(ruleData, null, 2)
          );
          break; // ✅ Exit loop only when a valid rule JSON is found
        }
      }
    }

    // ✅ Detect if the save tool should be invoked
    let selectedTool = null;
    if (/save/i.test(lastMessage)) {
      selectedTool = tools.find((tool) => tool.name === "save_rule");
    }

    console.log("--- selectedTool ---", selectedTool);

    if (useTools && selectedTool && ruleData) {
      try {
        console.log(`Detected tool invocation: ${selectedTool.name}`);
        console.log(
          "In Rule - printing input:",
          JSON.stringify(ruleData, null, 2)
        );

        const toolCall = new AIMessage({
          content: "",
          tool_calls: [
            {
              name: selectedTool.name,
              args: { ...(ruleData || {}) },
              id: "tool_call_id",
              type: "tool_call",
            },
          ],
        });

        const toolResponse = await toolNode.invoke({ messages: [toolCall] });

        console.log("-- Tool Response ---", toolResponse);

        if (toolResponse?.messages && Array.isArray(toolResponse.messages)) {
          rawResponse = {
            content:
              toolResponse.messages[0]?.content ||
              "Tool executed successfully.",
          };
        } else {
          rawResponse = { content: "Unexpected tool response format." };
        }
      } catch (error) {
        console.error(`Error invoking ${selectedTool.name} tool:`, error);
        rawResponse = { content: `Error executing ${selectedTool.name} tool.` };
      }
    } else {
      rawResponse = await model.invoke(messages);
    }

    console.log("-- Raw LLM Response ---", rawResponse);

    const responseText =
      typeof rawResponse.content === "string"
        ? rawResponse.content
        : JSON.stringify(rawResponse.content);

    const jsonMatch = responseText.match(/\{.*\}/s);
    let parsedResponse;

    if (jsonMatch) {
      try {
        console.log(
          " -------- *********************************** jsonMatch[0] ************************************ -------- ",
          jsonMatch?.[0]
        );
        parsedResponse = responseSchema.parse(JSON.parse(jsonMatch[0]));
      } catch (error) {
        console.error("Error parsing JSON response:", error);
        parsedResponse = { response: responseText, goto: "__end__" };
      }
    } else {
      parsedResponse = { response: responseText, goto: "__end__" };
    }

    console.log(
      "--------------------------------------------- parsedResponse ------------------------------------ ",
      parsedResponse
    );

    return new Command({
      goto: parsedResponse.goto,
      update: {
        messages: {
          role: "assistant",
          content: parsedResponse.response,
          name,
        },
      },
    });
  };
};

const ruleCreator = makeAgentNode({
  name: "rule_creator",
  destinations: ["rule_validator"],
  systemPrompt: [
    "You are a assistant the collaborates with credit risk managers and helps them create rules for risk management, lender selection, etc. ",
    "Credit risk managers will input rules which will evaluate a borrowers attributes against limits and thresholds they set",
    "An example input from the risk manager may be ((age > 18 and age < 65 and income > 10,000) or (age > 35 and income between 50000 and 100000)) then eligible for a loan, else not. ",
    "You will have to elicit more details like whether the income is monthly or annual. ",
    "You will also need to validate whether the limits are logical, for example age cannot be more than 100 and so on. ",
    "You should also ask explicitly about the lender for which the rule is set up during your conversation. ",
    "You will carry on the conversation in simple English. ",
    "You will be creating a JSON of rules mapped to the lender. ",
    "You will create the JSON using combination of fields and operators",
    "You should use built-in JSON validators to validate the generated JSON for its correctness and formatting.",
    "You should create rules in terms of these fields as key: credit_score, income, age, occupation, overdue_amount, active_loans, dpd. Not all fields are mandatory. ",
    "Lender is a mandatory field for rule creation. ",
    "JSON should have two fields: 'rule' and 'lender'. The 'lender' will have lender name and the 'rule' will have the rule JSON. ",
    'An example is {"rule":{"or":[{"and":[{"age":{"operator":">","value":18}},{"age":{"operator":"<","value":65}},{"income":{"operator":">","value":10000}}]},{"and":[{"age":{"operator":">","value":35}},{"income":{"operator":">=","value":50000}},{"income":{"operator":"<=","value":100000}}]}]},"lender":"KSF"}',
    "You should use built-in JSON validators to validate the generated JSON for its correctness and formatting.",
    "You should dispaly the JSON only if it is valid.",
    "You should auto correct the JSON if there are any issues.",
    "Along with the lender, minimum one field is mandatory for rule creation.",
    "Finally when the risk manager is done and satisfied, you take help of 'rule_validator' to generate some test and show the results of running the test data against the newly created rule. ",
    "Once the risk manager is satisfied with the test inputs, You should be displaying the JSON output and expression output of the lender specific.",
    "You should then ask the risk manager whether they want to save this rule.",
    "Always create the rule JSON first and then ask the user to save the rule.",
    "You should never ask the user to test the input and save the data in one go.",
    "You should explicityly ask them to input 'save' to proceed with rule saving",
    "Once the rule is saved, you should provide a confirmation to the user. ",
    "In case of any error, you should provide a warning to the user and let them know the issue. ",
    "Never ask the user to test the input and save the data in one go.",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name.",
  ].join(""),
  useTools: true,
  tools: [saveRuleTool],
});

// const ruleSaver = makeAgentNode({
//   name: "rule_saver",
//   destinations: ["rule_creator", "rule_validator"],
//   systemPrompt: [
//     "You are an expert that can help save the rule created by 'rule_creator' in the database. ",
//     "If you need help with correctness of rule, ask 'rule_validator' for help. ",
//     "Once the rule is saved, you should provide a confirmation to the user. ",
//     "in case of any error, you should provide a warning to the user and let them know the issue. ",
//     "If you need further user inputs, go to 'rule_creator' for help. ",
//     "If you have enough information to respond to the user, return '__end__'. ",
//     "Never mention other agents by name.",
//   ].join(""),
//   useTools: true,
//   tools: [saveRuleTool], // Add other tools as needed
// });

// const ruleValidator = makeAgentNode({
//   name: "rule_validator",
//   destinations: ["rule_creator", "rule_saver"],
//   systemPrompt: [
//     "You are a rule validation expert that creates test input and validate it against the rules. ",
//     "By default you are provided with all the existing rules in the database. ",
//     "When a new rule is created, you should check for conflicts with existing rules in the database. ",
//     "If there are conflicts, provide a warning and suggest corrections. ",
//     "If you need user input, ask 'rule_creator' for help. ",
//     "If you need specific rules already present, ask 'sightseeing_advisor' for help. ",
//     "If you have enough information to respond to the user, return '__end__'. ",
//     "Never mention other agents by name.",
//   ].join(""),
// });

const ruleValidator = makeAgentNode({
  name: "rule_validator",
  destinations: ["rule_creator"],
  systemPrompt: [
    "You are a rule validation expert that validates new rules against existing ones.",
    "If a new rule conflicts with any of these, suggest corrections.",
    "If you need user input, ask 'rule_creator' for help.",
    "If you need to save a rule, ask 'rule_saver' for help.",
    "If you have enough information to respond, return '__end__'.",
    "Never mention other agents by name.",
  ].join("\n"),
});

const builder = new StateGraph(MessagesAnnotation)
  .addNode("rule_creator", ruleCreator, {
    ends: ["rule_validator", "__end__"],
  })
  // .addNode("rule_saver", ruleSaver, {
  //   ends: ["rule_creator", "rule_validator", "__end__"],
  // })
  .addNode("rule_validator", ruleValidator, {
    ends: ["rule_creator", "__end__"],
  })
  .addEdge("__start__", "rule_creator");

const checkpointer = new MemorySaver();
const graph = builder.compile({ checkpointer });

const threadConfig = { configurable: { thread_id: "tesla123" } };

app.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  console.log("Received request:", message);

  try {
    const recommendationStream = await graph.stream(
      { messages: [{ role: "user", content: message }] },
      threadConfig
    );

    console.log("------- recommendationStream -------- ", recommendationStream);

    let responses = [];
    for await (const chunk of recommendationStream) {
      responses.push(chunk);
    }

    res.json({ responses });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Endpoint to get all rules
app.get("/rules", async (req, res) => {
  try {
    const rules = await Rule.find().sort({ created_at: -1 }); // Most recent first (optional)
    res.json({ rules });
  } catch (error) {
    console.error("Error fetching rules:", error);
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

// Utility to evaluate a single condition
const evaluateCondition = (fieldValue, operator, targetValue) => {
  switch (operator) {
    case ">":
      return fieldValue > targetValue;
    case ">=":
      return fieldValue >= targetValue;
    case "<":
      return fieldValue < targetValue;
    case "<=":
      return fieldValue <= targetValue;
    case "==":
      return fieldValue === targetValue;
    case "!=":
      return fieldValue !== targetValue;
    default:
      return false;
  }
};

// Recursive rule evaluator
const evaluateRule = (ruleNode, data) => {
  if (ruleNode.and) {
    return ruleNode.and.every((condition) => evaluateRule(condition, data));
  }

  if (ruleNode.or) {
    return ruleNode.or.some((condition) => evaluateRule(condition, data));
  }

  const [field, logic] = Object.entries(ruleNode)[0];
  const fieldValue = data[field];

  if (typeof fieldValue === "undefined") return false;

  return evaluateCondition(fieldValue, logic.operator, logic.value);
};

// ✅ POST /evaluate
app.post("/evaluate", async (req, res) => {
  try {
    const testData = req.body;
    if (!testData) return res.status(400).json({ error: "Test data required" });

    const rules = await Rule.find({});
    const eligibleLenders = [];

    for (const rule of rules) {
      const ruleTree = rule.rule_json;

      if (evaluateRule(ruleTree, testData)) {
        eligibleLenders.push(rule.lender);
      }
    }

    res.json({ ...testData, eligibleLenders });
  } catch (error) {
    console.error("Evaluation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
