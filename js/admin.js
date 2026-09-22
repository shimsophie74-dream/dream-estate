/**
 * 서버리스 통합 어드민 관리자 스크립트 (admin.js)
 * Customer Reviews & Real Property Details, Properties Management, Board Articles
 */

const ADMIN_STORAGE_KEY = 'realestate_admin_pwd';
let currentAdminTab = 'reviews';

// State
let boardPosts = [];
let adminReviews = [];
let adminProperties = [];
let editingReviewId = null;
let editingPropId = null;
let editingPostId = null;

document.addEventListener('DOMContentLoaded', () => {
  checkLoginState();
  initBoardFormEvents();
  initPropImageDropZone();
});

// 1. Auth & Login
function checkLoginState() {
  const pwd = sessionStorage.getItem(ADMIN_STORAGE_KEY);
  const loginModal = document.getElementById('loginModal');
  const adminContent = document.getElementById('adminContent');

  if (!pwd) {
    loginModal.style.display = 'flex';
    adminContent.style.display = 'none';
  } else {
    loginModal.style.display = 'none';
    adminContent.style.display = 'block';
    loadAllAdminData(pwd);
  }
}

window.handleLogin = function(e) {
  e.preventDefault();
  const pwdInput = document.getElementById('adminPasswordInput');
  const pwd = pwdInput.value.trim();
  if (!pwd) {
    alert('비밀번호를 입력해 주세요.');
    return;
  }

  sessionStorage.setItem(ADMIN_STORAGE_KEY, pwd);
  checkLoginState();
};

window.handleLogout = function() {
  sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  window.location.reload();
};

function getAuthPassword() {
  return sessionStorage.getItem(ADMIN_STORAGE_KEY) || 'admin1234';
}

// 2. Tab Navigation
window.switchAdminTab = function(tabName) {
  currentAdminTab = tabName;
  const tabs = ['reviews', 'properties', 'board'];

  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn${capitalize(t)}`);
    const sec = document.getElementById(`tabSection${capitalize(t)}`);
    if (btn && sec) {
      if (t === tabName) {
        btn.classList.add('active');
        btn.style.background = 'var(--primary)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--primary)';
        sec.style.display = 'block';
      } else {
        btn.classList.remove('active');
        btn.style.background = '#ffffff';
        btn.style.color = 'var(--text-muted)';
        btn.style.borderColor = 'var(--border-color)';
        sec.style.display = 'none';
      }
    }
  });
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 3. Load All Data
async function loadAllAdminData(pwd) {
  await Promise.all([
    loadAdminReviews(pwd),
    loadAdminProperties(pwd),
    loadAdminPosts(pwd)
  ]);
}

// ==========================================================================
// TAB 1: REVIEWS MANAGEMENT
// ==========================================================================
async function loadAdminReviews(pwd) {
  const tableBody = document.getElementById('adminReviewsTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">리뷰 목록 로딩 중...</td></tr>';

  try {
    let res = await fetch('/api/reviews', {
      headers: { 'x-admin-password': pwd }
    });
    if (!res.ok) res = await fetch('data/reviews.json');
    const data = await res.json();
    adminReviews = data.reviews || (Array.isArray(data) ? data : []);
    renderAdminReviewsTable();
  } catch (err) {
    console.error('Admin reviews load error:', err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">로드 실패: ${err.message}</td></tr>`;
  }
}

