extends Node2D

signal petted

@onready var head_pivot: Node2D = $HeadPivot
@onready var face: Node2D = $HeadPivot/Face
@onready var torso_pivot: Node2D = $TorsoPivot
@onready var outfit: Node2D = $TorsoPivot/Outfit
@onready var arm_left: Node2D = $ArmLeftPivot
@onready var arm_right: Node2D = $ArmRightPivot
@onready var leg_left: Node2D = $LegLeftPivot
@onready var leg_right: Node2D = $LegRightPivot

var elapsed := 0.0
var next_blink_at := 2.4
var home_position := Vector2.ZERO
var home_scale := Vector2.ONE
var busy := false
var talking := false
var mood := "calm"
var action_tween: Tween
var face_style := 0
var hat_style := 0
var outfit_style := 0
var badge_style := 0

func _ready() -> void:
    randomize()
    home_position = position
    home_scale = scale
    next_blink_at = randf_range(1.8, 3.4)

func _process(delta: float) -> void:
    elapsed += delta
    var pointer := get_viewport().get_mouse_position()
    var viewport_size := get_viewport_rect().size
    var normalized := Vector2(
        clampf((pointer.x - viewport_size.x * 0.5) / maxf(viewport_size.x * 0.5, 1.0), -1.0, 1.0),
        clampf((pointer.y - viewport_size.y * 0.38) / maxf(viewport_size.y * 0.5, 1.0), -1.0, 1.0)
    )
    face.set_look(normalized)
    face.set_talking(talking)

    if not busy:
        var breath := sin(elapsed * TAU / 2.55)
        torso_pivot.scale = Vector2(1.0 - breath * 0.003, 1.0 + breath * 0.012)
        torso_pivot.rotation = sin(elapsed * 0.53) * 0.006
        head_pivot.position = Vector2(0, 80.0 - breath * 1.35)
        head_pivot.rotation = sin(elapsed * 0.46) * 0.012
        arm_left.rotation = deg_to_rad(3.0 + breath * 0.8)
        arm_right.rotation = deg_to_rad(-3.0 - breath * 0.8)
        leg_left.rotation = sin(elapsed * 0.42) * 0.004
        leg_right.rotation = -sin(elapsed * 0.42) * 0.004

    if elapsed >= next_blink_at:
        face.blink()
        next_blink_at = elapsed + randf_range(2.5, 5.6)

func _input(event: InputEvent) -> void:
    var screen_position: Variant = null
    if event is InputEventScreenTouch and event.pressed:
        screen_position = event.position
    elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
        screen_position = event.position
    if screen_position != null:
        var local := to_local(screen_position)
        if Rect2(-135, 0, 270, 520).has_point(local):
            play_pet()
            petted.emit()

func set_mood(value: String) -> void:
    mood = value
    face.set_mood(value)

func set_talking(value: bool) -> void:
    talking = value

func cycle_face() -> int:
    face_style = (face_style + 1) % 3
    _apply_styles()
    return face_style

func cycle_hat() -> int:
    hat_style = (hat_style + 1) % 3
    _apply_styles()
    return hat_style

func cycle_outfit() -> int:
    outfit_style = (outfit_style + 1) % 3
    _apply_styles()
    return outfit_style

func cycle_badge() -> int:
    badge_style = (badge_style + 1) % 3
    _apply_styles()
    return badge_style

func _apply_styles() -> void:
    face.set_styles(face_style, hat_style)
    outfit.set_styles(outfit_style, badge_style)

func _fresh_tween() -> Tween:
    if action_tween and action_tween.is_valid():
        action_tween.kill()
    action_tween = create_tween()
    action_tween.set_trans(Tween.TRANS_SINE)
    action_tween.set_ease(Tween.EASE_IN_OUT)
    return action_tween

func _finish_action() -> void:
    busy = false
    position = home_position
    scale = home_scale
    torso_pivot.rotation = 0.0
    torso_pivot.scale = Vector2.ONE
    head_pivot.rotation = 0.0
    head_pivot.position = Vector2(0, 80)
    arm_left.rotation = deg_to_rad(3.0)
    arm_right.rotation = deg_to_rad(-3.0)
    leg_left.rotation = 0.0
    leg_right.rotation = 0.0

