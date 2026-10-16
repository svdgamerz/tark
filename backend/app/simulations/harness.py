# -*- coding: utf-8 -*-
"""Master Virtual Lab Simulation Harness for Tark.

Provides medical/university laboratory-grade styling (PhET/Labster/BioRender caliber):
- Ultra-sharp Retina/4K canvas auto-scaling
- Modern Obsidian Glassmorphism theme (#070d18)
- Dual-panel layout: Main Apparatus Viewport (62% width) + Dynamic Analytical Graph (38% width)
- Pure Web Audio API micro-synthesizer (zero external audio files)
- Rich volumetric apparatus rendering helpers (glassware with meniscus, pistons, gauges, waves, vectors)
- Dynamic telemetry chips updating live with SI units
- Interactive hover/click raycaster inspector
- Textbook scenario presets bar
"""

import json
from typing import Any


def build_harness_html(spec: dict[str, Any]) -> str:
    title = spec.get("title", "Interactive Virtual Lab")
    subject = spec.get("subject", "Physics")
    formula = spec.get("formula", "")
    params = spec.get("params", [])
    presets = spec.get("presets", [])
    readouts = spec.get("readouts", [])
    components = spec.get("components", [])
    graph_spec = spec.get("graph", {})
    draw_apparatus_code = spec.get("draw_apparatus_code", "")

    # Build sliders HTML
    sliders_html = ""
    for p in params:
        key = p["key"]
        val = p.get("default", p.get("defaultValue", (p["min"] + p["max"]) / 2))
        unit = p.get("unit", "")
        step = p.get("step", 1)
        sliders_html += f"""
        <div class="slider-cell" id="cell_{key}">
          <div class="slider-header">
            <div class="slider-label-group">
              <span class="slider-dot"></span>
              <span class="slider-label">{p['label']}</span>
            </div>
            <div class="slider-value-pill" id="val_{key}">
              <span class="val-num">{val}</span><span class="val-unit"> {unit}</span>
            </div>
          </div>
          <div class="slider-control-row">
            <button type="button" class="nudge-btn nudge-btn-minus" data-key="{key}" data-step="-{step}" title="Nudge lower">−</button>
            <input type="range" class="range-slider" id="slider_{key}" data-unit="{unit}"
                   min="{p['min']}" max="{p['max']}" step="{step}" value="{val}">
            <button type="button" class="nudge-btn nudge-btn-plus" data-key="{key}" data-step="{step}" title="Nudge higher">+</button>
          </div>
          <div class="slider-bounds-row">
            <span class="bound-tag bound-min">MIN: {p['min']} {unit}</span>
            <span class="bound-tag bound-step">Δ {step}</span>
            <span class="bound-tag bound-max">MAX: {p['max']} {unit}</span>
          </div>
        </div>"""

    # Build presets HTML
    presets_html = ""
    for idx, pr in enumerate(presets):
        active_cls = " active" if idx == 0 else ""
        presets_html += f"""<button class="preset-pill{active_cls}" data-idx="{idx}">{pr['label']}</button>"""

    # Build telemetry chips HTML
    chips_html = ""
    for idx, r in enumerate(readouts):
        chips_html += f"""
        <div class="telemetry-chip" id="chip_{idx}">
          <span class="telemetry-label">{r['label']}:</span>
          <span class="telemetry-val" id="chip_val_{idx}">--</span>
        </div>"""

    # Build JS Objects
    readouts_js_parts = []
    for r in readouts:
        label = r.get("label", "")
        unit = r.get("unit", "")
        calc_code = r.get("calc_js", "0")
        readouts_js_parts.append(
            f"{{ label: {json.dumps(label)}, unit: {json.dumps(unit)}, calc: (p, state) => {{ try {{ return ({calc_code}); }} catch(e) {{ return '--'; }} }} }}"
        )
    readouts_js = "[\n    " + ",\n    ".join(readouts_js_parts) + "\n  ]"

    comp_js_parts = []
    for c in components:
        name = c.get("name", "")
        role = c.get("role", "")
        f_str = c.get("formula", "")
        bounds_code = c.get("bounds_js", "{x: 0, y: 0, w: 0, h: 0}")
        comp_js_parts.append(
            f"{{ name: {json.dumps(name)}, role: {json.dumps(role)}, formula: {json.dumps(f_str)}, getBounds: (appW, appH, p) => {{ try {{ return ({bounds_code}); }} catch(e) {{ return null; }} }} }}"
        )
    components_js = "[\n    " + ",\n    ".join(comp_js_parts) + "\n  ]"

    g_title = graph_spec.get("title", "Dynamic Response Curve")
    g_form = graph_spec.get("formula", "")
    g_xl = graph_spec.get("xLabel", "Input")
    g_yl = graph_spec.get("yLabel", "Output")
    g_xmin = graph_spec.get("xMin", 0)
    g_xmax = graph_spec.get("xMax", 100)
    g_ymin = graph_spec.get("yMin", 0)
    g_ymax = graph_spec.get("yMax", 100)
    g_fn = graph_spec.get("fn_js", "x")
    g_curx = graph_spec.get("getCurrentX_js", f"{g_xmin} + ({g_xmax} - {g_xmin}) * 0.5")

    graph_js = f"""{{
    title: {json.dumps(g_title)},
    formula: {json.dumps(g_form)},
    xLabel: {json.dumps(g_xl)},
    yLabel: {json.dumps(g_yl)},
    xMin: {g_xmin}, xMax: {g_xmax},
    yMin: {g_ymin}, yMax: {g_ymax},
    fn: (x, p, state) => {{ try {{ return ({g_fn}); }} catch(e) {{ return 0; }} }},
    getCurrentX: (p, state) => {{ try {{ return ({g_curx}); }} catch(e) {{ return {g_xmin}; }} }}
  }}"""

    presets_js = json.dumps(presets)

    # Build missions list (from spec or synthesized progressive discovery quests)
    missions = spec.get("missions", [])
    if not missions and params:
        p0 = params[0]
        p0_min = p0["min"]
        p0_max = p0["max"]
        p0_mid = round((p0_min + p0_max) / 2, 2)
        p0_key = p0["key"]
        p0_unit = p0.get("unit", "")
        p0_label = p0.get("label", p0_key)
        tol = max(1.0, round((p0_max - p0_min) * 0.08, 2))

        m1 = {
            "id": 1,
            "title": f"Calibration: {p0_label}",
            "task": f"Adjust {p0_label} to {p0_mid} {p0_unit} (±{tol}) to reach baseline equilibrium.",
            "hint": f"Move the {p0_label} slider to near {p0_mid}.",
            "condition_js": f"Math.abs(p['{p0_key}'] - {p0_mid}) <= {tol}",
            "xp": 50,
        }

        if len(params) > 1:
            p1 = params[1]
            p1_key = p1["key"]
            p1_target = round(p1["min"] + (p1["max"] - p1["min"]) * 0.75, 2)
            p1_unit = p1.get("unit", "")
            p1_label = p1.get("label", p1_key)
            m2 = {
                "id": 2,
                "title": f"Dynamics: {p1_label} Target",
                "task": f"Elevate {p1_label} to at least {p1_target} {p1_unit} to inspect dynamic trajectory.",
                "hint": f"Drag {p1_label} to {p1_target} or above.",
                "condition_js": f"p['{p1_key}'] >= {p1_target} - 0.2",
                "xp": 75,
            }
        else:
            p0_high = round(p0_min + (p0_max - p0_min) * 0.85, 2)
            m2 = {
                "id": 2,
                "title": "Threshold Exploration",
                "task": f"Push {p0_label} to {p0_high} {p0_unit} or higher.",
                "hint": f"Increase {p0_label} above {p0_high}.",
                "condition_js": f"p['{p0_key}'] >= {p0_high} - 0.2",
                "xp": 75,
            }

        m3 = {
            "id": 3,
            "title": "Steady-State Convergence",
            "task": "Keep the apparatus playing for at least 4 seconds to observe convergence on the analytical graph.",
            "hint": "Ensure ▶ Play is active and let the simulation run.",
            "condition_js": "state.time >= 4.0 && state.isPlaying",
            "xp": 100,
        }
        missions = [m1, m2, m3]

    missions_js_parts = []
    for idx, m in enumerate(missions):
        c_code = m.get("condition_js", "false")
        missions_js_parts.append(
            f"{{ id: {json.dumps(m.get('id', idx+1))}, title: {json.dumps(m.get('title', f'Mission {idx+1}'))}, task: {json.dumps(m.get('task', ''))}, hint: {json.dumps(m.get('hint', ''))}, xp: {m.get('xp', 50)}, check: (p, state) => {{ try {{ return Boolean({c_code}); }} catch(e) {{ return false; }} }} }}"
        )
    missions_js = "[\n    " + ",\n    ".join(missions_js_parts) + "\n  ]"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🧪 {title} – Tark Virtual Lab</title>
