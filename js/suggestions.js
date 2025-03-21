﻿// suggestions.js
function initSuggestions() {
  const predictiveQuestions = [
    "What documents do I need?",
    "How do I apply for a visa?",
    "What are the housing options?",
    "How can I find a job?",
    "What is the cost of living in Germany?"
  ];

  const suggestionsDiv = document.getElementById("suggestions");
  if (!suggestionsDiv) return;

  predictiveQuestions.forEach(question => {
    const suggestionBtn = document.createElement("div");
    suggestionBtn.className = "suggestion";
    suggestionBtn.innerText = question;
    suggestionBtn.onclick = () => {
      const chatInput = document.getElementById("chatInput");
      chatInput.value = question;
      autoResize(chatInput);
    };
    suggestionsDiv.appendChild(suggestionBtn);
  });
}

export { initSuggestions };
