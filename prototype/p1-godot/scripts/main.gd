extends Control

@onready var character: Node2D = $Character
@onready var speech: Label = $SpeechBubble
@onready var auto_timer: Timer = $AutoTimer

var auto_lines := [
    ["curious", "지금 뭐 보고 있어? 나도 궁금해."],
    ["wave", "여기 있어! 잠깐 나 봐줘."],
    ["happy", "오늘 같이 있어서 좋아."],
    ["sleepy", "조금 졸리지만 네 목소리는 듣고 싶어."]
]

func _ready() -> void:
    var buttons := {
        "calm": $BottomPanel/Margin/VBox/Buttons/Calm,
        "curious": $BottomPanel/Margin/VBox/Buttons/Curious,
        "happy": $BottomPanel/Margin/VBox/Buttons/Happy,
        "talk": $BottomPanel/Margin/VBox/Buttons/Talk,
        "pet": $BottomPanel/Margin/VBox/Buttons/Pet,
        "wave": $BottomPanel/Margin/VBox/Buttons/Wave,
        "jump": $BottomPanel/Margin/VBox/Buttons/Jump,
        "sleepy": $BottomPanel/Margin/VBox/Buttons/Sleepy,
        "face": $BottomPanel/Margin/VBox/Buttons/Face,
        "hat": $BottomPanel/Margin/VBox/Buttons/Hat,
        "outfit": $BottomPanel/Margin/VBox/Buttons/Outfit,
        "badge": $BottomPanel/Margin/VBox/Buttons/Badge
    }
    for action in buttons:
        buttons[action].pressed.connect(_on_action.bind(action))
    character.petted.connect(func(): _say("헤헤, 쓰다듬어 줘서 좋아."))
    auto_timer.timeout.connect(_on_auto_timer)
    auto_timer.wait_time = randf_range(10.0, 16.0)
    auto_timer.start()
    _say("안녕. 나는 아직 하얀 기본 모습이야. 같이 나를 만들어 줘.")

func _on_action(action: String) -> void:
    match action:
        "calm":
            character.set_mood("calm")
            _say("조용히 같이 있을게.")
        "curious":
            character.play_curious()
            _say("그게 뭐야? 나도 보여줘.")
        "happy":
            character.play_happy()
            _say("좋아! 지금 기분이 반짝반짝해.")
        "talk":
            character.set_talking(true)
            _say("말할 때는 입과 고개가 같이 움직여야 자연스러워.")
            get_tree().create_timer(2.2).timeout.connect(func(): character.set_talking(false))
        "pet":
            character.play_pet()
            _say("조금 더 해줘도 돼.")
        "wave":
            character.play_wave()
            _say("안녕! 여기 있어.")
        "jump":
            character.play_jump()
            _say("신난다!")
        "sleepy":
            character.play_sleepy()
            _say("하암… 그래도 아직 안 잘래.")
        "face":
            _say("얼굴 스타일 %d" % character.cycle_face())
        "hat":
            _say("모자 스타일 %d" % character.cycle_hat())
        "outfit":
            _say("옷 스타일 %d" % character.cycle_outfit())
        "badge":
            _say("배지 스타일 %d" % character.cycle_badge())

func _on_auto_timer() -> void:
    var item: Array = auto_lines.pick_random()
    match item[0]:
        "curious": character.play_curious()
        "wave": character.play_wave()
        "happy": character.play_happy()
        "sleepy": character.play_sleepy()
    _say(item[1])
    auto_timer.wait_time = randf_range(12.0, 22.0)
    auto_timer.start()

func _say(text: String) -> void:
    speech.text = text
