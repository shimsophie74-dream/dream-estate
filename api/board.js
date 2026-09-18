// Vercel Serverless Function: api/board.js
// Handles GET (Read), POST (Create), PUT (Update), DELETE (Delete) for the Board System
// Data is persisted directly to GitHub repository (data/board.json) via GitHub REST API

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || 'data/board.json';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

// Helper: Get local file path fallback
function getLocalFilePath() {
  const possiblePaths = [
    path.join(process.cwd(), 'homepage', 'data', 'board.json'),
    path.join(process.cwd(), 'data', 'board.json'),
    path.join(__dirname, '..', 'data', 'board.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), 'data', 'board.json');
}

// Helper: Fetch JSON from GitHub
async function getBoardFromGitHub() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vercel-Serverless-Board'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return {
    posts: JSON.parse(content),
    sha: data.sha
  };
}

// Helper: Commit JSON to GitHub
async function saveBoardToGitHub(posts, sha, commitMsg = 'Update board.json') {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const contentBase64 = Buffer.from(JSON.stringify(posts, null, 2), 'utf-8').toString('base64');

  const body = {
    message: `[Board Auto-Commit] ${commitMsg}`,
    content: contentBase64,
    sha: sha
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Vercel-Serverless-Board'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub Commit failed: ${response.status} ${errText}`);
  }

  return await response.json();
}

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-password'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const isGitHubConfigured = Boolean(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

  // --- GET: List all posts ---
  if (req.method === 'GET') {
    try {
      if (isGitHubConfigured) {
        try {
          const { posts } = await getBoardFromGitHub();
          return res.status(200).json({ success: true, source: 'github', posts });
        } catch (ghErr) {
          console.warn('GitHub read failed, falling back to local file:', ghErr.message);
        }
      }

      // Local fallback
      const localPath = getLocalFilePath();
      if (fs.existsSync(localPath)) {
        const raw = fs.readFileSync(localPath, 'utf-8');
        const posts = JSON.parse(raw);
        return res.status(200).json({ success: true, source: 'local', posts, githubConfigured: isGitHubConfigured });
      }

      return res.status(200).json({ success: true, posts: [], source: 'empty', githubConfigured: isGitHubConfigured });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- Auth check for Write Operations (POST, PUT, DELETE) ---
  const authHeader = req.headers['x-admin-password'] || req.headers['authorization'];
  const reqPassword = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : req.body?.adminPassword;

  if (reqPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: '관리자 비밀번호가 일치하지 않습니다. 올바른 비밀번호를 입력해 주세요.'
    });
  }

  // --- POST: Create Post ---
  if (req.method === 'POST') {
    try {
      const { title, category, summary, content, tags, thumbnail, isPinned, author } = req.body;
      if (!title || !content) {
        return res.status(400).json({ success: false, error: '제목과 본문은 필수 입력 사항입니다.' });
      }

      const newPost = {
        id: `post-${Date.now()}`,
        title: title.trim(),
        category: category || '공지사항',
        summary: summary ? summary.trim() : content.substring(0, 100).replace(/[#*`\n]/g, ' ') + '...',
        content: content.trim(),
        author: author || '대표 공인중개사',
        date: new Date().toISOString().split('T')[0],
        views: 1,
        tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
        thumbnail: thumbnail || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
        isPinned: Boolean(isPinned)
      };

      if (isGitHubConfigured) {
        const { posts, sha } = await getBoardFromGitHub();
        posts.unshift(newPost);
        await saveBoardToGitHub(posts, sha, `새 글 작성: ${newPost.title}`);
        return res.status(201).json({ success: true, source: 'github', post: newPost });
      } else {
        // Local File Write
        const localPath = getLocalFilePath();
        let posts = [];
        if (fs.existsSync(localPath)) {
          posts = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
        posts.unshift(newPost);
        fs.writeFileSync(localPath, JSON.stringify(posts, null, 2), 'utf-8');
        return res.status(201).json({ success: true, source: 'local', post: newPost, notice: 'GitHub 연동 환경변수가 설정되지 않아 로컬 파일에 저장되었습니다.' });
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- PUT: Update Post ---
  if (req.method === 'PUT') {
    try {
      const { id, title, category, summary, content, tags, thumbnail, isPinned, views } = req.body;
      if (!id) {
        return res.status(400).json({ success: false, error: '수정할 게시글 ID가 필요합니다.' });
      }

      if (isGitHubConfigured) {
        const { posts, sha } = await getBoardFromGitHub();
        const index = posts.findIndex(p => p.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
        }

        posts[index] = {
          ...posts[index],
          title: title !== undefined ? title.trim() : posts[index].title,
          category: category || posts[index].category,
          summary: summary !== undefined ? summary.trim() : posts[index].summary,
          content: content !== undefined ? content.trim() : posts[index].content,
          tags: Array.isArray(tags) ? tags : (tags !== undefined ? tags.split(',').map(t => t.trim()).filter(Boolean) : posts[index].tags),
          thumbnail: thumbnail || posts[index].thumbnail,
          isPinned: isPinned !== undefined ? Boolean(isPinned) : posts[index].isPinned,
          views: views !== undefined ? Number(views) : posts[index].views,
          updatedAt: new Date().toISOString().split('T')[0]
        };

        await saveBoardToGitHub(posts, sha, `게시글 수정: ${posts[index].title}`);
        return res.status(200).json({ success: true, source: 'github', post: posts[index] });
      } else {
        const localPath = getLocalFilePath();
        const posts = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        const index = posts.findIndex(p => p.id === id);
        if (index === -1) {
          return res.status(404).json({ success: false, error: '게시글을 찾을 수 없습니다.' });
        }

        posts[index] = {
          ...posts[index],
          title: title !== undefined ? title.trim() : posts[index].title,
          category: category || posts[index].category,
          summary: summary !== undefined ? summary.trim() : posts[index].summary,
          content: content !== undefined ? content.trim() : posts[index].content,
          tags: Array.isArray(tags) ? tags : (tags !== undefined ? tags.split(',').map(t => t.trim()).filter(Boolean) : posts[index].tags),
          thumbnail: thumbnail || posts[index].thumbnail,
          isPinned: isPinned !== undefined ? Boolean(isPinned) : posts[index].isPinned,
          views: views !== undefined ? Number(views) : posts[index].views,
          updatedAt: new Date().toISOString().split('T')[0]
        };

        fs.writeFileSync(localPath, JSON.stringify(posts, null, 2), 'utf-8');
        return res.status(200).json({ success: true, source: 'local', post: posts[index] });
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // --- DELETE: Delete Post ---
  if (req.method === 'DELETE') {
    try {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: '삭제할 게시글 ID가 필요합니다.' });
      }

      if (isGitHubConfigured) {
        const { posts, sha } = await getBoardFromGitHub();
        const filtered = posts.filter(p => p.id !== id);
        if (filtered.length === posts.length) {
          return res.status(404).json({ success: false, error: '삭제할 게시글을 찾을 수 없습니다.' });
        }

        await saveBoardToGitHub(filtered, sha, `게시글 삭제: ID ${id}`);
        return res.status(200).json({ success: true, source: 'github', deletedId: id });
      } else {
        const localPath = getLocalFilePath();
        const posts = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        const filtered = posts.filter(p => p.id !== id);
        fs.writeFileSync(localPath, JSON.stringify(filtered, null, 2), 'utf-8');
        return res.status(200).json({ success: true, source: 'local', deletedId: id });
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
