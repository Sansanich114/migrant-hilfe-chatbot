document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const themeSwitcher = document.getElementById("themeSwitcher");
  const themeIcon = document.getElementById("themeIcon");
  const settingsIcon = document.getElementById("settingsIcon");
  const userIcon = document.getElementById("userIcon");
  const logoIcon = document.getElementById("logoIcon");
  const sendIcon = document.getElementById("sendIcon");
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsMenu = document.getElementById("settingsMenu");
  const aboutModal = document.getElementById("aboutModal");
  const closeAbout = document.getElementById("closeAbout");
  const openAboutUs = document.getElementById("openAboutUs");
  const profileBtn = document.getElementById("profileBtn");
  const profileModal = document.getElementById("profileModal");
  const closeProfile = document.getElementById("closeProfile");
  const deleteAllDataBtn = document.getElementById("deleteAllDataBtn");
  const deleteAllModal = document.getElementById("deleteAllModal"); // if exists
  const closeDeleteAll = document.getElementById("closeDeleteAll"); // if exists
  const confirmDeleteAllBtn = document.getElementById("confirmDeleteAllBtn"); // if exists
  const cancelDeleteAllBtn = document.getElementById("cancelDeleteAllBtn"); // if exists
  const newChatBtn = document.getElementById("newChatBtn");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  // Theme toggle
  themeSwitcher.addEventListener("click", () => {
    body.classList.add("theme-transition");
    body.classList.toggle("dark-mode");
    settingsMenu.classList.add("hidden");
    const isDark = body.classList.contains("dark-mode");
    themeIcon.src = isDark ? "images/accent-icons/theme-dark.svg" : "images/accent-icons/theme-accent.svg";
    settingsIcon.src = isDark ? "images/accent-icons/settings-dark.svg" : "images/accent-icons/settings-accent.svg";
    userIcon.src = isDark ? "images/accent-icons/user-dark.svg" : "images/accent-icons/user-accent.svg";
    logoIcon.src = isDark ? "images/accent-icons/migrant-logo-dark.svg" : "images/accent-icons/migrant-logo-accent.svg";
    sendIcon.src = isDark ? "images/accent-icons/send-dark.svg" : "images/accent-icons/send-accent.svg";
    setTimeout(() => { body.classList.remove("theme-transition"); }, 300);
  });
  
  // Settings menu
  settingsBtn.addEventListener("click", () => { settingsMenu.classList.toggle("hidden"); });
  openAboutUs.addEventListener("click", () => { aboutModal.classList.remove("hidden"); settingsMenu.classList.add("hidden"); });
  closeAbout.addEventListener("click", () => { aboutModal.classList.add("hidden"); });
  profileBtn.addEventListener("click", () => { profileModal.classList.remove("hidden"); });
  closeProfile.addEventListener("click", () => { profileModal.classList.add("hidden"); });
  
  // Delete All Chat History (if implemented via a modal)
  if(deleteAllDataBtn){
    deleteAllDataBtn.addEventListener("click", () => { settingsMenu.classList.add("hidden"); if(deleteAllModal) deleteAllModal.classList.remove("hidden"); });
  }
  
  // New Chat button: check auth
  newChatBtn.addEventListener("click", () => {
    if (!localStorage.getItem("userId")) {
      openAuthModal();
      return;
    }
    createNewConversation();
  });
  
  // Send message: check auth
  sendBtn.addEventListener("click", () => {
    if (!localStorage.getItem("userId")) {
      openAuthModal();
      return;
    }
    sendMessage();
  });
  
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!localStorage.getItem("userId")) {
        openAuthModal();
        return;
      }
      sendMessage();
    }
  });
  chatInput.addEventListener("input", () => autoResize(chatInput));

  window.addEventListener("click", (e) => {
    if (e.target === aboutModal) aboutModal.classList.add("hidden");
    if (e.target === profileModal) profileModal.classList.add("hidden");
  });

  if (!localStorage.getItem("userId")) {
    openAuthModal();
  } else {
    fetchIntro();
    fetchConversations();
  }

  // Expose modal functions for rename and delete conversation
  window.openRenameModal = (convId, oldName) => {
    renameConvId = convId;
    document.getElementById("renameInput").value = oldName || "";
    document.getElementById("renameModal").classList.remove("hidden");
  };
  window.openDeleteConvModal = (convId) => {
    deleteConvId = convId;
    document.getElementById("deleteConvModal").classList.remove("hidden");
  };
});
