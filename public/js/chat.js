// public/js/chat.js
document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chatContainer");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const suggestionsContainer = document.getElementById("suggestions");
  const debugBox = document.getElementById("debugInfo");

  // Generate a session ID if not already set
  if (!localStorage.getItem("sessionId")) {
    localStorage.setItem("sessionId", `sess_${Date.now()}_${Math.floor(Math.random() * 100000)}`);
  }

  const sessionId = localStorage.getItem("sessionId");

  async function sendMessage(userMessage) {
    if (!userMessage) return;

    // Display user's message
    const userDiv = document.createElement("div");
    userDiv.classList.add("message", "user");
    const userBubble = document.createElement("div");
    userBubble.classList.add("bubble");
    userBubble.textContent = userMessage;
    userDiv.appendChild(userBubble);
    chatContainer.appendChild(userDiv);
    scrollToBottom();

    chatInput.value = "";

    // Optional: show typing indicator
    const typingDiv = document.createElement("div");
    typingDiv.classList.add("message", "bot", "typing-message");
    typingDiv.innerHTML = `
      <div class="bubble">
        <div class="typing-indicator">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>`;
    chatContainer.appendChild(typingDiv);
    scrollToBottom();

    // Prepare request payload
    const payload = {
      message: userMessage,
      conversationId: localStorage.getItem("conversationId") || null,
      userId: localStorage.getItem("userId") || null,
      sessionId,
    };

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      typingDiv.remove();

      if (response.ok) {
        // Save IDs for future requests
        if (data.conversationId) localStorage.setItem("conversationId", data.conversationId);
        if (data.userId) localStorage.setItem("userId", data.userId);

        // Display bot response
        const botDiv = document.createElement("div");
        botDiv.classList.add("message", "bot");
        const botBubble = document.createElement("div");
        botBubble.classList.add("bubble");
        botBubble.textContent = data.reply || "🤖 No reply received.";
        botDiv.appendChild(botBubble);
        chatContainer.appendChild(botDiv);

        // Render suggestions
        renderSuggestions(data.suggestions || []);

        // Optional: Show debug info
        if (debugBox) {
          debugBox.innerText = `
Missing Info: ${data.missingInfo?.join(", ") || "None"}
User Mood: ${data.userMood || "?"}
Urgency: ${data.urgency || "?"}
          `.trim();
        }
      } else {
        showError(data.error || "❌ Error from server.");
      }
    } catch (err) {
      typingDiv.remove();
      console.error("Request failed:", err);
      showError("⚠️ Network error. Try again.");
    } finally {
      scrollToBottom();
    }
  }

  function showError(errorMsg) {
    const errorDiv = document.createElement("div");
    errorDiv.classList.add("message", "bot");
    const errorBubble = document.createElement("div");
    errorBubble.classList.add("bubble");
    errorBubble.textContent = errorMsg;
    errorDiv.appendChild(errorBubble);
    chatContainer.appendChild(errorDiv);
  }

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function renderSuggestions(suggestions) {
    suggestionsContainer.innerHTML = "";
    if (!suggestions.length) return;

    suggestions.forEach((suggestion) => {
      const btn = document.createElement("div");
      btn.classList.add("suggestion");
      btn.textContent = suggestion;
      btn.onclick = () => sendMessage(suggestion);
      suggestionsContainer.appendChild(btn);
    });
  }

  // Send button click
  sendBtn.addEventListener("click", () => {
    const message = chatInput.value.trim();
    sendMessage(message);
  });

  // Allow Enter (without Shift) to send message
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(chatInput.value.trim());
    }
  });
});
