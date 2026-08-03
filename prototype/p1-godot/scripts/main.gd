extends Control

@onready var character = $Character
@onready var auto_timer: Timer = $AutoTimer

var web_action_callback
var auto_lines := [
    ["curious", "지금 뭐 보고 있어? 나도 궁금해."],
    ["wave", "여기 있어! 잠깐 나 봐줘."],
    ["happy", "오늘 같이 있어서 좋아."],
    ["sleepy", "조금 졸리지만 네 목소리는 듣고 싶어."]
]

func _ready() -> void:
    character.petted.connect(func(): _say("헤헤, 쓰다듬어 줘서 좋아."))
    auto_timer.timeout.connect(_on_auto_timer)
    auto_timer.wait_time = randf_range(10.0, 16.0)
    auto_timer.start()
    _register_web_bridge()
    _say("안녕. 나는 아직 아무것도 꾸미지 않은 하얀 모습이야.")

func _register_web_bridge() -> void:
    if not OS.has_feature("web"):
        return
    web_action_callback = JavaScriptBridge.create_callback(_on_web_action)
    var window = JavaScriptBridge.get_interface("window")
    if window:
        window.__pocketpalReceiveAction = web_action_callback
    JavaScriptBridge.eval("window.pocketpalBridgeReady && window.pocketpalBridgeReady();")

func _on_web_action(arguments: Array) -> void:
    if arguments.is_empty():
        return
    _on_action(str(arguments[0]))

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
    if OS.has_feature("web"):
        JavaScriptBridge.eval("window.pocketpalSetSpeech && window.pocketpalSetSpeech(%s);" % JSON.stringify(text))
    else:
        print(text)
