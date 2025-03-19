document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const themeSwitcher = document.getElementById("themeSwitcher");
  const themeIcon = document.getElementById("themeIcon");
  const logoIcon = document.getElementById("logoIcon");
  const sendIcon = document.getElementById("sendIcon");
  const aboutModal = document.getElementById("aboutModal");
  const closeAbout = document.getElementById("closeAbout");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  // === THEME TOGGLE ===
  themeSwitcher.addEventListener("click", () => {
    body.classList.add("theme-transition");
    body.classList.toggle("dark-mode");
    const isDark = body.classList.contains("dark-mode");

    // Swap theme icons:
    // In dark mode, show a Sun icon (to switch to light)
    // In light mode, show a Moon icon (to switch to dark)
    themeIcon.src = isDark
      ? "https://img.icons8.com/ios-filled/24/000000/sun--v1.png"         // Sun icon for dark mode
      : "https://img.icons8.com/ios-filled/24/ffffff/crescent-moon.png";    // Moon icon for light mode

    // Toggle the main logo for dark mode (if desired)
    logoIcon.src = isDark
      ? "https://img.icons8.com/ios-filled/50/ffffff/home--v1.png"
      : "https://img.icons8.com/ios-filled/50/000000/home--v1.png";

    // Toggle send icon (remains unchanged here)
    sendIcon.src = isDark
      ? "https://img.icons8.com/ios-filled/24/ffffff/filled-sent.png"
      : "https://img.icons8.com/ios-filled/24/000000/filled-sent.png";

    setTimeout(() => {
      body.classList.remove("theme-transition");
    }, 300);
  });

  // === ABOUT MODAL ===
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

  // === CHAT SEND EVENTS ===
  // 1) Clicking the "Send" button
  sendBtn.addEventListener("click", () => {
    sendMessage();
  });

  // 2) Pressing "Enter" (without Shift) in the textarea
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Fetch intro message on load
  fetchIntro();
});
