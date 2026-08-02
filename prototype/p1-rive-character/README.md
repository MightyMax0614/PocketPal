# PocketPal P1.7 Character Studio

Rive가 아이폰 Safari에서 실행되는 것을 확인한 뒤 만든 전용 캐릭터 연동 단계다.

## 현재 기능

- 저장소의 `pocketpal.riv` 자동 탐색
- 파일이 없으면 공식 Rive 샘플로 자동 대체
- 아이폰 파일 앱에서 `.riv` 직접 선택
- `PocketPalState` 입력 14개 자동 검사
- 소울 행동 명령 시험
- 얼굴, 모자, 옷, 배지 값 시험
- Rive 가져오기용 하얀 기본 바디 SVG 제공

## 전용 파일 위치

```text
prototype/assets/rive/pocketpal.riv
```

전용 파일은 다음 이름을 사용해야 한다.

```text
Artboard: PocketPal
State Machine: PocketPalState
```

자세한 계약은 `docs/RIVE_CHARACTER_SPEC_V0_1.md`와 `prototype/assets/rive/pocketpal-rig-contract.json`을 참고한다.
