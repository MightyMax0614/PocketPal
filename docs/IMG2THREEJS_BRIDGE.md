# img2threejs Bridge 사용 방법

- 작성일: 2026-08-02
- 대상: PocketPal P1.2 이후 NAS/PC 작업기

## 역할

`tools/img2threejs_bridge.py`는 PocketPal에서 저장한 `job.json`과 `source.png`를 img2threejs 공식 Python 단계에 전달한다.

실행하는 단계:

1. 이미지 검사
2. 사전 평가 생성
3. sculpt spec 생성
4. strict-quality 검증
5. Three.js TypeScript 팩토리 생성

여기까지는 결정적 스크립트 단계다. img2threejs의 핵심인 에이전트 이미지 비교·수정 루프와 브라우저용 JavaScript 빌드는 이후에 진행한다.

## 준비

```bash
git clone https://github.com/img2threejs/img2threejs.git ~/.claude/skills/img2threejs
```

PocketPal 웹에서 다음 두 파일을 저장한다.

```text
char_20260802_153700.job.json
char_20260802_153700.source.png
```

PC/NAS에서 폴더를 만든다.

```text
jobs/char_20260802_153700/
  job.json
  source.png
```

저장된 파일명을 위와 같이 바꾸거나, `job.json`의 `source_image` 값을 실제 파일명에 맞춘다.

## 실행

```bash
python3 tools/img2threejs_bridge.py \
  jobs/char_20260802_153700 \
  --skill-root ~/.claude/skills/img2threejs
```

## 생성 결과

```text
jobs/char_20260802_153700/
  job.json
  source.png
  result/
    assessment.json
    spec.json
    createModel.ts
    bridge.log
    meta.json
    NEXT_STEP.md
```

## 다음 단계

`result/NEXT_STEP.md`의 지침에 따라 Codex, Claude Code 또는 OpenCode에서 원본 이미지와 `createModel.ts`를 함께 검토한다.

최종 결과는 두 방식 중 하나로 PocketPal 뷰어에 연결한다.

### 절차형 Three.js 모듈

```text
viewer-3d.html?module=/results/<job_id>/createModel.js
```

모듈은 아래 함수 중 하나를 export해야 한다.

- `createPocketPalModel`
- `createModel`
- default export

함수의 반환값은 `THREE.Object3D`여야 한다.

### GLB 결과

```text
viewer-3d.html?model=/results/<job_id>/model.glb
```

또는 아이폰의 3D 뷰어 화면에서 GLB 파일을 직접 선택한다.

## 현재 제한

- 아이폰에서 NAS로 자동 업로드하는 API는 아직 없다.
- TypeScript 팩토리를 브라우저용 JavaScript로 자동 빌드하는 단계는 아직 없다.
- 캐릭터 리깅과 표정은 img2threejs의 후속 character/animation 기능과 별도 보정이 필요하다.
