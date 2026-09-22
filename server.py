#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local development server for Anyang·Gunpo·Uiwang Industrial Real Estate Homepage.
Serves static files and emulates Vercel serverless endpoints locally:
- /api/board
- /api/reviews
- /api/properties
"""

import http.server
import socketserver
import json
import os
import sys
import urllib.parse
from datetime import datetime

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
BOARD_FILE = os.path.join(DATA_DIR, 'board.json')
REVIEWS_FILE = os.path.join(DATA_DIR, 'reviews.json')
PROPERTIES_FILE = os.path.join(DATA_DIR, 'properties.json')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin1234')

def load_json_file(file_path, default=None):
    if default is None:
        default = []
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return default
    return default

def save_json_file(file_path, data):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

class LocalHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-admin-password, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ('/api/board', '/api/board.js'):
            self._handle_board_get()
        elif path in ('/api/reviews', '/api/reviews.js'):
            self._handle_reviews_get()
        elif path in ('/api/properties', '/api/properties.js'):
            self._handle_properties_get()
        elif path == '/admin':
            self.path = '/admin.html'
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ('/api/board', '/api/board.js'):
            self._handle_board_post()
        elif path in ('/api/reviews', '/api/reviews.js'):
            self._handle_reviews_post()
        elif path in ('/api/properties', '/api/properties.js'):
            self._handle_properties_post()
        elif path in ('/api/upload', '/api/upload.js'):
            self._handle_upload_post()
        else:
            self.send_error(404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ('/api/board', '/api/board.js'):
            self._handle_board_put()
        elif path in ('/api/reviews', '/api/reviews.js'):
            self._handle_reviews_put()
        elif path in ('/api/properties', '/api/properties.js'):
            self._handle_properties_put()
        else:
            self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path in ('/api/board', '/api/board.js'):
            self._handle_board_delete()
        elif path in ('/api/reviews', '/api/reviews.js'):
            self._handle_reviews_delete()
        elif path in ('/api/properties', '/api/properties.js'):
            self._handle_properties_delete()
        else:
            self.send_error(404)

    def _check_auth(self, body_data=None):
        auth_header = self.headers.get('x-admin-password') or self.headers.get('Authorization', '')
        req_pwd = auth_header.replace('Bearer ', '').strip() if auth_header else ''
        if not req_pwd and body_data and isinstance(body_data, dict):
            req_pwd = body_data.get('adminPassword', '')
        return req_pwd == ADMIN_PASSWORD

    def _read_json_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length <= 0:
            return None
        body = self.rfile.read(length).decode('utf-8')
        try:
            return json.loads(body)
        except Exception:
            return None

    def _send_json(self, status, payload):
        resp = json.dumps(payload, ensure_ascii=False)
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(resp.encode('utf-8'))

    def _send_json_error(self, code, msg):
        self._send_json(code, {'success': False, 'error': msg})

    # =========================================================================
    # BOARD HANDLERS
    # =========================================================================
    def _handle_board_get(self):
        posts = load_json_file(BOARD_FILE)
        self._send_json(200, {'success': True, 'source': 'local-file', 'posts': posts})

    def _handle_board_post(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')
        if not self._check_auth(data):
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        if not title or not content:
            return self._send_json_error(400, '제목과 본문은 필수입니다.')

        new_post = {
            'id': f"post-{int(datetime.now().timestamp()*1000)}",
            'title': title,
            'category': data.get('category', '공지사항'),
            'summary': data.get('summary', content[:100].replace('\n', ' ') + '...'),
            'content': content,
            'author': data.get('author', '대표 공인중개사'),
            'date': datetime.now().strftime('%Y-%m-%d'),
            'views': 1,
            'tags': data.get('tags', []) if isinstance(data.get('tags'), list) else [t.strip() for t in data.get('tags', '').split(',') if t.strip()],
            'thumbnail': data.get('thumbnail') or 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80',
            'isPinned': bool(data.get('isPinned', False))
        }

        posts = load_json_file(BOARD_FILE)
        posts.insert(0, new_post)
        save_json_file(BOARD_FILE, posts)
        self._send_json(201, {'success': True, 'source': 'local-file', 'post': new_post})

    def _handle_board_put(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')
        if not self._check_auth(data):
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        post_id = data.get('id')
        if not post_id:
            return self._send_json_error(400, 'ID가 필요합니다.')

        posts = load_json_file(BOARD_FILE)
        found = False
        target = None
        for p in posts:
            if p.get('id') == post_id:
                found = True
                if 'title' in data: p['title'] = data['title'].strip()
                if 'category' in data: p['category'] = data['category']
                if 'summary' in data: p['summary'] = data['summary'].strip()
                if 'content' in data: p['content'] = data['content'].strip()
                if 'tags' in data: p['tags'] = data['tags'] if isinstance(data['tags'], list) else [t.strip() for t in data['tags'].split(',') if t.strip()]
                if 'thumbnail' in data: p['thumbnail'] = data['thumbnail']
                if 'isPinned' in data: p['isPinned'] = bool(data['isPinned'])
                p['updatedAt'] = datetime.now().strftime('%Y-%m-%d')
                target = p
                break

        if not found:
            return self._send_json_error(404, '게시글을 찾을 수 없습니다.')

        save_json_file(BOARD_FILE, posts)
        self._send_json(200, {'success': True, 'source': 'local-file', 'post': target})

    def _handle_board_delete(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        post_id = qs.get('id', [None])[0]
        if not post_id:
            data = self._read_json_body()
            if data: post_id = data.get('id')

        if not self._check_auth():
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')
        if not post_id:
            return self._send_json_error(400, '삭제할 ID가 필요합니다.')

        posts = load_json_file(BOARD_FILE)
        new_posts = [p for p in posts if p.get('id') != post_id]
        save_json_file(BOARD_FILE, new_posts)
        self._send_json(200, {'success': True, 'deletedId': post_id})

    # =========================================================================
    # REVIEWS HANDLERS (Real Property Details + Review)
    # =========================================================================
    def _handle_reviews_get(self):
        reviews = load_json_file(REVIEWS_FILE)
        self._send_json(200, {'success': True, 'source': 'local-file', 'reviews': reviews})

    def _handle_reviews_post(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')

        # Reviews can be submitted directly from website or by admin
        client_name = data.get('clientName', '').strip()
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        if not client_name or not title or not content:
            return self._send_json_error(400, '작성자명, 후기 제목 및 내용은 필수 항목입니다.')

        # Extract property details (real actual property information)
        prop_input = data.get('property', {})
        if not isinstance(prop_input, dict):
            prop_input = {}

        prop_title = prop_input.get('title') or data.get('propertyTitle', '안양·군포·의왕 실거래 매물')
        prop_type = prop_input.get('type') or data.get('propertyType', 'factory')
        prop_type_name = prop_input.get('typeName') or data.get('propertyTypeName', '공장 / 지산')
        prop_region = prop_input.get('region') or data.get('propertyRegion', '안양 평촌')
        prop_price = prop_input.get('price') or data.get('propertyPrice', '상담 협의')
        
        try:
            prop_area = float(prop_input.get('areaPyeong') or data.get('propertyArea', 50))
        except (ValueError, TypeError):
            prop_area = 50

        specs = prop_input.get('specs') or data.get('propertySpecs', [])
        if isinstance(specs, str):
            specs = [s.strip() for s in specs.split(',') if s.strip()]

        tags = data.get('tags', [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(',') if t.strip()]

        new_review = {
            'id': f"rev-{int(datetime.now().timestamp()*1000)}",
            'clientName': client_name,
            'clientCompany': data.get('clientCompany', '기업/개인 고객'),
            'rating': int(data.get('rating', 5)),
            'property': {
                'title': prop_title,
                'type': prop_type,
                'typeName': prop_type_name,
                'region': prop_region,
                'areaPyeong': prop_area,
                'price': prop_price,
                'specs': specs
            },
            'title': title,
            'content': content,
            'date': datetime.now().strftime('%Y-%m-%d'),
            'verified': bool(data.get('verified', True)),
            'likes': 1,
            'tags': tags
        }

        reviews = load_json_file(REVIEWS_FILE)
        reviews.insert(0, new_review)
        save_json_file(REVIEWS_FILE, reviews)
        self._send_json(201, {'success': True, 'source': 'local-file', 'review': new_review})

    def _handle_reviews_put(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')
        if not self._check_auth(data):
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        rev_id = data.get('id')
        if not rev_id:
            return self._send_json_error(400, 'Review ID is required')

        reviews = load_json_file(REVIEWS_FILE)
        found = False
        target = None
        for r in reviews:
            if r.get('id') == rev_id:
                found = True
                if 'clientName' in data: r['clientName'] = data['clientName'].strip()
                if 'clientCompany' in data: r['clientCompany'] = data['clientCompany'].strip()
                if 'rating' in data: r['rating'] = int(data['rating'])
                if 'title' in data: r['title'] = data['title'].strip()
                if 'content' in data: r['content'] = data['content'].strip()
                if 'property' in data and isinstance(data['property'], dict):
                    r['property'] = data['property']
                if 'tags' in data:
                    r['tags'] = data['tags'] if isinstance(data['tags'], list) else [t.strip() for t in data['tags'].split(',') if t.strip()]
                if 'verified' in data: r['verified'] = bool(data['verified'])
                r['updatedAt'] = datetime.now().strftime('%Y-%m-%d')
                target = r
                break

        if not found:
            return self._send_json_error(404, '후기를 찾을 수 없습니다.')

        save_json_file(REVIEWS_FILE, reviews)
        self._send_json(200, {'success': True, 'source': 'local-file', 'review': target})

    def _handle_reviews_delete(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        rev_id = qs.get('id', [None])[0]
        if not rev_id:
            data = self._read_json_body()
            if data: rev_id = data.get('id')

        if not self._check_auth():
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')
        if not rev_id:
            return self._send_json_error(400, '삭제할 ID가 필요합니다.')

        reviews = load_json_file(REVIEWS_FILE)
        new_reviews = [r for r in reviews if r.get('id') != rev_id]
        save_json_file(REVIEWS_FILE, new_reviews)
        self._send_json(200, {'success': True, 'deletedId': rev_id})

    # =========================================================================
    # PROPERTIES HANDLERS (Direct Real Property Management)
    # =========================================================================
    def _handle_properties_get(self):
        props = load_json_file(PROPERTIES_FILE)
        self._send_json(200, {'success': True, 'source': 'local-file', 'properties': props})

    def _handle_properties_post(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')
        if not self._check_auth(data):
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        title = data.get('title', '').strip()
        if not title:
            return self._send_json_error(400, '매물명/제목은 필수입니다.')

        new_prop = {
            'id': f"prop-{int(datetime.now().timestamp()*1000)}",
            'type': data.get('type', 'factory'),
            'typeName': data.get('typeName', '공장 / 지산'),
            'region': data.get('region', 'anyang'),
            'regionName': data.get('regionName', '안양 평촌'),
            'title': title,
            'priceType': data.get('priceType', '임대'),
            'deposit': int(data.get('deposit', 0)),
            'rent': int(data.get('rent', 0)),
            'salePrice': int(data.get('salePrice', 0)),
            'areaPyeong': float(data.get('areaPyeong', 50)),
            'areaM2': round(float(data.get('areaPyeong', 50)) * 3.30578, 1),
            'floor': data.get('floor', '중층'),
            'ceilingHeight': data.get('ceilingHeight', '5.5m'),
            'electricPower': data.get('electricPower', '50kW'),
            'parking': data.get('parking', '무료 주차'),
            'specs': data.get('specs', []) if isinstance(data.get('specs'), list) else [s.strip() for s in data.get('specs', '').split(',') if s.strip()],
            'tags': data.get('tags', []) if isinstance(data.get('tags'), list) else [t.strip() for t in data.get('tags', '').split(',') if t.strip()],
            'badge': data.get('badge', '실매물확인'),
            'image': data.get('image') or 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80'
        }

        props = load_json_file(PROPERTIES_FILE)
        props.insert(0, new_prop)
        save_json_file(PROPERTIES_FILE, props)
        self._send_json(201, {'success': True, 'source': 'local-file', 'property': new_prop})

    def _handle_properties_put(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')
        if not self._check_auth(data):
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        prop_id = data.get('id')
        if not prop_id:
            return self._send_json_error(400, 'Property ID is required')

        props = load_json_file(PROPERTIES_FILE)
        found = False
        target = None
        for p in props:
            if p.get('id') == prop_id:
                found = True
                for field in ['type', 'typeName', 'region', 'regionName', 'title', 'priceType', 'floor', 'ceilingHeight', 'electricPower', 'parking', 'badge', 'image']:
                    if field in data: p[field] = data[field]
                if 'deposit' in data: p['deposit'] = int(data['deposit'])
                if 'rent' in data: p['rent'] = int(data['rent'])
                if 'salePrice' in data: p['salePrice'] = int(data['salePrice'])
                if 'areaPyeong' in data:
                    p['areaPyeong'] = float(data['areaPyeong'])
                    p['areaM2'] = round(float(data['areaPyeong']) * 3.30578, 1)
                if 'specs' in data:
                    p['specs'] = data['specs'] if isinstance(data['specs'], list) else [s.strip() for s in data['specs'].split(',') if s.strip()]
                if 'tags' in data:
                    p['tags'] = data['tags'] if isinstance(data['tags'], list) else [t.strip() for t in data['tags'].split(',') if t.strip()]
                target = p
                break

        if not found:
            return self._send_json_error(404, '매물을 찾을 수 없습니다.')

        save_json_file(PROPERTIES_FILE, props)
        self._send_json(200, {'success': True, 'source': 'local-file', 'property': target})

    def _handle_properties_delete(self):
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        prop_id = qs.get('id', [None])[0]
        if not prop_id:
            data = self._read_json_body()
            if data: prop_id = data.get('id')

        if not self._check_auth():
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')
        if not prop_id:
            return self._send_json_error(400, '삭제할 ID가 필요합니다.')

        props = load_json_file(PROPERTIES_FILE)
        new_props = [p for p in props if p.get('id') != prop_id]
        save_json_file(PROPERTIES_FILE, new_props)
        self._send_json(200, {'success': True, 'deletedId': prop_id})

    # =========================================================================
    # IMAGE UPLOAD HANDLER
    # =========================================================================
    def _handle_upload_post(self):
        data = self._read_json_body()
        if not data:
            return self._send_json_error(400, 'Invalid JSON body')

        file_data = data.get('fileData', '')
        filename = data.get('filename', '')
        if not file_data:
            return self._send_json_error(400, '사진 데이터가 전달되지 않았습니다.')

        # Strip data URL prefix if present
        if ',' in file_data:
            _, base64_str = file_data.split(',', 1)
        else:
            base64_str = file_data

        try:
            import base64
            img_bytes = base64.b64decode(base64_str)
        except Exception as e:
            return self._send_json_error(400, f'Base64 디코딩 실패: {e}')

        ext = '.jpg'
        if filename:
            _, raw_ext = os.path.splitext(filename)
            if raw_ext.lower() in ('.jpg', '.jpeg', '.png', '.webp'):
                ext = raw_ext.lower()

        safe_filename = f"prop-{int(datetime.now().timestamp()*1000)}{ext}"
        upload_dir = os.path.join(BASE_DIR, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        target_path = os.path.join(upload_dir, safe_filename)

        with open(target_path, 'wb') as f:
            f.write(img_bytes)

        rel_url = f"/uploads/{safe_filename}"
        self._send_json(200, {'success': True, 'url': rel_url, 'filename': safe_filename})

if __name__ == '__main__':
    # Force UTF-8 encoding
    sys.stdout.reconfigure(encoding='utf-8')
    print("============================================================")
    print(" 🏢 안양·군포·의왕 산업부동산 통합 로컬 서버 구동")
    print(f" 🌐 홈페이지: http://localhost:{PORT}")
    print(f" 📋 관리자 포털: http://localhost:{PORT}/admin.html")
    print(f" 🔑 관리자 기본 비밀번호: {ADMIN_PASSWORD}")
    print(f" 📦 지원 API: /api/board, /api/reviews, /api/properties")
    print("============================================================")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), LocalHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
