const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to parse JSON request bodies.
// This is essential for Dialogflow CX webhooks as they send JSON.
app.use(express.json());

// Add this simple GET handler for the Load Balancer Health Check
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Main webhook endpoint for Dialogflow CX
//app.post('/dialogflow-cx-webhook', async (req, res) => {
  app.post('/', (req, res) => {
  console.log('--- Dialogflow CX Webhook Request Received ---');
  // Uncomment the line below to log the full incoming request for debugging
  // console.log(JSON.stringify(req.body, null, 2));

  try {
    const requestBody = req.body;

    // 1. Extracting Key Information from the Dialogflow CX Webhook Request
    // This is how you interact with the "Dialogflow CX Webhook SDK" structure.

    // Fulfillment Tag: A string that Dialogflow CX sends to identify the specific intent/route.
    const tag = requestBody.fulfillmentInfo?.tag;
    console.log(`Fulfillment Tag: ${tag || 'N/A'}`);

    // Session ID: The unique identifier for the current conversation session.
    const session = requestBody.session;
    console.log(`Session: ${session}`);

    // Current Page Display Name: The name of the page the agent is currently on.
    const currentPageDisplayName = requestBody.pageInfo?.displayName;
    console.log(`Current Page: ${currentPageDisplayName || 'N/A'}`);

    // Parameters: Data collected from user input (form filling).
    const parameters = {};
    if (requestBody.pageInfo?.formInfo?.parameterInfo) {
      requestBody.pageInfo.formInfo.parameterInfo.forEach(param => {
        // Only include parameters that have a value
        if (param.value !== undefined) {
          parameters[param.displayName] = param.value;
        }
      });
    }
    console.log('Parameters:', parameters);

    // Matched Intent: The intent that Dialogflow CX matched (if any).
    const matchedIntent = requestBody.intentInfo?.displayName;
    console.log(`Matched Intent: ${matchedIntent || 'N/A'}`);


    // 2. Custom Business Logic to Determine the Response
    // This is where you'd implement your application's intelligence.
    // You can use the 'tag', 'parameters', 'matchedIntent', etc., to craft your response.

    let responseText = `Hello from your Express webhook! You're on page "${currentPageDisplayName}".`;

    if (tag) {
      responseText += ` The fulfillment tag "${tag}" was triggered.`;
    }
    if (Object.keys(parameters).length > 0) {
      responseText += ` Parameters received: ${JSON.stringify(parameters)}.`;
    } else {
      responseText += ` No specific parameters were provided.`;
    }

    // Example of conditional responses based on tag
    if (tag === 'checkOrderStatus') {
      const orderId = parameters.orderId;
      if (orderId) {
        responseText = `Let me look up order ${orderId} for you. Please wait a moment... (Simulated)`;
        // In a real application, you'd call an external API here to get order status
      } else {
        responseText = `Please tell me the order ID you want to check.`;
      }
    } else if (tag === 'sayGoodbye') {
      responseText = `It was a pleasure assisting you! Goodbye.`;
    }


    // 3. Constructing the Dialogflow CX Webhook Response
    // This MUST adhere to the Dialogflow CX WebhookResponse JSON format.
    const webhookResponse = {
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: [responseText] // Dialogflow CX expects an array of strings for text
            }
          }
        ]
      },
      // You can also include optional fields like:
      // targetPage: `projects/YOUR_PROJECT_ID/locations/YOUR_REGION/agents/YOUR_AGENT_ID/pages/PAGE_ID`,
      // sessionInfo: {
      //   parameters: {
      //     newSessionParam: "someValue"
      //   }
      // },
      // pageInfo: {
      //   formInfo: {
      //     parameterInfo: [
      //       { displayName: "formParamToUpdate", value: "updatedFormValue" }
      //     ]
      //   }
      // }
    };

    console.log('--- Sending Dialogflow CX Webhook Response ---');
    // Uncomment the line below to log the full outgoing response for debugging
    // console.log(JSON.stringify(webhookResponse, null, 2));

    // Send the JSON response back to Dialogflow CX
    res.json(webhookResponse);

  } catch (error) {
    console.error('Error processing Dialogflow CX webhook request:', error);
    // Always send a valid Dialogflow CX response, even on error,
    // to prevent the agent from hanging.
    res.status(500).json({
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: ["I apologize, but there was an internal error processing your request. Please try again later."]
            }
          }
        ]
      }
    });
  }
});

// For any other routes or methods not explicitly handled
// app.use((req, res) => {
//   res.status(404).send("Endpoint not found. Ensure you are POSTing to /dialogflow-cx-webhook.");
// });

// Start the server
app.listen(PORT, () => {
  console.log(`Dialogflow CX Webhook server listening on port ${PORT}`);
});