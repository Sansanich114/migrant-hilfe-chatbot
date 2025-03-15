// darkMode.js
function initDarkMode() {
  const darkModeToggle = document.getElementById("darkModeToggle");
  if (!darkModeToggle) return;

  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    darkModeToggle.innerText = document.body.classList.contains("dark-mode")
      ? "Light Mode"
      : "Dark Mode";
  });
}

export { initDarkMode };
