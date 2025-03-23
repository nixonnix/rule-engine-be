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

dotenv.config();

// Add multiple tools here
const tools = [saveRuleTool]; // Add future tools like createRuleTool here
const toolNode = new ToolNode(tools);

const app = express();
const port = process.env.PORT || 5000;
app.use(express.json());

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

    console.log("-- messages ---", messages);

    let rawResponse;
    const lastMessage =
      state.messages?.[state.messages.length - 1]?.content || "";

    // Check if any tool should be triggered
    let selectedTool = null;
    for (const tool of tools) {
      console.log("------- tool ------- ", tool);
      console.log("------- tool.name ------- ", tool.name);
      if (new RegExp(tool.name, "i").test(lastMessage)) {
        selectedTool = tool;
        break;
      }
    }

    console.log("-------- useTools ------- ", useTools);
    console.log("-------- selectedTool ------- ", selectedTool);
    console.log("------- lastMessage -------- ", lastMessage);
    console.log(
      "--------- new RegExp",
      new RegExp(tool.name, "i").test(lastMessage)
    );

    if (useTools && selectedTool) {
      try {
        console.log(`Detected tool invocation: ${selectedTool.name}`);

        const toolCall = new AIMessage({
          content: "",
          tool_calls: [
            {
              name: selectedTool.name,
              args: lastMessage, // Pass message as argument
              id: "tool_call_id",
              type: "tool_call",
            },
          ],
        });

        const toolResponse = await toolNode.invoke({
          messages: [toolCall],
        });

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

    // const responseText =
    //   typeof rawResponse.content === "string"
    //     ? rawResponse.content
    //     : JSON.stringify(rawResponse.content);

    const responseText =
      typeof rawResponse.content === "string"
        ? rawResponse.content
        : JSON.stringify(rawResponse.content);

    const jsonMatch = responseText.match(/\{.*\}/s);
    let parsedResponse;

    if (jsonMatch) {
      try {
        parsedResponse = responseSchema.parse(JSON.parse(jsonMatch[0]));
      } catch (error) {
        console.error("Error parsing JSON response:", error);
        parsedResponse = { response: responseText, goto: "__end__" };
      }
    } else {
      console.warn("No structured JSON detected, falling back to plain text.");
      parsedResponse = { response: responseText, goto: "__end__" };
    }

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

  // return new Command({
  //   goto: "__end__",
  //   update: {
  //     messages: {
  //       role: "assistant",
  //       content: responseText,
  //       name,
  //     },
  //   },
  // });
};

const ruleCreator = makeAgentNode({
  name: "rule_creator",
  destinations: ["rule_saver", "rule_validator"],
  systemPrompt: [
    "You are a assistant the collaborates with credit risk managers and helps them create rules for risk management, lender selection, etc. ",
    "Credit risk managers will input rules which will evaluate a borrowers attributes against limits and thresholds they set",
    "An example input from the risk manager may be ((age > 18 and age < 65 and income > 10,000) or (age > 35 and income between 50000 and 100000)) then eligible for a loan, else not. ",
    ,
    "You will have to elicit more details like whether the income is monthly or annual. ",
    "You will also need to validate whether the limits are logical, for example age cannot be more than 100 and so on. ",
    "You should also ask explicitly about the lender for which the rule is set up during your conversation. ",
    "You will carry on the conversation in simple English. ",
    "You will be creating a JSON of rules mapped to the lender. ",
    "You should create rules in terms of these fields as key: credit_score, income, age, occupation, overdue_amount, active_loans, dpd. Not all fields are mandatory. ",
    "Minimum one field is mandatory for rule creation.",
    "Finally when the risk manager is done and satisfied, you take help of 'rule_validator' to generate some test and show the results of running the test data against the newly created rule. ",
    "Once the risk manager is satisfied with the test inputs, You should be displaying the JSON output and expression output of the lender specific.",
    "You should then ask the risk manager whether they want to save this rule.",
    "You should explicityly ask them to input 'save' to proceed with rule saving",
    "If the manager chose to save the rule by giving 'save' as input, you should ask 'rule_saver' agent for help in order to save the rule. ",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name.",
  ].join(""),
  // useTools: true,
});

const ruleSaver = makeAgentNode({
  name: "rule_saver",
  destinations: ["rule_creator", "rule_validator"],
  systemPrompt: [
    "You are an expert that can help save the rule created by 'rule_creator' in the database. ",
    "If you need help with correctness of rule, ask 'rule_validator' for help. ",
    "Once the rule is saved, you should provide a confirmation to the user. ",
    "in case of any error, you should provide a warning to the user and let them know the issue. ",
    "If you need further user inputs, go to 'rule_creator' for help. ",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name.",
  ].join(""),
  useTools: true,
  tools: [saveRuleTool], // Add other tools as needed
});

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
  destinations: ["rule_creator", "rule_saver"],
  systemPrompt: async () => {
    // Fetch existing rules from MongoDB
    const existingRules = await Rule.find({});
    console.log(
      " %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%"
    );
    const rulesText = existingRules.length
      ? existingRules
          .map(
            (r) => `Lender: ${r.lender}, Rule: ${JSON.stringify(r.rule_json)}`
          )
          .join("\n")
      : "No existing rules found.";

    return [
      "You are a rule validation expert that validates new rules against existing ones.",
      "Here are the existing rules in the database:",
      rulesText,
      "If a new rule conflicts with any of these, suggest corrections.",
      "If you need user input, ask 'rule_creator' for help.",
      "If you need to save a rule, ask 'rule_saver' for help.",
      "If you have enough information to respond, return '__end__'.",
      "Never mention other agents by name.",
    ].join("\n");
  },
});

const builder = new StateGraph(MessagesAnnotation)
  .addNode("rule_creator", ruleCreator, {
    ends: ["rule_saver", "rule_validator", "__end__"],
  })
  .addNode("rule_saver", ruleSaver, {
    ends: ["rule_creator", "rule_validator", "__end__"],
  })
  .addNode("rule_validator", ruleValidator, {
    ends: ["rule_creator", "rule_saver", "__end__"],
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
