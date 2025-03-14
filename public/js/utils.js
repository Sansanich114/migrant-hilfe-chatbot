// utils.js
// Helper functions (e.g., auto-resizing textareas)

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }
  
  // Disables or enables the chat input and send button
  function disableInput(chatInput, sendBtn, disable) {
    chatInput.disabled = disable;
    sendBtn.disabled = disable;
  }
  
  // Export to global scope so other files can use them
  window.autoResize = autoResize;
  window.disableInput = disableInput;
  