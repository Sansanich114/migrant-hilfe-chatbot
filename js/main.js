import { initChat } from "./chat.js";
import { initDarkMode } from "./darkMode.js";
import { initSuggestions } from "./suggestions.js";

document.addEventListener("DOMContentLoaded", () => {
  initSuggestions();
  initChat();
  initDarkMode();
});
