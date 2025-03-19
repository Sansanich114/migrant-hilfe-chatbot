document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const themeSwitcher = document.getElementById("themeSwitcher");
  const themeIcon = document.getElementById("themeIcon");
  const logoIcon = document.getElementById("logoIcon");
  const sendIcon = document.getElementById("sendIcon");
  const closeAbout = document.getElementById("closeAbout");
  const aboutModal = document.getElementById("aboutModal");

  // Theme toggle functionality
  themeSwitcher.addEventListener("click", () => {
    body.classList.add("theme-transition");
    body.classList.toggle("dark-mode");
    const isDark = body.classList.contains("dark-mode");
    themeIcon.src = isDark
      ? "https://example.com/icons/theme-dark.svg"
      : "https://example.com/icons/theme-light.svg";
    logoIcon.src = isDark
      ? "https://example.com/icons/real-estate-logo-dark.svg"
      : "https://example.com/icons/real-estate-logo.svg";
    sendIcon.src = isDark
      ? "https://example.com/icons/send-dark.svg"
      : "https://example.com/icons/send-light.svg";
    setTimeout(() => {
      body.classList.remove("theme-transition");
    }, 300);
  });

  // About modal handling
  if (aboutModal) {
    document.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.classList.add("hidden");
      }
    });
    closeAbout.addEventListener("click", () => {
      aboutModal.classList.add("hidden");
    });
  }

  // Initialize the chat with an intro message
  fetchIntro();
});
