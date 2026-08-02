# PocketPal Godot Character Specification v0.1

## 확정

- 엔진: Godot 4.7.1 Standard
- 비용: 라이선스 비용 및 런타임 로열티 0원
- 화면 기준: 480×640 세로형
- 본체: 흰색 중성 사람형 기본 바디
- 사용자 개성: 얼굴, 모자, 옷, 배지, 가방, 손 소품
- Soul: 기억·감정·상황이 애니메이션 명령을 호출

## 초기 동작 계약

- `set_mood(value)`
- `set_talking(value)`
- `play_pet()`
- `play_wave()`
- `play_jump()`
- `play_curious()`
- `play_happy()`
- `play_sleepy()`

## 다음 리그 단계

1. 현재 회전형 파츠로 동작 속도와 캐릭터 비율 검증
2. 승인 후 Skeleton2D와 Bone2D 배치
3. Polygon2D 메시와 뼈 가중치 적용
4. 팔/몸, 다리/몸 경계 메시 변형
5. AnimationPlayer와 AnimationTree로 모션 블렌딩
6. Soul Engine 상태와 AnimationTree parameter 연결
