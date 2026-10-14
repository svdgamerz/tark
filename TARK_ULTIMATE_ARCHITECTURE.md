# 🧠 TARK ULTIMATE — Omni-Agent AI Architecture

> **Synthesizing the Best of PersonalJarvis, OpenClaw, Comma, and Mark-XL into the Ultimate Autonomous AI Desktop Assistant.**

---

## 🏛️ Architecture Overview

TARK Ultimate combines the distinctive strengths of the top open-source AI assistant repositories into a single, cohesive engine:

```
                                  ┌───────────────────────────────┐
                                  │       USER INTERACTION        │
                                  │  Voice • CLI • Gateway REST   │
                                  └───────────────┬───────────────┘
                                                  │
                                                  ▼
                         ┌─────────────────────────────────────────────────┐
                         │              MASTER ORCHESTRATOR                │
                         │   Fast-Path Reflexes  •  /goal Autonomous Loop  │
                         └───────┬─────────────────┬─────────────────┬─────┘
                                 │                 │                 │
                ┌────────────────┴────┐            │       ┌─────────┴──────────┐
                ▼                     ▼            ▼       ▼                    ▼
     ┌────────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
     │  ExecutiveAgent    │ │   CoderAgent     │ │  OperatorAgent   │ │  AuditorAgent    │
     │  (Goal Planner)    │ │ (File/Code/Term) │ │ (Desktop/Vision) │ │ (Comma Verifier) │
     └────────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
                │                     │                    │                    │
                └─────────────────────┼────────────────────┼────────────────────┘
                                      │
                                      ▼
             ┌────────────────────────────────────────────────────────┐
             │                  DYNAMIC SKILL REGISTRY                │
             │   Built-in Tools  +  Auto-discovered skills/*.py       │
             └────────┬───────────────────────┬──────────────────────┬┘
                      │                       │                      │
                      ▼                       ▼                      ▼
           ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
           │   SYSTEM OPERATOR    ││    3-TIER MEMORY     ││  OPENCLAW GATEWAY    │
           │ Win32 Direct Post    ││ Working Context      ││ REST API on :8999    │
           │ Antigravity Multi-WS ││ tark_memory.json     ││ /v1/chat, /v1/goal   │
           │ Screen & Camera Vision││ tark_goals.json     ││ Remote Webhooks      │
           └──────────────────────┘└──────────────────────┘└──────────────────────┘
```

---

## 🏆 Repository Synthesis Matrix

| Capability | Originating Repo | TARK Ultimate Implementation |
| :--- | :--- | :--- |
| **Multi-Agent Team** | **PersonalJarvis** (`PersonalJarvis/PersonalJarvis`) | `ExecutiveAgent`, `CoderAgent`, `OperatorAgent`, `ResearcherAgent`, and `AuditorAgent` collaborating concurrently (`tark_core/agent_team.py`). |
| **Dynamic Skills Engine** | **OpenClaw** (`openclaw/openclaw`) | Automatic plugin discovery from `skills/` directory (`tark_core/skills_engine.py`). Add any Python script with `register_skills(registry)` to expand capabilities. |
| **Multi-Channel Bridge** | **OpenClaw** (`openclaw/openclaw`) | Lightweight background REST API & Webhook gateway (`tark_core/channel_bridge.py`) on `http://127.0.0.1:8999` for mobile and remote control. |
| **Sessionless Goal Engine** | **Comma** (`AFK-surf/Comma`) | Persistent `/goal` workflow with milestone DAG decomposition, crash-resilient checkpoints in `tark_goals.json`, and `/goal resume` support. |
| **Auditor Review Stage** | **Comma** (`AFK-surf/Comma`) | Comma-style verification loop where `AuditorAgent` validates execution outputs and triggers self-healing on failure before marking milestones complete. |
| **Ocular Sight & OCR** | **Mark-XL** + **TARK Core** | LLaMA 3.2 11B Vision on NVIDIA NIM for screen & camera inspection + native Windows OCR (`winsdk.windows.media.ocr`). |
| **Background Win32 Post** | **TARK Core** | Direct Win32 `PostMessageW` event injection into `Chrome_RenderWidgetHostHWND` with zero mouse cursor movement and zero focus disruption. |
| **Antigravity Multi-WS** | **TARK Core** | Parallel discovery of all open Antigravity IDE workspaces, approving permission dialogs and pulsing prompt submits across all windows. |
| **Procedural Sci-Fi Audio** | **Mark-XL** (`FatihMakes/Mark-XL`) | Pure mathematical sine-wave synthesized Iron Man HUD audio chimes and boot tones with zero disk I/O latency. |

---

## 🚀 How to Use TARK Ultimate

### 1. Launching the Assistant
Run via console or double-click:
```powershell
.\run_tark.bat
```
Or execute directly with Python 3.12:
```powershell
py -3.12 tark.py
```

### 2. Using the Comma-Style `/goal` Engine
Give TARK high-level, long-running missions:
```text
/goal build a python script that fetches the latest news and saves a summary to Desktop
```
* **Step 1:** `ExecutiveAgent` deconstructs the goal into 3–6 verifiable milestones.
* **Step 2:** Specialized agents (`CoderAgent`, `OperatorAgent`, `ResearcherAgent`) execute each step.
* **Step 3:** `AuditorAgent` reviews the results. If errors occur, it initiates self-healing loops automatically.
* **Step 4:** Checkpoints are stored in `tark_goals.json`. If you shut down your PC, simply launch TARK and type:
```text
/goal resume
```

### 3. OpenClaw REST Gateway (`http://127.0.0.1:8999`)
You can now control TARK remotely from mobile devices, curl, or external webhooks:
* **Health Check:**
  ```bash
  curl http://127.0.0.1:8999/health
  ```
* **Send Chat / Voice Command:**
  ```bash
  curl -X POST http://127.0.0.1:8999/v1/chat -H "Content-Type: application/json" -d '{"query": "what is on my clipboard"}'
  ```
* **Launch Long-Running Goal Remotely:**
  ```bash
  curl -X POST http://127.0.0.1:8999/v1/goal -H "Content-Type: application/json" -d '{"prompt": "Audit git repository status"}'
  ```
* **Query Active Goal Status:**
  ```bash
  curl http://127.0.0.1:8999/v1/goal/status
  ```
* **Toggle Antigravity Multi-Workspace Auto-Submit:**
  ```bash
  curl -X POST http://127.0.0.1:8999/v1/autosubmit -H "Content-Type: application/json" -d '{"enable": true}'
  ```

### 4. Adding Custom Skills (OpenClaw Style)
Drop any new `.py` file into the `skills/` folder:
```python
# skills/my_custom_tool.py
def register_skills(registry):
    def my_tool(param: str) -> str:
        return f"Processed {param}"

    registry.register(
        name="my_tool",
        description="Description for LLM function calling",
        parameters={
            "type": "object",
            "properties": {"param": {"type": "string"}},
            "required": ["param"]
        },
        func=my_tool,
        category="custom"
    )
```
TARK auto-discovers and exposes it to all agents on startup with zero configuration changes!
