#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Local development server for Anyang·Gunpo·Uiwang Industrial Real Estate Homepage.
Serves static files and emulates the Vercel serverless /api/board endpoint locally.
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
BOARD_FILE = os.path.join(BASE_DIR, 'data', 'board.json')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin1234')

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
        if parsed.path in ('/api/board', '/api/board.js'):
            self._handle_api_get()
        elif parsed.path == '/admin':
            self.path = '/admin.html'
            super().do_GET()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api/board', '/api/board.js'):
            self._handle_api_post()
        else:
            self.send_error(404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api/board', '/api/board.js'):
            self._handle_api_put()
        else:
            self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path in ('/api/board', '/api/board.js'):
            self._handle_api_delete()
        else:
            self.send_error(404)

    def _check_auth(self, body_data=None):
        auth_header = self.headers.get('x-admin-password') or self.headers.get('Authorization', '')
        req_pwd = auth_header.replace('Bearer ', '').strip() if auth_header else ''
        if not req_pwd and body_data and isinstance(body_data, dict):
            req_pwd = body_data.get('adminPassword', '')
        return req_pwd == ADMIN_PASSWORD

    def _handle_api_get(self):
        try:
            if os.path.exists(BOARD_FILE):
                with open(BOARD_FILE, 'r', encoding='utf-8') as f:
                    posts = json.load(f)
            else:
                posts = []
            
            resp = json.dumps({'success': True, 'source': 'local-file', 'posts': posts}, ensure_ascii=False)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(resp.encode('utf-8'))
        except Exception as e:
            self._send_json_error(500, str(e))

    def _handle_api_post(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
        except:
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

        posts = []
        if os.path.exists(BOARD_FILE):
            with open(BOARD_FILE, 'r', encoding='utf-8') as f:
                posts = json.load(f)
        posts.insert(0, new_post)
        with open(BOARD_FILE, 'w', encoding='utf-8') as f:
            json.dump(posts, f, ensure_ascii=False, indent=2)

        resp = json.dumps({'success': True, 'source': 'local-file', 'post': new_post}, ensure_ascii=False)
        self.send_response(201)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(resp.encode('utf-8'))

    def _handle_api_put(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length).decode('utf-8')
        try:
            data = json.loads(body)
        except:
            return self._send_json_error(400, 'Invalid JSON body')

        if not self._check_auth(data):
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        post_id = data.get('id')
        if not post_id:
            return self._send_json_error(400, 'ID가 필요합니다.')

        posts = []
        if os.path.exists(BOARD_FILE):
            with open(BOARD_FILE, 'r', encoding='utf-8') as f:
                posts = json.load(f)

        found = False
        target_post = None
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
                target_post = p
                break

        if not found:
            return self._send_json_error(404, '게시글을 찾을 수 없습니다.')

        with open(BOARD_FILE, 'w', encoding='utf-8') as f:
            json.dump(posts, f, ensure_ascii=False, indent=2)

        resp = json.dumps({'success': True, 'source': 'local-file', 'post': target_post}, ensure_ascii=False)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(resp.encode('utf-8'))

    def _handle_api_delete(self):
        # Could come from query string or body
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        post_id = qs.get('id', [None])[0]

        if not post_id:
            length = int(self.headers.get('Content-Length', 0))
            if length > 0:
                body = self.rfile.read(length).decode('utf-8')
                try:
                    data = json.loads(body)
                    post_id = data.get('id')
                except:
                    pass

        if not self._check_auth():
            return self._send_json_error(401, '관리자 비밀번호가 일치하지 않습니다.')

        if not post_id:
            return self._send_json_error(400, '삭제할 ID가 필요합니다.')

        posts = []
        if os.path.exists(BOARD_FILE):
            with open(BOARD_FILE, 'r', encoding='utf-8') as f:
                posts = json.load(f)

        new_posts = [p for p in posts if p.get('id') != post_id]
        with open(BOARD_FILE, 'w', encoding='utf-8') as f:
            json.dump(new_posts, f, ensure_ascii=False, indent=2)

        resp = json.dumps({'success': True, 'deletedId': post_id}, ensure_ascii=False)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(resp.encode('utf-8'))

    def _send_json_error(self, code, msg):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self._send_cors_headers()
        self.end_headers()
        err = json.dumps({'success': False, 'error': msg}, ensure_ascii=False)
        self.wfile.write(err.encode('utf-8'))

if __name__ == '__main__':
    # Force UTF-8 encoding
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"============================================================")
    print(f" 🏢 안양·군포·의왕 산업부동산 로컬 테스트 서버 구동")
    print(f" 🌐 접속 주소: http://localhost:{PORT}")
    print(f" 📋 관리자 페이지: http://localhost:{PORT}/admin.html")
    print(f" 🔑 기본 관리자 비밀번호: admin1234")
    print(f"============================================================")
    with socketserver.TCPServer(("", PORT), LocalHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n서버를 종료합니다.")
