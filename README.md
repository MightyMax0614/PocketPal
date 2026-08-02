# PocketPal

**아이와 대화하고, 기억하고, 먼저 말을 걸며 함께 성장하는 휴대형 AI 친구**

현재 목표는 판매용 제품이 아니라 두 자녀가 실제로 사용할 수 있는 완성 시제품 2대를 만드는 것입니다.

## 현재 단계

- P0 제품 사양: 대부분 완료
- P1 브라우저 소프트웨어 시제품: **P1.2 진행 중**
- P2 1:1 외형 목업: 준비 중
- 고가 부품·맞춤 배터리·전용 PCB: 아직 구매하지 않음

## 확정 외형

- 104 × 62 × 12.0 mm
- 최대 두께 12.5 mm
- 목표 무게 120 g 이하
- 약 2.8인치 세로형 IPS
- 외경 약 40 mm 평면 클릭휠
- 중앙 버튼 약 15 mm
- 전·후면 카메라 모두 탑재
- 전면 카메라는 상단 베젤 안에 숨김
- USB-C 하단 중앙
- 마이크 2개, 스피커 1개, 진동, Wi-Fi, Bluetooth

## P1.2 웹 시제품

GitHub Pages에서 아이폰으로 바로 시험할 수 있습니다.

현재 구현:

- 모바일 스크롤과 충돌하지 않는 가상 클릭휠
- 전·후면 카메라 전환
- 로컬 기억 저장
- 그림·사진을 2D 캐릭터로 즉시 적용
- 캐릭터 이름과 이미지 재접속 유지
- 3D 변환 작업용 `job.json` 생성
- 원본 캐릭터 이미지 저장
- 2.5D 임시 회전 미리보기
- GLB/GLTF 실제 결과 불러오기
- Three.js 절차형 모듈 URL 불러오기
- img2threejs 공식 Python 단계를 호출하는 PC/NAS 브리지

현재 2.5D 미리보기는 **진짜 3D 변환 결과가 아닙니다.** 실제 img2threejs 결과는 NAS/PC에서 생성한 절차형 Three.js 모듈 또는 GLB/GLTF로 뷰어에 넣습니다.

## 저장소 구조

```text
PocketPal/
├── README.md
├── index.html
├── docs/
│   ├── PocketPal_Master_Spec_v0.1.md
│   ├── PROJECT_STATUS_2026-08-02.md
│   ├── P1_CUSTOM_CHARACTER_PIPELINE.md
│   ├── P1_CUSTOM_CHARACTER_UI_SPEC.md
│   ├── JOB_FORMAT.md
│   └── IMG2THREEJS_BRIDGE.md
├── prototype/
│   ├── assets/jobs/example-job.json
│   └── p1-web/
│       ├── index.html
│       ├── app.js
│       ├── styles.css
│       ├── mobile.css
│       ├── character.css
│       ├── character-customizer.js
│       ├── job-manager.js
│       ├── viewer-3d.html
│       ├── viewer-3d.css
│       └── viewer-3d.js
└── tools/
    └── img2threejs_bridge.py
```

## 3D 변환 흐름

```text
아이폰 그림/사진
    ↓
2D 캐릭터 즉시 적용
    ↓
3D 만들기
    ↓
job.json + source.png
    ↓
PC/NAS img2threejs 작업
    ↓
createModel.js 또는 model.glb
    ↓
PocketPal 3D 뷰어
```

## PC/NAS 브리지 실행

```bash
python3 tools/img2threejs_bridge.py \
  jobs/<job_id> \
  --skill-root ~/.claude/skills/img2threejs
```

자세한 내용은 [img2threejs Bridge 사용 방법](docs/IMG2THREEJS_BRIDGE.md)을 참고합니다.

## 개발 원칙

- 기존 PC·스마트폰·웹캠·마이크·스피커로 먼저 시험
- 국내 재고와 빠른 배송 우선
- 실제 치수와 데이터시트로 검증
- 확정 / 잠정 / 검증 필요를 구분
- 콘셉트 이미지를 제작용 CAD로 단정하지 않음
- 2.5D 임시 화면과 실제 3D 결과를 명확하게 구분

## 문서

- [마스터 사양서](docs/PocketPal_Master_Spec_v0.1.md)
- [2026-08-02 진행 기록](docs/PROJECT_STATUS_2026-08-02.md)
- [커스텀 캐릭터 파이프라인](docs/P1_CUSTOM_CHARACTER_PIPELINE.md)
- [3D 작업 규격](docs/JOB_FORMAT.md)
- [img2threejs 브리지](docs/IMG2THREEJS_BRIDGE.md)

---

> PocketPal은 기능을 많이 넣는 기기가 아니라, 아이가 오래 곁에 두고 싶은 AI 친구를 만드는 프로젝트입니다.
