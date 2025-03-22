// public/js/main.js

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const themeSwitcher = document.getElementById("themeSwitcher");
  const themeIcon = document.getElementById("themeIcon");
  const logoIcon = document.getElementById("logoIcon"); // If you still have a logo
  const sendIcon = document.getElementById("sendIcon");
  const aboutModal = document.getElementById("aboutModal");
  const closeAbout = document.getElementById("closeAbout");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  // 1) If user is not logged in, open the auth modal
  //    so they can't send messages without a valid userId.
  const userId = localStorage.getItem("userId");
  if (!userId) {
    // Only do this if you have an auth modal defined (e.g., #authModal in HTML).
    // If you do, open it right away:
    if (typeof openAuthModal === "function") {
      openAuthModal();
    }
  }

  // THEME TOGGLE
  themeSwitcher.addEventListener("click", () => {
    body.classList.add("theme-transition");
    body.classList.toggle("dark-mode");
    const isDark = body.classList.contains("dark-mode");

    // Update theme toggle icons:
    // In dark mode, use the accent icon; in light mode, use the correct dark theme file.
    themeIcon.src = isDark
      ? "images/accent-icons/theme-accent.svg"  // Icon for dark mode active
      : "images/accent-icons/theme-dark.svg";   // Correct light mode icon

    // Always use the white send icon for better visibility
    sendIcon.src = "images/accent-icons/send-dark.svg";

    // If you have a logo and want to change it in dark mode, uncomment:
    /*
    if (logoIcon) {
      logoIcon.src = isDark
        ? "images/accent-icons/migrant-logo-dark.svg"
        : "images/accent-icons/migrant-logo-accent.svg";
    }
    */

    setTimeout(() => {
      body.classList.remove("theme-transition");
    }, 300);
  });

  // ABOUT MODAL
  if (aboutModal && closeAbout) {
    document.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.add("hidden");
      }
    });
    closeAbout.addEventListener("click", () => {
      aboutModal.classList.add("hidden");
    });
  }

  // SEND BUTTON CLICK
  sendBtn.addEventListener("click", () => {
    sendMessage();
  });

  // PRESSING ENTER
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // FETCH INTRO MESSAGE ON LOAD
  fetchIntro();
});
