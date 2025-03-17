// public/js/auth.js
document.addEventListener("DOMContentLoaded", () => {
  const authModal = document.getElementById("authModal");
  const closeAuth = document.getElementById("closeAuth");
  const showSignup = document.getElementById("showSignup");
  const showLogin = document.getElementById("showLogin");
  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  const signupBtn = document.getElementById("signupBtn");
  const loginBtn = document.getElementById("loginBtn");

  // Toggle between signup and login forms
  showSignup.addEventListener("click", () => {
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  });
  showLogin.addEventListener("click", () => {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
  });
  closeAuth.addEventListener("click", () => {
    authModal.classList.add("hidden");
  });

  // Signup handler
  signupBtn.addEventListener("click", async () => {
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const passwordConfirm = document.getElementById("signupPasswordConfirm").value;
    if (!email || !password || !passwordConfirm) {
      alert("Please fill in all fields.");
      return;
    }
    if (password !== passwordConfirm) {
      alert("Passwords do not match.");
      return;
    }
    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, confirmPassword: passwordConfirm })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Signup successful!");
        authModal.classList.add("hidden");
      } else {
        alert(data.error || "Signup failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Signup error.");
    }
  });

  // Login handler
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    if (!email || !password) {
      alert("Please fill in both fields.");
      return;
    }
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        // Save session token and user info
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("email", data.email);
        authModal.classList.add("hidden");
        location.reload(); // reload to allow chat functionality
      } else {
        alert(data.error || "Login failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Login error.");
    }
  });
});

// Expose a function to show the auth modal from other scripts
window.openAuthModal = function() {
  document.getElementById("authModal").classList.remove("hidden");
};
