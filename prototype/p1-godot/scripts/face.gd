extends Node2D

var look := Vector2.ZERO
var blink_amount := 0.0
var talking := false
var mood := "calm"
var face_style := 0
var hat_style := 0
var mouth_phase := 0.0
var blink_tween: Tween

func _process(delta: float) -> void:
    if talking:
        mouth_phase += delta * 13.0
    queue_redraw()

func set_look(value: Vector2) -> void:
    look = Vector2(clampf(value.x, -1.0, 1.0), clampf(value.y, -1.0, 1.0))

func set_talking(value: bool) -> void:
    talking = value

func set_mood(value: String) -> void:
    mood = value
    queue_redraw()

func set_styles(new_face_style: int, new_hat_style: int) -> void:
    face_style = new_face_style
    hat_style = new_hat_style
    queue_redraw()

func blink() -> void:
    if blink_tween and blink_tween.is_valid():
        blink_tween.kill()
    blink_tween = create_tween()
    blink_tween.tween_method(_set_blink, 0.0, 1.0, 0.08)
    blink_tween.tween_interval(0.045)
    blink_tween.tween_method(_set_blink, 1.0, 0.0, 0.11)

func _set_blink(value: float) -> void:
    blink_amount = value
    queue_redraw()

func _ellipse(center: Vector2, radius: Vector2, count: int = 28) -> PackedVector2Array:
    var points := PackedVector2Array()
    for index in range(count):
        var angle := TAU * float(index) / float(count)
        points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
    return points

func _draw() -> void:
    var ink := Color("#303634")
    var eye_y := -6.0
    var eye_radius := Vector2(5.3, 7.0)
    if face_style == 1:
        eye_radius = Vector2(7.2, 8.6)
    elif face_style == 2:
        eye_radius = Vector2(6.5, 3.2)
        eye_y += 2.0

    var eye_height := maxf(0.7, eye_radius.y * (1.0 - blink_amount))
    var pupil_offset := Vector2(look.x * 2.8, look.y * 1.8)
    for x in [-27.0, 27.0]:
        var center := Vector2(x, eye_y)
        draw_colored_polygon(_ellipse(center, Vector2(eye_radius.x, eye_height)), ink)
        if blink_amount < 0.72 and face_style != 2:
            draw_circle(center + pupil_offset + Vector2(-1.0, -1.0), 1.45, Color.WHITE)

    if mood == "happy":
        draw_arc(Vector2(0, 22), 10.0, 0.18, PI - 0.18, 24, ink, 3.0, true)
    elif mood == "sleepy":
        draw_line(Vector2(-5, 24), Vector2(5, 24), ink, 2.5, true)
    elif talking:
        var opening := 5.0 + ((sin(mouth_phase) + 1.0) * 0.5) * 7.0
        draw_colored_polygon(_ellipse(Vector2(0, 24), Vector2(8.0, opening)), ink)
        draw_colored_polygon(_ellipse(Vector2(0, 28), Vector2(4.4, opening * 0.32)), Color("#d7767e"))
    else:
        draw_arc(Vector2(0, 17), 9.0, 0.35, PI - 0.35, 20, ink, 2.6, true)

    if mood == "happy" or mood == "curious":
        draw_colored_polygon(_ellipse(Vector2(-47, 15), Vector2(9, 4.5)), Color(1.0, 0.55, 0.62, 0.34))
        draw_colored_polygon(_ellipse(Vector2(47, 15), Vector2(9, 4.5)), Color(1.0, 0.55, 0.62, 0.34))

    if hat_style == 1:
        var beanie := PackedVector2Array([Vector2(-55,-61),Vector2(-43,-87),Vector2(-15,-101),Vector2(16,-101),Vector2(44,-87),Vector2(56,-61)])
        draw_colored_polygon(beanie, Color("#77b9ad"))
        draw_rect(Rect2(-58,-66,116,14), Color("#5c9f95"), true)
    elif hat_style == 2:
        var crown := PackedVector2Array([Vector2(-50,-61),Vector2(-39,-94),Vector2(-14,-73),Vector2(0,-103),Vector2(15,-73),Vector2(40,-94),Vector2(50,-61)])
        draw_colored_polygon(crown, Color("#f4c657"))
        draw_rect(Rect2(-50,-64,100,12), Color("#dcae3f"), true)
