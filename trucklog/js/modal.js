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

export function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%)',
    'z-index:9999', 'padding:10px 18px', 'border-radius:12px',
    'font-size:0.875rem', 'font-weight:700', 'color:#fff',
    'box-shadow:0 4px 24px rgba(0,0,0,0.6)', 'pointer-events:none',
    'white-space:nowrap', 'transition:opacity 0.3s',
  ].join(';');
  el.style.background = type === 'error' ? '#DC2626' : type === 'info' ? '#EA580C' : '#16A34A';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2200);
}

export function confirmSheet(title, msg, confirmLabel, onConfirm) {
  openModal(`
    <div class="p-5 text-center">
      <p class="font-black text-lg">${title}</p>
      ${msg ? `<p class="text-gray-400 text-sm mt-1.5 px-2">${msg}</p>` : ''}
      <div class="flex gap-3 mt-5">
        <button onclick="closeModal()" class="flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl">Cancel</button>
        <button id="confirm-yes-btn" class="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">${confirmLabel || 'Delete'}</button>
      </div>
    </div>
  `, el => {
    el.querySelector('#confirm-yes-btn').addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  });
}

window.closeModal = closeModal;
