// utils.js
// Helper functions (e.g., auto-resizing textareas, smooth scrolling)

function autoResize(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  }
  
  // Additional utility functions can be added here
  
  // Example: Export functions if using modules (or attach to window)
  window.autoResize = autoResize;
  