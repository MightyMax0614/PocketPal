# PocketPal P1 Character 3D Flow V2

- 기록일: 2026-08-02
- 구현 버전: P1.3
- 상태: 프런트 입력·작업 요청·실제 GLB 확인 흐름 구현

## 확정된 사용자 흐름

```text
홈
→ 내 캐릭터
   → 그림·사진 적용
   → 3D 준비
   → 3D 상태 보기
   → 3D 결과 보기
```

## 입력 규칙

- 정면 이미지는 필수다.
- 측면과 뒷면은 선택이다.
- 측면 또는 뒷면이 없으면 `missing_views`에 기록하고 AI 추정 대상으로 처리한다.
- 정면·측면·뒷면 이미지는 브라우저 IndexedDB에 저장한다.
- 기존에 적용한 2D 캐릭터를 정면 입력으로 재사용할 수 있다.

## 작업 요청 V2

웹은 `job_v2.json`을 생성한다.

주요 요구 사항:

- `schema_version: 2.0`
- `target: pocketpal_character_3d`
- `generate_full_360_mesh: true`
- 최종 출력: `character.glb`
- 모자·안경·배지·가방용 부착점 포함

예시 파일:

- `prototype/assets/jobs/example-character-job-v2.json`

## PC·NAS 처리

- `tools/character_job_v2_adapter.py`가 V2 작업을 기존 img2threejs 브리지에 연결한다.
- 현재 img2threejs deterministic 단계는 정면 이미지를 기본 참조로 사용한다.
- 측면·뒷면은 이후 에이전트의 시각 비교와 보정에 사용한다.
- 단일 deterministic 실행만으로 여러 시점이 자동 융합됐다고 간주하지 않는다.

## 실제 3D 결과 규칙

- P1 웹은 실제 `.glb` 파일을 IndexedDB에 저장한다.
- 3D 뷰어는 저장된 GLB 또는 실제 img2threejs Three.js 모듈만 표시한다.
- 사진 전체 판, 컷아웃, 이미지 적층 방식의 가짜 2.5D는 메인 흐름에서 제거한다.
- 실제 결과가 없으면 `저장된 실제 GLB 결과가 없음`이라고 표시한다.

## 현재 구현 파일

- `prototype/p1-web/index.html`
- `prototype/p1-web/app.js`
- `prototype/p1-web/character-3d.js`
- `prototype/p1-web/character-3d.css`
- `prototype/p1-web/viewer-3d.html`
- `prototype/p1-web/viewer-3d.js`
- `tools/character_job_v2_adapter.py`

## 아직 남은 작업

1. PC·NAS 작업기에서 실제 img2threejs 에이전트 실행
2. 정면 기반 초안 생성 후 측면·뒷면 비교 보정
3. Three.js 결과를 GLB로 내보내는 자동 빌드
4. 캐릭터 메시 품질 검사
5. 리깅과 애니메이션
6. 선물 부착점 실사용 검증

## 검증 기준

- 아이폰에서 하위 메뉴가 클릭휠로 정상 이동한다.
- 정면·측면·뒷면 이미지를 각각 저장할 수 있다.
- `job_v2.json`과 입력 파일을 내보낼 수 있다.
- 실제 GLB가 없을 때 가짜 3D를 표시하지 않는다.
- 실제 GLB 등록 후 손가락으로 360도 회전·확대·축소할 수 있다.
