// modals.js
// Code to handle modal open/close behaviors and settings menus

function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
  }
  
  function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }
  
  // Example: Attaching event listeners for modal triggers could go here
  