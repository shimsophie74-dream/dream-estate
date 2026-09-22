// Vercel Serverless Function: api/properties.js
// Handles GET, POST, PUT, DELETE for Properties Management
// Persists directly to GitHub repository (data/properties.json) via GitHub REST API or local file fallback

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_FILE_PATH = 'data/properties.json';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

function getLocalFilePath() {
  const possiblePaths = [
    path.join(process.cwd(), 'homepage', 'data', 'properties.json'),
    path.join(process.cwd(), 'data', 'properties.json'),
    path.join(__dirname, '..', 'data', 'properties.json')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), 'data', 'properties.json');
}

async function getPropertiesFromGitHub() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Vercel-Serverless-Properties'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  return {
    properties: JSON.parse(content),
    sha: data.sha
  };
}

async function savePropertiesToGitHub(properties, sha, commitMsg = 'Update properties.json') {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
  const contentBase64 = Buffer.from(JSON.stringify(properties, null, 2), 'utf-8').toString('base64');

  const body = {
    message: `[Properties Auto-Commit] ${commitMsg}`,
    content: contentBase64,
    sha: sha
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Vercel-Serverless-Properties'
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

  // GET: List all properties
  if (req.method === 'GET') {
    try {
      if (isGitHubConfigured) {
        const { properties } = await getPropertiesFromGitHub();
        return res.status(200).json({ success: true, source: 'github', properties });
      } else {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf-8');
          return res.status(200).json({ success: true, source: 'local-file', properties: JSON.parse(raw) });
        }
        return res.status(200).json({ success: true, source: 'empty', properties: [] });
      }
    } catch (err) {
      console.error('GET properties error:', err);
      try {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          const raw = fs.readFileSync(localPath, 'utf-8');
          return res.status(200).json({ success: true, source: 'fallback-local', properties: JSON.parse(raw) });
        }
      } catch (_) {}
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Check auth for modifications
  const authHeader = req.headers['x-admin-password'] || req.headers['authorization'];
  const reqPwd = authHeader ? authHeader.replace('Bearer ', '').trim() : (req.body && req.body.adminPassword);
  if (reqPwd !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: '관리자 비밀번호가 일치하지 않습니다.' });
  }

  // POST: Create Property
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const { title } = body;
      if (!title) return res.status(400).json({ success: false, error: '매물명은 필수입니다.' });

      const newProp = {
        id: `prop-${Date.now()}`,
        type: body.type || 'factory',
        typeName: body.typeName || '공장 / 지산',
        region: body.region || 'anyang',
        regionName: body.regionName || '안양 평촌',
        title: title.trim(),
        priceType: body.priceType || '임대',
        deposit: Number(body.deposit) || 0,
        rent: Number(body.rent) || 0,
        salePrice: Number(body.salePrice) || 0,
        areaPyeong: Number(body.areaPyeong) || 50,
        areaM2: Math.round(Number(body.areaPyeong || 50) * 3.30578 * 10) / 10,
        floor: body.floor || '중층',
        ceilingHeight: body.ceilingHeight || '5.5m',
        electricPower: body.electricPower || '기본',
        parking: body.parking || '무료 주차',
        badge: body.badge || '추천매물',
        specs: Array.isArray(body.specs) ? body.specs : (typeof body.specs === 'string' ? body.specs.split(',').map(s=>s.trim()) : []),
        tags: Array.isArray(body.tags) ? body.tags : (typeof body.tags === 'string' ? body.tags.split(',').map(s=>s.trim()) : []),
        image: body.image || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80'
      };

      if (isGitHubConfigured) {
        const { properties, sha } = await getPropertiesFromGitHub();
        properties.unshift(newProp);
        await savePropertiesToGitHub(properties, sha, `Add property: ${newProp.title}`);
        return res.status(201).json({ success: true, source: 'github', property: newProp });
      } else {
        const localPath = getLocalFilePath();
        let properties = [];
        if (fs.existsSync(localPath)) {
          properties = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
        properties.unshift(newProp);
        fs.writeFileSync(localPath, JSON.stringify(properties, null, 2), 'utf-8');
        return res.status(201).json({ success: true, source: 'local-file', property: newProp });
      }
    } catch (err) {
      console.error('POST property error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT: Update Property
  if (req.method === 'PUT') {
    try {
      const body = req.body || {};
      const { id } = body;
      if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

      let properties = [];
      let sha = null;

      if (isGitHubConfigured) {
        const ghData = await getPropertiesFromGitHub();
        properties = ghData.properties;
        sha = ghData.sha;
      } else {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          properties = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
      }

      const idx = properties.findIndex(p => p.id === id);
      if (idx === -1) return res.status(404).json({ success: false, error: '매물을 찾을 수 없습니다.' });

      for (const field of ['type', 'typeName', 'region', 'regionName', 'title', 'priceType', 'floor', 'ceilingHeight', 'electricPower', 'parking', 'badge', 'image']) {
        if (body[field] !== undefined) properties[idx][field] = body[field];
      }
      if (body.deposit !== undefined) properties[idx].deposit = Number(body.deposit);
      if (body.rent !== undefined) properties[idx].rent = Number(body.rent);
      if (body.salePrice !== undefined) properties[idx].salePrice = Number(body.salePrice);
      if (body.areaPyeong !== undefined) {
        properties[idx].areaPyeong = Number(body.areaPyeong);
        properties[idx].areaM2 = Math.round(Number(body.areaPyeong) * 3.30578 * 10) / 10;
      }
      if (body.specs !== undefined) {
        properties[idx].specs = Array.isArray(body.specs) ? body.specs : body.specs.split(',').map(s=>s.trim());
      }
      if (body.tags !== undefined) {
        properties[idx].tags = Array.isArray(body.tags) ? body.tags : body.tags.split(',').map(s=>s.trim());
      }

      if (isGitHubConfigured) {
        await savePropertiesToGitHub(properties, sha, `Update property: ${id}`);
      } else {
        const localPath = getLocalFilePath();
        fs.writeFileSync(localPath, JSON.stringify(properties, null, 2), 'utf-8');
      }

      return res.status(200).json({ success: true, property: properties[idx] });
    } catch (err) {
      console.error('PUT property error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // DELETE: Remove Property
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ success: false, error: 'ID is required' });

      let properties = [];
      let sha = null;

      if (isGitHubConfigured) {
        const ghData = await getPropertiesFromGitHub();
        properties = ghData.properties;
        sha = ghData.sha;
      } else {
        const localPath = getLocalFilePath();
        if (fs.existsSync(localPath)) {
          properties = JSON.parse(fs.readFileSync(localPath, 'utf-8'));
        }
      }

      const updated = properties.filter(p => p.id !== id);
      if (isGitHubConfigured) {
        await savePropertiesToGitHub(updated, sha, `Delete property: ${id}`);
      } else {
        const localPath = getLocalFilePath();
        fs.writeFileSync(localPath, JSON.stringify(updated, null, 2), 'utf-8');
      }

      return res.status(200).json({ success: true, deletedId: id });
    } catch (err) {
      console.error('DELETE property error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.status(405).json({ success: false, error: 'Method Not Allowed' });
};
