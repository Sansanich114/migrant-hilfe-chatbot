function initDarkMode() {
  const darkModeToggle = document.getElementById("darkModeToggle");
  darkModeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    darkModeToggle.innerText = document.body.classList.contains("dark-mode")
      ? "Light Mode"
      : "Dark Mode";
  });
}

export { initDarkMode };
