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
        <div class="slider-cell">
          <div class="slider-header">
            <span class="slider-label">{p['label']}</span>
            <span class="slider-value-pill" id="val_{key}">{val} {unit}</span>
          </div>
          <input type="range" class="range-slider" id="slider_{key}" data-unit="{unit}"
                 min="{p['min']}" max="{p['max']}" step="{step}" value="{val}">
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
  height: 48px; background: var(--panel); backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--panel-border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px; z-index: 20; flex-shrink: 0;
}}
.header-left {{ display: flex; align-items: center; gap: 10px; }}
.lab-icon {{ font-size: 1.25rem; }}
.lab-title {{ font-size: 1rem; font-weight: 700; color: #f8fafc; }}
.lab-badge {{
  background: rgba(56, 189, 248, 0.14); border: 1px solid rgba(56, 189, 248, 0.35);
  color: #38bdf8; font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 999px;
  letter-spacing: 0.4px;
}}
.header-center {{ display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; }}
.telemetry-chip {{
  background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 8px; padding: 4px 10px; font-size: 0.8rem; font-family: ui-monospace, SFMono-Regular, monospace;
  color: #a5f3fc; display: flex; align-items: center; gap: 5px; white-space: nowrap;
}}
.telemetry-label {{ color: #94a3b8; font-size: 0.72rem; font-family: -apple-system, sans-serif; }}
.telemetry-val {{ font-weight: 700; color: #38bdf8; }}
.header-right {{ display: flex; align-items: center; gap: 8px; }}
.icon-btn {{
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1; border-radius: 8px; width: 32px; height: 32px; display: flex;
  align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; font-size: 0.95rem;
}}
.icon-btn:hover {{ background: rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.4); color: #fff; }}

/* Canvas Viewport */
#canvasWrap {{ flex: 1; position: relative; width: 100%; overflow: hidden; background: #070d18; }}
#simCanvas {{ width: 100%; height: 100%; display: block; }}

/* Floating Inspector Card */
#inspectorCard {{
  position: absolute; pointer-events: none; z-index: 30; display: none;
  background: rgba(11, 19, 41, 0.95); backdrop-filter: blur(16px);
  border: 1px solid rgba(56, 189, 248, 0.45); border-radius: 10px;
  padding: 10px 14px; max-width: 280px; box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
  animation: fadeIn 0.12s ease-out;
}}
#inspectorCard h4 {{ margin: 0 0 4px 0; font-size: 0.92rem; color: #38bdf8; display: flex; align-items: center; gap: 6px; }}
#inspectorCard p {{ margin: 0 0 6px 0; font-size: 0.78rem; color: #cbd5e1; line-height: 1.35; }}
#inspectorCard .formula-tag {{
  display: inline-block; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35);
  color: #a5f3fc; font-family: ui-monospace, monospace; font-size: 0.74rem; padding: 2px 6px; border-radius: 4px;
}}

/* Bottom Control Dock */
#dock {{
  background: var(--panel); backdrop-filter: blur(16px);
  border-top: 1px solid var(--panel-border);
  padding: 8px 16px 10px 16px; display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; z-index: 20;
}}
.dock-top-row {{ display: flex; align-items: center; justify-content: space-between; gap: 12px; }}
.presets-group {{ display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; }}
.presets-title {{ font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-right: 4px; white-space: nowrap; }}
.preset-pill {{
  background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14);
  color: #cbd5e1; padding: 4px 10px; border-radius: 16px; font-size: 0.76rem; font-weight: 500;
  cursor: pointer; white-space: nowrap; transition: all 0.15s;
}}
.preset-pill:hover, .preset-pill.active {{
  background: rgba(56, 189, 248, 0.22); border-color: rgba(56, 189, 248, 0.55); color: #38bdf8;
}}
.playback-controls {{ display: flex; align-items: center; gap: 6px; }}
.play-btn {{
  background: linear-gradient(135deg, #0284c7, #2563eb); border: none; color: #fff;
  padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
}}
.reset-btn {{
  background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.15);
  color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;
}}
.dock-sliders-row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }}
.slider-cell {{
  background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px; padding: 5px 10px; display: flex; flex-direction: column; gap: 4px;
}}
.slider-header {{ display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; }}
.slider-label {{ color: #cbd5e1; font-weight: 500; }}
.slider-value-pill {{
  color: #38bdf8; font-family: ui-monospace, monospace; font-weight: 700;
  background: rgba(56, 189, 248, 0.12); padding: 1px 6px; border-radius: 4px;
}}
.range-slider {{
  -webkit-appearance: none; appearance: none; width: 100%; height: 5px;
  background: rgba(255, 255, 255, 0.12); border-radius: 3px; outline: none;
}}
.range-slider::-webkit-slider-thumb {{
  -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%;
  background: #38bdf8; cursor: pointer; box-shadow: 0 0 8px rgba(56, 189, 248, 0.8);
}}
@keyframes fadeIn {{ from {{ opacity: 0; transform: translateY(4px); }} to {{ opacity: 1; transform: translateY(0); }} }}
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
    custom: {{}}
  }};

  // --- Specifications ---
  const SPEC_PRESETS = {presets_js};
  const SPEC_READOUTS = {readouts_js};
  const SPEC_COMPONENTS = {components_js};
  const SPEC_GRAPH = {graph_js};

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

  // --- Sliders & UI Wiring ---
  {chr(10).join(f"""
  const s_{p['key']} = document.getElementById('slider_{p['key']}');
  const v_{p['key']} = document.getElementById('val_{p['key']}');
  if (s_{p['key']}) {{
    s_{p['key']}.addEventListener('input', (e) => {{
      state.params['{p['key']}'] = parseFloat(e.target.value);
      if (v_{p['key']}) v_{p['key']}.textContent = e.target.value + ' {p.get('unit', '')}';
      playClick(550 + state.params['{p['key']}'] * 2);
      updateTelemetry();
    }});
  }}""" for p in params)}

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
          const v = document.getElementById('val_' + k);
          if (s) s.value = val;
          if (v) v.textContent = val + ' ' + (s.dataset.unit || '');
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
  }}

  // --- Play/Pause & Reset ---
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {{
    playBtn.addEventListener('click', () => {{
      state.isPlaying = !state.isPlaying;
      playBtn.textContent = state.isPlaying ? '⏸ Pause' : '▶ Play';
      playClick(720);
    }});
  }}
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {{
    resetBtn.addEventListener('click', () => {{
      const defaultP = SPEC_PRESETS[0];
      if (defaultP) presetPills[0].click();
      state.time = 0;
      playClick(440);
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

    requestAnimationFrame(loop);
  }}

  updateTelemetry();
  requestAnimationFrame(loop);
}})();
</script>
</body>
</html>"""
