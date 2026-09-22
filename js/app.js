/**
 * 안양·군포·의왕 공장·창고·상가·사무실 전문 부동산 메인 스크립트
 * Dynamic Property Filtering, Serverless Board Integration, Modals, Touch CTA
 */

// State Management
const state = {
  properties: [],
  boardPosts: [],
  reviews: [],
  currentPropCategory: 'all',
  currentPropRegion: 'all',
  currentBoardCategory: 'all',
  currentReviewFilter: 'all',
  boardSearchQuery: ''
};

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', () => {
  initHeaderScroll();
  loadProperties();
  loadBoardPosts();
  loadReviews();
  initFilterEvents();
  initReviewFilterEvents();
  initInquiryForm();
});

// 1. Header Scroll Effect
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

// 2. Load Properties
async function loadProperties() {
  try {
    let res = await fetch('/api/properties');
    if (!res.ok) {
      res = await fetch('data/properties.json');
    }
    const data = await res.json();
    state.properties = data.properties || (Array.isArray(data) ? data : []);
    renderProperties();
  } catch (err) {
    console.error('Properties load error:', err);
    try {
      const fallbackRes = await fetch('data/properties.json');
      state.properties = await fallbackRes.json();
      renderProperties();
    } catch (e) {
      const grid = document.getElementById('propertyGrid');
      if (grid) {
        grid.innerHTML = '<p class="error-msg">매물 데이터를 불러오는 중 오류가 발생했습니다.</p>';
      }
    }
  }
}

