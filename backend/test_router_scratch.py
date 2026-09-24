import asyncio
import json
import urllib.parse
import requests
from app.router.gemini_adapter import GeminiAdapter
from app.config.settings import Settings
from app.router.base import Message

s = Settings()
key = s.tavily_api_keys[0] if s.tavily_api_keys else ""

test_plans = [
    {
        "subject": "Human Heart Anatomy",
        "view": "Internal coronal cross-section showing all 4 chambers, valves, and major blood vessels",
        "labels": ["Superior Vena Cava", "Aorta", "Pulmonary Artery", "Pulmonary Veins", "Left Atrium", "Right Atrium", "Left Ventricle", "Right Ventricle", "Tricuspid Valve", "Bicuspid (Mitral) Valve", "Septum"],
        "search_query": "human heart internal cross section labelled diagram textbook"
    },
    {
        "subject": "Nephron",
        "view": "Overall structure including Bowman capsule, glomerulus, tubule, loop of Henle, collecting duct",
        "labels": ["Glomerulus", "Bowman Capsule", "Proximal Convoluted Tubule", "Loop of Henle", "Distal Convoluted Tubule", "Collecting Duct"],
        "search_query": "labelled diagram of nephron structure textbook"
    },
    {
        "subject": "DC Electric Motor",
        "view": "Schematic diagram showing armature, commutator, brushes, magnets",
        "labels": ["Permanent Magnets", "Armature Coil", "Commutator Split Rings", "Carbon Brushes", "Battery"],
        "search_query": "labelled diagram working principle of DC electric motor textbook"
    }
]

for p in test_plans:
    sq = p["search_query"]
    print("Testing:", p["subject"])
    if key:
        try:
            res = requests.post("https://api.tavily.com/search", json={
                "api_key": key,
                "query": sq,
                "include_images": True,
                "max_results": 3
            }, timeout=8)
            imgs = res.json().get("images", [])
            print(f"  Found {len(imgs)} Tavily images:")
            for img in imgs[:2]:
                print("   ", img)
        except Exception as e:
            print("  Tavily error:", e)

    lbls = ", ".join(p["labels"][:8])
    flux_prompt = f"Clean educational textbook diagram of {p['subject']} showing {p['view']} with clear labels: {lbls}. Labeled scientific illustration, high resolution, white background, bold legible English text labels with pointer lines, textbook style"
    flux_url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(flux_prompt)}?model=flux&width=1024&height=768&nologo=true"
    print("  Flux URL preview:", flux_url[:90] + "...")
    print()
