/**
 * 서버리스 게시판 어드민 관리자 스크립트 (admin.js)
 * Vercel Serverless Function & GitHub JSON Commit 연동
 */

const ADMIN_STORAGE_KEY = 'realestate_admin_pwd';
let currentEditingId = null;
let boardPosts = [];

document.addEventListener('DOMContentLoaded', () => {
  checkLoginState();
  initFormEvents();
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
    loadAdminPosts(pwd);
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

// 2. Load Posts
async function loadAdminPosts(pwd) {
  const tableBody = document.getElementById('adminPostListBody');
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">게시글 목록을 불러오는 중...</td></tr>';

  try {
    let res = await fetch('/api/board', {
      headers: { 'x-admin-password': pwd }
    });

    if (!res.ok) {
      // If 401, clear storage and show error
      if (res.status === 401) {
        alert('비밀번호가 올바르지 않습니다. 다시 입력해 주세요.');
        sessionStorage.removeItem(ADMIN_STORAGE_KEY);
        checkLoginState();
        return;
      }
      res = await fetch('data/board.json');
    }

    const data = await res.json();
    boardPosts = data.posts || (Array.isArray(data) ? data : []);
    
    // Update GitHub Connection status badge
    updateSourceBadge(data.source, data.githubConfigured);

    renderAdminTable();
  } catch (err) {
    console.error('Admin post load error:', err);
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">데이터 로드 실패: ${err.message}</td></tr>`;
  }
}

function updateSourceBadge(source, githubConfigured) {
  const badge = document.getElementById('dbSourceBadge');
  if (!badge) return;

  if (source === 'github' || githubConfigured) {
    badge.innerHTML = '🟢 GitHub 저장소 영구 연동 활성 (Vercel Serverless)';
    badge.className = 'status-badge-active';
  } else {
    badge.innerHTML = '🟡 로컬 파일 시스템 모드 (GitHub PAT 설정 가이드 참조)';
    badge.className = 'status-badge-local';
  }
}

// 3. Render Admin Table
function renderAdminTable() {
  const tableBody = document.getElementById('adminPostListBody');
  const totalBadge = document.getElementById('totalPostCount');
  if (totalBadge) totalBadge.textContent = `${boardPosts.length}건`;

  if (boardPosts.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:40px; color:#64748b;">등록된 게시글이 없습니다.</td></tr>';
    return;
  }

  tableBody.innerHTML = boardPosts.map((post, idx) => `
    <tr>
      <td style="font-weight:700; color:#64748b;">${post.isPinned ? '📌' : (boardPosts.length - idx)}</td>
      <td><span class="badge-cat">${post.category}</span></td>
      <td>
        <strong style="color:#0f172a; cursor:pointer;" onclick="openPreview('${post.id}')">${post.title}</strong>
        ${post.isPinned ? '<span style="color:#d97706; font-size:11px; margin-left:6px; font-weight:800;">[중요]</span>' : ''}
      </td>
      <td>${post.date}</td>
      <td>${post.views || 1}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn-table-edit" onclick="editPost('${post.id}')">수정</button>
          <button class="btn-table-del" onclick="deletePost('${post.id}')">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// 4. Form Submit (Create or Update)
function initFormEvents() {
  const form = document.getElementById('postEditorForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = sessionStorage.getItem(ADMIN_STORAGE_KEY);
    const saveBtn = document.getElementById('savePostBtn');

    const postData = {
      title: form.title.value.trim(),
      category: form.category.value,
      summary: form.summary.value.trim(),
      content: form.content.value.trim(),
      tags: form.tags.value.split(',').map(t => t.trim()).filter(Boolean),
      thumbnail: form.thumbnail.value.trim() || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
      isPinned: form.isPinned.checked,
      author: form.author.value.trim() || '대표 공인중개사'
    };

    if (!postData.title || !postData.content) {
      alert('제목과 본문은 필수 입력 사항입니다.');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    try {
      const isUpdate = Boolean(currentEditingId);
      const url = '/api/board';
      const method = isUpdate ? 'PUT' : 'POST';
      if (isUpdate) postData.id = currentEditingId;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': pwd
        },
        body: JSON.stringify(postData)
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || '저장에 실패했습니다.');
      }

      alert(isUpdate ? '게시글이 성공적으로 수정되었습니다.' : '새 게시글이 성공적으로 발행되었습니다!');
      resetForm();
      loadAdminPosts(pwd);
    } catch (err) {
      alert('오류: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '게시글 저장';
    }
  });
}

// 5. Edit Post
window.editPost = function(postId) {
  const post = boardPosts.find(p => p.id === postId);
  if (!post) return;

  currentEditingId = postId;
  const form = document.getElementById('postEditorForm');
  form.title.value = post.title;
  form.category.value = post.category;
  form.summary.value = post.summary || '';
  form.content.value = post.content;
  form.tags.value = (post.tags || []).join(', ');
  form.thumbnail.value = post.thumbnail || '';
  form.author.value = post.author || '';
  form.isPinned.checked = Boolean(post.isPinned);

  document.getElementById('formCardTitle').textContent = '게시글 수정 중 (#ID: ' + postId + ')';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  form.scrollIntoView({ behavior: 'smooth' });
};

window.resetForm = function() {
  currentEditingId = null;
  const form = document.getElementById('postEditorForm');
  form.reset();
  document.getElementById('formCardTitle').textContent = '새 부동산 소식 / 뉴스 작성';
  document.getElementById('cancelEditBtn').style.display = 'none';
};

// 6. Delete Post
window.deletePost = async function(postId) {
  if (!confirm('정말 이 게시글을 영구 삭제하시겠습니까?')) return;

  const pwd = sessionStorage.getItem(ADMIN_STORAGE_KEY);
  try {
    const res = await fetch(`/api/board?id=${postId}`, {
      method: 'DELETE',
      headers: {
        'x-admin-password': pwd
      }
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || '삭제 실패');

    alert('게시글이 삭제되었습니다.');
    loadAdminPosts(pwd);
  } catch (err) {
    alert('삭제 오류: ' + err.message);
  }
};

// 7. Preview Modal
window.openPreview = function(postId) {
  const post = boardPosts.find(p => p.id === postId);
  if (!post) return;
  alert(`[미리보기]\n제목: ${post.title}\n카테고리: ${post.category}\n작성일: ${post.date}\n요약: ${post.summary}`);
};

// 8. Download JSON Backup
window.downloadJsonBackup = function() {
  const jsonStr = JSON.stringify(boardPosts, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `board_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