func play_wave() -> void:
    if busy: return
    busy = true
    var tween := _fresh_tween()
    tween.tween_property(arm_right, "rotation", deg_to_rad(-67), 0.18)
    tween.tween_property(arm_right, "rotation", deg_to_rad(-35), 0.12)
    tween.tween_property(arm_right, "rotation", deg_to_rad(-67), 0.12)
    tween.tween_property(arm_right, "rotation", deg_to_rad(-35), 0.12)
    tween.tween_property(arm_right, "rotation", deg_to_rad(-3), 0.18)
    tween.tween_callback(_finish_action)

func play_jump() -> void:
    if busy: return
    busy = true
    set_mood("happy")
    var tween := _fresh_tween()
    tween.set_ease(Tween.EASE_OUT)
    tween.parallel().tween_property(self, "position", home_position + Vector2(0, -42), 0.18)
    tween.parallel().tween_property(self, "scale", home_scale * Vector2(0.96, 1.04), 0.18)
    tween.set_ease(Tween.EASE_IN)
    tween.parallel().tween_property(self, "position", home_position, 0.22)
    tween.parallel().tween_property(self, "scale", home_scale * Vector2(1.04, 0.96), 0.22)
    tween.tween_property(self, "scale", home_scale, 0.12)
    tween.tween_callback(_finish_action)

func play_pet() -> void:
    if busy: return
    busy = true
    set_mood("happy")
    face.blink()
    var tween := _fresh_tween()
    tween.parallel().tween_property(head_pivot, "rotation", deg_to_rad(10), 0.22)
    tween.parallel().tween_property(torso_pivot, "rotation", deg_to_rad(4), 0.22)
    tween.tween_interval(0.42)
    tween.parallel().tween_property(head_pivot, "rotation", 0.0, 0.28)
    tween.parallel().tween_property(torso_pivot, "rotation", 0.0, 0.28)
    tween.tween_callback(_finish_action)

func play_curious() -> void:
    if busy: return
    busy = true
    set_mood("curious")
    var tween := _fresh_tween()
    tween.parallel().tween_property(head_pivot, "rotation", deg_to_rad(-9), 0.24)
    tween.parallel().tween_property(head_pivot, "position", Vector2(-3, 74), 0.24)
    tween.parallel().tween_property(torso_pivot, "rotation", deg_to_rad(-2), 0.24)
    tween.tween_interval(0.55)
    tween.parallel().tween_property(head_pivot, "rotation", 0.0, 0.25)
    tween.parallel().tween_property(head_pivot, "position", Vector2(0, 80), 0.25)
    tween.parallel().tween_property(torso_pivot, "rotation", 0.0, 0.25)
    tween.tween_callback(_finish_action)

func play_happy() -> void:
    if busy: return
    busy = true
    set_mood("happy")
    var tween := _fresh_tween()
    tween.parallel().tween_property(arm_left, "rotation", deg_to_rad(29), 0.18)
    tween.parallel().tween_property(arm_right, "rotation", deg_to_rad(-29), 0.18)
    tween.parallel().tween_property(torso_pivot, "scale", Vector2(1.04, 0.97), 0.18)
    tween.tween_property(torso_pivot, "scale", Vector2(0.98, 1.03), 0.16)
    tween.tween_property(torso_pivot, "scale", Vector2.ONE, 0.18)
    tween.parallel().tween_property(arm_left, "rotation", deg_to_rad(3), 0.20)
    tween.parallel().tween_property(arm_right, "rotation", deg_to_rad(-3), 0.20)
    tween.tween_callback(_finish_action)

func play_sleepy() -> void:
    if busy: return
    busy = true
    set_mood("sleepy")
    var tween := _fresh_tween()
    tween.parallel().tween_property(head_pivot, "rotation", deg_to_rad(13), 0.65)
    tween.parallel().tween_property(head_pivot, "position", Vector2(4, 90), 0.65)
    tween.parallel().tween_property(torso_pivot, "rotation", deg_to_rad(3), 0.65)
    tween.tween_interval(0.7)
    tween.parallel().tween_property(head_pivot, "rotation", 0.0, 0.45)
    tween.parallel().tween_property(head_pivot, "position", Vector2(0, 80), 0.45)
    tween.parallel().tween_property(torso_pivot, "rotation", 0.0, 0.45)
    tween.tween_callback(_finish_action)
