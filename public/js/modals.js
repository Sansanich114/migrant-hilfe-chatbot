function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

window.openModal = openModal;
window.closeModal = closeModal;
