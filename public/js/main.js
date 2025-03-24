document.addEventListener("DOMContentLoaded", function() {
  fetch("agency/config.json")
    .then(response => response.json())
    .then(config => {
      document.getElementById("agencyName").textContent = config.agencyName;
      document.getElementById("agencyLogo").src = config.logoURL;
      document.getElementById("pageTitle").textContent = config.agencyName + " Chatbot";
      document.documentElement.style.setProperty("--brand-color", config.brandColor);
    })
    .catch(err => console.error("Error loading config:", err));
});
