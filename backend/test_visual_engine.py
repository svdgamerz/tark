import asyncio
import sys

# Force UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from app.main import _make_figure
from app.diagrams.render import wants_diagram

TEST_CASES = [
    ("Biology: Human Heart", "explain me heart with a neat labelled diagram"),
    ("Biology: Nephron", "structure of nephron with labelled parts"),
    ("Biology: Plant Cell", "can you show a neat labelled diagram of plant cell"),
    ("Physics: Electric Motor", "electric motor working and labelled diagram"),
    ("Physics: Prism Refraction", "refraction of light through glass prism labelled diagram"),
    ("Chemistry: Galvanic Cell", "electrochemical galvanic cell labelled diagram showing anode and cathode"),
    ("Chemistry: Blast Furnace", "blast furnace labelled diagram for iron extraction"),
    ("Geography: Earth Layers", "layers of the earth labelled cross section diagram"),
    ("Geography: Volcano", "volcano cross section showing magma chamber and vent diagram"),
    ("Mathematics: Function Plot", "plot graph of y = x**2 - 4")
]

async def run_tests():
    print("==================================================")
    print("TESTING TARK VISUAL DIAGRAM & IMAGE ENGINE")
    print("==================================================\n")
    
    passed = 0
    for category, prompt in TEST_CASES:
        print(f"[{category}]")
        print(f"  Prompt: '{prompt}'")
        
        # Check intent detection
        is_wanted = wants_diagram(prompt)
        print(f"  wants_diagram: {is_wanted}")
        if not is_wanted:
            print("  FAIL: Prompt not recognized as visual intent!\n")
            continue
            
        # Run visual figure engine
        fig = await _make_figure(prompt)
        if not fig:
            print("  FAIL: Engine returned no figure!\n")
            continue
            
        event = fig.get("event")
        data_url = fig.get("data_url", "")
        code = fig.get("code", "")
        
        if event == "figure":
            print(f"  SUCCESS: Event 'figure' (Image/Diagram)")
            print(f"  URL: {data_url[:95]}...")
            passed += 1
        elif event == "figure_mermaid":
            print(f"  SUCCESS: Event 'figure_mermaid' (Mermaid Flowchart)")
            print(f"  Code: {code[:60]}...")
            passed += 1
        else:
            print(f"  WARNING Unknown event: {event}")
            
        print()
        
    print("==================================================")
    print(f"RESULTS: {passed}/{len(TEST_CASES)} PASSED")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
