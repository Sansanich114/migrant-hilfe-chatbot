// modals.js
// Handles About Us and Profile modals, plus any others

function openModal(modal) {
    modal.classList.remove('hidden');
  }
  
  function closeModal(modal) {
    modal.classList.add('hidden');
  }
  
  // Export to global scope
  window.openModal = openModal;
  window.closeModal = closeModal;
  