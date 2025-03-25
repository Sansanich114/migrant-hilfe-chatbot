// chat.js
// Minimal chat logic: user messages + a mock bot reply
// (Avatar creation removed so there's no chatbot icon)

document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chatContainer");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  function sendMessage() {
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    // Create user message bubble
    const userDiv = document.createElement("div");
    userDiv.classList.add("message", "user");
    const userBubble = document.createElement("div");
    userBubble.classList.add("bubble");
    userBubble.textContent = userMessage;
    userDiv.appendChild(userBubble);
    chatContainer.appendChild(userDiv);

    // Clear input
    chatInput.value = "";

    // Mock bot reply
    setTimeout(() => {
      const botDiv = document.createElement("div");
      botDiv.classList.add("message", "bot");

      const botWrapper = document.createElement("div");
      botWrapper.classList.add("bot-wrapper");

      const botBubble = document.createElement("div");
      botBubble.classList.add("bubble");
      botBubble.textContent = "Danke für Ihre Nachricht! (Mock Reply)";

      botWrapper.appendChild(botBubble);
      botDiv.appendChild(botWrapper);

      chatContainer.appendChild(botDiv);

      // Auto-scroll
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 500);

    // Auto-scroll
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  sendBtn.addEventListener("click", sendMessage);

  // Send on Enter
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
});
