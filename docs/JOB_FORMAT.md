# PocketPal 3D Job Format

- 문서 버전: v1.0
- 작성일: 2026-08-02

## 목적

PocketPal 웹과 NAS/PC의 3D 작업기가 같은 요청 형식을 사용하도록 `job.json` 규격을 정의한다.

## 예시

```json
{
  "schema_version": "1.0",
  "job_id": "char_20260802_153700",
  "character_name": "별이",
  "source_type": "drawing_or_photo",
  "source_image": "source.png",
  "requested_at": "2026-08-02T06:37:00.000Z",
  "status": "queued",
  "target": "pocketpal_character",
  "output_contract": {
    "preferred": "procedural_threejs_module",
    "accepted": [
      "procedural_threejs_module",
      "glb",
      "gltf"
    ],
    "viewer_entry": "viewer-3d.html"
  },
  "options": {
    "style": "cute",
    "preserve_silhouette": true,
    "remove_background": true,
    "create_preview": true,
    "expose_attachment_points": [
      "head",
      "face",
      "chest",
      "back",
      "left_hand",
      "right_hand"
    ],
    "rigging": false
  }
}
```

## 상태

| 값 | 설명 |
|---|---|
| `queued` | 요청 준비 완료 |
| `processing` | 변환 처리 중 |
| `done` | 결과 생성 완료 |
| `failed` | 변환 실패 |

## 입력 파일

```text
jobs/<job_id>/
  job.json
  source.png
```

## 출력 파일 후보

### img2threejs 절차형 모델

```text
results/<job_id>/
  spec.json
  assessment.json
  createModel.ts
  createModel.js
  preview.png
  meta.json
```

### GLB/GLTF 모델

```text
results/<job_id>/
  model.glb
  preview.png
  meta.json
```

## 결과 meta.json 예시

```json
{
  "job_id": "char_20260802_153700",
  "status": "done",
  "result_type": "procedural_threejs_module",
  "model_file": "createModel.js",
  "preview_image": "preview.png",
  "completed_at": "2026-08-02T06:55:00.000Z",
  "notes": "정면 이미지에서 추정한 스타일화 캐릭터"
}
```

## 주의

- `source.png`는 현재 브라우저에서 직접 저장한다.
- NAS API가 붙기 전까지 `job.json`과 원본 이미지는 수동으로 같은 폴더에 넣는다.
- 단일 이미지에서 보이지 않는 뒷면은 추정값이다.