function renderAdminReviewsTable() {
  const tableBody = document.getElementById('adminReviewsTableBody');
  const countBadge = document.getElementById('adminReviewCountBadge');
  if (!tableBody) return;

  if (countBadge) countBadge.textContent = `${adminReviews.length}건`;

  if (adminReviews.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">등록된 고객 리뷰가 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = adminReviews.map((r, idx) => {
    const prop = r.property || {};
    const stars = '★'.repeat(r.rating || 5);

    return `
      <tr>
        <td style="color:#94a3b8; font-weight:700;">${idx + 1}</td>
        <td>
          <div style="font-weight:800; color:var(--navy-dark);">${r.clientName}</div>
          <div style="font-size:12px; color:var(--text-light);">${r.clientCompany || '-'}</div>
        </td>
        <td>
          <div style="font-weight:700; color:var(--navy-dark);">${prop.title || '-'}</div>
          <div style="font-size:12px; color:var(--text-muted);">
            ${prop.region || ''} · 실 ${prop.areaPyeong || 0}평 · ${prop.price || ''}
          </div>
        </td>
        <td><span style="color:#f59e0b; font-weight:700;">${stars}</span></td>
        <td style="font-size:12px; color:var(--text-muted);">${r.date || '-'}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button onclick="editAdminReview('${r.id}')" class="btn-table-edit">수정</button>
            <button onclick="deleteAdminReview('${r.id}')" class="btn-table-del">삭제</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveAdminReview = async function(e) {
  e.preventDefault();
  const pwd = getAuthPassword();
  const saveBtn = document.getElementById('saveReviewBtn');

  const propTypeNames = {
    'factory': '공장 / 지산',
    'warehouse': '창고 / 물류',
    'retail': '상가 / 점포',
    'office': '사무실 / 사옥'
  };

  const propType = document.getElementById('revPropType').value;
  const specsRaw = document.getElementById('revPropSpecs').value;
  const tagsRaw = document.getElementById('revTags').value;

  const payload = {
    clientName: document.getElementById('revClientName').value.trim(),
    clientCompany: document.getElementById('revClientCompany').value.trim(),
    rating: parseInt(document.getElementById('revRating').value) || 5,
    title: document.getElementById('revTitle').value.trim(),
    content: document.getElementById('revContent').value.trim(),
    tags: tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    verified: true,
    property: {
      title: document.getElementById('revPropTitle').value.trim(),
      type: propType,
      typeName: propTypeNames[propType] || '산업부동산',
      region: document.getElementById('revPropRegion').value.trim(),
      areaPyeong: parseFloat(document.getElementById('revPropArea').value) || 50,
      price: document.getElementById('revPropPrice').value.trim(),
      specs: specsRaw ? specsRaw.split(',').map(s => s.trim()).filter(Boolean) : []
    }
  };

  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';

  try {
    const isEdit = Boolean(editingReviewId);
    const url = '/api/reviews';
    const method = isEdit ? 'PUT' : 'POST';
    if (isEdit) payload.id = editingReviewId;

    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': pwd
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '저장 실패');
    }

    alert(isEdit ? '리뷰가 성공적으로 수정되었습니다.' : '새 리뷰가 성공적으로 등록되었습니다.');
    resetReviewForm();
    await loadAdminReviews(pwd);
  } catch (err) {
    alert(`오류: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '⭐ 리뷰 저장';
  }
};

