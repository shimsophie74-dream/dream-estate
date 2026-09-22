// Vercel Serverless Function: api/reviews.js
// Handles GET, POST, PUT, DELETE for Customer Reviews & Real Property Details
// Persists directly to GitHub repository (data/reviews.json) via GitHub REST API or local file fallback

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = 'data/reviews.json';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

function getLocalFilePath() {
  const possiblePaths = [
    path.join(process.cwd(), 'homepage', 'data', 'reviews.json'),
    path.join(process.cwd(), 'data', 'reviews.json'),
    path.join(__dirname, '..', 'data', 'reviews.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), 'data', 'reviews.json');
}

async function getReviewsFromGitHub() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vercel-Serverless-Reviews'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return {
    reviews: JSON.parse(content),
    sha: data.sha
  };
}

async function saveReviewsToGitHub(reviews, sha, commitMsg = 'Update reviews.json') {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const contentBase64 = Buffer.from(JSON.stringify(reviews, null, 2), 'utf-8').toString('base64');

  const body = {
    message: `[Reviews Auto-Commit] ${commitMsg}`,
    content: contentBase64,
    sha: sha
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Vercel-Serverless-Reviews'
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
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-admin-password, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const isGitHubConfigured = Boolean(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

  // GET: List all reviews
  if (req.method === 'GET') {
    try {
      if (isGitHubConfigured) {
        const { reviews } = await getReviewsFromGitHub();
        return res.status(200).json({ success: true, source: 'github', reviews });
      } else {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf-8');
          return res.status(200).json({ success: true, source: 'local-file', reviews: JSON.parse(raw) });
        }
        return res.status(200).json({ success: true, source: 'empty', reviews: [] });
      }
    } catch (err) {
      console.error('GET reviews error:', err);
      // Fallback to local
      try {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf-8');
          return res.status(200).json({ success: true, source: 'fallback-local', reviews: JSON.parse(raw) });
        }
      } catch (_) {}
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST: Create review
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { clientName, title, content } = body;
      if (!clientName || !title || !content) {
        return res.status(400).json({ success: false, error: '작성자명, 후기 제목 및 내용은 필수입니다.' });
      }

      const propInput = body.property || {};
      const newReview = {
        id: `rev-${Date.now()}`,
        clientName: clientName.trim(),
        clientCompany: (body.clientCompany || '기업/개인 고객').trim(),
        rating: Number(body.rating) || 5,
        property: {
          title: propInput.title || body.propertyTitle || '안양·군포·의왕 실거래 매물',
          type: propInput.type || body.propertyType || 'factory',
          typeName: propInput.typeName || body.propertyTypeName || '공장 / 지산',
          region: propInput.region || body.propertyRegion || '안양 평촌',
          areaPyeong: Number(propInput.areaPyeong || body.propertyArea || 50),
          price: propInput.price || body.propertyPrice || '상담 협의',
          specs: Array.isArray(propInput.specs) ? propInput.specs : (typeof propInput.specs === 'string' ? propInput.specs.split(',').map(s=>s.trim()) : [])
        },
        title: title.trim(),
        content: content.trim(),
        date: new Date().toISOString().slice(0, 10),
        verified: Boolean(body.verified !== false),
        likes: 1,
        tags: Array.isArray(body.tags) ? body.tags : (typeof body.tags === 'string' ? body.tags.split(',').map(s=>s.trim()) : [])
      };

      if (isGitHubConfigured) {
        const { reviews, sha } = await getReviewsFromGitHub();
        reviews.unshift(newReview);
        await saveReviewsToGitHub(reviews, sha, `Add review: ${newReview.title}`);
        return res.status(201).json({ success: true, source: 'github', review: newReview });
      } else {
        const localPath = getLocalFilePath();
        let reviews = [];
        if (fs.existsSync(localPath)) {
          reviews = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
        reviews.unshift(newReview);
        fs.writeFileSync(localPath, JSON.stringify(reviews, null, 2), 'utf-8');
        return res.status(201).json({ success: true, source: 'local-file', review: newReview });
      }
    } catch (err) {
      console.error('POST review error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Check Admin Password for PUT & DELETE
  const authHeader = req.headers['x-admin-password'] || req.headers['authorization'];
  const reqPwd = authHeader ? authHeader.replace('Bearer ', '').trim() : (req.body && req.body.adminPassword);
  if (reqPwd !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  // PUT: Update Review
  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      const { id } = body;
      if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

      let reviews = [];
      let sha = null;

      if (isGitHubConfigured) {
        const ghData = await getReviewsFromGitHub();
        reviews = ghData.reviews;
        sha = ghData.sha;
      } else {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          reviews = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
      }

      const idx = reviews.findIndex(r => r.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: '후기를 찾을 수 없습니다.' });

      if (body.clientName) reviews[idx].clientName = body.clientName.trim();
      if (body.clientCompany) reviews[idx].clientCompany = body.clientCompany.trim();
      if (body.rating) reviews[idx].rating = Number(body.rating);
      if (body.title) reviews[idx].title = body.title.trim();
      if (body.content) reviews[idx].content = body.content.trim();
      if (body.property) reviews[idx].property = body.property;
      if (body.tags) reviews[idx].tags = Array.isArray(body.tags) ? body.tags : body.tags.split(',').map(s=>s.trim());
      if (body.verified !== undefined) reviews[idx].verified = Boolean(body.verified);

      if (isGitHubConfigured) {
        await saveReviewsToGitHub(reviews, sha, `Update review: ${id}`);
      } else {
        const localPath = getLocalFilePath();
        fs.writeFileSync(localPath, JSON.stringify(reviews, null, 2), 'utf-8');
      }

      return res.status(200).json({ success: true, review: reviews[idx] });
    } catch (err) {
      console.error('PUT review error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DELETE: Remove Review
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

      let reviews = [];
      let sha = null;

      if (isGitHubConfigured) {
        const ghData = await getReviewsFromGitHub();
        reviews = ghData.reviews;
        sha = ghData.sha;
      } else {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          reviews = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
      }

      const updated = reviews.filter(r => r.id !== id);
      if (isGitHubConfigured) {
        await saveReviewsToGitHub(updated, sha, `Delete review: ${id}`);
      } else {
        const localPath = getLocalFilePath();
        fs.writeFileSync(localPath, JSON.stringify(updated, null, 2), 'utf-8');
      }

      return res.status(200).json({ success: true, deletedId: id });
    } catch (err) {
      console.error('DELETE review error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
