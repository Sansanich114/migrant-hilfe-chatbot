let isBotTyping = false;
let typingIndicatorElement = null;

function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  addMessage("user", userMessage);
  chatInput.value = "";
  autoResize(chatInput);
  disableInput(chatInput, sendBtn, true);
  addBotTypingMessage();

  // Retrieve stored conversationId and userId (set during login/signup)
  let conversationId = localStorage.getItem("conversationId") || "";
  // Validate conversationId length (MongoDB IDs are typically 24 hex chars)
  if (conversationId && conversationId.length !== 24) {
    conversationId = "";
    localStorage.removeItem("conversationId");
  }
  const userId = localStorage.getItem("userId") || "";
  
  const payload = { conversationId, message: userMessage, userId };

  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      removeBotTypingMessage();
      disableInput(chatInput, sendBtn, false);
      if (data.reply) {
        addMessage("bot", data.reply);
      } else {
        addMessage("bot", "Sorry, I didn't get a response.");
      }
      updateSuggestions(data.suggestions);
      // Store conversationId if returned by the server
      if (data.conversationId) {
        localStorage.setItem("conversationId", data.conversationId);
      }
    })
    .catch((error) => {
      removeBotTypingMessage();
      disableInput(chatInput, sendBtn, false);
      console.error("Error in /chat:", error);
      addMessage("bot", "Error: Unable to process request.");
    });
}

function addMessage(sender, text) {
  const chatContainer = document.getElementById("chatContainer");
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "bubble";
  bubbleDiv.innerText = text;

  messageDiv.appendChild(bubbleDiv);
  chatContainer.appendChild(messageDiv);
  // Removed auto-scroll to keep the UI stable
}

function addBotTypingMessage() {
  isBotTyping = true;
  const chatContainer = document.getElementById("chatContainer");
  typingIndicatorElement = document.createElement("div");
  typingIndicatorElement.classList.add("message", "bot", "typing-message");

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "bubble";
  bubbleDiv.innerHTML = `
    <div class="typing-indicator">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>`;
  typingIndicatorElement.appendChild(bubbleDiv);

  chatContainer.appendChild(typingIndicatorElement);
  // Removed auto-scroll to keep the UI stable
}

function removeBotTypingMessage() {
  if (typingIndicatorElement) {
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.removeChild(typingIndicatorElement);
    typingIndicatorElement = null;
    isBotTyping = false;
  }
}

// Updated so clicking a suggestion automatically sends it
function updateSuggestions(suggestions) {
  const suggestionsDiv = document.getElementById("suggestions");
  suggestionsDiv.innerHTML = "";
  if (suggestions && suggestions.length > 0) {
    suggestions.forEach((suggestion) => {
      const suggestionBtn = document.createElement("div");
      suggestionBtn.className = "suggestion";
      suggestionBtn.innerText = suggestion;
      suggestionBtn.onclick = () => {
        const chatInput = document.getElementById("chatInput");
        chatInput.value = suggestion;
        autoResize(chatInput);
        sendMessage(); // auto-send the suggestion
      };
      suggestionsDiv.appendChild(suggestionBtn);
    });
  }
}

function fetchIntro() {
  fetch("/user/intro?lang=en")
    .then((res) => res.json())
    .then((data) => {
      if (data.reply) {
        addMessage("bot", data.reply);
      }
      updateSuggestions(data.suggestions);
    })
    .catch((err) => console.error("Error fetching intro message:", err));
}

window.sendMessage = sendMessage;
window.addMessage = addMessage;
window.addBotTypingMessage = addBotTypingMessage;
window.removeBotTypingMessage = removeBotTypingMessage;
window.updateSuggestions = updateSuggestions;
window.fetchIntro = fetchIntro;
