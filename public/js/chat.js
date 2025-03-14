// chat.js
// Main chat-related logic: creating profile, fetching convos, sending messages

let isBotTyping = false;
let typingIndicatorElement = null;

// Creates a new user profile if none exists
function createProfile() {
  const language = localStorage.getItem("userLanguage") || "en";
  fetch("/createProfile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileInfo: { language } }),
  })
    .then((res) => res.json())
    .then((data) => {
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("conversationId", data.conversationId);
      fetchIntro();
      fetchConversations();
    })
    .catch((err) => console.error("Error creating profile:", err));
}

// Fetches an intro message from the server
function fetchIntro() {
  const userId = localStorage.getItem("userId");
  const language = localStorage.getItem("userLanguage") || "en";
  if (!userId) return;

  fetch(`/intro?userId=${userId}&lang=${language}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.reply) {
        addMessage("bot", data.reply);
      }
      updateSuggestions(data.suggestions || []);
    })
    .catch((err) => console.error("Error fetching intro message:", err));
}

// Fetches all conversations for the current user
function fetchConversations() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;
  fetch(`/profile/${userId}`)
    .then((res) => res.json())
    .then((data) => {
      const chatListDiv = document.getElementById("chatList");
      chatListDiv.innerHTML = "";

      if (data.conversations) {
        data.conversations.forEach((conv) => {
          const convItem = document.createElement("div");
          convItem.className = "chat-item";

          const convName = document.createElement("span");
          convName.innerText = conv.conversationName || "Conversation " + conv._id.slice(-4);
          convItem.appendChild(convName);

          // Buttons container
          const btnContainer = document.createElement("div");
          btnContainer.style.display = "flex";
          btnContainer.style.gap = "8px";

          // Edit button
          const editBtn = document.createElement("button");
          editBtn.className = "edit-btn";
          editBtn.innerText = "✏️";
          editBtn.onclick = async (e) => {
            e.stopPropagation();
            const newName = prompt("Enter a new name for this conversation:", conv.conversationName);
            if (!newName) return;
            try {
              await fetch("/renameConversation", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId: conv._id, newName })
              });
              fetchConversations();
            } catch (err) {
              console.error("Rename failed:", err);
            }
          };

          // Delete button
          const deleteBtn = document.createElement("button");
          deleteBtn.innerText = "🗑️";
          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm("Are you sure you want to delete this conversation?")) return;
            try {
              await fetch("/deleteConversation", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId: conv._id })
              });
              fetchConversations();
            } catch (err) {
              console.error("Delete failed:", err);
            }
          };

          btnContainer.appendChild(editBtn);
          btnContainer.appendChild(deleteBtn);
          convItem.appendChild(btnContainer);

          convItem.onclick = () => loadConversation(conv._id);
          chatListDiv.appendChild(convItem);
        });
      }
    })
    .catch((err) => console.error("Error fetching conversations:", err));
}

// Loads a specific conversation by ID
function loadConversation(conversationId) {
  const userId = localStorage.getItem("userId");
  if (!userId) return;
  fetch(`/profile/${userId}`)
    .then((res) => res.json())
    .then((data) => {
      const conv = data.conversations.find(c => c._id === conversationId);
      if (conv) {
        localStorage.setItem("conversationId", conversationId);
        const chatContainer = document.getElementById("chatContainer");
        chatContainer.innerHTML = "";

        conv.messages.forEach((msg) => {
          if (msg.role === "assistant" || msg.role === "system") {
            addMessage("bot", msg.content);
          } else {
            addMessage("user", msg.content);
          }
        });
      }
    })
    .catch((err) => console.error("Error loading conversation:", err));
}

// Deletes all user data
async function deleteAllUserData() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;
  if (!confirm("Are you sure you want to delete ALL data? This cannot be undone.")) return;

  try {
    await fetch("/deleteAllUserData", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    // Clear localStorage except for language
    const lang = localStorage.getItem("userLanguage");
    localStorage.clear();
    localStorage.setItem("userLanguage", lang);
    window.location.reload();
  } catch (err) {
    console.error("Error deleting all user data:", err);
    alert("Unable to delete data.");
  }
}

// Sends a message to the server
function sendMessage() {
  if (isBotTyping) return;
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  addMessage("user", userMessage);
  chatInput.value = "";
  autoResize(chatInput);
  disableInput(chatInput, sendBtn, true);
  addBotTypingMessage();

  const userId = localStorage.getItem("userId");
  const conversationId = localStorage.getItem("conversationId");
  const payload = { userId, conversationId, message: userMessage };

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
    })
    .catch((error) => {
      removeBotTypingMessage();
      disableInput(chatInput, sendBtn, false);
      console.error("Error in /chat:", error);
      addMessage("bot", "Error: Unable to process request.");
    });
}

// Adds a message (user or bot) to the chat container
function addMessage(sender, text) {
  const chatContainer = document.getElementById("chatContainer");
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "bubble";
  bubbleDiv.innerText = text;

  if (sender === "user") {
    const userAvatarImg = document.createElement("img");
    userAvatarImg.classList.add("avatar");
    userAvatarImg.src = "images/accent-icons/user-accent.svg";
    userAvatarImg.alt = "User Avatar";
    messageDiv.appendChild(userAvatarImg);
    messageDiv.appendChild(bubbleDiv);
  } else {
    const botAvatar = document.createElement("img");
    botAvatar.className = "avatar";
    botAvatar.src = "images/accent-icons/bot-accent.svg";
    botAvatar.alt = "Bot Avatar";
    messageDiv.appendChild(botAvatar);
    messageDiv.appendChild(bubbleDiv);
  }

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Shows bot typing indicator
function addBotTypingMessage() {
  isBotTyping = true;
  const chatContainer = document.getElementById("chatContainer");
  typingIndicatorElement = document.createElement("div");
  typingIndicatorElement.classList.add("message", "bot", "typing-message");

  const botAvatar = document.createElement("img");
  botAvatar.className = "avatar";
  botAvatar.src = "images/accent-icons/bot-accent.svg";
  botAvatar.alt = "Bot Avatar";
  typingIndicatorElement.appendChild(botAvatar);

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
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Removes the bot typing indicator
function removeBotTypingMessage() {
  if (typingIndicatorElement) {
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.removeChild(typingIndicatorElement);
    typingIndicatorElement = null;
    isBotTyping = false;
  }
}

// Updates suggestion buttons
function updateSuggestions(suggestions) {
  const suggestionsDiv = document.getElementById("suggestions");
  suggestionsDiv.innerHTML = "";

  if (suggestions && suggestions.length > 0) {
    suggestions.forEach((suggestion) => {
      const suggestionBtn = document.createElement("div");
      suggestionBtn.className = "suggestion bubble-lift";
      suggestionBtn.innerText = suggestion;
      suggestionBtn.onclick = () => {
        const chatInput = document.getElementById("chatInput");
        chatInput.value = suggestion;
        autoResize(chatInput);
      };
      suggestionsDiv.appendChild(suggestionBtn);
    });
  }
}

// Export all chat functions to the global scope so main.js can use them
window.createProfile = createProfile;
window.fetchIntro = fetchIntro;
window.fetchConversations = fetchConversations;
window.loadConversation = loadConversation;
window.deleteAllUserData = deleteAllUserData;
window.sendMessage = sendMessage;
window.addMessage = addMessage;
window.addBotTypingMessage = addBotTypingMessage;
window.removeBotTypingMessage = removeBotTypingMessage;
window.updateSuggestions = updateSuggestions;
