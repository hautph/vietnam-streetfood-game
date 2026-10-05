/**
 * streetfood-nav.js
 * Tiện ích thanh điều hướng dùng chung cho cả 4 game ẩm thực đường phố:
 * - Nút "🏠 Về Cổng Game" nổi góc màn hình (Floating Home Button)
 * - Tự động ghi nhớ vị trí kéo/thả (Draggable) nếu người chơi muốn di chuyển
 * - Menu xác nhận quay về trang chủ nhanh chóng, không làm mất tiến trình
 */

(function () {
  'use strict';

  if (window.__STREETFOOD_NAV_INITIALIZED__) return;
  window.__STREETFOOD_NAV_INITIALIZED__ = true;

  // Đường dẫn về trang chủ (Hub Portal)
  const HOME_URL = '../index.html';

  function injectNav() {
    if (document.getElementById('streetfood-home-btn')) return;

    // 1. Thêm CSS giao diện nút Home
    const style = document.createElement('style');
    style.id = 'streetfood-nav-style';
    style.textContent = `
      #streetfood-home-btn {
        position: fixed;
        top: calc(env(safe-area-inset-top, 0px) + 12px);
        left: 12px;
        z-index: 999999;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #7c2d12;
        border: 2px solid #fdba74;
        border-radius: 999px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(124, 45, 18, 0.18), 0 2px 4px rgba(0, 0, 0, 0.08);
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      #streetfood-home-btn:hover {
        background: #fff7ed;
        border-color: #ea580c;
        color: #ea580c;
        transform: translateY(-2px) scale(1.04);
        box-shadow: 0 6px 18px rgba(234, 88, 12, 0.28);
      }
      #streetfood-home-btn:active {
        transform: translateY(1px) scale(0.96);
      }
      #streetfood-home-btn .sf-icon {
        font-size: 15px;
        line-height: 1;
      }
      #streetfood-home-btn .sf-text {
        white-space: nowrap;
      }

      /* Modal xác nhận thoát về Hub */
      #streetfood-confirm-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000000;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      #streetfood-confirm-overlay.show {
        opacity: 1;
        pointer-events: auto;
      }
      #streetfood-confirm-box {
        background: #ffffff;
        color: #1f2937;
        width: 100%;
        max-width: 340px;
        border-radius: 20px;
        padding: 24px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        transform: scale(0.92);
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        font-family: system-ui, -apple-system, sans-serif;
      }
      #streetfood-confirm-overlay.show #streetfood-confirm-box {
        transform: scale(1);
      }
      #streetfood-confirm-box h3 {
        margin: 0 0 10px;
        font-size: 18px;
        font-weight: 800;
        color: #9a3412;
      }
      #streetfood-confirm-box p {
        margin: 0 0 20px;
        font-size: 14px;
        color: #4b5563;
        line-height: 1.5;
      }
      #streetfood-confirm-box .sf-btns {
        display: flex;
        gap: 10px;
      }
      #streetfood-confirm-box button {
        flex: 1;
        padding: 11px 16px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        border: none;
        transition: transform 0.15s;
      }
      #streetfood-confirm-box button:active {
        transform: scale(0.96);
      }
      #sf-btn-cancel {
        background: #f3f4f6;
        color: #374151;
      }
      #sf-btn-confirm {
        background: #ea580c;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(234, 88, 12, 0.35);
      }

      /* Tự động thu gọn text trên màn hình hẹp khi chơi */
      @media (max-width: 480px) {
        #streetfood-home-btn {
          padding: 6px 9px;
        }
        #streetfood-home-btn .sf-text {
          font-size: 12px;
        }
      }
    `;
    document.head.appendChild(style);

    // 2. Tạo nút Home
    const btn = document.createElement('button');
    btn.id = 'streetfood-home-btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Về Cổng Game');
    btn.innerHTML = `<span class="sf-icon">🏠</span><span class="sf-text">Cổng Game</span>`;

    // 3. Tạo Modal xác nhận
    const overlay = document.createElement('div');
    overlay.id = 'streetfood-confirm-overlay';
    overlay.innerHTML = `
      <div id="streetfood-confirm-box">
        <div style="font-size: 36px; margin-bottom: 8px;">🏮</div>
        <h3>Quay về Cổng Game?</h3>
        <p>Tiến trình hiện tại của bạn đã được ghi nhớ trên máy. Bạn có thể quay lại bất cứ lúc nào!</p>
        <div class="sf-btns">
          <button id="sf-btn-cancel" type="button">Ở lại chơi</button>
          <button id="sf-btn-confirm" type="button">Về Cổng Game</button>
        </div>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(overlay);

    // 4. Xử lý mở/đóng modal và điều hướng
    function openConfirm() {
      overlay.classList.add('show');
    }

    function closeConfirm() {
      overlay.classList.remove('show');
    }

    function goHome() {
      window.location.href = HOME_URL;
    }

    // Sự kiện kéo thả nhẹ để người chơi di chuyển nút nếu bị che giao diện
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    // Khôi phục vị trí lưu nếu có
    try {
      const savedPos = JSON.parse(localStorage.getItem('sf_nav_pos') || 'null');
      if (savedPos && savedPos.left != null && savedPos.top != null) {
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 40;
        const safeLeft = Math.max(8, Math.min(maxX, savedPos.left));
        const safeTop = Math.max(8, Math.min(maxY, savedPos.top));
        btn.style.left = safeLeft + 'px';
        btn.style.top = safeTop + 'px';
      }
    } catch (_) {}

    function onPointerDown(e) {
      if (e.target.closest('#streetfood-confirm-overlay')) return;
      isDragging = true;
      hasMoved = false;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX;
      startY = clientY;
      const rect = btn.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startX;
      const dy = clientY - startY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasMoved = true;
        const newLeft = Math.max(8, Math.min(window.innerWidth - btn.offsetWidth - 8, initialLeft + dx));
        const newTop = Math.max(8, Math.min(window.innerHeight - btn.offsetHeight - 8, initialTop + dy));
        btn.style.left = newLeft + 'px';
        btn.style.top = newTop + 'px';
      }
    }

    function onPointerUp() {
      if (isDragging) {
        isDragging = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);

        if (hasMoved) {
          try {
            const rect = btn.getBoundingClientRect();
            localStorage.setItem('sf_nav_pos', JSON.stringify({ left: rect.left, top: rect.top }));
          } catch (_) {}
        }
      }
    }

    btn.addEventListener('pointerdown', onPointerDown);

    btn.addEventListener('click', (e) => {
      if (hasMoved) return; // Nếu vừa kéo thì không mở modal
      openConfirm();
    });

    document.getElementById('sf-btn-cancel').onclick = closeConfirm;
    document.getElementById('sf-btn-confirm').onclick = goHome;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeConfirm();
    });

    // Nhấn phím Escape để đóng popup
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('show')) {
        closeConfirm();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }
})();
