const avatars = {
  bot: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj4KICA8cmVjdCB4PSIxMCIgeT0iMTIiIHdpZHRoPSIyMCIgaGVpZ2h0PSIxNiIgcng9IjMiIHJ5PSIzIiBmaWxsPSIjM0UyNzIzIiAvPgogIDxjaXJjbGUgY3g9IjE3IiBjeT0iMjAiIHI9IjIiIGZpbGw9IiNGRkYiIC8+CiAgPGNpcmNsZSBjeD0iMjMiIGN5PSIyMCIgcj0iMiIgZmlsbD0iI0ZGRiIgLz4KICA8cmVjdCB4PSIxNSIgeT0iMjgiIHdpZHRoPSIxMCIgaGVpZ2h0PSIyIiBmaWxsPSIjRkZGIiAvPgo8L3N2Zz4=",
  user: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj4KICA8Y2lyY2xlIGN4PSIyMCIgY3k9IjE0IiByPSI2IiBmaWxsPSIjM0UyNzIzIiAvPgogIDxwYXRoIGQ9Ik0yMCAyMmMtNS4zMyAwLTEwIDIuNjctMTAgNnY0aDIwdi00YzAtMy4zMy00LjY3LTYtMTAtNnoiIGZpbGw9IiM0RTI3MjMiIC8+Cjwvc3ZnPg=="
};

function addMessage(sender, text) {
  const chatContainer = document.getElementById("chatContainer");
  const lastMessage = chatContainer.lastElementChild;
  if (lastMessage && lastMessage.classList.contains("message") && lastMessage.classList.contains(sender)) {
    const bubble = lastMessage.querySelector(".bubble");
    bubble.innerText += "`n" + text;
  } else {
    const messageDiv = document.createElement("div");
    messageDiv.className = "message " + sender;
    const avatarImg = document.createElement("img");
    avatarImg.className = "avatar";
    avatarImg.src = avatars[sender];
    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "bubble";
    bubbleDiv.innerText = text;
    messageDiv.appendChild(avatarImg);
    messageDiv.appendChild(bubbleDiv);
    chatContainer.appendChild(messageDiv);
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const userMessage = chatInput.value.trim();
  if (!userMessage) return;
  addMessage("user", userMessage);
  chatInput.value = "";
  autoResize(chatInput);
  fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userMessage })
  })
    .then(response => response.json())
    .then(data => {
      if (data.reply) {
        addMessage("bot", data.reply);
      } else {
        addMessage("bot", "Sorry, I didn't get a response.");
      }
    })
    .catch(error => {
      console.error("Error in /chat:", error);
      addMessage("bot", "Error: Unable to process request.");
    });
}

function initChat() {
  const chatInput = document.getElementById("chatInput");
  chatInput.addEventListener("input", () => autoResize(chatInput));
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  chatInput.addEventListener("keypress", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

export { initChat };
