# PocketPal P1.5 — Rive Engine Lab

이 폴더는 기존 CSS 도형 캐릭터를 대체하기 위한 Rive 런타임 검증 시제품입니다.

## 목적

- 전문 리깅된 `.riv` 캐릭터가 iPhone Safari에서 부드럽게 실행되는지 확인
- Rive 파일의 Artboard, State Machine, Input을 런타임에서 검사
- PocketPal Soul Engine의 감정·행동 명령을 Rive 상태에 연결
- 이후 전용 `pocketpal.riv` 파일만 교체하여 같은 앱 코드를 유지

## 현재 샘플

- `https://cdn.rive.app/animations/skills.riv`
  - State Machine: `skill-controller`
  - Number input: `level`
- `https://cdn.rive.app/animations/vehicles.riv`
  - State Machine: `bumpy`

두 파일 모두 Rive 공식 문서와 런타임 예제에서 사용하는 공개 샘플입니다. PocketPal 최종 캐릭터 디자인은 아닙니다.

## 구현 기능

- `@rive-app/webgl2@2.36.0` 고정 버전 로드
- Retina 캔버스 크기 자동 보정
- FPS 표시
- 공식 샘플 전환
- iPhone 파일 앱에서 로컬 `.riv` 선택
- Artboard/State Machine 목록 자동 표시
- Number/Boolean/Trigger 입력 자동 제어 UI
- Soul preset 이름과 유사한 Rive input 자동 매핑
- Rive 상태 변경 로그
- Data Binding 연결 여부 표시

## PocketPal 전용 Rive 파일 계약

최종 `pocketpal.riv`에는 기본 View Model과 State Machine을 두고 아래 속성을 권장합니다.

```text
mood        Number 또는 Enum: calm / curious / happy / sad / sleepy
talking     Boolean
lookX       Number (-1.0 ~ 1.0)
lookY       Number (-1.0 ~ 1.0)
energy      Number (0 ~ 100)
pet         Trigger
wave        Trigger
surprise    Trigger

faceStyle   Enum
eyeStyle    Enum
mouthStyle  Enum
hatStyle    Enum
outfitStyle Enum
badgeStyle  Enum
customHat   Image
customFace  Image
customBody  Image
customBadge Image
```

새 파일은 기존 State Machine Input보다 Rive Data Binding을 우선 사용합니다. 현재 Inspector는 공개 샘플 검증을 위해 기존 Input도 지원합니다.

## 확정 사항

- CSS로 캐릭터 본체를 직접 그리지 않는다.
- 앱 코드는 감정·기억·행동 상태만 전달한다.
- 최종 외형과 애니메이션 품질은 Rive Editor에서 제작한 전용 `.riv` 파일이 담당한다.
- 공개 샘플을 PocketPal 최종 캐릭터라고 표시하지 않는다.
