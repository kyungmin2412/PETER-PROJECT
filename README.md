# Peter's Market Dashboard

미국·한국 시장 데일리 브리핑 대시보드. 첨부된 "US Market Daily" 샘플 PDF의 13개 섹션
(매크로 지표, 관심종목, 섹터 등락, 매크로/종목/정책 이슈, 한국 시장 수급, 이격도,
V-KOSPI 등)을 그대로 웹으로 옮겼습니다.

## 아키텍처

```
scripts/fetch_market_data.py   (yfinance)  ─┐
scripts/fetch_korea_data.py    (pykrx)     ─┼─▶ src/data/latest.json ─▶ Next.js 정적 빌드 ─▶ GitHub Pages
GitHub Actions (스케줄 cron)   ────────────┘
```

- **프론트엔드**: Next.js (App Router) + TypeScript + Tailwind, `output: "export"`로 완전 정적 빌드.
  서버가 필요 없어 GitHub Pages에 바로 올라갑니다.
- **데이터**: `src/data/latest.json` 하나가 대시보드 전체를 구동합니다. 스키마는
  `src/lib/types.ts` 참고.
- **자동 갱신**: `.github/workflows/update-data.yml`이 평일 06:17 KST경 실행되어
  `scripts/fetch_*.py`로 실데이터를 받아 `latest.json`을 갱신하고 `main`에 커밋합니다.
  그 커밋이 `.github/workflows/deploy.yml`을 트리거해 정적 사이트를 다시 빌드·배포합니다.
  스케줄 시각을 정각(21:00 UTC)에서 21:17 UTC로 옮긴 이유는 아래 "알려진 한계" 참고.
- **왜 두 워크플로로 나눴나**: 이 리포를 개발한 세션은 조직 네트워크 정책상 금융
  데이터 사이트(Yahoo Finance, Investing.com, KRX 등)에 직접 접근할 수 없어서, 데이터
  수집 스크립트를 이 세션 안에서 직접 실행·검증하지 못했습니다. GitHub Actions
  runner는 일반 인터넷 접근이 가능하므로 실제 수집·검증은 그쪽에서 처음 이뤄집니다.
  처음 스케줄 실행 후 Actions 로그를 한 번 확인해 주세요.

## 데이터 필드: 자동 vs 수동

| 구분 | 필드 | 방식 |
|---|---|---|
| 자동 (실데이터) | `macro.*`, `watchlist[].close/change/changePercent`, `sectors[].changePercent`, `korea.kospi/kosdaq/usdkrw`, `korea.netBuy`, `korea.topBuyers*`, `korea.deviation` | `scripts/fetch_market_data.py`, `scripts/fetch_korea_data.py` |
| 수동/큐레이션 필요 | `macroThemes`, `stockCatalysts`, `sectorLeaders`, `policyWatch`, `mostWatched`, `koreaIssues`, `stockNews`, `watchlist[].comment` | 사람이 직접 편집 (또는 향후 LLM 요약 파이프라인 연결) |
| 베스트에핏 (소스 불안정) | `korea.depositTrend` (고객예탁금, KOFIA), `korea.volatility` (V-KOSPI) | `fetch_korea_data.py`의 `fetch_deposit_trend()` / `fetch_vkospi()` — 안정적인 무료 API를 찾지 못해 현재는 스텁 상태. 실패 시 기존 값을 그대로 유지합니다 |

뉴스/이슈 섹션은 의도적으로 자동 생성하지 않았습니다. 원본 PDF의 해당 섹션들은
여러 뉴스를 종합한 분석·코멘트라서, 근거 없이 그럴듯한 분석문을 자동 생성하면
가짜 정보가 될 위험이 있습니다. 대신 `src/data/latest.json`에서 직접 수정하거나,
헤드라인을 모아주는 스크립트를 얹고 LLM으로 요약하는 단계를 별도로 붙이는 것을
권장합니다.

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:3000
```

정적 빌드 확인:

```bash
npm run build       # ./out 에 정적 파일 생성
npx serve out
```

샘플 데이터를 다시 생성하려면:

```bash
node scripts/gen-sample-data.mjs
```

## 실데이터 수집 (로컬에서 직접 돌릴 때)

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_market_data.py
python scripts/fetch_korea_data.py
```

두 스크립트 모두 `src/data/latest.json`의 객관적 수치 필드만 갱신하고, 위 "수동/큐레이션"
필드는 건드리지 않습니다.

## 배포 (GitHub Pages)

1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정.
2. `main` 브랜치에 푸시하면 `deploy.yml`이 자동으로 빌드·배포합니다.
3. `next.config.ts`의 `basePath`는 `GITHUB_REPOSITORY` 환경변수(Actions가 자동 설정,
   정확한 대소문자 포함)에서 저장소 이름을 가져옵니다. 저장소를 옮기거나 이름을
   바꿔도 별도로 손댈 필요가 없습니다.
4. (선택) `data.krx.co.kr`에 계정을 만들고, 저장소 Settings → Secrets and variables →
   Actions에 `KRX_ID`, `KRX_PW`를 등록하면 한국 시장 데이터 수집이 더 안정적으로
   동작할 가능성이 높습니다. 아래 "알려진 한계" 참고.

## 알려진 한계

- **한국 시장 데이터(KOSPI/KOSDAQ/수급/이격도)가 pykrx에서 실패할 수 있습니다.**
  2026-08-10 첫 스케줄 실행에서 실제로 전부 실패했습니다 (로그: `KRX 로그인 실패`,
  `Expecting value: line 1 column 1`). pykrx 소스를 확인해보니 2026-04에 KRX 로그인
  세션 기능이 추가됐고, `KRX_ID`/`KRX_PW` 환경변수가 없으면 비로그인 상태로 요청하는데
  이게 더 이상 안정적으로 통하지 않는 것으로 보입니다. `update-data.yml`은 이미
  `secrets.KRX_ID`/`secrets.KRX_PW`를 전달하도록 준비돼 있으니, 저장소 Secrets에
  KRX 계정 정보를 등록하면 해결될 가능성이 높습니다 — 다만 이 세션은 KRX 접속
  자체가 막혀 있어 등록 후 실제로 고쳐지는지는 직접 검증하지 못했습니다. 다음
  스케줄 실행(또는 workflow_dispatch 수동 실행) 로그로 확인해 주세요.
- **스케줄이 예정 시각보다 늦게 실행될 수 있습니다.** GitHub Actions는 예약 실행을
  큐에 넣어 처리하는데, 정각처럼 몰리는 시간대는 지연이 흔합니다. 첫 실행이 06:00
  KST가 아니라 약 08:05 KST에 돌았던 것도 이 때문으로, 정각(21:00 UTC)에서 21:17
  UTC로 옮겨 완화를 시도했지만 완전히 없앨 수는 없습니다.
- `korea.depositTrend`, `korea.volatility`는 안정적인 무료 데이터 소스가 확인되지
  않아 자동 수집이 미구현 상태입니다 (스텁 함수가 경고만 남기고 기존 값 유지).
- `fetch_top_buyers()`가 사용하는 pykrx 컬럼명은 pykrx 문서 기준으로 작성했으며,
  실제 실행 시 pykrx 버전에 따라 컬럼명이 다를 수 있습니다. 최초 Actions 실행
  로그에서 확인·수정이 필요할 수 있습니다.
- 뉴스/이슈 계열 섹션(4,5,6,7,8,12,13번)은 수동 편집이 필요합니다.
