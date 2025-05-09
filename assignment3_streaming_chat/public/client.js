// DOM Elements
const chatBox = document.getElementById('chat-box');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const typingIndicator = document.getElementById('typing-indicator');
const characterNameElement = document.getElementById('character-name');

// Global Variables
let eventSource;
let currentAIMessageElement = null;

// Fetch character info when page loads
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/character-info');
        const data = await response.json();
        characterNameElement.textContent = data.name;
        // Add a welcome message using the character's name
        const welcomeMessage = document.querySelector('.welcome-message p');
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome! Start a conversation with ${data.name}.`;
        }
    } catch (error) {
        console.error('Error fetching character info:', error);
    }
    
    // Connect to SSE stream
    connectToEventStream();
});

// Connect to the server's event stream
function connectToEventStream() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource('/chat-stream');
    
    // Handle connection open
    eventSource.addEventListener('connected', (event) => {
        console.log('Connected to event stream:', event.data);
    });
    
    // Handle incoming message tokens
    eventSource.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        updateAIMessage(data.token);
    });
    
    // Handle completion of a message
    eventSource.addEventListener('complete', (event) => {
        finishAIMessage();
    });
    
    // Handle errors
    eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        eventSource.close();
        // Try to reconnect after a delay
        setTimeout(connectToEventStream, 3000);
    };
}

// Add a user message to the chat
function addUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'user-message');
    messageElement.textContent = message;
    chatBox.appendChild(messageElement);
    scrollToBottom();
}

// Create a new AI message container for streaming
function createAIMessage() {
    // Show typing indicator
    typingIndicator.classList.add('active');
    
    // Create new message element with streaming class
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'ai-message', 'streaming');
    messageElement.textContent = '';
    chatBox.appendChild(messageElement);
    
    return messageElement;
}

// Update AI message with a new token
function updateAIMessage(token) {
    // Create a new message element if none exists
    if (!currentAIMessageElement) {
        currentAIMessageElement = createAIMessage();
    }
    
    // Add the token to the message
    currentAIMessageElement.textContent += token;
    scrollToBottom();
}

// Finish the AI message (remove streaming class, etc.)
function finishAIMessage() {
    if (currentAIMessageElement) {
        // Remove streaming class
        currentAIMessageElement.classList.remove('streaming');
        // Reset current message element
        currentAIMessageElement = null;
        // Hide typing indicator
        typingIndicator.classList.remove('active');
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Send a message to the server
async function sendMessage(message) {
    try {
        // Disable input while processing
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        // Send the message to the server
        const response = await fetch('/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        if (!response.ok) {
            throw new Error('Failed to send message');
        }
        
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
        
        // Re-enable input
        messageInput.disabled = false;
        sendButton.disabled = false;
    }
}

// Handle form submission
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Add user message to chat
    addUserMessage(message);
    
    // Send message to server
    sendMessage(message);
    
    // Clear input field
    messageInput.value = '';
});

// Handle window close/refresh - close the event source
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});