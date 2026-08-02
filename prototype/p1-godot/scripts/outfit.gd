extends Node2D

var outfit_style := 0
var badge_style := 0

func set_styles(new_outfit_style: int, new_badge_style: int) -> void:
    outfit_style = new_outfit_style
    badge_style = new_badge_style
    queue_redraw()

func _draw() -> void:
    if outfit_style > 0:
        var color := Color("#87c9bd") if outfit_style == 1 else Color("#ef9db4")
        var shirt := PackedVector2Array([
            Vector2(-70,-85), Vector2(-42,-109), Vector2(42,-109), Vector2(70,-85),
            Vector2(76,72), Vector2(55,102), Vector2(-55,102), Vector2(-76,72)
        ])
        draw_colored_polygon(shirt, color)
        draw_arc(Vector2(0,-104), 25.0, 0.0, PI, 24, color.darkened(0.18), 5.0, true)

    if badge_style == 1:
        _draw_star(Vector2(38,-10), 13.0, 6.0, Color("#f4c657"))
    elif badge_style == 2:
        _draw_heart(Vector2(38,-10), Color("#ea7892"))

func _draw_star(center: Vector2, outer_radius: float, inner_radius: float, color: Color) -> void:
    var points := PackedVector2Array()
    for index in range(10):
        var radius := outer_radius if index % 2 == 0 else inner_radius
        var angle := -PI / 2.0 + TAU * float(index) / 10.0
        points.append(center + Vector2(cos(angle), sin(angle)) * radius)
    draw_colored_polygon(points, color)

func _draw_heart(center: Vector2, color: Color) -> void:
    draw_circle(center + Vector2(-5,-3), 7.0, color)
    draw_circle(center + Vector2(5,-3), 7.0, color)
    var point := PackedVector2Array([center + Vector2(-12,0), center + Vector2(12,0), center + Vector2(0,15)])
    draw_colored_polygon(point, color)
