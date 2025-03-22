let isBotTyping = false;
let typingIndicatorElement = null;

function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  // 1) Add user message to the chat
  addMessage("user", userMessage);

  // 2) Clear input
  chatInput.value = "";
  autoResize(chatInput);
  disableInput(chatInput, sendBtn, true);

  // 3) Show bot typing indicator
  addBotTypingMessage();

  // 4) Retrieve stored conversationId and userId from localStorage
  let conversationId = localStorage.getItem("conversationId") || "";
  let userId = localStorage.getItem("userId") || "";

  // 5) Prepare payload
  const payload = { conversationId, message: userMessage, userId };

  // 6) Send POST request to /chat
  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => response.json())
    .then((data) => {
      // 7) Remove bot typing indicator
      removeBotTypingMessage();
      disableInput(chatInput, sendBtn, false);

      // 8) If there's a bot reply, add it; else fallback
      if (data.reply) {
        addMessage("bot", data.reply);
      } else {
        addMessage("bot", "Sorry, I didn't get a response.");
      }

      // 9) Update suggestions
      updateSuggestions(data.suggestions);

      // 10) Store conversationId & userId in localStorage for next time
      if (data.conversationId) {
        localStorage.setItem("conversationId", data.conversationId);
      }
      if (data.userId) {
        localStorage.setItem("userId", data.userId);
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
}

function removeBotTypingMessage() {
  if (typingIndicatorElement) {
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.removeChild(typingIndicatorElement);
    typingIndicatorElement = null;
    isBotTyping = false;
  }
}

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

// Exported to global scope (e.g., from an inline script in index.html)
window.sendMessage = sendMessage;
window.addMessage = addMessage;
window.addBotTypingMessage = addBotTypingMessage;
window.removeBotTypingMessage = removeBotTypingMessage;
window.updateSuggestions = updateSuggestions;
window.fetchIntro = fetchIntro;
