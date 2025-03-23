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

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

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

const makeAgentNode = ({ name, destinations, systemPrompt }) => {
  return async (state) => {
    const possibleDestinations = ["__end__", ...destinations];

    console.log(
      " --------------------------- name -----------------------------",
      name
    );

    const responseSchema = z.object({
      response: z
        .string()
        .describe(
          "A human readable response to the original question. Does not need to be a final response. Will be streamed back to the user."
        ),
      goto: z
        .enum(possibleDestinations)
        .describe(
          "The next agent to call, or __end__ if the user's query has been resolved. Must be one of the specified values."
        ),
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...state.messages,
    ];

    console.log("-- messages ---", messages);

    // Direct model invocation without structured output
    const rawResponse = await model.invoke(messages);
    console.log("-- Raw LLM Response ---", rawResponse);

    // Extract content from AIMessage
    const responseText = rawResponse.content;

    // Extract JSON from response using regex (if it exists)
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
};

const travelAdvisor = makeAgentNode({
  name: "travel_advisor",
  destinations: ["sightseeing_advisor", "hotel_advisor"],
  systemPrompt: [
    "You are a general travel expert that can recommend travel destinations (e.g. countries, cities, etc). ",
    "If you need specific sightseeing recommendations, ask 'sightseeing_advisor' for help. ",
    "If you need hotel recommendations, ask 'hotel_advisor' for help. ",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name.",
  ].join(""),
});

const sightseeingAdvisor = makeAgentNode({
  name: "sightseeing_advisor",
  destinations: ["travel_advisor", "hotel_advisor"],
  systemPrompt: [
    "You are a travel expert that can provide specific sightseeing recommendations for a given destination. ",
    "If you need general travel help, go to 'travel_advisor' for help. ",
    "If you need hotel recommendations, go to 'hotel_advisor' for help. ",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name.",
  ].join(""),
});

const hotelAdvisor = makeAgentNode({
  name: "hotel_advisor",
  destinations: ["travel_advisor", "sightseeing_advisor"],
  systemPrompt: [
    "You are a booking expert that provides hotel recommendations for a given destination. ",
    "If you need general travel help, ask 'travel_advisor' for help. ",
    "If you need specific sightseeing recommendations, ask 'sightseeing_advisor' for help. ",
    "If you have enough information to respond to the user, return '__end__'. ",
    "Never mention other agents by name.",
  ].join(""),
});

const builder = new StateGraph(MessagesAnnotation)
  .addNode("travel_advisor", travelAdvisor, {
    ends: ["sightseeing_advisor", "hotel_advisor", "__end__"],
  })
  .addNode("sightseeing_advisor", sightseeingAdvisor, {
    ends: ["travel_advisor", "hotel_advisor", "__end__"],
  })
  .addNode("hotel_advisor", hotelAdvisor, {
    ends: ["travel_advisor", "sightseeing_advisor", "__end__"],
  })
  .addEdge("__start__", "travel_advisor");

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
