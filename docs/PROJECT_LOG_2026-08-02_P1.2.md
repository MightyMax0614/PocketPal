# PocketPal P1.2 개발 기록

- 기록일: 2026-08-02
- 저장소: `MightyMax0614/PocketPal`
- 단계: P1 브라우저 시제품

## 사용자 테스트에서 확인된 내용

1. GitHub Pages에서 아이폰으로 PocketPal 외형과 클릭휠 시제품 실행 성공
2. 초기 클릭휠은 Safari 스크롤과 충돌함
3. 페이지 스크롤 잠금과 터치 판정 보정 후 클릭휠 조작 성공
4. 기존 임시 파란 캐릭터의 디자인 만족도가 낮음
5. 아이 그림 또는 사진을 캐릭터로 사용하는 방향 확정
6. 이미지 업로드 후 단순 2D 적용과 실제 3D 변환을 명확히 구분해야 함
7. 3D 생성 후보로 `img2threejs/img2threejs`를 첫 연동 대상으로 채택

## P1.2에서 구현한 코드

### 커스텀 캐릭터

- 아이폰 사진첩/파일에서 그림 또는 사진 선택
- 큰 이미지를 브라우저 저장용으로 축소
- 2D 캐릭터 즉시 적용
- 캐릭터 이름 저장
- IndexedDB 우선 저장, localStorage 대체
- Safari 재접속 후 캐릭터 복원
- 기본 캐릭터 초기화
- 현재 캐릭터 정보를 다른 모듈에서 읽을 수 있는 API 제공

### 3D 작업 요청

- `3D 만들기` 버튼
- `none / queued / processing / done / failed` 상태 카드
- PocketPal `job.json` 생성
- 원본 이미지 저장
- 요청 파일 저장
- 현재 작업 상태 브라우저 저장

### 3D 뷰어

- 현재 그림을 이용한 2.5D 임시 미리보기
- 2.5D와 실제 3D를 화면 문구로 구분
- 한 손가락 회전
- 두 손가락 확대/축소
- 자동 회전
- GLB/GLTF 로컬 파일 불러오기
- URL의 `model` 파라미터로 GLB/GLTF 불러오기
- URL의 `module` 파라미터로 절차형 Three.js 모듈 불러오기

### img2threejs 브리지

- PocketPal 작업 폴더의 `job.json` 검증
- img2threejs 이미지 probe 실행
- assessment 생성
- sculpt spec 생성
- strict-quality 검증
- TypeScript Three.js 팩토리 생성
- 처리 로그와 다음 작업 문서 생성
- 실패 시 job 상태와 오류 기록

## 중요한 사실

- 현재 아이폰 화면에서 자동으로 보이는 것은 2.5D 임시 미리보기다.
- 실제 img2threejs 결과는 NAS/PC와 에이전트 처리 후 생성된다.
- img2threejs는 기본적으로 GLB를 바로 만드는 도구가 아니라 `THREE.Group` 팩토리 TypeScript 코드를 생성한다.
- PocketPal 뷰어는 향후 컴파일된 JavaScript 모듈 또는 GLB/GLTF를 받도록 설계했다.

## 추가된 주요 파일

```text
prototype/p1-web/job-manager.js
prototype/p1-web/viewer-3d.html
prototype/p1-web/viewer-3d.css
prototype/p1-web/viewer-3d.js
tools/img2threejs_bridge.py
docs/JOB_FORMAT.md
docs/IMG2THREEJS_BRIDGE.md
docs/P1_CUSTOM_CHARACTER_UI_SPEC.md
prototype/assets/jobs/example-job.json
```

## 다음 작업

1. 아이폰에서 P1.2 UI 실제 테스트
2. `3D 만들기`, `job.json 저장`, `원본 저장` 동작 확인
3. 2.5D 뷰어 회전과 확대 확인
4. PC 또는 NAS에 img2threejs 설치
5. 첫 아이 그림 1개로 TypeScript 팩토리 생성 시험
6. 생성된 TypeScript를 브라우저용 JavaScript로 빌드하는 자동화 추가
7. NAS 업로드 API 연결
8. 캐릭터 부착점과 3D 선물 시스템 연결
