// main.js
// Loads config.json, applies dynamic branding. Dark mode removed.

function lightenColor(hex, percent) {
  // Simple lighten function if you need it for brand color adjustments
  let num = parseInt(hex.replace('#',''), 16);
  let r = (num >> 16) + Math.round(2.55 * percent);
  let g = ((num >> 8) & 0x00FF) + Math.round(2.55 * percent);
  let b = (num & 0x0000FF) + Math.round(2.55 * percent);

  r = (r < 0) ? 0 : ((r > 255) ? 255 : r);
  g = (g < 0) ? 0 : ((g > 255) ? 255 : g);
  b = (b < 0) ? 0 : ((b > 255) ? 255 : b);

  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

document.addEventListener("DOMContentLoaded", () => {
  // 1) Fetch config.json for brand color, agency name, etc.
  fetch("agency/config.json")
    .then(response => response.json())
    .then(config => {
      const agencyName = config.agencyName || "Realty Assistant";
      const brandColor = config.brandColor || "#123456";
      const lighterColor = lightenColor(brandColor, 25);

      // Update nav & page title
      const agencyNameEl = document.getElementById("agencyName");
      const pageTitleEl = document.getElementById("pageTitle");
      if (agencyNameEl) agencyNameEl.textContent = agencyName;
      if (pageTitleEl) pageTitleEl.textContent = agencyName + " Chatbot";

      // Set the logo
      const agencyLogoEl = document.getElementById("agencyLogo");
      if (agencyLogoEl && config.logoURL) {
        agencyLogoEl.src = config.logoURL;
      }

      // Update CSS variables
      document.documentElement.style.setProperty("--brand-color", brandColor);
      document.documentElement.style.setProperty("--brand-color-lighter", lighterColor);
    })
    .catch(err => console.error("Error loading agency config:", err));

  // No dark mode toggling code here—removed entirely
});
