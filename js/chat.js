// chat.js

export function initChat() {
  // 1) Grab relevant DOM elements
  const newChatBtn = document.getElementById("newChatBtn");
  const sendBtn = document.getElementById("sendBtn");
  const chatInput = document.getElementById("chatInput");

  // 2) Hook up event listeners
  if (newChatBtn) {
    newChatBtn.addEventListener("click", createNewConversation);
  }
  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // 3) If user has no userId in localStorage, create profile
  if (!localStorage.getItem("userId")) {
    createProfile();
  } else {
    fetchIntro();
    fetchConversations();
  }
}

// CREATE PROFILE
function createProfile() {
  const language = navigator.language || "en";
  localStorage.setItem("userLanguage", language);

  // NOTE the /user prefix
  fetch("/user/createProfile", {
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

// INTRO
function fetchIntro() {
  const userId = localStorage.getItem("userId");
  const language = localStorage.getItem("userLanguage") || "en";
  if (!userId) return;

  // If your backend expects /intro?userId=..., leave it as is:
  fetch(`/intro?userId=${userId}&lang=${language}`)
    .then((res) => res.json())
    .then((data) => {
      if (data.reply) {
        addMessage("bot", data.reply);
      }
      updateSuggestions(data.suggestions || []);
    })
    .catch((err) => console.error("Error fetching intro:", err));
}

// FETCH CONVERSATIONS
function fetchConversations() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;

  // NOTE the /user prefix
  fetch(`/user/profile/${userId}`)
    .then((res) => res.json())
    .then((data) => {
      const chatListDiv = document.getElementById("chatList");
      if (!chatListDiv) return;
      chatListDiv.innerHTML = "";

      if (data.conversations) {
        data.conversations.forEach((conv) => {
          const convItem = document.createElement("div");
          convItem.className = "chat-item";

          const convName = document.createElement("span");
          convName.innerText =
            conv.conversationName || "Conversation " + conv._id.slice(-4);
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
            const newName = prompt("Enter a new name:", conv.conversationName);
            if (!newName) return;
            try {
              await fetch("/user/renameConversation", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId: conv._id, newName }),
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
            if (!confirm("Delete this conversation?")) return;
            try {
              await fetch("/user/deleteConversation", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ conversationId: conv._id }),
              });
              fetchConversations();
            } catch (err) {
              console.error("Delete failed:", err);
            }
          };

          btnContainer.appendChild(editBtn);
          btnContainer.appendChild(deleteBtn);
          convItem.appendChild(btnContainer);

          // Clicking on the conversation loads it
          convItem.onclick = () => loadConversation(conv._id);
          chatListDiv.appendChild(convItem);
        });
      }
    })
    .catch((err) => console.error("Error fetching conversations:", err));
}

// LOAD A SPECIFIC CONVERSATION
function loadConversation(conversationId) {
  const userId = localStorage.getItem("userId");
  if (!userId) return;

  fetch(`/user/profile/${userId}`)
    .then((res) => res.json())
    .then((data) => {
      const conv = data.conversations.find((c) => c._id === conversationId);
      if (!conv) return;

      localStorage.setItem("conversationId", conversationId);

      const chatContainer = document.getElementById("chatContainer");
      if (!chatContainer) return;
      chatContainer.innerHTML = "";

      conv.messages.forEach((msg) => {
        if (msg.role === "assistant" || msg.role === "system") {
          addMessage("bot", msg.content);
        } else {
          addMessage("user", msg.content);
        }
      });
    })
    .catch((err) => console.error("Error loading conversation:", err));
}

// CREATE NEW CONVERSATION
function createNewConversation() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;

  // NOTE the /user prefix
  fetch("/user/createConversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.conversationId) {
        console.error("No conversationId returned:", data);
        return;
      }
      localStorage.setItem("conversationId", data.conversationId);
      fetchConversations();
    })
    .catch((err) => console.error("Error creating conversation:", err));
}

// SEND MESSAGE
function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  if (!chatInput || !sendBtn) return;

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

  // /chat is correct (since app.js has app.use('/chat', chatRoutes))
  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      removeBotTypingMessage();
      disableInput(chatInput, sendBtn, false);
      if (data.reply) {
        addMessage("bot", data.reply);
      } else {
        addMessage("bot", "Sorry, I didn't get a response.");
      }
      updateSuggestions(data.suggestions || []);
    })
    .catch((err) => {
      removeBotTypingMessage();
      disableInput(chatInput, sendBtn, false);
      console.error("Error in /chat:", err);
      addMessage("bot", "Error: Unable to process request.");
    });
}

// DELETE ALL USER DATA
export function deleteAllUserData() {
  const userId = localStorage.getItem("userId");
  if (!userId) return;
  if (!confirm("Delete ALL data? This cannot be undone.")) return;

  fetch("/user/deleteAllUserData", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  })
    .then(() => {
      const lang = localStorage.getItem("userLanguage");
      localStorage.clear();
      localStorage.setItem("userLanguage", lang);
      window.location.reload();
    })
    .catch((err) => {
      console.error("Error deleting all user data:", err);
      alert("Unable to delete data.");
    });
}

// HELPER: addMessage
function addMessage(sender, text) {
  const chatContainer = document.getElementById("chatContainer");
  if (!chatContainer) return;

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message", sender);

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "bubble";
  bubbleDiv.innerText = text;

  if (sender === "user") {
    const userAvatar = document.createElement("img");
    userAvatar.className = "avatar";
    userAvatar.src = "images/accent-icons/user-accent.svg";
    userAvatar.alt = "User Avatar";
    messageDiv.appendChild(userAvatar);
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

// HELPER: addBotTypingMessage
function addBotTypingMessage() {
  const chatContainer = document.getElementById("chatContainer");
  if (!chatContainer) return;

  const typingIndicatorElement = document.createElement("div");
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

  // We can track it globally if we want, or remove it right after the next response
  window._typingIndicatorElement = typingIndicatorElement;
}

// HELPER: removeBotTypingMessage
function removeBotTypingMessage() {
  const chatContainer = document.getElementById("chatContainer");
  if (!chatContainer || !window._typingIndicatorElement) return;

  chatContainer.removeChild(window._typingIndicatorElement);
  window._typingIndicatorElement = null;
}

// HELPER: updateSuggestions
function updateSuggestions(suggestions) {
  const suggestionsDiv = document.getElementById("suggestions");
  if (!suggestionsDiv) return;
  suggestionsDiv.innerHTML = "";

  if (Array.isArray(suggestions) && suggestions.length > 0) {
    suggestions.forEach((suggestion) => {
      const suggestionBtn = document.createElement("div");
      suggestionBtn.className = "suggestion bubble-lift";
      suggestionBtn.innerText = suggestion;
      suggestionBtn.onclick = () => {
        const chatInput = document.getElementById("chatInput");
        if (!chatInput) return;
        chatInput.value = suggestion;
        autoResize(chatInput);
      };
      suggestionsDiv.appendChild(suggestionBtn);
    });
  }
}

// HELPER: autoResize
function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// HELPER: disableInput
function disableInput(chatInput, sendBtn, disable) {
  chatInput.disabled = disable;
  sendBtn.disabled = disable;
}
