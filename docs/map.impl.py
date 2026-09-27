# Opcode combat map: base.objects = full SVG string; runtime.actors = placements (meters after compile).

map = {
    "name": "map_name",
    "base": {
        "objects": "",  # SAMPLE_SVG below
        "meters_per_unit": None,  # default: viewBox width → 100m
    },
    "runtime": {"actors": {}},
}

# SVG element attributes
#   type="bounding_box" — valid AI solve / stance sampling region (not a combat barrier)
#   type="barrier" | "concealment"
#   ar, ssp, name
#   cover-height — logical mask height fraction (NOT the rect pixel height):
#       1     → full body (全身)
#       0.75  → two-thirds concealment (2/3 遮蔽)
#       0.5   → half body (半身)
#       0.2   → leg cover (腿部)
#   On <path>, cover-height may alias as height="..." when there is no layout height.

SAMPLE_SVG = """
<svg width="1044" height="645" viewBox="0 0 1044 645" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="0.5" y="0.5" width="1043" height="644" stroke="black" type="bounding_box"/>
<rect x="116" y="119" width="153" height="21" type="barrier" ar="15" ssp="123" name="wall-0" cover-height="1"/>
<rect x="720" y="537" width="153" height="21" type="barrier" ar="15" ssp="123" name="wall-1" cover-height="1"/>
<rect x="862" y="439" width="153" height="21" transform="rotate(-90 862 439)" type="barrier" ar="15" ssp="123" name="wall-2" cover-height="1"/>
<rect x="522" y="460" width="85" height="88" transform="rotate(-90 522 460)" type="barrier" ar="15" ssp="123" name="wall-3" cover-height="0.5"/>
<rect x="676" y="172" width="85" height="88" transform="rotate(-90 676 172)" type="concealment" name="test-conc" cover-height="0.75"/>
<path d="M250 547L250 394L353.5 247L368 255.5L271 394L271 547L250 547Z" type="barrier" ar="15" ssp="123" name="wall-4" cover-height="0.2"/>
</svg>
"""
