// main.js
// Global initialization: sets up event listeners, orchestrates the chat logic

document.addEventListener("DOMContentLoaded", () => {
    // 1) Language detection
    const userLanguage = navigator.language || 'en';
    localStorage.setItem("userLanguage", userLanguage);
  
    // 2) Grab references to DOM elements
    const body = document.body;
    const themeSwitcher = document.getElementById("themeSwitcher");
    const settingsBtn = document.getElementById("settingsBtn");
    const settingsMenu = document.getElementById("settingsMenu");
    const aboutModal = document.getElementById("aboutModal");
    const closeAbout = document.getElementById("closeAbout");
    const openAboutUs = document.getElementById("openAboutUs");
    const profileBtn = document.getElementById("profileBtn");
    const profileModal = document.getElementById("profileModal");
    const closeProfile = document.getElementById("closeProfile");
    const deleteAllDataBtn = document.getElementById("deleteAllDataBtn");
  
    const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
    const sidebarToggleIcon = document.getElementById("sidebarToggleIcon");
  
    const newChatBtn = document.getElementById("newChatBtn");
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
  
    // 3) Event Listeners
    // Sidebar toggle
    sidebarToggleBtn.addEventListener("click", () => {
      body.classList.toggle("sidebar-hidden");
      if (body.classList.contains("sidebar-hidden")) {
        sidebarToggleIcon.textContent = "►";
      } else {
        sidebarToggleIcon.textContent = "◄";
      }
    });
  
    // Theme toggle
    themeSwitcher.addEventListener("click", () => {
      body.classList.toggle("dark-mode");
      settingsMenu.classList.add("hidden");
    });
  
    // Settings dropdown
    settingsBtn.addEventListener("click", () => {
      settingsMenu.classList.toggle("hidden");
    });
  
    // About Us modal
    openAboutUs.addEventListener("click", () => {
      aboutModal.classList.remove("hidden");
      settingsMenu.classList.add("hidden");
    });
    closeAbout.addEventListener("click", () => {
      aboutModal.classList.add("hidden");
    });
  
    // Profile modal
    profileBtn.addEventListener("click", () => {
      profileModal.classList.remove("hidden");
    });
    closeProfile.addEventListener("click", () => {
      profileModal.classList.add("hidden");
    });
  
    // Delete all user data
    deleteAllDataBtn.addEventListener("click", () => {
      settingsMenu.classList.add("hidden");
      deleteAllUserData();
    });
  
    // Close modals when clicking outside them
    window.addEventListener("click", (e) => {
      if (e.target === aboutModal) aboutModal.classList.add("hidden");
      if (e.target === profileModal) profileModal.classList.add("hidden");
    });
  
    // New Chat
    newChatBtn.addEventListener("click", () => {
      createNewConversation();
    });
  
    // Send message on button or Enter
    sendBtn.addEventListener("click", sendMessage);
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  
    // Auto-resize for chat input
    chatInput.addEventListener("input", () => autoResize(chatInput));
  
    // 4) On Page Load: create profile if needed, or load existing data
    if (!localStorage.getItem("userId")) {
      createProfile();
    } else {
      fetchIntro();
      fetchConversations();
    }
  });
  
  // Helper function for “+ New Chat”
  function createNewConversation() {
    const userId = localStorage.getItem("userId");
    if (!userId) return;
    fetch("/createConversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
      .then((res) => res.json())
      .then((data) => {
        localStorage.setItem("conversationId", data.conversationId);
        // Optionally load the new conversation or refresh
        fetchConversations();
      })
      .catch((err) => console.error("Error creating new conversation:", err));
  }
  