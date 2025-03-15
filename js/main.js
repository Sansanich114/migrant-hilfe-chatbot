// main.js
// Bootstraps the client by calling initChat, initDarkMode, etc.
// (If your project still needs this ES module approach.)

import { initChat } from "./chat.js";
import { initDarkMode } from "./darkMode.js";
import { initSuggestions } from "./suggestions.js";

document.addEventListener("DOMContentLoaded", () => {
  initChat();
  initDarkMode();
  initSuggestions();
});
