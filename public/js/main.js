// main.js
// Global initialization: sets up event listeners, orchestrates the chat logic

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
  const deleteAllModal = document.getElementById("deleteAllModal");
  const closeDeleteAll = document.getElementById("closeDeleteAll");
  const confirmDeleteAllBtn = document.getElementById("confirmDeleteAllBtn");
  const cancelDeleteAllBtn = document.getElementById("cancelDeleteAllBtn");

  const newChatBtn = document.getElementById("newChatBtn");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  // Rename + Delete Conversation Modals
  const renameModal = document.getElementById("renameModal");
  const closeRename = document.getElementById("closeRename");
  const renameInput = document.getElementById("renameInput");
  const saveRenameBtn = document.getElementById("saveRenameBtn");
  const cancelRenameBtn = document.getElementById("cancelRenameBtn");

  const deleteConvModal = document.getElementById("deleteConvModal");
  const closeDeleteConv = document.getElementById("closeDeleteConv");
  const confirmDeleteConvBtn = document.getElementById("confirmDeleteConvBtn");
  const cancelDeleteConvBtn = document.getElementById("cancelDeleteConvBtn");

  let renameConvId = null;
  let deleteConvId = null;

  // THEME TOGGLE
  themeSwitcher.addEventListener("click", () => {
    body.classList.add("theme-transition");
    body.classList.toggle("dark-mode");
    settingsMenu.classList.add("hidden");

    const isDark = body.classList.contains("dark-mode");
    themeIcon.src    = isDark ? "images/accent-icons/theme-dark.svg"    : "images/accent-icons/theme-accent.svg";
    settingsIcon.src = isDark ? "images/accent-icons/settings-dark.svg" : "images/accent-icons/settings-accent.svg";
    userIcon.src     = isDark ? "images/accent-icons/user-dark.svg"     : "images/accent-icons/user-accent.svg";
    logoIcon.src     = isDark ? "images/accent-icons/migrant-logo-dark.svg" : "images/accent-icons/migrant-logo-accent.svg";
    sendIcon.src     = isDark ? "images/accent-icons/send-dark.svg"     : "images/accent-icons/send-accent.svg";

    // Remove the transition class after 300ms
    setTimeout(() => {
      body.classList.remove("theme-transition");
    }, 300);
  });

  // SETTINGS MENU
  settingsBtn.addEventListener("click", () => {
    settingsMenu.classList.toggle("hidden");
  });

  // ABOUT US MODAL
  openAboutUs.addEventListener("click", () => {
    aboutModal.classList.remove("hidden");
    settingsMenu.classList.add("hidden");
  });
  closeAbout.addEventListener("click", () => {
    aboutModal.classList.add("hidden");
  });

  // PROFILE MODAL
  profileBtn.addEventListener("click", () => {
    profileModal.classList.remove("hidden");
  });
  closeProfile.addEventListener("click", () => {
    profileModal.classList.add("hidden");
  });

  // DELETE ALL DATA
  deleteAllDataBtn.addEventListener("click", () => {
    settingsMenu.classList.add("hidden");
    deleteAllModal.classList.remove("hidden");
  });
  closeDeleteAll.addEventListener("click", () => {
    deleteAllModal.classList.add("hidden");
  });
  confirmDeleteAllBtn.addEventListener("click", () => {
    deleteAllModal.classList.add("hidden");
    deleteAllUserData();
  });
  cancelDeleteAllBtn.addEventListener("click", () => {
    deleteAllModal.classList.add("hidden");
  });

  // NEW CHAT
  newChatBtn.addEventListener("click", () => {
    createNewConversation();
  });

  // SEND MESSAGE
  sendBtn.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // AUTO-RESIZE
  chatInput.addEventListener("input", () => autoResize(chatInput));

  // CLOSE MODALS IF CLICK OUTSIDE
  window.addEventListener("click", (e) => {
    if (e.target === aboutModal) aboutModal.classList.add("hidden");
    if (e.target === profileModal) profileModal.classList.add("hidden");
    if (e.target === renameModal) renameModal.classList.add("hidden");
    if (e.target === deleteConvModal) deleteConvModal.classList.add("hidden");
    if (e.target === deleteAllModal) deleteAllModal.classList.add("hidden");
  });

  // CREATE PROFILE IF NEEDED
  if (!localStorage.getItem("userId")) {
    createProfile();
  } else {
    fetchIntro();
    fetchConversations();
  }

  // RENAME CONVERSATION
  closeRename.addEventListener("click", () => {
    renameModal.classList.add("hidden");
  });
  cancelRenameBtn.addEventListener("click", () => {
    renameModal.classList.add("hidden");
  });
  saveRenameBtn.addEventListener("click", async () => {
    const newName = renameInput.value.trim();
    if (!newName) return;
    renameModal.classList.add("hidden");

    try {
      await fetch("/renameConversation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: renameConvId, newName })
      });
      fetchConversations();
    } catch (err) {
      console.error("Rename failed:", err);
    }
  });

  // DELETE CONVERSATION
  closeDeleteConv.addEventListener("click", () => {
    deleteConvModal.classList.add("hidden");
  });
  cancelDeleteConvBtn.addEventListener("click", () => {
    deleteConvModal.classList.add("hidden");
  });
  confirmDeleteConvBtn.addEventListener("click", async () => {
    deleteConvModal.classList.add("hidden");
    try {
      await fetch("/deleteConversation", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: deleteConvId })
      });
      fetchConversations();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  });

  window.openRenameModal = (convId, oldName) => {
    renameConvId = convId;
    renameInput.value = oldName || "";
    renameModal.classList.remove("hidden");
  };
  window.openDeleteConvModal = (convId) => {
    deleteConvId = convId;
    deleteConvModal.classList.remove("hidden");
  };
});

/** Creates a new conversation */
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
      if (!data.conversationId) {
        console.error("No conversationId returned:", data);
        alert("Error creating new conversation.");
        return;
      }
      localStorage.setItem("conversationId", data.conversationId);
      fetchConversations();
    })
    .catch((err) => console.error("Error creating new conversation:", err));
}