<style>
:root {{
  --bg: #070d18;
  --panel: rgba(11, 19, 41, 0.92);
  --panel-border: rgba(56, 189, 248, 0.22);
  --accent: #38bdf8;
  --text: #e0eaff;
  --text-muted: #94a3b8;
}}
* {{ box-sizing: border-box; }}
html, body {{
  margin: 0; padding: 0; width: 100%; height: 100%;
  overflow: hidden; background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text); user-select: none;
}}
#app {{ display: flex; flex-direction: column; width: 100%; height: 100%; position: relative; }}

/* Top Scientific Telemetry Bar */
#topBar {{
  height: 54px; background: rgba(11, 19, 41, 0.98); backdrop-filter: blur(16px);
  border-bottom: 1.5px solid rgba(56, 189, 248, 0.35);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; z-index: 20; flex-shrink: 0;
}}
.header-left {{ display: flex; align-items: center; gap: 12px; }}
.lab-icon {{ font-size: 1.35rem; }}
.lab-title {{ font-size: 1.05rem; font-weight: 800; color: #f8fafc; letter-spacing: -0.01em; }}
.lab-badge {{
  background: rgba(56, 189, 248, 0.16); border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8; font-size: 0.76rem; font-weight: 700; padding: 3px 10px; border-radius: 999px;
  letter-spacing: 0.4px;
}}
.header-center {{ display: flex; align-items: center; gap: 10px; overflow-x: auto; scrollbar-width: none; }}
.telemetry-chip {{
  background: rgba(15, 23, 42, 0.95); border: 1.5px solid rgba(56, 189, 248, 0.45);
  border-radius: 8px; padding: 6px 14px; font-size: 0.92rem; font-family: ui-monospace, SFMono-Regular, monospace;
  color: #a5f3fc; display: flex; align-items: center; gap: 8px; white-space: nowrap;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.15);
}}
.telemetry-label {{ color: #94a3b8; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, sans-serif; }}
.telemetry-val {{ font-weight: 800; color: #38bdf8; font-size: 1.15rem; text-shadow: 0 0 8px rgba(56, 189, 248, 0.5); }}
.header-right {{ display: flex; align-items: center; gap: 8px; }}
.icon-btn {{
  background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18);
  color: #cbd5e1; border-radius: 8px; width: 34px; height: 34px; display: flex;
  align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; font-size: 1rem;
}}
.icon-btn:hover {{ background: rgba(56, 189, 248, 0.25); border-color: rgba(56, 189, 248, 0.55); color: #fff; }}

/* Canvas Viewport */
#canvasWrap {{ flex: 1; position: relative; width: 100%; overflow: hidden; background: #070d18; }}
#simCanvas {{ width: 100%; height: 100%; display: block; }}

/* Floating Inspector Card */
#inspectorCard {{
  position: absolute; pointer-events: none; z-index: 30; display: none;
  background: rgba(11, 19, 41, 0.96); backdrop-filter: blur(16px);
  border: 1.5px solid rgba(56, 189, 248, 0.55); border-radius: 10px;
  padding: 10px 14px; max-width: 290px; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.8);
  animation: fadeIn 0.12s ease-out;
}}
#inspectorCard h4 {{ margin: 0 0 4px 0; font-size: 0.95rem; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 6px; }}
#inspectorCard p {{ margin: 0 0 6px 0; font-size: 0.8rem; color: #e2e8f0; line-height: 1.4; }}
#inspectorCard .formula-tag {{
  display: inline-block; background: rgba(56, 189, 248, 0.18); border: 1px solid rgba(56, 189, 248, 0.45);
  color: #a5f3fc; font-family: ui-monospace, monospace; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 5px;
}}

/* Bottom Control Dock */
#dock {{
  background: rgba(11, 19, 41, 0.98); backdrop-filter: blur(18px);
  border-top: 1.5px solid rgba(56, 189, 248, 0.35);
  padding: 10px 20px 14px 20px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0; z-index: 20;
}}
.dock-top-row {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
.presets-group {{ display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; }}
.presets-title {{ font-size: 0.8rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; margin-right: 4px; white-space: nowrap; letter-spacing: 0.05em; }}
.preset-pill {{
  background: rgba(255, 255, 255, 0.08); border: 1.5px solid rgba(255, 255, 255, 0.18);
  color: #e2e8f0; padding: 5px 12px; border-radius: 16px; font-size: 0.82rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: all 0.15s;
}}
.preset-pill:hover, .preset-pill.active {{
  background: rgba(56, 189, 248, 0.25); border-color: rgba(56, 189, 248, 0.65); color: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);
}}
.playback-controls {{ display: flex; align-items: center; gap: 8px; }}
.play-btn {{
  background: linear-gradient(135deg, #0284c7, #2563eb); border: none; color: #fff;
  padding: 6px 16px; border-radius: 8px; font-size: 0.86rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
  transition: all 0.15s;
}}
.play-btn:hover {{ transform: translateY(-1px); box-shadow: 0 6px 18px rgba(2, 132, 199, 0.5); }}
.reset-btn {{
  background: rgba(255, 255, 255, 0.08); border: 1.5px solid rgba(255, 255, 255, 0.18);
  color: #cbd5e1; padding: 6px 14px; border-radius: 8px; font-size: 0.86rem; font-weight: 600; cursor: pointer;
  transition: all 0.15s;
}}
.reset-btn:hover {{ background: rgba(255, 255, 255, 0.15); color: #fff; }}

.dock-sliders-row {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}}
.slider-cell {{
  background: rgba(15, 23, 42, 0.92); border: 1.5px solid rgba(56, 189, 248, 0.35);
  border-radius: 10px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5); transition: border-color 0.2s, box-shadow 0.2s;
}}
.slider-cell:hover, .slider-cell:focus-within {{
  border-color: rgba(56, 189, 248, 0.7);
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.25);
}}
.slider-header {{
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}}
.slider-label-group {{
  display: flex; align-items: center; gap: 8px;
}}
.slider-dot {{
  width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; box-shadow: 0 0 8px #38bdf8; flex-shrink: 0;
}}
.slider-label {{
  color: #f8fafc; font-weight: 700; font-size: 0.92rem; letter-spacing: 0.02em;
}}
.slider-value-pill {{
  color: #38bdf8; background: rgba(56, 189, 248, 0.18); border: 1.5px solid rgba(56, 189, 248, 0.6);
  padding: 3px 10px; border-radius: 7px; box-shadow: 0 0 14px rgba(56, 189, 248, 0.25);
  display: inline-flex; align-items: baseline; gap: 4px;
}}
.val-num {{
  font-size: 1.25rem; font-weight: 800; font-family: ui-monospace, Menlo, Consolas, monospace;
  text-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}}
