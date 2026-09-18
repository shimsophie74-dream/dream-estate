# 🏢 안양·군포·의왕 산업부동산 홈페이지 & Vercel 서버리스 게시판 시스템

안양, 군포, 의왕 지역 공장·창고·상가·사무실 전문 공인중개사를 위한 **최신 인터랙티브 모바일 최적화 웹사이트** 및 **Vercel 서버리스 + GitHub JSON 데이터베이스 연동 시스템**입니다.

---

## 🌟 주요 특징

1. **프리미엄 반응형 UI/UX (UI/UX Pro Max 디자인 시스템 적용)**
   - 신뢰감 있는 딥 네이비(`--navy-dark`), 비즈니스 틸(`--primary`), 럭셔리 앰버/골드(`--accent-gold`) 색상 조합
   - 글래스모피즘(Glassmorphism) 레이어와 유려한 마이크로 인터랙션
   - 공장/창고 맞춤형 상세 스펙(층고, 전력, 바닥하중, 트레일러 진입, 호이스트 등) 및 실시간 필터링

2. **고전환(High-Conversion) 전화연결 CTA 시스템**
   - **헤더 & 히어로 직통 통화 버튼** (`031-442-5918`, `010-4637-7428`)
   - **모바일 하단 스티키 콜바(Bottom Sticky Call Bar)**: 모바일 환경에서 항상 하단에 고정되어 [문자상담] [매물의뢰] [즉시전화] 제공
   - **빠른 매물 의뢰 & 구하기 모달 팝업**: 원하는 용도, 지역, 평수를 선택하면 즉시 접수

3. **Vercel 서버리스 + GitHub JSON 영구 보존 데이터베이스**
   - 유료 외부 DB(PostgreSQL/MongoDB 등) 없이, GitHub 저장소의 `data/board.json` 파일을 데이터베이스로 사용
   - 어드민 페이지(`/admin.html`)에서 글 작성·수정·삭제 시 Vercel 서버리스 함수(`api/board.js`)가 GitHub REST API를 통해 레포지토리에 자동 커밋
   - 로컬 테스트 환경이나 GitHub 토큰 미설정 상태에서도 로컬 파일 시스템을 통해 정상 작동

---

## 🚀 로컬 테스트 실행 방법

내장된 경량 Python 서버를 통해 지금 즉시 로컬에서 모든 기능을 테스트할 수 있습니다.

```bash
# homepage 폴더로 이동
cd homepage

# 로컬 서버 실행
python server.py
```

브라우저에서 접속:
- **메인 홈페이지**: [http://localhost:8000](http://localhost:8000)
- **게시판 관리자**: [http://localhost:8000/admin.html](http://localhost:8000/admin.html)
- **초기 관리자 비밀번호**: `admin1234`

---

## ☁️ Vercel 1분 배포 및 GitHub 자동 커밋 연동 가이드

### 1단계: GitHub 저장소에 푸시
```bash
git init
git add .
git commit -m "feat: 안양군포의왕 부동산 홈페이지 및 서버리스 게시판 구축"
git branch -M main
git remote add origin https://github.com/당신의계정/당신의레포.git
git push -u origin main
```

### 2단계: Vercel에 배포
1. [Vercel](https://vercel.com)에 로그인 후 **Add New... → Project** 선택
2. 위 GitHub 저장소 임포트 (Root Directory가 `homepage`일 경우 Root Directory를 `homepage`로 지정하거나 프로젝트 루트로 지정)
3. **Deploy** 버튼 클릭

### 3단계: GitHub 영구 커밋 환경변수 설정
Vercel 프로젝트 관리자 대시보드 → **Settings → Environment Variables**에 아래 4개 환경변수를 등록합니다:

| 환경변수 이름 | 설명 | 예시 값 |
|---|---|---|
| `GITHUB_TOKEN` | GitHub Personal Access Token (PAT, `repo` 권한) | `ghp_xxxxxxxxxxxxxx` |
| `GITHUB_OWNER` | GitHub 계정명 또는 조직명 | `your-github-id` |
| `GITHUB_REPO` | 저장소 이름 | `your-realestate-repo` |
| `ADMIN_PASSWORD` | 관리자 로그인 비밀번호 (미설정 시 `admin1234`) | `your-secret-password` |

> 💡 **GitHub Personal Access Token 발급 방법**:
> 1. GitHub 우측 상단 프로필 → **Settings → Developer Settings → Personal access tokens → Tokens (classic)**
> 2. **Generate new token (classic)** 클릭
> 3. Note에 `Vercel Board Sync` 입력, Expiration 설정 후 Scopes에서 `repo` 전체 체크
> 4. 생성된 토큰(`ghp_...`)을 복사하여 Vercel `GITHUB_TOKEN`에 붙여넣기

이제 관리자 페이지에서 게시글을 작성하면 GitHub 저장소의 `data/board.json` 파일로 자동 커밋되어 Vercel 재배포나 서버 재시작 시에도 데이터가 100% 영구 보존됩니다!
