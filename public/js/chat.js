// public/js/chat.js
document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chatContainer");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  async function sendMessage() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    // Create and display the user's message bubble
    const userDiv = document.createElement("div");
    userDiv.classList.add("message", "user");
    const userBubble = document.createElement("div");
    userBubble.classList.add("bubble");
    userBubble.textContent = userMessage;
    userDiv.appendChild(userBubble);
    chatContainer.appendChild(userDiv);
    chatInput.value = "";
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Prepare payload with user message, conversationId and userId if available
    const payload = {
      message: userMessage,
      conversationId: localStorage.getItem("conversationId") || null,
      userId: localStorage.getItem("userId") || null,
    };

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        // Save conversationId from response if not already stored
        if (data.conversationId) {
          localStorage.setItem("conversationId", data.conversationId);
        }
        // Display the chatbot's reply
        const botDiv = document.createElement("div");
        botDiv.classList.add("message", "bot");
        const botWrapper = document.createElement("div");
        botWrapper.classList.add("bot-wrapper");
        const botBubble = document.createElement("div");
        botBubble.classList.add("bubble");
        botBubble.textContent = data.reply;
        botWrapper.appendChild(botBubble);
        botDiv.appendChild(botWrapper);
        chatContainer.appendChild(botDiv);
      } else {
        // Display error message from backend
        const errorDiv = document.createElement("div");
        errorDiv.classList.add("message", "bot");
        const errorWrapper = document.createElement("div");
        errorWrapper.classList.add("bot-wrapper");
        const errorBubble = document.createElement("div");
        errorBubble.classList.add("bubble");
        errorBubble.textContent = data.error || "An error occurred.";
        errorWrapper.appendChild(errorBubble);
        errorDiv.appendChild(errorWrapper);
        chatContainer.appendChild(errorDiv);
      }
    } catch (err) {
      console.error("Chat request failed:", err);
      const errorDiv = document.createElement("div");
      errorDiv.classList.add("message", "bot");
      const errorWrapper = document.createElement("div");
      errorWrapper.classList.add("bot-wrapper");
      const errorBubble = document.createElement("div");
      errorBubble.classList.add("bubble");
      errorBubble.textContent = "Network error, please try again.";
      errorWrapper.appendChild(errorBubble);
      errorDiv.appendChild(errorWrapper);
      chatContainer.appendChild(errorDiv);
    }
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  sendBtn.addEventListener("click", sendMessage);

  // Allow sending message with Enter (without Shift)
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
