// Importing required modules
const express = require('express');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage, SystemMessage } = require('langchain/schema');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// Keep track of connected clients
const clients = [];

// Load character data from JSON file
let character;
try {
  const characterData = fs.readFileSync(path.join(__dirname, 'character.json'), 'utf8');
  character = JSON.parse(characterData);
  console.log('Character profile loaded successfully');
} catch (error) {
  console.error('Error loading character profile:', error);
  character = {
    name: 'AI Assistant',
    personality: { traits: ['Helpful', 'Friendly'] },
    background: { summary: 'An AI assistant ready to help.' },
    situational_responses: { greeting: 'Hello! How can I help you today?' }
  };
}

// Initialize the ChatOpenAI instance with streaming capability
const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  streaming: true,
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY
});

// SSE endpoint for chat
app.get('/chat-stream', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send an initial connection message
  res.write('event: connected\ndata: connected to chat stream\n\n');

  // Store the client
  const client = { id: Date.now().toString(), res };
  clients.push(client);
  
  // Handle client disconnect
  req.on('close', () => {
    console.log(`Client ${client.id} disconnected`);
    const index = clients.findIndex(c => c.id === client.id);
    if (index !== -1) {
      clients.splice(index, 1);
    }
  });
});

// API endpoint to send messages and get streaming responses
app.post('/send-message', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Create system prompt based on character profile
    const characterTraits = character.personality.traits.join(', ');
    const characterBackground = character.background.summary;
    const characterExpertise = character.background.expertise ? character.background.expertise.join(', ') : '';
    const characterValues = character.values ? character.values.join(', ') : '';
    
    // Construct a comprehensive system prompt
    let characterSystemPrompt = `You are ${character.name}, a ${character.demographics.age}-year-old ${character.demographics.occupation} working at ${character.demographics.location}. 
    
Your personality traits include: ${characterTraits}.
Your background: ${characterBackground}
Your areas of expertise: ${characterExpertise}
Your core values: ${characterValues}

You should speak in the following style: ${character.personality.speaking_style}

In different situations, respond as follows:
- When greeting someone: "${character.situational_responses.greeting}"
- When explaining a complex topic: "${character.situational_responses.explaining_complex_topic}"
- When expressing technological concerns: "${character.situational_responses.expressing_technological_concern}"
- When sharing a discovery: "${character.situational_responses.sharing_discovery}"
- When correcting a misconception: "${character.situational_responses.responding_to_misconception}"
- When discussing AI ethics: "${character.situational_responses.discussing_AI_ethics}"

Always stay in character and respond as Professor Chen would, with their background in quantum physics and AI, expertise, and personality. Use physics and computing analogies when appropriate, and maintain a balance between technical accuracy and accessible explanations.`;

    // Set up the chat model with streaming handlers
    await model.call(
      [
        new SystemMessage(characterSystemPrompt),
        new HumanMessage(message)
      ],
      {
        callbacks: [
          {
            handleLLMNewToken(token) {
              // Send the token as an SSE event to all connected clients
              const event = `event: message\ndata: ${JSON.stringify({ token })}\n\n`;
              
              // Send to all clients
              for (const client of clients) {
                client.res.write(event);
              }
            }
          }
        ]
      }
    );

    // Send a completion event
    const completionEvent = `event: complete\ndata: ${JSON.stringify({ complete: true })}\n\n`;
    for (const client of clients) {
      client.res.write(completionEvent);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// API endpoint to get character info
app.get('/character-info', (req, res) => {
  // Send character name and basic info
  res.json({ 
    name: character.name,
    occupation: character.demographics.occupation,
    location: character.demographics.location
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});