.val-unit {{
  font-size: 0.85rem; font-weight: 700; color: #94a3b8; font-family: -apple-system, sans-serif;
}}
.slider-control-row {{
  display: flex; align-items: center; gap: 8px; width: 100%;
}}
.nudge-btn {{
  background: rgba(56, 189, 248, 0.14); border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8; border-radius: 6px; width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.15rem; font-weight: 800; cursor: pointer; user-select: none;
  transition: all 0.12s; flex-shrink: 0;
}}
.nudge-btn:hover {{
  background: rgba(56, 189, 248, 0.35); border-color: #38bdf8; color: #ffffff;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.6);
}}
.nudge-btn:active {{
  transform: scale(0.92);
}}
.range-slider {{
  flex: 1; -webkit-appearance: none; appearance: none; width: 100%; height: 8px;
  background: rgba(255, 255, 255, 0.18); border-radius: 4px; outline: none; cursor: pointer;
}}
.range-slider::-webkit-slider-thumb {{
  -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
  background: #38bdf8; border: 2.5px solid #ffffff; cursor: grab; box-shadow: 0 0 12px rgba(56, 189, 248, 0.9);
}}
.range-slider::-moz-range-thumb {{
  width: 20px; height: 20px; border-radius: 50%;
  background: #38bdf8; border: 2.5px solid #ffffff; cursor: grab; box-shadow: 0 0 12px rgba(56, 189, 248, 0.9);
}}
.slider-bounds-row {{
  display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem;
  color: #94a3b8; font-family: ui-monospace, monospace; font-weight: 700; letter-spacing: 0.02em;
}}
.bound-tag {{ opacity: 0.9; }}
@keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(4px); }} to {{ opacity: 1; transform: translateY(0); }} }}

