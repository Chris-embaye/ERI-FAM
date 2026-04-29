let _cleanup = null;

export function openModal(html, onMount) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = html;
  overlay.classList.remove('hidden');
  if (onMount) _cleanup = onMount(content) || null;
}

export function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  if (_cleanup) { _cleanup(); _cleanup = null; }
}

window.closeModal = closeModal;
