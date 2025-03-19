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

  // THEME TOGGLE
  themeSwitcher.addEventListener("click", () => {
    body.classList.add("theme-transition");
    body.classList.toggle("dark-mode");
    const isDark = body.classList.contains("dark-mode");

    // If dark => show a bright sun icon
    // If light => show a dark moon icon
    themeIcon.src = isDark
      ? "images/accent-icons/sun-bright.svg"   // bright sun in dark mode
      : "images/accent-icons/moon-dark.svg";   // dark moon in light mode

    // Optionally update send icon color
    sendIcon.src = isDark
      ? "images/accent-icons/send-dark.svg"
      : "images/accent-icons/send-accent.svg";

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
