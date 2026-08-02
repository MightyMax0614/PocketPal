# PocketPal Rive Character Specification v0.1

- 상태: 확정 초안
- 대상: 하얀 중성 기본 캐릭터 1종
- 목표: 아이폰 Safari, 향후 iOS/Android/전용 기기에서 동일한 `.riv` 사용

## 1. 제품 원칙

PocketPal의 본체는 단순한 하얀 사람형 바디로 유지한다. 아이가 얼굴, 모자, 옷, 배지, 가방, 손 소품을 더해 자기 캐릭터로 만든다. 캐릭터의 정체성은 꾸미기뿐 아니라 기억, 말투, 감정, 자발 행동을 통해 형성한다.

## 2. Artboard와 State Machine

- Artboard: `PocketPal`
- State Machine: `PocketPalState`
- 최초 시제품 제어: State Machine Inputs
- 최종 제품 제어: Rive Data Binding으로 이전

## 3. 필수 입력 계약

| 이름 | 타입 | 의미 |
|---|---|---|
| mood | Number | 0 calm, 1 curious, 2 happy, 3 sad, 4 sleepy |
| energy | Number | 0~100 |
| look_x | Number | -100~100 |
| look_y | Number | -100~100 |
| talking | Boolean | 말하는 동안 true |
| sleepy | Boolean | 졸림 유지 상태 |
| pet | Trigger | 쓰다듬기 반응 |
| wave | Trigger | 손 흔들기 |
| jump | Trigger | 기쁨 점프 |
| notice | Trigger | 무언가 발견함 |
| face_style | Number | 얼굴 조합 번호 |
| hat_style | Number | 모자 조합 번호 |
| outfit_style | Number | 옷 조합 번호 |
| badge_style | Number | 배지 조합 번호 |

## 4. 필수 애니메이션

- `idle_breathe`: 기본 호흡과 미세 체중 이동
- `blink`: 불규칙 눈 깜빡임
- `look`: 눈과 고개의 시선 이동
- `talk_loop`: 입, 볼, 고개가 함께 움직이는 말하기
- `pet_reaction`: 눈을 감고 손이 닿은 방향으로 몸 기울이기
- `wave`: 손 흔들기
- `jump`: 짧은 기쁨 점프
- `curious`: 고개 기울이기와 몸 앞으로 숙이기
- `happy`: 밝은 표정과 몸 전체 반응
- `sleepy`: 느린 호흡, 고개 떨굼, 하품

## 5. 레이어와 부착점

기본 SVG 레이어 이름을 유지한다.

- `rig_root`
- `shadow_layer`
- `body_back`
- `body_front`
- `face_anchor`
- `face_default`
- `attachment_slots`

부착점:

- `slot_head`
- `slot_face`
- `slot_body_front`
- `slot_badge`
- `slot_back`
- `slot_hand_left`
- `slot_hand_right`

## 6. 리깅 기준

- 머리는 몸통과 독립된 transform 공간을 사용한다.
- 팔과 다리는 각각 회전축을 몸 안쪽에 둔다.
- 몸통은 메시 변형으로 호흡과 좌우 체중 이동을 만든다.
- 눈, 눈꺼풀, 눈동자, 입은 독립 요소로 분리한다.
- 꾸미기 파츠는 본체 메시를 훼손하지 않고 부착점 transform을 따라간다.
- 기본 idle은 4~7초 주기의 큰 동작과 1.8~2.8초 호흡을 겹친다.
- 모든 루프는 연결점에서 튀지 않아야 한다.

## 7. 품질 기준

- 작은 480×640 화면에서도 실루엣과 표정이 읽혀야 한다.
- 60fps 목표, 낮은 성능에서는 30fps 이상 유지한다.
- 팔과 몸, 다리와 몸 사이가 움직일 때 벌어지거나 뚫리지 않아야 한다.
- 표정 변경이 스티커 교체처럼 보이지 않고 머리와 몸 동작을 동반해야 한다.
- CSS 도형 애니메이션은 최종 제품에 사용하지 않는다.

## 8. 제작 순서

1. `pocketpal-base-body.svg`를 Rive Editor로 가져오기
2. 레이어 이름 정리
3. 뼈대와 메시 리깅
4. idle, blink, look, talk 제작
5. pet, wave, jump, curious, happy, sleepy 제작
6. `PocketPalState` 생성
7. 입력 계약 생성
8. `pocketpal.riv` 내보내기
9. `prototype/assets/rive/pocketpal.riv`에 배치
10. P1.7 Character Studio에서 14/14 계약 검사

## 9. 현재 한계

`pocketpal.riv` 바이너리는 Rive Editor에서 실제 리깅과 애니메이션을 한 뒤 내보내야 한다. 저장소에는 현재 벡터 원본, 입력 계약, 자동 검사 및 웹 연동 코드까지 준비되어 있다.