/* Guided Quest Card (Floating HUD) */
#questCard {{
  position: absolute; top: 12px; right: 14px; z-index: 35;
  background: rgba(11, 19, 41, 0.92); backdrop-filter: blur(14px);
  border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 10px;
  padding: 8px 12px; width: 275px; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.65);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: all 0.25s ease;
}}
#questCard.minimized .quest-body {{ display: none; }}
.quest-header {{
  display: flex; align-items: center; justify-content: space-between; cursor: pointer; user-select: none;
}}
.quest-title-wrap {{ display: flex; align-items: center; gap: 5px; }}
.quest-badge {{
  font-size: 0.70rem; font-weight: 800; letter-spacing: 0.05em; color: #38bdf8;
  background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 2px 6px; border-radius: 5px; text-transform: uppercase;
}}
.quest-step {{ font-size: 0.74rem; color: #94a3b8; font-weight: 700; margin-left: 4px; }}
.quest-xp {{
  font-size: 0.70rem; font-weight: 700; color: #f59e0b;
  background: rgba(245, 158, 11, 0.12); padding: 1px 5px; border-radius: 4px;
}}
.quest-body {{ margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }}
.quest-title {{ font-size: 0.82rem; font-weight: 700; color: #f8fafc; }}
.quest-task {{ font-size: 0.75rem; color: #cbd5e1; line-height: 1.35; }}
.quest-hint {{ font-size: 0.70rem; color: #94a3b8; font-style: italic; }}
.quest-progress-wrap {{
  width: 100%; height: 5px; background: rgba(255, 255, 255, 0.12); border-radius: 3px;
  overflow: hidden; margin-top: 3px; position: relative;
}}
.quest-progress-bar {{
  height: 100%; width: 0%; background: linear-gradient(90deg, #0284c7, #38bdf8);
  border-radius: 3px; transition: width 0.25s ease;
}}
.quest-complete-toast {{
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.96), rgba(5, 150, 105, 0.96));
  backdrop-filter: blur(12px); color: #fff; font-weight: 700; font-size: 0.85rem;
  padding: 8px 18px; border-radius: 20px; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.4);
  z-index: 50; display: none; animation: popToast 0.3s ease-out; white-space: nowrap;
}}
@keyframes popToast {{
  0% {{ opacity: 0; transform: translate(-50%, -10px) scale(0.9); }}
  100% {{ opacity: 1; transform: translate(-50%, 0) scale(1); }}
}}
</style>
</head>
<body>
<div id="app">
  <!-- Top Bar -->
  <div id="topBar">
    <div class="header-left">
      <span class="lab-icon">🧪</span>
      <span class="lab-title">{title}</span>
      <span class="lab-badge">{subject}</span>
    </div>
    <div class="header-center">
      {chips_html}
    </div>
    <div class="header-right">
      <button class="icon-btn" id="audioToggle" title="Toggle Sound (Mute/Unmute)">🔊</button>
    </div>
  </div>

  <!-- Canvas Viewport -->
  <div id="canvasWrap">
    <canvas id="simCanvas"></canvas>
    <div id="inspectorCard">
      <h4 id="inspTitle"></h4>
      <p id="inspRole"></p>
      <div id="inspFormula" class="formula-tag"></div>
    </div>
    <!-- Guided Discovery Quest Card (Collapsible) -->
    <div id="questCard" class="quest-card">
      <div class="quest-header" id="questHeader" title="Click to collapse / expand mission">
        <div class="quest-title-wrap">
          <span class="quest-badge">🎯 LAB MISSION</span>
          <span class="quest-step" id="questStep">1/3</span>
        </div>
        <span class="quest-xp" id="questXp">+50 XP</span>
      </div>
      <div class="quest-body" id="questBody">
        <div class="quest-title" id="questTitle">Mission 1</div>
        <div class="quest-task" id="questTask">...</div>
        <div class="quest-hint" id="questHint">💡 Hint: ...</div>
        <div class="quest-progress-wrap">
          <div class="quest-progress-bar" id="questBar"></div>
        </div>
      </div>
    </div>
    <div id="questToast" class="quest-complete-toast"></div>
  </div>

  <!-- Bottom Dock -->
  <div id="dock">
    <div class="dock-top-row">
      <div class="presets-group">
        <span class="presets-title">⚡ Presets:</span>
        {presets_html}
      </div>
      <div class="playback-controls">
        <button class="play-btn" id="playBtn">⏸ Pause</button>
        <button class="reset-btn" id="resetBtn">↺ Reset</button>
      </div>
    </div>
    <div class="dock-sliders-row">
      {sliders_html}
    </div>
  </div>
</div>

<script>
(() => {{
  // --- Simulation State ---
  const state = {{
    isPlaying: true,
    audioEnabled: true,
    time: 0,
    lastNow: performance.now(),
    hoveredComponent: null,
    params: {{}},
    custom: {{}},
    activeMissionIndex: 0,
    completedMissions: []
  }};

  // --- Specifications ---
  const SPEC_PRESETS = {presets_js};
  const SPEC_READOUTS = {readouts_js};
  const SPEC_COMPONENTS = {components_js};
  const SPEC_GRAPH = {graph_js};
  const SPEC_MISSIONS = {missions_js};

  // --- Initialize Parameters ---
  {chr(10).join(f"  state.params['{p['key']}'] = {p.get('default', (p['min']+p['max'])/2)};" for p in params)}

  // --- Web Audio Micro-Synthesizer ---
  let audioCtx = null;
  function getAudioCtx() {{
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }}
  function playClick(freq = 640) {{
    if (!state.audioEnabled) return;
    try {{
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      osc.start(); osc.stop(ctx.currentTime + 0.035);
    }} catch(e) {{}}
  }}

  // --- Canvas Auto-Scaler ---
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  let logicalW = 800, logicalH = 500;

  function resizeCanvas() {{
    const dpr = window.devicePixelRatio || 1;
    logicalW = canvas.clientWidth;
    logicalH = canvas.clientHeight;
    canvas.width = Math.floor(logicalW * dpr);
    canvas.height = Math.floor(logicalH * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }}
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Flexible Argument Unpacker Helper ---
  function unpack(args, names) {{
    let a = [...args];
    if (a[0] && (a[0].canvas || typeof a[0].fillRect === 'function')) a.shift();
    let res = {{}};
    let nameIdx = 0;
    for (let item of a) {{
      if (item && typeof item === 'object' && !Array.isArray(item)) {{
        Object.assign(res, item);
      }} else if (item !== undefined) {{
        if (nameIdx < names.length) {{
          res[names[nameIdx]] = item;
          nameIdx++;
        }}
      }}
    }}
    // Handle vector coordinate conventions (dx/dy, x/y)
    if (res.x !== undefined && res.x1 === undefined) res.x1 = res.x;
    if (res.y !== undefined && res.y1 === undefined) res.y1 = res.y;
    if (res.dx !== undefined && res.x2 === undefined) {{
      res.x2 = (res.x1 !== undefined ? res.x1 : 0) + res.dx;
    }}
    if (res.dy !== undefined && res.y2 === undefined) {{
      res.y2 = (res.y1 !== undefined ? res.y1 : 0) + res.dy;
    }}
    return res;
  }}

  // --- Drawing Toolkit Helpers ---
  const helpers = {{
    getCtx: () => ctx,
    getContext: () => ctx,

    // Volumetric 3D Shaded Sphere (Enzymes, Atoms, Molecules, Planets, Projectiles)
    drawSphere: (...args) => {{
      const {{ x = 0, y = 0, r = 15, radius = 15, color = '#38bdf8', label = '' }} = unpack(args, ['x', 'y', 'r', 'color', 'label']);
      const effR = r || radius || 15;
      ctx.save();
      const grad = ctx.createRadialGradient(x - effR * 0.35, y - effR * 0.35, effR * 0.1, x, y, effR);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, color);
      grad.addColorStop(1, '#05192d');
      ctx.fillStyle = grad;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x, y, effR, 0, Math.PI * 2);
      ctx.fill();
      if (label) {{
        ctx.shadowBlur = 0; ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center'; ctx.fillText(label, x, y + effR + 14);
      }}
      ctx.restore();
    }},

    // Volumetric glassware / beaker / U-tube
    drawGlassware: (...args) => {{
      const {{ x = 0, y = 0, w = 60, width = 60, h = 100, height = 100, liquidRatio = 0.5, liquidHeight = 0.5, color = '#38bdf8', liquidColor = '#38bdf8', label = '' }} = unpack(args, ['x', 'y', 'w', 'h', 'liquidRatio', 'color', 'label']);
      const effW = w || width || 60;
      const effH = h || height || 100;
      const effRatio = liquidRatio !== undefined ? liquidRatio : (liquidHeight || 0.5);
      const effColor = liquidColor || color || '#38bdf8';
      ctx.save();
      const grad = ctx.createLinearGradient(x, 0, x + effW, 0);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
      grad.addColorStop(0.12, 'rgba(255, 255, 255, 0.38)');
      grad.addColorStop(0.3, 'rgba(56, 189, 248, 0.08)');
      grad.addColorStop(0.85, 'rgba(14, 165, 233, 0.15)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.25)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, effW, effH, [0, 0, 12, 12]);
      ctx.fill(); ctx.stroke();

      const clampedRatio = Math.max(0, Math.min(1, effRatio));
      const liqH = (effH - 6) * clampedRatio;
      const liqY = y + effH - 3 - liqH;
      if (liqH > 2) {{
        const lGrad = ctx.createLinearGradient(0, liqY, 0, y + effH);
        lGrad.addColorStop(0, effColor);
        lGrad.addColorStop(1, '#0369a1');
        ctx.fillStyle = lGrad;
        ctx.beginPath();
        ctx.moveTo(x + 3, liqY + 3);
        ctx.quadraticCurveTo(x + effW / 2, liqY - 2, x + effW - 3, liqY + 3);
        ctx.lineTo(x + effW - 3, y + effH - 3);
        ctx.lineTo(x + 3, y + effH - 3);
        ctx.closePath();
        ctx.fill();
      }}
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {{
        const ty = y + (effH * i) / 6;
        ctx.beginPath();
        ctx.moveTo(x + 4, ty); ctx.lineTo(x + 12, ty);
        ctx.stroke();
      }}
      if (label) {{
        ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';
        ctx.fillText(label, x + 8, y + 16);
      }}
      ctx.restore();
    }},

    // Metallic piston / rod
    drawPiston: (...args) => {{
      const {{ x = 0, y = 0, w = 60, width = 60, h = 20, height = 20, rodLength = 40, color = '#64748b' }} = unpack(args, ['x', 'y', 'w', 'h', 'rodLength', 'color']);
      const effW = w || width || 60;
      const effH = h || height || 20;
      ctx.save();
      const rodW = Math.max(6, effW * 0.16);
      const rodX = x + (effW - rodW) / 2;
      const rodGrad = ctx.createLinearGradient(rodX, 0, rodX + rodW, 0);
      rodGrad.addColorStop(0, '#64748b'); rodGrad.addColorStop(0.3, '#cbd5e1'); rodGrad.addColorStop(1, '#475569');
      ctx.fillStyle = rodGrad;
      ctx.fillRect(rodX, y - rodLength, rodW, rodLength);

      const headGrad = ctx.createLinearGradient(x, 0, x + effW, 0);
      headGrad.addColorStop(0, '#475569'); headGrad.addColorStop(0.2, '#94a3b8'); headGrad.addColorStop(0.5, '#cbd5e1'); headGrad.addColorStop(1, '#334155');
      ctx.fillStyle = headGrad;
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, effW, effH, 4);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }},

    // Calibrated dial meter / pressure gauge
    drawGauge: (...args) => {{
      const {{ x = 0, y = 0, r = 35, radius = 35, minVal = 0, maxVal = 100, curVal = 50, val = 50, label = '', unit = '' }} = unpack(args, ['x', 'y', 'r', 'minVal', 'maxVal', 'curVal', 'label', 'unit']);
      const effR = r || radius || 35;
      const current = curVal !== undefined ? curVal : (val !== undefined ? val : 50);
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, effR, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      const span = Math.PI * 1.5;
      const startA = Math.PI * 0.75;
      const ratio = Math.max(0, Math.min(1, (current - minVal) / (maxVal - minVal || 1)));
      const needleA = startA + ratio * span;

      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (effR - 6) * Math.cos(needleA), y + (effR - 6) * Math.sin(needleA));
      ctx.stroke();

      ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(label || '', x, y + effR * 0.45);
      ctx.font = 'bold 10px monospace'; ctx.fillStyle = '#38bdf8';
      ctx.fillText(current.toFixed(1) + ' ' + (unit || ''), x, y + effR * 0.75);
      ctx.restore();
    }},

    // Glowing vector arrow
    drawVector: (...args) => {{
      const u = unpack(args, ['x1', 'y1', 'x2', 'y2', 'color', 'label']);
      const x1 = u.x1 !== undefined ? u.x1 : (u.x !== undefined ? u.x : 0);
      const y1 = u.y1 !== undefined ? u.y1 : (u.y !== undefined ? u.y : 0);
      const x2 = u.x2 !== undefined ? u.x2 : (u.dx !== undefined ? x1 + u.dx : x1 + 40);
      const y2 = u.y2 !== undefined ? u.y2 : (u.dy !== undefined ? y1 + u.dy : y1);
      const color = u.color || '#38bdf8';
      const label = u.label || '';
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headlen = 9;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
      ctx.closePath(); ctx.fill();
      if (label) {{
        ctx.shadowBlur = 0; ctx.font = 'bold 11px sans-serif';
        ctx.fillText(label, (x1 + x2) / 2 + 8, (y1 + y2) / 2 - 4);
      }}
      ctx.restore();
    }},

    // Cylindrical Chamber
    drawCylinder: (...args) => {{
      const u = unpack(args, ['x', 'y', 'w', 'h', 'label', 'color']);
      const x = u.x !== undefined ? u.x : 0;
      const y = u.y !== undefined ? u.y : 0;
      const w = u.w !== undefined ? u.w : (u.width !== undefined ? u.width : 60);
      const h = u.h !== undefined ? u.h : (u.height !== undefined ? u.height : 100);
      const color = u.color || '#38bdf8';
      const label = u.label || '';
      ctx.save();
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.3)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, [4, 4, 10, 10]);
      ctx.fill(); ctx.stroke();
      if (label) {{
        ctx.fillStyle = '#94a3b8'; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y - 8);
      }}
      ctx.restore();
    }},

    // Fluid Reservoir / Conduit
    drawFluid: (...args) => {{
      const u = unpack(args, ['x', 'y', 'w', 'h', 'color', 'label']);
      const x = u.x !== undefined ? u.x : 0;
      const y = u.y !== undefined ? u.y : 0;
      const w = u.w !== undefined ? u.w : (u.width !== undefined ? u.width : 60);
      const h = u.h !== undefined ? u.h : (u.height !== undefined ? u.height : 40);
      const color = u.color || '#0284c7';
      const label = u.label || '';
      const pressure = u.pressure || '';
      ctx.save();
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(1, '#0369a1');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(x, y, w, 3);
      if (label || pressure) {{
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
        ctx.fillText((label ? label + ' ' : '') + (pressure ? pressure + ' kPa' : ''), x + w / 2, y + h / 2 + 4);
      }}
      ctx.restore();
    }},

    // Lab Block / Container
    drawBox: (...args) => {{
      const u = unpack(args, ['x', 'y', 'w', 'h', 'color', 'stroke', 'label']);
      const x = u.x !== undefined ? u.x : 0;
      const y = u.y !== undefined ? u.y : 0;
      const w = u.w !== undefined ? u.w : (u.width !== undefined ? u.width : 50);
      const h = u.h !== undefined ? u.h : (u.height !== undefined ? u.height : 50);
      const color = u.color || '#1e293b';
      const stroke = u.stroke || '#38bdf8';
      const label = u.label || '';
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6);
      ctx.fill(); ctx.stroke();
      if (label) {{
        ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + h / 2 + 4);
      }}
      ctx.restore();
    }},

    // Spring
    drawSpring: (...args) => {{
      const u = unpack(args, ['x1', 'y1', 'x2', 'y2', 'coils', 'width', 'color']);
      const x1 = u.x1 || 0, y1 = u.y1 || 0, x2 = u.x2 || 0, y2 = u.y2 || 100;
      const coils = u.coils || 10, width = u.width || 18, color = u.color || '#94a3b8';
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      const dx = x2 - x1, dy = y2 - y1;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      ctx.translate(x1, y1);
      ctx.rotate(angle);
      ctx.moveTo(0, 0);
      const segLen = dist / (coils * 2);
      for (let i = 0; i < coils * 2; i++) {{
        const sx = (i + 0.5) * segLen * 2;
        const sy = (i % 2 === 0 ? 1 : -1) * (width / 2);
        ctx.lineTo(sx, sy);
      }}
      ctx.lineTo(dist, 0);
      ctx.stroke();
      ctx.restore();
    }},

    // Optical Ray / Light Beam
    drawRay: (...args) => {{
      const u = unpack(args, ['x1', 'y1', 'x2', 'y2', 'color']);
      const x1 = u.x1 || 0, y1 = u.y1 || 0, x2 = u.x2 || 100, y2 = u.y2 || 0;
      const color = u.color || '#ef4444';
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }},

    // Periodic / Sinusoidal Wave
    drawWave: (...args) => {{
      const {{ x = 0, y = 100, w = 300, amp = 30, freq = 2, phase = 0, color = '#38bdf8', label = '' }} = unpack(args, ['x', 'y', 'w', 'amp', 'freq', 'phase', 'color', 'label']);
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.shadowColor = color; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i <= w; i += 2) {{
        const wy = y + Math.sin((i / w) * Math.PI * 2 * freq + phase) * amp;
        if (i === 0) ctx.moveTo(x + i, wy);
        else ctx.lineTo(x + i, wy);
      }}
      ctx.stroke();
      if (label) {{
        ctx.shadowBlur = 0; ctx.fillStyle = color; ctx.font = 'bold 11px sans-serif';
        ctx.fillText(label, x + w - 40, y - amp - 6);
      }}
      ctx.restore();
    }},

    // Live Analytical Graph Plotter
    drawAnalyticalGraph: (gx, gy, gw, gh, gspec, p, state) => {{
      ctx.save();
      ctx.fillStyle = 'rgba(11, 19, 41, 0.75)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(gx, gy, gw, gh, 10);
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#38bdf8'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText(gspec.title || 'Dynamic Response Curve', gx + 12, gy + 18);
      if (gspec.formula) {{
        ctx.fillStyle = '#a5f3fc'; ctx.font = '10px monospace';
        ctx.fillText(gspec.formula, gx + gw - ctx.measureText(gspec.formula).width - 12, gy + 18);
      }}

      const padL = 36, padR = 14, padT = 32, padB = 28;
      const plotX = gx + padL, plotY = gy + padT;
      const plotW = gw - padL - padR, plotH = gh - padT - padB;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plotX, plotY); ctx.lineTo(plotX, plotY + plotH);
      ctx.lineTo(plotX + plotW, plotY + plotH);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
      ctx.fillText(gspec.xLabel || 'Input', plotX + plotW / 2 - 15, plotY + plotH + 18);
      ctx.save();
      ctx.translate(plotX - 22, plotY + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(gspec.yLabel || 'Output', -15, 0);
      ctx.restore();

      const xMin = gspec.xMin || 0, xMax = gspec.xMax || 100;
      const yMin = gspec.yMin || 0, yMax = gspec.yMax || 100;
      const fn = gspec.fn || ((x, p) => x);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let i = 0; i <= 50; i++) {{
        const xVal = xMin + ((xMax - xMin) * i) / 50;
        const yVal = fn(xVal, p, state);
        const px = plotX + ((xVal - xMin) / (xMax - xMin || 1)) * plotW;
        const py = plotY + plotH - ((yVal - yMin) / (yMax - yMin || 1)) * plotH;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }}
      ctx.stroke();

      const curX = gspec.getCurrentX ? gspec.getCurrentX(p, state) : xMin + (xMax - xMin) * 0.5;
      const curY = fn(curX, p, state);
      const mX = plotX + ((curX - xMin) / (xMax - xMin || 1)) * plotW;
      const mY = plotY + plotH - ((curY - yMin) / (yMax - yMin || 1)) * plotH;

      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(mX, mY, 5 + Math.sin(state.time * 6) * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // High-contrast live operating coordinate readout badge
      const coordStr = `${{Number(curX).toFixed(1)}}, ${{Number(curY).toFixed(1)}}`;
      ctx.font = 'bold 11px monospace';
      const cW = ctx.measureText(coordStr).width;
      const bX = Math.min(plotX + plotW - cW - 10, Math.max(plotX + 4, mX - cW / 2));
      const bY = mY > plotY + 30 ? mY - 14 : mY + 22;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bX - 4, bY - 11, cW + 8, 16, 4);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(coordStr, bX, bY + 1);

      ctx.restore();
    }}
  }};

  // --- Interactive Inspector Detection ---
  const inspectorCard = document.getElementById('inspectorCard');
  const inspTitle = document.getElementById('inspTitle');
  const inspRole = document.getElementById('inspRole');
  const inspFormula = document.getElementById('inspFormula');

  function handlePointer(e) {{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const splitX = Math.floor(logicalW * 0.62);
    const appW = splitX - 10;
    const appH = logicalH;

    let found = null;
    for (const comp of SPEC_COMPONENTS) {{
      if (comp.getBounds) {{
        try {{
          const b = comp.getBounds(appW, appH, state.params);
          if (b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {{
            found = comp;
            break;
          }}
        }} catch(err) {{}}
      }}
    }}

    if (found) {{
      canvas.style.cursor = 'pointer';
      inspectorCard.style.display = 'block';
      inspectorCard.style.left = Math.min(e.clientX + 14, window.innerWidth - 290) + 'px';
      inspectorCard.style.top = Math.min(e.clientY + 14, window.innerHeight - 150) + 'px';
      inspTitle.textContent = '🔍 ' + found.name;
      inspRole.textContent = found.role;
      inspFormula.textContent = found.formula || '';
      inspFormula.style.display = found.formula ? 'inline-block' : 'none';
    }} else {{
      canvas.style.cursor = 'default';
      inspectorCard.style.display = 'none';
    }}
  }}
  canvas.addEventListener('mousemove', handlePointer);

  // Helper to format value pill
  function setValPill(key, val, unit) {{
    const el = document.getElementById('val_' + key);
    if (el) {{
      el.innerHTML = '<span class="val-num">' + val + '</span><span class="val-unit"> ' + unit + '</span>';
    }}
  }}

  // --- Sliders & UI Wiring ---
  {chr(10).join(f"""
  const s_{p['key']} = document.getElementById('slider_{p['key']}');
  if (s_{p['key']}) {{
    s_{p['key']}.addEventListener('input', (e) => {{
      const num = parseFloat(e.target.value);
      state.params['{p['key']}'] = num;
      setValPill('{p['key']}', num, '{p.get('unit', '')}');
      playClick(550 + state.params['{p['key']}'] * 2);
      updateTelemetry();
    }});
  }}""" for p in params)}

  // --- Nudge Buttons Wiring ---
  document.querySelectorAll('.nudge-btn').forEach((btn) => {{
    btn.addEventListener('click', (e) => {{
      e.preventDefault();
      const k = btn.dataset.key;
      const stepVal = parseFloat(btn.dataset.step);
      const s = document.getElementById('slider_' + k);
      if (!s) return;
      const minVal = parseFloat(s.min);
      const maxVal = parseFloat(s.max);
      let cur = parseFloat(s.value);
      let next = Math.min(maxVal, Math.max(minVal, Number((cur + stepVal).toFixed(4))));
      s.value = next;
      state.params[k] = next;
      setValPill(k, next, s.dataset.unit || '');
      playClick(stepVal > 0 ? 680 : 520);
      updateTelemetry();
    }});
  }});

  // --- Presets Wiring ---
  const presetPills = document.querySelectorAll('.preset-pill');
  presetPills.forEach((pill) => {{
    pill.addEventListener('click', () => {{
      presetPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      const idx = parseInt(pill.dataset.idx, 10);
      const pr = SPEC_PRESETS[idx];
      if (pr && pr.params) {{
        for (const [k, val] of Object.entries(pr.params)) {{
          state.params[k] = val;
          const s = document.getElementById('slider_' + k);
          if (s) s.value = val;
          setValPill(k, val, s ? s.dataset.unit || '' : '');
        }}
        playClick(880);
        updateTelemetry();
      }}
    }});
  }});

  // --- Telemetry Chips Updater ---
  function updateTelemetry() {{
    SPEC_READOUTS.forEach((r, idx) => {{
      const el = document.getElementById('chip_val_' + idx);
      if (el && r.calc) {{
        try {{
          const res = r.calc(state.params, state);
          el.textContent = res + ' ' + (r.unit || '');
        }} catch(e) {{}}
      }}
    }});
    broadcastTelemetry('telemetry');
  }}

  // --- Lab Copilot Telemetry Broadcaster (Parent Window Bridge) ---
  let lastBroadcastTime = 0;
  function broadcastTelemetry(reason = 'update', extra = {{}}) {{
    const now = performance.now();
    if (now - lastBroadcastTime < 75 && reason === 'telemetry') return;
    lastBroadcastTime = now;

    const readoutsMap = {{}};
    SPEC_READOUTS.forEach((r, idx) => {{
      const el = document.getElementById('chip_val_' + idx);
      if (el) readoutsMap[r.label] = el.textContent;
    }});

    const currentM = SPEC_MISSIONS[state.activeMissionIndex] || null;

    const payload = {{
      type: 'tark_sim_telemetry',
      title: {json.dumps(title)},
      subject: {json.dumps(subject)},
      params: Object.assign({{}}, state.params),
      readouts: readoutsMap,
      isPlaying: state.isPlaying,
      time: Number(state.time.toFixed(2)),
      activeMission: currentM ? {{ id: currentM.id, title: currentM.title, task: currentM.task, xp: currentM.xp }} : null,
      activeMissionIndex: state.activeMissionIndex,
      totalMissions: SPEC_MISSIONS.length,
      completedMissions: state.completedMissions.slice(),
      reason,
      extra
    }};
    try {{
      window.parent.postMessage(payload, '*');
    }} catch(e) {{}}
  }}

  // --- Lab Copilot Inbound Control Event Listener ---
  window.addEventListener('message', (evt) => {{
    if (!evt.data || typeof evt.data !== 'object') return;
    const data = evt.data;
    if (data.type === 'tark_set_param' && data.key !== undefined) {{
      const k = String(data.key);
      const val = parseFloat(data.value);
      if (!isNaN(val)) {{
        state.params[k] = val;
        const s = document.getElementById('slider_' + k);
        if (s) s.value = val;
        setValPill(k, val, s ? s.dataset.unit || '' : '');
        playClick(660);
        updateTelemetry();
        broadcastTelemetry('param_set', {{ key: k, value: val }});
      }}
    }} else if (data.type === 'tark_set_preset' && typeof data.index === 'number') {{
      if (presetPills[data.index]) {{
        presetPills[data.index].click();
        broadcastTelemetry('preset_set', {{ index: data.index }});
      }}
    }} else if (data.type === 'tark_reset') {{
      if (resetBtn) resetBtn.click();
      broadcastTelemetry('sim_reset');
    }} else if (data.type === 'tark_play_pause') {{
      if (typeof data.isPlaying === 'boolean') {{
        state.isPlaying = data.isPlaying;
        if (playBtn) playBtn.textContent = state.isPlaying ? '⏸ Pause' : '▶ Play';
      }} else if (playBtn) {{
        playBtn.click();
      }}
      broadcastTelemetry('playback_set', {{ isPlaying: state.isPlaying }});
    }} else if (data.type === 'tark_query_state') {{
      broadcastTelemetry('state_report');
    }}
  }});

  // --- Triumph Audio & Confetti FX ---
  function playSuccessChime() {{
    if (!state.audioEnabled) return;
    try {{
      const ctx = getAudioCtx();
      if (!ctx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {{
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.36);
      }});
    }} catch(e) {{}}
  }}

  const confettiParticles = [];
  function triggerConfetti() {{
    for (let i = 0; i < 40; i++) {{
      confettiParticles.push({{
        x: logicalW * 0.35 + (Math.random() - 0.5) * 140,
        y: logicalH * 0.4 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 260,
        vy: -120 - Math.random() * 200,
        size: 4 + Math.random() * 5,
        color: ['#38bdf8', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 5)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 8,
        life: 1.0,
      }});
    }}
  }}

  // --- Guided Discovery Missions Engine ---
  let missionStabilityTimer = 0;
  function renderActiveMission() {{
    const stepEl = document.getElementById('questStep');
    const titleEl = document.getElementById('questTitle');
    const taskEl = document.getElementById('questTask');
    const hintEl = document.getElementById('questHint');
    const xpEl = document.getElementById('questXp');
    const barEl = document.getElementById('questBar');

    if (!SPEC_MISSIONS || SPEC_MISSIONS.length === 0) {{
      const qc = document.getElementById('questCard');
      if (qc) qc.style.display = 'none';
      return;
    }}

    if (state.activeMissionIndex >= SPEC_MISSIONS.length) {{
      if (stepEl) stepEl.textContent = 'DONE ✓';
      if (titleEl) titleEl.textContent = 'All Quests Mastered!';
      if (taskEl) taskEl.textContent = 'Laboratory investigation fully accomplished.';
      if (hintEl) hintEl.textContent = '⭐ Exceptional empirical discovery!';
      if (barEl) barEl.style.width = '100%';
      return;
    }}

    const m = SPEC_MISSIONS[state.activeMissionIndex];
    if (stepEl) stepEl.textContent = (state.activeMissionIndex + 1) + '/' + SPEC_MISSIONS.length;
    if (titleEl) titleEl.textContent = m.title;
    if (taskEl) taskEl.textContent = m.task;
    if (hintEl) hintEl.textContent = m.hint ? ('💡 Hint: ' + m.hint) : '';
    if (xpEl) xpEl.textContent = '+' + m.xp + ' XP';
    if (barEl) barEl.style.width = '0%';
  }}

  function updateMissions(dt) {{
    if (!SPEC_MISSIONS || SPEC_MISSIONS.length === 0) return;
    if (state.activeMissionIndex >= SPEC_MISSIONS.length) return;

    const currentM = SPEC_MISSIONS[state.activeMissionIndex];
    const isPassing = currentM.check(state.params, state);
    const barEl = document.getElementById('questBar');

    if (isPassing) {{
      missionStabilityTimer += dt;
      const progress = Math.min(100, Math.floor((missionStabilityTimer / 1.1) * 100));
      if (barEl) barEl.style.width = progress + '%';

      if (missionStabilityTimer >= 1.1) {{
        missionStabilityTimer = 0;
        state.completedMissions.push(currentM.id);
        playSuccessChime();
        triggerConfetti();

        const toast = document.getElementById('questToast');
        if (toast) {{
          toast.textContent = '🎉 ' + currentM.title + ' Complete! +' + currentM.xp + ' XP';
          toast.style.display = 'block';
          setTimeout(() => {{ if (toast) toast.style.display = 'none'; }}, 2800);
        }}

        try {{
          window.parent.postMessage({{
            type: 'tark_mission_completed',
            completedMission: currentM,
            nextMissionIndex: state.activeMissionIndex + 1,
            totalMissions: SPEC_MISSIONS.length,
            params: Object.assign({{}}, state.params),
          }}, '*');
        }} catch(e) {{}}

        state.activeMissionIndex++;
        renderActiveMission();
      }}
    }} else {{
      missionStabilityTimer = Math.max(0, missionStabilityTimer - dt * 2.5);
      if (barEl) barEl.style.width = Math.max(0, Math.floor((missionStabilityTimer / 1.1) * 100)) + '%';
    }}
  }}

  const questHeader = document.getElementById('questHeader');
  if (questHeader) {{
    questHeader.addEventListener('click', () => {{
      const qc = document.getElementById('questCard');
      if (qc) qc.classList.toggle('minimized');
    }});
  }}

  // --- Play/Pause & Reset ---
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {{
    playBtn.addEventListener('click', () => {{
      state.isPlaying = !state.isPlaying;
      playBtn.textContent = state.isPlaying ? '⏸ Pause' : '▶ Play';
      playClick(720);
      broadcastTelemetry('playback_click', {{ isPlaying: state.isPlaying }});
    }});
  }}
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {{
    resetBtn.addEventListener('click', () => {{
      const defaultP = SPEC_PRESETS[0];
      if (defaultP) presetPills[0].click();
      state.time = 0;
      missionStabilityTimer = 0;
      playClick(440);
      broadcastTelemetry('reset_click');
    }});
  }}
  const audioToggle = document.getElementById('audioToggle');
  if (audioToggle) {{
    audioToggle.addEventListener('click', () => {{
      state.audioEnabled = !state.audioEnabled;
      audioToggle.textContent = state.audioEnabled ? '🔊' : '🔇';
    }});
  }}

  // --- Primary 60 FPS Render Loop ---
  function loop(now) {{
    const dt = Math.min((now - state.lastNow) / 1000, 0.05);
    state.lastNow = now;
    if (state.isPlaying) state.time += dt;

    ctx.clearRect(0, 0, logicalW, logicalH);

    ctx.fillStyle = '#070d18';
    ctx.fillRect(0, 0, logicalW, logicalH);

    const splitX = Math.floor(logicalW * 0.62);
    const appW = splitX - 10;
    const appH = logicalH;
    const graphX = splitX + 8;
    const graphY = 16;
    const graphW = logicalW - splitX - 24;
    const graphH = logicalH - 32;

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(splitX, 16); ctx.lineTo(splitX, logicalH - 16);
    ctx.stroke();

    if (SPEC_GRAPH && SPEC_GRAPH.fn) {{
      helpers.drawAnalyticalGraph(graphX, graphY, graphW, graphH, SPEC_GRAPH, state.params, state);
    }}

    ctx.save();
    try {{
      const p = state.params;
      {draw_apparatus_code}
      if (typeof drawApparatus === 'function') {{
        drawApparatus(ctx, appW, appH, p, state);
      }}
    }} catch(e) {{
      ctx.fillStyle = '#ef4444'; ctx.font = '12px sans-serif';
      ctx.fillText('Simulation notice: ' + e.message, 20, 40);
    }}
    ctx.restore();

    updateMissions(dt);

    if (confettiParticles.length > 0) {{
      for (let i = confettiParticles.length - 1; i >= 0; i--) {{
        const pt = confettiParticles[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 320 * dt;
        pt.rot += pt.vrot * dt;
        pt.life -= dt * 0.9;
        if (pt.life <= 0) {{
          confettiParticles.splice(i, 1);
          continue;
        }}
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.6);
        ctx.restore();
      }}
    }}

    requestAnimationFrame(loop);
  }}

  updateTelemetry();
  renderActiveMission();
  broadcastTelemetry('sim_init');
  requestAnimationFrame(loop);
}})();
</script>
</body>
</html>"""
