# Voice of YUHAN 설문조사 — 배포 가이드

이 폴더를 GitHub Pages에 올려서 `vote.ourclinic.kr` 에서 서비스하기 위한 단계별 안내입니다.
전체 흐름: **Supabase 설정 → config.js 수정 → GitHub 업로드 → GitHub Pages/DNS 연결**

---

## 1. Supabase 프로젝트 만들기

1. Supabase 대시보드 → **New project** → 이름은 원하는 대로 (예: `voy-survey`), 리전은 서울(ap-northeast-2) 추천.
2. 생성이 끝나면 왼쪽 메뉴 **SQL Editor** 로 이동 → `supabase/schema.sql` 파일 내용을 통째로 붙여넣고 **Run** 실행.
   - `surveys`, `responses`, `draws` 3개 테이블과 보안 정책(RLS)이 만들어집니다.
3. 왼쪽 메뉴 **Project Settings → API** 로 이동해서 아래 두 값을 복사해두세요.
   - **Project URL** (예: `https://abcdxyz.supabase.co`)
   - **anon public** 키 (긴 문자열, `service_role` 키는 사용하지 않습니다 — 절대 외부에 노출하지 마세요)

## 2. 관리자용 Edge Function 배포

관리자 페이지의 저장/삭제/추첨 같은 민감한 동작은 이 함수를 거쳐야만 동작합니다 (비밀번호가 브라우저 밖으로 나가지 않도록).

로컬 컴퓨터(터미널)에서:

```bash
npm install -g supabase
supabase login
cd (이 폴더의 supabase 디렉터리가 있는 경로)
supabase link --project-ref YOUR-PROJECT-REF   # Project Settings 상단에서 확인 가능
supabase functions deploy admin-api
supabase secrets set ADMIN_PASSCODE=원하는_관리자_비밀번호
```

- `ADMIN_PASSCODE` 는 관리자 페이지 로그인 비밀번호입니다. 원하는 값으로 바꿔서 설정하세요.
- 배포가 끝나면 함수 URL은 자동으로 `https://YOUR-PROJECT-REF.supabase.co/functions/v1/admin-api` 가 됩니다 (별도로 저장할 필요 없음 — 관리자 페이지가 Supabase 클라이언트를 통해 자동으로 호출해요).

## 3. config.js 값 채우기

이 폴더의 `config.js` 파일을 열어서 1번에서 복사해둔 값으로 바꿔주세요.

```js
window.SUPABASE_CONFIG = {
  url: 'https://abcdxyz.supabase.co',       // 실제 Project URL로 교체
  anonKey: '실제 anon public 키로 교체',
};
```

## 4. GitHub 저장소에 업로드

1. GitHub에서 새 저장소 생성 (예: `voy-survey`), Public/Private 어느 쪽이든 상관없습니다.
2. 이 폴더(`vote-site/`) 안의 파일 전체를 저장소에 업로드합니다. 터미널을 쓸 수 있다면:

```bash
cd vote-site
git init
git add .
git commit -m "Voice of YUHAN 설문조사"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/voy-survey.git
git push -u origin main
```

   터미널이 익숙하지 않다면 GitHub 웹사이트의 **Add file → Upload files** 로 폴더 안의 모든 파일(하위 폴더 `admin/`, `assets/` 포함, `supabase/` 폴더는 배포에 필수는 아니지만 함께 올려도 무방)을 그대로 끌어다 놓으면 됩니다.
   - `CNAME` 파일은 숨김 파일처럼 보일 수 있는데, 반드시 저장소 최상위에 함께 올라가야 합니다.

## 5. GitHub Pages 켜기

1. 저장소 → **Settings → Pages**
2. **Build and deployment → Source**: `Deploy from a branch`
3. **Branch**: `main` / `/(root)` 선택 → Save
4. 같은 화면의 **Custom domain** 칸에 `vote.ourclinic.kr` 입력 → Save
   - 이미 3번 단계에서 `CNAME` 파일을 올렸다면 자동으로 채워져 있을 수도 있어요.

## 6. DNS 연결 (ourclinic.kr 도메인 관리 화면에서)

도메인을 관리하는 곳(가비아, Cloudflare 등)의 DNS 설정에서 아래 레코드를 추가하세요.

| 타입 | 호스트/이름 | 값 |
|---|---|---|
| CNAME | `vote` | `YOUR-GITHUB-USERNAME.github.io` |

- 반영까지 몇 분~몇 시간 걸릴 수 있습니다.
- 반영되면 GitHub Pages 설정 화면에서 자동으로 HTTPS 인증서(자물쇠 표시)가 발급됩니다. 발급 전까지는 "Enforce HTTPS" 체크박스가 비활성화되어 있을 수 있어요 — 발급되면 꼭 체크해주세요.

## 확인

- `https://vote.ourclinic.kr/` → 설문조사 페이지 (아직 "활성" 설문이 없으면 "준비 중" 화면이 보이는 게 정상입니다)
- `https://vote.ourclinic.kr/admin` → 관리자 페이지 → 2번에서 설정한 비밀번호로 로그인 → "설문 만들기" 탭에서 첫 설문을 만들고 **"저장 후 바로 이 설문을 공개(활성화)"** 를 체크한 뒤 저장하면 바로 위 설문조사 페이지에 노출됩니다.

## 폴더 구성

```
vote-site/
├── index.html              설문조사 페이지 (vote.ourclinic.kr/)
├── admin/index.html        관리자 페이지 (vote.ourclinic.kr/admin)
├── assets/style.css        공용 스타일
├── assets/logo.webp        Voice of YUHAN 로고
├── config.js                Supabase 연결 정보 (직접 채워야 함)
├── CNAME                    GitHub Pages 커스텀 도메인 설정 파일
├── DEPLOY.md                 이 문서
└── supabase/
    ├── schema.sql            DB 테이블 + 보안 정책
    └── functions/admin-api/index.ts   관리자 전용 서버 함수
```