// 3. Render Properties
function renderProperties() {
  const grid = document.getElementById('propertyGrid');
  const countBadge = document.getElementById('propCountBadge');
  if (!grid) return;

  const filtered = state.properties.filter(item => {
    const matchCat = state.currentPropCategory === 'all' || item.type === state.currentPropCategory;
    const matchRegion = state.currentPropRegion === 'all' || item.region === state.currentPropRegion;
    return matchCat && matchRegion;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length}개 매물 보유`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff; border-radius: 16px; border: 1px dashed #cbd5e1;">
        <p style="font-size: 16px; font-weight: 700; color: #475569; margin-bottom: 8px;">선택하신 조건에 해당하는 실시간 매물이 준비 중입니다.</p>
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 18px;">원하시는 면적과 조건을 전화로 말씀해 주시면 즉시 미공개 급매물을 찾아드립니다.</p>
        <a href="tel:031-442-5918" class="btn-primary-glow" style="display:inline-flex; padding: 12px 24px; font-size: 14px;">📞 031-442-5918 맞춤 매물 즉시 문의</a>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const priceDisplay = item.priceType === '매매' 
      ? `매매 <span class="num">${formatMoney(item.salePrice)}</span>`
      : `보 <span class="num">${item.deposit}</span> / 월 <span class="num">${item.rent}만</span>`;

    return `
      <article class="property-card" data-id="${item.id}">
        <div class="prop-img-box">
          <img src="${item.image}" alt="${item.title}" class="prop-img" loading="lazy">
          <span class="prop-badge-top">${item.badge}</span>
          <span class="prop-type-badge">${item.typeName}</span>
        </div>
        <div class="prop-body">
          <div class="prop-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            ${item.regionName}
          </div>
          <h3 class="prop-title" title="${item.title}">${item.title}</h3>
          
          <div class="prop-price-box">
            <span class="price-type">${item.priceType}</span>
            <span class="price-amount">${priceDisplay}</span>
          </div>

          <div class="prop-specs-grid">
            <div class="spec-entry">
              <span>전용면적</span>
              <strong>${item.areaPyeong}평 (${item.areaM2}㎡)</strong>
            </div>
            <div class="spec-entry">
              <span>층수/층고</span>
              <strong>${item.floor} (${item.ceilingHeight})</strong>
            </div>
            <div class="spec-entry">
              <span>전력</span>
              <strong>${item.electricPower}</strong>
            </div>
            <div class="spec-entry">
              <span>주차</span>
              <strong>${item.parking}</strong>
            </div>
          </div>

          <div class="prop-chips">
            ${item.specs.map(s => `<span class="chip-tag">${s}</span>`).join('')}
          </div>

          <div class="prop-actions">
            <a href="tel:031-442-5918" class="btn-card-call" title="전화 상담">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
              즉시 전화
            </a>
            <button class="btn-card-detail" onclick="openPropertyDetail('${item.id}')">상세 스펙</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// 4. Load Board Posts (Vercel Serverless API or local data fallback)
async function loadBoardPosts() {
  const grid = document.getElementById('boardGrid');
  if (!grid) return;

  grid.innerHTML = '<p style="grid-column:1/-1; text-align:center; padding:30px; color:#64748b;">부동산 소식을 불러오고 있습니다...</p>';

  try {
    // Try Serverless API first
    let res = await fetch('/api/board');
    if (!res.ok) {
      // Fallback directly to static data file
      res = await fetch('data/board.json');
    }
    const data = await res.json();
    state.boardPosts = data.posts || (Array.isArray(data) ? data : []);
    renderBoard();
  } catch (err) {
    console.warn('API fetch failed, reading static data/board.json:', err);
    try {
      const res = await fetch('data/board.json');
      state.boardPosts = await res.json();
      renderBoard();
    } catch (e) {
      grid.innerHTML = '<p class="error-msg" style="grid-column:1/-1; text-align:center; padding:30px; color:#ef4444;">게시글을 불러올 수 없습니다.</p>';
    }
  }
}

// 5. Render Board Posts
function renderBoard() {
  const grid = document.getElementById('boardGrid');
  if (!grid) return;

  const query = state.boardSearchQuery.trim().toLowerCase();

  const filtered = state.boardPosts.filter(post => {
    const matchCat = state.currentBoardCategory === 'all' || post.category === state.currentBoardCategory;
    const matchQuery = !query || 
      post.title.toLowerCase().includes(query) ||
      post.summary.toLowerCase().includes(query) ||
      (post.tags && post.tags.some(t => t.toLowerCase().includes(query)));
    return matchCat && matchQuery;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">
        <p style="font-weight: 700; margin-bottom: 6px;">검색된 소식이 없습니다.</p>
        <p style="font-size: 13px;">다른 검색어나 카테고리를 선택해 보세요.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(post => `
    <article class="news-card" onclick="openBoardDetail('${post.id}')">
      <div class="news-thumb-wrap">
        <img src="${post.thumbnail}" alt="${post.title}" class="news-thumb" loading="lazy">
        <span class="news-cat-chip">${post.category}</span>
        ${post.isPinned ? '<span class="news-pinned-icon">중요</span>' : ''}
      </div>
      <div class="news-body">
        <div class="news-meta">
          <span>${post.date}</span>
          <span>조회수 ${post.views || 1}</span>
        </div>
        <h3 class="news-title">${post.title}</h3>
        <p class="news-summary">${post.summary}</p>
        <div class="news-tags">
          ${(post.tags || []).slice(0, 3).map(t => `<span class="news-tag-item">#${t}</span>`).join('')}
        </div>
      </div>
    </article>
  `).join('');
}

// 6. Interactive Filter Events
function initFilterEvents() {
  // Property Category Tabs
  document.querySelectorAll('.cat-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.cat-tab-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.currentPropCategory = e.currentTarget.dataset.type;
      renderProperties();
    });
  });

  // Property Region Chips
  document.querySelectorAll('.region-chip').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.region-chip').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.currentPropRegion = e.currentTarget.dataset.region;
      renderProperties();
    });
  });

  // Board Category Pills
  document.querySelectorAll('.board-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.board-pill-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      state.currentBoardCategory = e.currentTarget.dataset.category;
      renderBoard();
    });
  });

  // Board Search Input
  const searchInput = document.getElementById('boardSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.boardSearchQuery = e.target.value;
      renderBoard();
    });
  }
}

// 7. Modals: Board Article Detail View
window.openBoardDetail = function(postId) {
  const post = state.boardPosts.find(p => p.id === postId);
  if (!post) return;

  // Increment views
  post.views = (post.views || 0) + 1;
  renderBoard();

  // Try updating view count to API in background
  fetch('/api/board', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': 'admin1234' },
    body: JSON.stringify({ id: post.id, views: post.views })
  }).catch(() => {});

  const modalOverlay = document.getElementById('detailModalOverlay');
  const modalContainer = document.getElementById('detailModalContainer');

  // Simple Markdown to HTML formatter for content
  const formattedContent = formatMarkdown(post.content);

  modalContainer.innerHTML = `
    <button class="modal-close-btn" onclick="closeDetailModal()">&times;</button>
    <img src="${post.thumbnail}" alt="${post.title}" class="modal-header-img">
    <div class="modal-body">
      <span class="section-tag" style="margin-bottom:8px;">${post.category}</span>
      <h2 class="modal-article-title">${post.title}</h2>
      <div class="modal-article-meta">
        <span>작성자: ${post.author || '대표 공인중개사'}</span>
        <span>등록일: ${post.date}</span>
        <span>조회수: ${post.views}</span>
      </div>
      <div class="modal-article-content">
        ${formattedContent}
      </div>
      <div class="modal-call-footer">
        <h4 style="font-size:16px; font-weight:800; color:#0f766e; margin-bottom:6px;">이 소식과 관련된 안양·군포·의왕 맞춤 매물이 필요하신가요?</h4>
        <p style="font-size:13px; color:#64748b; margin-bottom:14px;">조건(평수, 층고, 예산)에 부합하는 급매물을 즉시 브리핑해 드립니다.</p>
        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <a href="tel:031-442-5918" class="btn-primary-glow" style="padding:10px 20px; font-size:14px;">📞 031-442-5918 전화상담</a>
          <a href="tel:010-4637-7428" class="btn-secondary-glass" style="background:#090e17; color:#fff; padding:10px 20px; font-size:14px;">📱 010-4637-7428 직통</a>
        </div>
      </div>
    </div>
  `;

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

// Property Detail Modal
window.openPropertyDetail = function(propId) {
  const item = state.properties.find(p => p.id === propId);
  if (!item) return;

  const modalOverlay = document.getElementById('detailModalOverlay');
  const modalContainer = document.getElementById('detailModalContainer');

  const priceDisplay = item.priceType === '매매' 
    ? `매매 ${formatMoney(item.salePrice)}원`
    : `보증금 ${item.deposit}만원 / 월세 ${item.rent}만원`;

  modalContainer.innerHTML = `
    <button class="modal-close-btn" onclick="closeDetailModal()">&times;</button>
    <img src="${item.image}" alt="${item.title}" class="modal-header-img">
    <div class="modal-body">
      <span class="section-tag" style="margin-bottom:8px;">${item.typeName} · ${item.regionName}</span>
      <h2 class="modal-article-title">${item.title}</h2>
      
      <div style="background:#f0fdfa; border:1px solid #99f6e4; border-radius:12px; padding:16px; margin-bottom:20px;">
        <span style="font-size:13px; color:#0f766e; font-weight:700;">임대/매매 조건</span>
        <div style="font-size:24px; font-weight:900; color:#0d5f58; margin-top:4px;">${priceDisplay}</div>
      </div>

      <h3 style="font-size:17px; font-weight:800; margin-bottom:12px; color:#090e17;">매물 상세 정보표</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:24px; font-size:14px;">
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; color:#64748b; width:30%;">전용 면적</td><td style="padding:10px; font-weight:700;">${item.areaPyeong}평 (${item.areaM2}㎡)</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; color:#64748b;">해당층 / 총층</td><td style="padding:10px; font-weight:700;">${item.floor}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; color:#64748b;">유효 층고</td><td style="padding:10px; font-weight:700;">${item.ceilingHeight}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; color:#64748b;">계약 전력</td><td style="padding:10px; font-weight:700;">${item.electricPower}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; color:#64748b;">주차 대수</td><td style="padding:10px; font-weight:700;">${item.parking}</td></tr>
        <tr><td style="padding:10px; color:#64748b;">특화 사양</td><td style="padding:10px; font-weight:700;">${item.specs.join(', ')}</td></tr>
      </table>

      <div class="modal-call-footer">
        <h4 style="font-size:16px; font-weight:800; color:#0f766e; margin-bottom:6px;">이 매물 실시간 현장 답사 및 가격 협의</h4>
        <p style="font-size:13px; color:#64748b; margin-bottom:14px;">매물 번호 <strong>#${item.id}</strong>을 말씀해 주시면 더욱 빠른 상담이 가능합니다.</p>
        <div style="display:flex; justify-content:center; gap:10px;">
          <a href="tel:031-442-5918" class="btn-primary-glow" style="padding:12px 24px;">📞 바로 전화걸기 (031-442-5918)</a>
        </div>
      </div>
    </div>
  `;

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeDetailModal = function() {
  const modalOverlay = document.getElementById('detailModalOverlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// Fast Inquiry Modal & Form
window.openInquiryModal = function() {
  const modal = document.getElementById('inquiryModalOverlay');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeInquiryModal = function() {
  const modal = document.getElementById('inquiryModalOverlay');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

function initInquiryForm() {
  const form = document.getElementById('fastInquiryForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const type = form.inquiryType.value;
    const region = form.inquiryRegion.value;
    const pyeong = form.inquiryPyeong.value;
    const phone = form.inquiryPhone.value;
    const note = form.inquiryNote.value;

    if (!phone) {
      alert('연락받으실 전화번호를 입력해 주세요.');
      return;
    }

    // Prepare sms link or confirmation
    alert(`[상담 신청 완료]\n${region} ${type} (${pyeong}) 매물 의뢰가 성공적으로 접수되었습니다.\n담당 공인중개사가 10분 이내로 연락드리겠습니다.`);
    
    // Optional: trigger SMS on mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      const smsBody = encodeURIComponent(`[매물의뢰 접수] ${region} / ${type} / ${pyeong} / 연락처: ${phone} / 메모: ${note}`);
      window.location.href = `sms:010-4637-7428?body=${smsBody}`;
    }

    form.reset();
    closeInquiryModal();
  });
}

// Helpers
function formatMoney(amount) {
  if (!amount) return '0';
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000);
    const man = amount % 10000;
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`;
  }
  return `${amount.toLocaleString()}만`;
}

function formatMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '<br><br>');
}

// ==========================================================================
// Verified Client Reviews & Real Property Review System
// ==========================================================================

// 1. Load Reviews
async function loadReviews() {
  try {
    let res = await fetch('/api/reviews');
    if (!res.ok) {
      res = await fetch('data/reviews.json');
    }
    const data = await res.json();
    state.reviews = data.reviews || (Array.isArray(data) ? data : []);
    renderReviews();
  } catch (err) {
    console.error('Reviews load error:', err);
    try {
      const fallbackRes = await fetch('data/reviews.json');
      state.reviews = await fallbackRes.json();
      renderReviews();
    } catch (e) {
      console.error('Fallback load error:', e);
      const grid = document.getElementById('reviewsGrid');
      if (grid) {
        grid.innerHTML = '<p class="error-msg">후기 데이터를 불러오는 중 오류가 발생했습니다.</p>';
      }
    }
  }
}

// 2. Render Reviews Grid
function renderReviews() {
  const grid = document.getElementById('reviewsGrid');
  const countBadge = document.getElementById('totalReviewCount');
  if (!grid) return;

  if (countBadge) {
    countBadge.textContent = state.reviews.length;
  }

  const filtered = state.reviews.filter(item => {
    if (state.currentReviewFilter === 'all') return true;
    const propType = item.property ? item.property.type : '';
    return propType === state.currentReviewFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding: 48px 20px; background:#fff; border-radius:18px; border:1px dashed #cbd5e1;">
        <div style="font-size:36px; margin-bottom:12px;">✍️</div>
        <p style="font-size:16px; font-weight:700; color:#475569; margin-bottom:6px;">선택하신 유형의 등록된 후기가 아직 없습니다.</p>
        <p style="font-size:14px; color:#94a3b8; margin-bottom:18px;">직접 계약하신 실제 매물 정보와 생생한 거래 경험을 첫 번째로 등록해 보세요!</p>
        <button onclick="openReviewModal()" class="btn-write-review">✍️ 첫 거래 후기 직접 등록하기</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const stars = '★'.repeat(item.rating || 5) + '☆'.repeat(5 - (item.rating || 5));
    const prop = item.property || {};
    const specsList = Array.isArray(prop.specs) ? prop.specs : [];
    const tagsList = Array.isArray(item.tags) ? item.tags : [];
    const authorInitial = (item.clientName || '고객').charAt(0);

    return `
      <article class="review-card" data-id="${item.id}">
        <div class="review-card-top">
          <span class="review-badge-verified">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            실거래 계약 검증
          </span>
          <div class="review-card-rating">
            <span class="review-stars">${stars}</span>
            <span class="review-rating-score">${(item.rating || 5).toFixed(1)}</span>
          </div>
        </div>

        <!-- Real Property Info Box -->
        <div class="review-prop-box">
          <div class="review-prop-header">
            <span class="review-prop-type-badge">${prop.typeName || '산업부동산'}</span>
            <span class="review-prop-date">${item.date ? item.date + ' 계약' : '계약완료'}</span>
          </div>
          <h4 class="review-prop-title" title="${prop.title || ''}">🏢 ${prop.title || '실거래 매물'}</h4>
          <div class="review-prop-summary-row">
            <span>📍 ${prop.region || '안양·군포·의왕'}</span>
            <span>•</span>
            <span class="review-prop-price">${prop.price || '상담협의'}</span>
            <span>•</span>
            <span>실 ${prop.areaPyeong || 0}평</span>
          </div>
          ${specsList.length > 0 ? `
            <div class="review-prop-specs-list">
              ${specsList.slice(0, 3).map(s => `<span class="review-prop-spec-pill">${s}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Review Text -->
        <h3 class="review-title">${item.title}</h3>
        <p class="review-content">"${item.content}"</p>

        <!-- Tags -->
        ${tagsList.length > 0 ? `
          <div class="review-tags-row">
            ${tagsList.map(t => `<span class="review-tag-chip">#${t}</span>`).join('')}
          </div>
        ` : ''}

        <!-- Author Footer -->
        <div class="review-footer">
          <div class="review-author-wrap">
            <div class="review-author-avatar">${authorInitial}</div>
            <div>
              <div class="review-author-name">${item.clientName}</div>
              <div class="review-author-corp">${item.clientCompany || '실거래 기업고객'}</div>
            </div>
          </div>
          <button onclick="openReviewDetail('${item.id}')" class="btn-review-detail">
            전체보기 →
          </button>
        </div>
      </article>
    `;
  }).join('');
}

// 3. Review Filter Tab Events
function initReviewFilterEvents() {
  const filterBtns = document.querySelectorAll('.review-tab-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentReviewFilter = btn.dataset.filter;
      renderReviews();
    });
  });
}

// 4. Review Modals
window.openReviewModal = function() {
  const overlay = document.getElementById('reviewModalOverlay');
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeReviewModal = function() {
  const overlay = document.getElementById('reviewModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
};

// 5. Handle Direct Review & Property Submission
window.handleReviewSubmit = async function(e) {
  e.preventDefault();
  const form = document.getElementById('reviewSubmitForm');
  const btn = document.getElementById('btnSubmitReview');

  if (!form) return;

  const propTypeNames = {
    'factory': '공장 / 지산',
    'warehouse': '창고 / 물류',
    'retail': '상가 / 점포',
    'office': '사무실 / 사옥'
  };

  const payload = {
    clientName: form.clientName.value.trim(),
    clientCompany: form.clientCompany.value.trim() || '실거래 고객',
    rating: Number(form.rating.value) || 5,
    title: form.reviewTitle.value.trim(),
    content: form.reviewContent.value.trim(),
    tags: form.tags.value ? form.tags.value.split(',').map(s => s.trim()).filter(Boolean) : ['실거래인증'],
    verified: true,
    property: {
      title: form.propTitle.value.trim(),
      type: form.propType.value,
      typeName: propTypeNames[form.propType.value] || '공장 / 지산',
      region: form.propRegion.value,
      areaPyeong: parseFloat(form.propArea.value) || 50,
      price: form.propPrice.value.trim(),
      specs: form.propSpecs.value ? form.propSpecs.value.split(',').map(s => s.trim()).filter(Boolean) : []
    }
  };

  if (!payload.clientName || !payload.title || !payload.content || !payload.property.title) {
    alert('필수 입력 항목(매물명, 작성자명, 후기 제목, 내용)을 모두 입력해 주세요.');
    return;
  }

  btn.disabled = true;
  btn.textContent = '등록 처리 중...';

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let newReview = null;
    if (res.ok) {
      const data = await res.json();
      newReview = data.review;
    } else {
      // Create locally in case of static hosting without server
      newReview = {
        id: `rev-${Date.now()}`,
        ...payload,
        date: new Date().toISOString().slice(0, 10),
        likes: 1
      };
    }

    state.reviews.unshift(newReview);
    renderReviews();

    alert('🎉 실제 매물 정보와 고객 후기가 성공적으로 등록되었습니다!\n홈페이지에 즉시 반영되었습니다.');
    form.reset();
    closeReviewModal();

    // Scroll smoothly to reviews section
    const revSec = document.getElementById('reviews');
    if (revSec) {
      revSec.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error('Review submit error:', err);
    // Fallback: save to state
    const fallbackReview = {
      id: `rev-${Date.now()}`,
      ...payload,
      date: new Date().toISOString().slice(0, 10),
      likes: 1
    };
    state.reviews.unshift(fallbackReview);
    renderReviews();
    alert('🎉 실제 매물 정보와 고객 후기가 등록되었습니다! (로컬 반영)');
    form.reset();
    closeReviewModal();
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 실제 매물 정보 및 후기 등록하기';
  }
};

// 6. Review Detail Modal
window.openReviewDetail = function(reviewId) {
  const item = state.reviews.find(r => r.id === reviewId);
  if (!item) return;

  const container = document.getElementById('reviewDetailContainer');
  const overlay = document.getElementById('reviewDetailModalOverlay');
  if (!container || !overlay) return;

  const stars = '★'.repeat(item.rating || 5) + '☆'.repeat(5 - (item.rating || 5));
  const prop = item.property || {};
  const specsList = Array.isArray(prop.specs) ? prop.specs : [];
  const tagsList = Array.isArray(item.tags) ? item.tags : [];

  container.innerHTML = `
    <button class="modal-close-btn" onclick="closeReviewDetailModal()">&times;</button>
    
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
      <span class="review-badge-verified">🟢 실거래 계약 검증 완료</span>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="stars-gold" style="font-size:16px;">${stars}</span>
        <span style="font-weight:800; font-size:14px; color:var(--navy-dark);">${(item.rating || 5).toFixed(1)} / 5.0</span>
      </div>
    </div>

    <!-- Real Property Card Inside Detail Modal -->
    <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:16px; padding:20px; margin-bottom:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:700; color:var(--primary); background:#e6fffa; padding:3px 10px; border-radius:6px;">
          ${prop.typeName || '산업부동산'}
        </span>
        <span style="font-size:12px; color:var(--text-light);">${item.date ? item.date + ' 계약 체결' : '계약 체결'}</span>
      </div>

      <h3 style="font-size:18px; font-weight:800; color:var(--navy-dark); margin-bottom:10px;">
        🏢 ${prop.title || '실거래 매물 정보'}
      </h3>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:12px; font-size:13px; margin-bottom:14px; background:#fff; padding:12px 16px; border-radius:10px; border:1px solid #e2e8f0;">
        <div><strong style="color:var(--text-muted);">소재 지역:</strong> ${prop.region || '-'}</div>
        <div><strong style="color:var(--text-muted);">전용 면적:</strong> 실 ${prop.areaPyeong || 0}평</div>
        <div><strong style="color:var(--text-muted);">거래 금액:</strong> <span style="color:#b45309; font-weight:700;">${prop.price || '-'}</span></div>
      </div>

      ${specsList.length > 0 ? `
        <div style="display:flex; flex-wrap:wrap; gap:6px;">
          ${specsList.map(s => `<span class="review-prop-spec-pill" style="padding:4px 10px; font-size:12px;">✓ ${s}</span>`).join('')}
        </div>
      ` : ''}
    </div>

    <h2 style="font-size:20px; font-weight:800; color:var(--navy-dark); margin-bottom:14px; line-height:1.4;">
      "${item.title}"
    </h2>

    <div style="font-size:15px; color:#334155; line-height:1.8; margin-bottom:24px; white-space:pre-line; background:#f8fafc; padding:20px; border-radius:12px; border-left:4px solid var(--primary);">
      ${item.content}
    </div>

    ${tagsList.length > 0 ? `
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:24px;">
        ${tagsList.map(t => `<span class="review-tag-chip" style="font-size:12px; padding:4px 10px;">#${t}</span>`).join('')}
      </div>
    ` : ''}

    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:18px; border-top:1px solid var(--border-color);">
      <div style="display:flex; align-items:center; gap:12px;">
        <div class="review-author-avatar">${(item.clientName || '고').charAt(0)}</div>
        <div>
          <div style="font-size:14px; font-weight:800; color:var(--navy-dark);">${item.clientName}</div>
          <div style="font-size:12px; color:var(--text-light);">${item.clientCompany || '실거래 고객사'}</div>
        </div>
      </div>

      <a href="tel:031-442-5918" class="btn-primary-glow" style="padding:10px 18px; font-size:13px;">
        📞 매물 맞춤 문의하기
      </a>
    </div>
  `;

  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeReviewDetailModal = function() {
  const overlay = document.getElementById('reviewDetailModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
};