window.editAdminReview = function(id) {
  const item = adminReviews.find(r => r.id === id);
  if (!item) return;

  editingReviewId = id;
  const prop = item.property || {};

  document.getElementById('reviewFormTitle').textContent = `✏️ 고객 리뷰 수정 (ID: ${id})`;
  document.getElementById('cancelReviewEditBtn').style.display = 'inline-block';
  document.getElementById('saveReviewBtn').textContent = '수정 내용 반영';

  document.getElementById('revPropTitle').value = prop.title || '';
  document.getElementById('revPropType').value = prop.type || 'factory';
  document.getElementById('revPropRegion').value = prop.region || '';
  document.getElementById('revPropArea').value = prop.areaPyeong || '';
  document.getElementById('revPropPrice').value = prop.price || '';
  document.getElementById('revPropSpecs').value = Array.isArray(prop.specs) ? prop.specs.join(', ') : '';

  document.getElementById('revClientName').value = item.clientName || '';
  document.getElementById('revClientCompany').value = item.clientCompany || '';
  document.getElementById('revRating').value = item.rating || 5;
  document.getElementById('revTags').value = Array.isArray(item.tags) ? item.tags.join(', ') : '';
  document.getElementById('revTitle').value = item.title || '';
  document.getElementById('revContent').value = item.content || '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteAdminReview = async function(id) {
  if (!confirm('정말로 이 고객 리뷰를 삭제하시겠습니까?')) return;
  const pwd = getAuthPassword();

  try {
    const res = await fetch(`/api/reviews?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': pwd }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '삭제 실패');
    }

    alert('리뷰가 삭제되었습니다.');
    if (editingReviewId === id) resetReviewForm();
    await loadAdminReviews(pwd);
  } catch (err) {
    alert(`삭제 오류: ${err.message}`);
  }
};

window.resetReviewForm = function() {
  editingReviewId = null;
  document.getElementById('adminReviewForm').reset();
  document.getElementById('reviewFormTitle').textContent = '⭐ 고객 리뷰 & 실매물 정보 등록';
  document.getElementById('cancelReviewEditBtn').style.display = 'none';
  document.getElementById('saveReviewBtn').textContent = '⭐ 리뷰 저장';
};

// ==========================================================================
// TAB 2: PROPERTIES MANAGEMENT
// ==========================================================================
async function loadAdminProperties(pwd) {
  const tableBody = document.getElementById('adminPropertiesTableBody');
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">매물 목록 로딩 중...</td></tr>';

  try {
    let res = await fetch('/api/properties', {
      headers: { 'x-admin-password': pwd }
    });
    if (!res.ok) res = await fetch('data/properties.json');
    const data = await res.json();
    adminProperties = data.properties || (Array.isArray(data) ? data : []);
    renderAdminPropertiesTable();
  } catch (err) {
    console.error('Admin properties load error:', err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">로드 실패: ${err.message}</td></tr>`;
  }
}

function renderAdminPropertiesTable() {
  const tableBody = document.getElementById('adminPropertiesTableBody');
  const countBadge = document.getElementById('adminPropCountBadge');
  if (!tableBody) return;

  if (countBadge) countBadge.textContent = `${adminProperties.length}개`;

  if (adminProperties.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">등록된 매물이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = adminProperties.map((p, idx) => {
    const priceDisplay = p.priceType === '매매'
      ? `매매 ${(p.salePrice || 0).toLocaleString()}만`
      : `보 ${(p.deposit || 0).toLocaleString()} / 월 ${(p.rent || 0).toLocaleString()}만`;

    return `
      <tr>
        <td style="color:#94a3b8; font-weight:700;">${idx + 1}</td>
        <td><span class="badge-cat">${p.typeName || p.type}</span></td>
        <td>
          <div style="font-weight:800; color:var(--navy-dark);">${p.title}</div>
          <div style="font-size:12px; color:var(--text-muted);">${p.regionName || p.region} · ${p.badge || ''}</div>
        </td>
        <td style="font-weight:700;">${p.areaPyeong || 0}평</td>
        <td style="color:#b45309; font-weight:700;">${priceDisplay}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button onclick="editAdminProperty('${p.id}')" class="btn-table-edit">수정</button>
            <button onclick="deleteAdminProperty('${p.id}')" class="btn-table-del">삭제</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.saveAdminProperty = async function(e) {
  e.preventDefault();
  const pwd = getAuthPassword();
  const saveBtn = document.getElementById('savePropBtn');

  const typeNames = {
    'factory': '공장 / 지식산업센터',
    'warehouse': '물류 / 보관창고',
    'retail': '상가 / 점포',
    'office': '사무실 / 사옥'
  };

  const regionNames = {
    'anyang': '안양 평촌',
    'gunpo': '군포 당정/복합물류',
    'uiwang': '의왕 포일/테크노'
  };

  const typeVal = document.getElementById('propTypeSelect').value;
  const regionVal = document.getElementById('propRegionSelect').value;
  const specsRaw = document.getElementById('propSpecsInput').value;

  const payload = {
    title: document.getElementById('propTitleInput').value.trim(),
    type: typeVal,
    typeName: typeNames[typeVal] || '산업부동산',
    region: regionVal,
    regionName: regionNames[regionVal] || '안양권',
    priceType: document.getElementById('propPriceTypeSelect').value,
    deposit: parseInt(document.getElementById('propDepositInput').value) || 0,
    rent: parseInt(document.getElementById('propRentInput').value) || 0,
    salePrice: parseInt(document.getElementById('propSalePriceInput').value) || 0,
    areaPyeong: parseFloat(document.getElementById('propAreaInput').value) || 50,
    floor: document.getElementById('propFloorInput').value.trim() || '중층',
    electricPower: document.getElementById('propPowerInput').value.trim() || '기본',
    badge: document.getElementById('propBadgeInput').value.trim() || '추천매물',
    specs: specsRaw ? specsRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    image: document.getElementById('propImageInput').value.trim() || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80'
  };

  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';

  try {
    const isEdit = Boolean(editingPropId);
    const url = '/api/properties';
    const method = isEdit ? 'PUT' : 'POST';
    if (isEdit) payload.id = editingPropId;

    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-password': pwd
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '저장 실패');
    }

    alert(isEdit ? '매물이 성공적으로 수정되었습니다.' : '새 매물이 성공적으로 등록되었습니다.');
    resetPropForm();
    await loadAdminProperties(pwd);
  } catch (err) {
    alert(`오류: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '🏢 매물 저장';
  }
};

window.editAdminProperty = function(id) {
  const item = adminProperties.find(p => p.id === id);
  if (!item) return;

  editingPropId = id;
  document.getElementById('propFormTitle').textContent = `✏️ 매물 수정 (ID: ${id})`;
  document.getElementById('cancelPropEditBtn').style.display = 'inline-block';
  document.getElementById('savePropBtn').textContent = '매물 수정 반영';

  document.getElementById('propTitleInput').value = item.title || '';
  document.getElementById('propTypeSelect').value = item.type || 'factory';
  document.getElementById('propRegionSelect').value = item.region || 'anyang';
  document.getElementById('propPriceTypeSelect').value = item.priceType || '임대';
  document.getElementById('propAreaInput').value = item.areaPyeong || '';
  document.getElementById('propDepositInput').value = item.deposit || '';
  document.getElementById('propRentInput').value = item.rent || '';
  document.getElementById('propSalePriceInput').value = item.salePrice || '';
  document.getElementById('propFloorInput').value = item.floor || '';
  document.getElementById('propPowerInput').value = item.electricPower || '';
  document.getElementById('propBadgeInput').value = item.badge || '';
  document.getElementById('propSpecsInput').value = Array.isArray(item.specs) ? item.specs.join(', ') : '';
  
  if (item.image) {
    document.getElementById('propImageInput').value = item.image;
    showPropImagePreview(item.image, '등록된 매물 사진', null);
  } else {
    clearPropImagePreview();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteAdminProperty = async function(id) {
  if (!confirm('정말로 이 매물을 삭제하시겠습니까?')) return;
  const pwd = getAuthPassword();

  try {
    const res = await fetch(`/api/properties?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': pwd }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '삭제 실패');
    }

    alert('매물이 삭제되었습니다.');
    if (editingPropId === id) resetPropForm();
    await loadAdminProperties(pwd);
  } catch (err) {
    alert(`삭제 오류: ${err.message}`);
  }
};

window.resetPropForm = function() {
  editingPropId = null;
  document.getElementById('adminPropForm').reset();
  document.getElementById('propFormTitle').textContent = '🏢 실제 매물 직접 등록 & 수정';
  document.getElementById('cancelPropEditBtn').style.display = 'none';
  document.getElementById('savePropBtn').textContent = '🏢 매물 저장';
  clearPropImagePreview();
};

// ==========================================================================
// Property JPG Image Upload & Drag-and-Drop Processing
// ==========================================================================
function initPropImageDropZone() {
  const dropZone = document.getElementById('propDropZone');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  });
}

window.handlePropFileChange = function(e) {
  const file = e.target.files && e.target.files[0];
  if (file) {
    processImageFile(file);
  }
};

function processImageFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('JPG 또는 PNG 이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const rawDataUrl = e.target.result;
    
    // Scale and compress with HTML5 Canvas for optimal loading speed and quality
    const img = new Image();
    img.onload = function() {
      const maxDim = 1280;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      // Display Preview
      showPropImagePreview(compressedDataUrl, file.name, file.size);

      // Upload to server
      uploadImageToServer(file.name, compressedDataUrl);
    };
    img.src = rawDataUrl;
  };
  reader.readAsDataURL(file);
}

function showPropImagePreview(url, fileName, fileSize) {
  const previewBox = document.getElementById('propImagePreviewBox');
  const previewImg = document.getElementById('propPreviewImg');
  const nameSpan = document.getElementById('propPreviewFileName');
  const sizeSpan = document.getElementById('propPreviewFileSize');
  const dropZone = document.getElementById('propDropZone');

  if (previewImg) previewImg.src = url;
  if (nameSpan) nameSpan.textContent = fileName || '매물 사진';
  if (sizeSpan) {
    sizeSpan.textContent = fileSize ? `(${Math.round(fileSize / 1024)} KB)` : '';
  }

  if (previewBox) previewBox.style.display = 'block';
  if (dropZone) dropZone.style.display = 'none';

  const hiddenInput = document.getElementById('propImageInput');
  if (hiddenInput && !hiddenInput.value) {
    hiddenInput.value = url;
  }
}

window.clearPropImagePreview = function() {
  const previewBox = document.getElementById('propImagePreviewBox');
  const previewImg = document.getElementById('propPreviewImg');
  const dropZone = document.getElementById('propDropZone');
  const fileInput = document.getElementById('propImageFileInput');
  const hiddenInput = document.getElementById('propImageInput');
  const fallbackInput = document.getElementById('propImageUrlFallback');

  if (previewImg) previewImg.src = '';
  if (previewBox) previewBox.style.display = 'none';
  if (dropZone) dropZone.style.display = 'block';
  if (fileInput) fileInput.value = '';
  if (hiddenInput) hiddenInput.value = '';
  if (fallbackInput) fallbackInput.value = '';
};

window.handlePropUrlFallback = function(url) {
  if (url && url.trim()) {
    showPropImagePreview(url.trim(), '외부 URL 이미지', null);
    const hiddenInput = document.getElementById('propImageInput');
    if (hiddenInput) hiddenInput.value = url.trim();
  } else {
    clearPropImagePreview();
  }
};

async function uploadImageToServer(filename, dataUrl) {
  const hiddenInput = document.getElementById('propImageInput');
  const sizeBadge = document.getElementById('propPreviewFileSize');
  
  // Set dataUrl as immediate fallback
  if (hiddenInput) hiddenInput.value = dataUrl;

  try {
    if (sizeBadge) sizeBadge.textContent += ' (서버 저장 중...)';
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, fileData: dataUrl })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.url) {
        if (hiddenInput) hiddenInput.value = data.url;
        if (sizeBadge) {
          sizeBadge.textContent = sizeBadge.textContent.replace(' (서버 저장 중...)', ' ✅ 저장완료');
        }
      }
    }
  } catch (err) {
    console.warn('Server upload fallback to Base64 data URL:', err);
    if (sizeBadge) {
      sizeBadge.textContent = sizeBadge.textContent.replace(' (서버 저장 중...)', '');
    }
  }
}

// ==========================================================================
// TAB 3: BOARD ARTICLES MANAGEMENT
// ==========================================================================
async function loadAdminPosts(pwd) {
  const tableBody = document.getElementById('adminPostListBody');
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">게시글 목록 로딩 중...</td></tr>';

  try {
    let res = await fetch('/api/board', {
      headers: { 'x-admin-password': pwd }
    });
    if (!res.ok) res = await fetch('data/board.json');
    const data = await res.json();
    boardPosts = data.posts || (Array.isArray(data) ? data : []);
    renderAdminTable();
  } catch (err) {
    console.error('Admin post load error:', err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:20px;">로드 실패: ${err.message}</td></tr>`;
  }
}

function renderAdminTable() {
  const tableBody = document.getElementById('adminPostListBody');
  const totalBadge = document.getElementById('totalPostCount');
  if (!tableBody) return;
  if (totalBadge) totalBadge.textContent = `${boardPosts.length}건`;

  if (boardPosts.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8;">등록된 소식 글이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = boardPosts.map((post, idx) => `
    <tr>
      <td style="color:#94a3b8; font-weight:700;">${idx + 1}</td>
      <td><span class="badge-cat">${post.category}</span></td>
      <td>
        <div style="font-weight:800; color:var(--navy-dark);">${post.isPinned ? '📌 ' : ''}${post.title}</div>
        <div style="font-size:12px; color:var(--text-muted);">${post.summary || ''}</div>
      </td>
      <td style="font-size:12px; color:var(--text-muted);">${post.date}</td>
      <td style="font-weight:700;">${post.views || 0}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button onclick="editPost('${post.id}')" class="btn-table-edit">수정</button>
          <button onclick="deletePost('${post.id}')" class="btn-table-del">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function initBoardFormEvents() {
  const form = document.getElementById('postEditorForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = getAuthPassword();
    const saveBtn = document.getElementById('savePostBtn');

    const payload = {
      title: form.title.value.trim(),
      category: form.category.value,
      author: form.author.value.trim() || '대표 공인중개사',
      summary: form.summary.value.trim(),
      content: form.content.value.trim(),
      tags: form.tags.value ? form.tags.value.split(',').map(s => s.trim()).filter(Boolean) : [],
      thumbnail: form.thumbnail.value.trim(),
      isPinned: form.isPinned.checked
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 처리 중...';

    try {
      const isEdit = Boolean(editingPostId);
      const url = '/api/board';
      const method = isEdit ? 'PUT' : 'POST';
      if (isEdit) payload.id = editingPostId;

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pwd
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '저장 실패');
      }

      alert(isEdit ? '소식이 수정되었습니다.' : '새 소식이 등록되었습니다.');
      resetForm();
      await loadAdminPosts(pwd);
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '게시글 저장';
    }
  });
}

window.editPost = function(id) {
  const post = boardPosts.find(p => p.id === id);
  if (!post) return;

  editingPostId = id;
  const form = document.getElementById('postEditorForm');
  document.getElementById('formCardTitle').textContent = `✏️ 소식 수정: ${post.title.slice(0, 20)}...`;
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  document.getElementById('savePostBtn').textContent = '수정 내용 저장';

  form.title.value = post.title;
  form.category.value = post.category;
  form.author.value = post.author;
  form.summary.value = post.summary || '';
  form.content.value = post.content;
  form.tags.value = Array.isArray(post.tags) ? post.tags.join(', ') : (post.tags || '');
  form.thumbnail.value = post.thumbnail || '';
  form.isPinned.checked = Boolean(post.isPinned);

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deletePost = async function(id) {
  if (!confirm('정말로 이 게시글을 삭제하시겠습니까?')) return;
  const pwd = getAuthPassword();

  try {
    const res = await fetch(`/api/board?id=${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-password': pwd }
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '삭제 실패');
    }

    alert('게시글이 삭제되었습니다.');
    if (editingPostId === id) resetForm();
    await loadAdminPosts(pwd);
  } catch (err) {
    alert(`삭제 오류: ${err.message}`);
  }
};

window.resetForm = function() {
  editingPostId = null;
  const form = document.getElementById('postEditorForm');
  if (form) form.reset();
  document.getElementById('formCardTitle').textContent = '새 부동산 소식 / 칼럼 작성';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('savePostBtn').textContent = '게시글 저장';
};
