# P1 Custom Character Pipeline

- 문서 버전: v0.2
- 작성일: 2026-08-02
- 목적: 아이 그림/사진을 PocketPal 캐릭터로 적용하고 3D 결과로 확장하는 흐름 정의

## 목표

PocketPal P1은 다음 두 경험을 함께 제공한다.

1. 그림이나 사진을 올리면 즉시 2D 캐릭터로 적용한다.
2. 같은 이미지를 기반으로 NAS/PC에서 3D 모델을 생성하고 다시 PocketPal에서 확인한다.

```text
아이폰에서 그림/사진 선택
        ↓
2D 캐릭터 즉시 적용
        ↓
3D 만들기
        ↓
job.json + source.png 준비
        ↓
NAS/PC의 img2threejs 작업
        ↓
절차형 Three.js 모듈 또는 GLB/GLTF 결과
        ↓
PocketPal 3D 뷰어
```

## 현재 구현

### 완료

- 그림·사진 업로드
- 이미지 자동 축소
- 캐릭터 이름 저장
- 2D 캐릭터 즉시 적용
- Safari 재접속 후 복원
- 3D 작업 요청 생성
- `job.json` 저장
- 원본 이미지 저장
- 현재 그림을 이용한 2.5D 임시 뷰어
- 실제 GLB/GLTF 파일 불러오기
- 손가락 회전과 확대/축소

### 아직 연결되지 않음

- 아이폰에서 NAS로 자동 업로드
- NAS가 작업 요청을 자동 감지하는 API
- img2threejs 에이전트의 완전 자동 실행
- 생성된 TypeScript 모델의 자동 빌드·배포
- 리깅과 애니메이션

## img2threejs 적용 방식

img2threejs의 기본 결과는 사진에서 메시를 직접 추출하는 방식이 아니라, 이미지의 대상을 Three.js 코드로 다시 구성하는 방식이다. 기본 출력은 `THREE.Group`을 만드는 TypeScript 팩토리다.

PocketPal은 두 결과 형식을 받는다.

1. `procedural_threejs_module`: img2threejs 결과를 브라우저용 JavaScript 모듈로 빌드
2. `glb` 또는 `gltf`: 별도 변환기를 통해 내보낸 모델

3D 뷰어는 다음 주소 형식을 지원하도록 설계한다.

```text
viewer-3d.html?module=/results/char_001/createModel.js
viewer-3d.html?model=/results/char_001/model.glb
```

## 상태

| 상태 | 의미 |
|---|---|
| `none` | 아직 요청 없음 |
| `queued` | 브라우저에서 요청 준비 완료 |
| `processing` | NAS/PC 또는 에이전트가 처리 중 |
| `done` | 뷰어에서 결과 확인 가능 |
| `failed` | 처리 실패 |

## 현재 테스트 기준

1. 캐릭터 화면에서 그림 선택
2. 2D 캐릭터가 바뀌는지 확인
3. `3D 만들기`를 눌러 상태가 대기중으로 변하는지 확인
4. `job.json 저장`과 `원본 저장`이 작동하는지 확인
5. `3D 미리보기`에서 2.5D 임시 화면이 회전하는지 확인
6. GLB 파일이 있으면 불러와 실제 3D 모델이 표시되는지 확인

> 화면에 자동으로 보이는 2.5D 결과는 진짜 3D 변환 결과가 아니다. 실제 변환 결과와 혼동하지 않도록 뷰어에서 명확히 표시한다.
