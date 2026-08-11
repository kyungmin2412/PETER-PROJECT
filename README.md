# Peter's Investment Dashboard

미국·한국 시장 지표를 **미국 시장 / 한국 시장 두 섹션으로 분리**해서 보여주는 투자 대시보드입니다.

## 담는 데이터

| 섹션 | 데이터 |
|---|---|
| 미국 시장 | 나스닥종합지수, S&P500, 다우존스, 미국 10년물 국채금리, WTI유, 섹터별 ETF 전일대비 등락률 (XLE·SOXX 등 11개 SPDR 섹터 + 반도체) |
| 한국 시장 | 코스피, 코스닥, 원/달러 환율, 고객예탁금 |

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

## 왜 investing.com을 직접 스크래핑하지 않았나

investing.com은 공개 API가 없고, HTML 구조를 직접 파싱하는 방식은 이용약관에 저촉될 수 있으며
페이지 구조가 바뀌면 조용히 깨집니다. 대신 이미 이 저장소에서 검증된 안정적인 무료 소스를 그대로
사용합니다.

- **미국 지표**(나스닥·S&P500·다우존스·미국채 10년·WTI·섹터 ETF): `yfinance` — 공식 API는 아니지만
  Yahoo Finance 시세를 안정적으로 반환하며, 이미 이 저장소의 기존 파이프라인에서 매일 정상 동작 중입니다.
- **한국 지표**(코스피·코스닥·원/달러): `pykrx` (KRX 데이터), 환율은 `yfinance`.
- **고객예탁금**: 네이버금융 증시자금동향 페이지(`finance.naver.com/sise/sise_deposit.naver`)를
  `scripts/fetch_korea_data.py`의 `fetch_customer_deposits()`가 파싱합니다. 이 세션은 조직
  네트워크 정책상 `finance.naver.com`에 직접 접근할 수 없어(에이전트 프록시가 403으로 차단),
  실제 페이지를 열어 구조를 확인하지 못한 채 학습 데이터 기준 지식으로 작성했습니다. 그래서
  고정된 컬럼 위치 대신 헤더 텍스트("고객예탁금", "실질고객예탁금" 제외)로 컬럼을 찾고, 단위도
  헤더에 적힌 그대로(억원/백만원 등) 읽어 환산하며, 결과가 상식적인 범위(10~500조원)를 벗어나면
  파싱 실패로 간주해 조용히 잘못된 값을 쓰는 대신 기존 값을 유지하도록 방어적으로 작성했습니다.
  Mock HTML로 파싱 로직 자체는 검증했지만, 실제 페이지 구조와 일치하는지는 GitHub Actions
  첫 실행 로그(`[warn] customer deposits: ...` 여부)로 반드시 확인해야 합니다.

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

두 스크립트 모두 `src/data/latest.json`의 객관적 수치 필드만 갱신합니다.

## 배포 (GitHub Pages)

1. 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정.
2. `main` 브랜치에 푸시하면 `deploy.yml`이 자동으로 빌드·배포합니다.
3. `next.config.ts`의 `basePath`는 `GITHUB_REPOSITORY` 환경변수(Actions가 자동 설정,
   정확한 대소문자 포함)에서 저장소 이름을 가져옵니다.
4. (선택) `data.krx.co.kr`에 계정을 만들고, 저장소 Settings → Secrets and variables →
   Actions에 `KRX_ID`, `KRX_PW`를 등록하면 한국 시장 데이터 수집이 더 안정적으로
   동작할 가능성이 높습니다.

## 알려진 한계

- **한국 시장 데이터(코스피/코스닥)가 pykrx에서 실패할 수 있습니다.** KRX 로그인 세션 없이는
  비로그인 요청이 안정적으로 통하지 않을 수 있어, `KRX_ID`/`KRX_PW` 시크릿 등록을 권장합니다.
- **`고객예탁금`(네이버금융 스크래핑)은 이 세션이 실제 페이지에 접근하지 못한 채 작성됐습니다.**
  로직은 방어적으로 짰지만(위 "왜 investing.com을 직접 스크래핑하지 않았나" 참고), 최초 스케줄
  실행 로그에서 정상 파싱되는지 반드시 확인이 필요합니다. 페이지 구조가 다르면 경고만 남기고
  기존 값을 유지하므로 크래시하지는 않지만, 값이 갱신되지 않는 상태가 계속될 수 있습니다.
