// main.js
// Bootstraps the client by calling initChat, initDarkMode, and initSuggestions.

import { initChat } from "./chat.js";
import { initDarkMode } from "./darkMode.js";
import { initSuggestions } from "./suggestions.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize chat logic (createProfile if needed, set up event listeners, etc.)
  initChat();

  // Initialize dark mode toggle logic
  initDarkMode();

  // Initialize suggestions logic (if you have a separate suggestions module)
  initSuggestions();
});
