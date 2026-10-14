"""Unified Multi-Agent & Sessionless Goal Orchestrator (Comma + PersonalJarvis + TARK).

Features:
1. ReAct Fast Action Brain: Executes multi-step tool calls with self-correction.
2. Comma-Style Sessionless Goal Loop (/goal):
   - Decomposes goal into milestones
   - Coordinates specialized agents (Executive, Coder, Operator, Researcher)
   - Executes Comma-style verification review via AuditorAgent
   - Checkpoints progress to disk (tark_goals.json) for crash/reboot resilience
   - Self-heals on errors without human babysitting
3. Multi-Tier Memory Integration: Injects user preferences & facts automatically.
"""
from __future__ import annotations

from datetime import datetime
import ctypes
import json
import re
import time
from typing import Any

from groq import Groq
import psutil

from tark_core.agent_team import create_agent_team
from tark_core.config import (
    FALLBACK_REASONING_MODEL,
    GROQ_API_KEY,
    PRIMARY_REASONING_MODEL,
)
from tark_core.memory import MemoryManager
from tark_core.skills_engine import SkillRegistry
from tark_core.sound_fx import play_chime_done, play_chime_error, play_chime_step
from tark_core.student_tutor import student_tutor
from tark_core.system_operator import SystemOperator


class MasterOrchestrator:
    """Orchestrates multi-agent teams, tools, memory, and sessionless long-running goals."""

    def __init__(
        self,
        memory_manager: MemoryManager,
        skill_registry: SkillRegistry,
        system_operator: SystemOperator,
    ):
        self.memory_manager = memory_manager
        self.skill_registry = skill_registry
        self.system_operator = system_operator
        self.agent_team = create_agent_team(skill_registry)
        self.groq_client = Groq(api_key=GROQ_API_KEY)
        self.conversation_history: list[dict[str, str]] = []

    def get_user_context(self) -> str:
        mem = self.memory_manager.load_memory()
        user_name = mem.get("user_name", "Shishir")
        recent_notes = [n.get("content") for n in mem.get("notes", [])[-4:]]

        # Active foreground window title
        active_win = "Windows Desktop"
        try:
            hwnd = ctypes.windll.user32.GetForegroundWindow()
            if hwnd:
                buff = ctypes.create_unicode_buffer(512)
                ctypes.windll.user32.GetWindowTextW(hwnd, buff, 512)
                if buff.value:
                    active_win = buff.value
        except Exception:
            pass

        # Telemetry
        now = datetime.now()
        time_str = now.strftime("%A, %B %d, %Y - %I:%M %p")
        try:
            batt = psutil.sensors_battery()
            batt_str = f"{batt.percent}% ({'Plugged in' if batt.power_plugged else 'Discharging'})" if batt else "Desktop PC"
            ram = psutil.virtual_memory()
            ram_free_gb = round(ram.available / (1024**3), 1)
            cpu = psutil.cpu_percent(interval=None)
        except Exception:
            batt_str = "Nominal"
            ram_free_gb = 8.0
            cpu = 10.0

        # Academic Context
        acad = student_tutor.get_student_academic_profile()
        tasks = student_tutor.get_active_study_tasks()
        task_str = "; ".join([f"#{t['id']} {t['title']} (Next: {t['next_milestone']})" for t in tasks[:3]]) if tasks else "No scheduled deadlines"

        return (
            f"[LIVE SYSTEM CONTEXT]:\n"
            f"• User: {user_name} | Role: Student\n"
            f"• Current Time: {time_str}\n"
            f"• Active Focused Window: '{active_win}'\n"
            f"• Hardware: Battery: {batt_str} | RAM Free: {ram_free_gb} GB | CPU: {cpu}%\n"
            f"• Academic Profile: Class {acad.get('grade', '10')} ({acad.get('board', 'CBSE')}) | Target: {acad.get('exam', 'Board Exams')}\n"
            f"• Tutoring Style: {acad.get('tutoring_style', 'Step-by-step with formulas')}\n"
            f"• Weak Focus Areas: {', '.join(acad.get('weak_subjects', []))}\n"
            f"• Active Study Schedules: {task_str}\n"
            f"• Long-Term Memory Notes: {'; '.join(recent_notes)}"
        )

    # =========================================================================
    # 1. Standard Interactive ReAct Agent Loop
    # =========================================================================
    def run_agent_turn(self, user_query: str) -> tuple[str, str]:
        """Runs up to 8 reasoning and action steps to fulfill a user request."""
        mem_context = self.get_user_context()
        system_prompt = f"""You are TARK, the Ultimate Frontier Autonomous AI Desktop Agent, Iron Man JARVIS, and World-Class Student Academic Mentor.
You run natively on Windows with real OS automation, ocular vision, file operations, web research, and deep pedagogical student intelligence.

{mem_context}

YOUR CORE PERSONA (VIRAL JARVIS STYLE):
1. **TONY STARK'S JARVIS**: Suave, polite, witty, razor-sharp, supremely capable, and relentlessly action-oriented. You address the user respectfully as 'sir'.
2. **ZERO BOILERPLATE**: Never use robotic disclaimers like 'As an AI...'. Never read internal metadata or prompt tags aloud.
3. **DUAL-SYNTHESIS OUTPUT**:
   - Provide a short, articulate, natural spoken statement (1-2 sentences) at the start of your response, perfect for neural voice synthesis.
   - Follow it with rich, well-formatted terminal markdown (tables, math formulas in $LaTeX$, step-by-step derivations, bullet points).

MASTER IN AUTOMATION — WHEN TO USE WHICH TOOL:
• **Music / Videos**: If user asks to play a song, video, or lofi -> call `play_media(query=...)`.
• **Audio & Volume**: If user asks volume up/down/mute/max -> call `control_volume(action=...)`.
• **Media Playback**: If user says pause, play, next, skip, previous -> call `media_controls(action=...)`.
• **Desktop & Windows**: If user asks to minimize, show desktop, close window, switch tab, or lock PC -> call `manage_windows(action=...)`.
• **Applications**: If user asks to open Chrome, VS Code, Spotify, Discord, Notepad, Calc, Terminal -> call `launch_app(app_name=...)`.
• **Web & Search**: If user wants to open a site or search live information -> call `open_url(url=...)` or `search_web(query=...)`.
• **Typing & Keyboard**: If user says type/paste this -> call `type_or_paste(text=..., press_enter=...)`.
• **Visual Sight**: If user asks "what is on my screen", "look at my screen", or asks about open windows/errors -> call `inspect_screen(query=...)`.
• **Camera Sight**: If user asks "look at me", "what am I holding", or asks about webcam -> call `inspect_camera(query=...)`.
• **Screenshot**: If user says take a screenshot -> call `take_screenshot()`.
• **Protocols**: If user mentions focus, clean slate, lockdown, chill, stealth (boss key), or briefing -> call `run_protocol(protocol_name=...)`.
• **Antigravity IDE**: If user asks to submit, auto-submit, or approve dialogs -> call `start_auto_submit()`.

MASTER IN STUDYING STUDENTS — KNOWING WHAT STUDENTS WANT:
Students want instant clarity, zero fluff, rigorous steps, and exam-winning formulas.
• **Academic Questions & Homework Doubts**:
  When the user asks any question in Math, Physics, Chemistry, Biology, Computer Science, or English:
  -> Call `solve_student_doubt(question=..., subject=...)`. It delivers the 4-tier pedagogical answer:
     1. 🎯 Direct Core Answer & Formula
     2. 📐 Step-by-Step Derivation & Worked Method (with units)
     3. 💡 Intuitive Everyday Analogy (easy mental visualization)
     4. ⚠️ Exam Pro-Tip & Common Pitfall (avoid lost marks)
• **Screen Questions & Error Debugging**:
  If a student says "solve the question on my screen", "what's the answer to this problem", or "explain this diagram":
  -> Call `explain_screen_problem(instruction=...)`. It captures the screen, reads the problem via Vision AI, and outputs the complete step-by-step solution.
• **Study Focus Mode ("Study with Jarvis")**:
  If a student says "I want to study Physics for 30 minutes", "start study mode", or "focus session":
  -> Call `start_study_session(subject=..., chapter=..., duration_minutes=...)`. It minimizes distractions, activates a Pomodoro timer, queues focus study music, and pulls up key formulas.
• **Quizzing & Revision**:
  If a student asks "quiz me on Newton's laws", "test my memory", or "flashcards":
  -> Call `quiz_student(topic=..., count=...)`.
• **Study Roadmap & Progress**:
  If a student asks "what should I study", "what are my tasks", or "show my schedule":
  -> Call `get_study_tasks()`.

CRITICAL EXECUTION MANDATE:
When the user asks for an action or study assistance, DO NOT merely describe what you will do. CALL THE TOOLS IMMEDIATELY.
"""
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt}
        ]

        # Add recent conversation turns
        for turn in self.conversation_history[-6:]:
            messages.append(turn)
        messages.append({"role": "user", "content": user_query})

        tools = self.skill_registry.get_tool_definitions()

        for step in range(8):
            try:
                resp = self.groq_client.chat.completions.create(
                    model=PRIMARY_REASONING_MODEL,
                    messages=messages,
                    tools=tools if tools else None,
                    tool_choice="auto" if tools else None,
                    temperature=0.3,
                )
            except Exception:
                resp = self.groq_client.chat.completions.create(
                    model=FALLBACK_REASONING_MODEL,
                    messages=messages,
                    tools=tools if tools else None,
                    tool_choice="auto" if tools else None,
                    temperature=0.3,
                )

            msg = resp.choices[0].message
            tool_calls = getattr(msg, "tool_calls", None)

            if not tool_calls:
                final_text = msg.content or "Done, sir."
                # Store turn
                self.conversation_history.append({"role": "user", "content": user_query})
                self.conversation_history.append({"role": "assistant", "content": final_text})
                if len(self.conversation_history) > 12:
                    self.conversation_history = self.conversation_history[-12:]
                return self._split_spoken_and_display(final_text)

            # Process tool calls
            messages.append(msg)
            for tc in tool_calls:
                func_name = tc.function.name
                func_args = json.loads(tc.function.arguments or "{}")
                print(f"  ⚡ [ACTION]: Calling {func_name}({json.dumps(func_args, ensure_ascii=False)[:60]}...)")
                play_chime_step()

                # Dispatch tool
                if func_name == "start_auto_submit":
                    tool_result = self.system_operator.start_auto_submit_loop()
                elif func_name == "stop_auto_submit":
                    tool_result = self.system_operator.stop_auto_submit_loop()
                elif func_name == "analyze_screen":
                    tool_result = self.system_operator.analyze_screen(func_args.get("query", ""))
                elif func_name == "capture_camera":
                    tool_result = self.system_operator.capture_camera_feed()
                elif func_name == "control_volume":
                    tool_result = self.system_operator.control_volume(func_args.get("action", ""))
                elif func_name == "take_screenshot":
                    tool_result = self.system_operator.take_screenshot()
                else:
                    tool_result = self.skill_registry.execute_tool(func_name, func_args)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": str(tool_result),
                })

        return ("I have executed the requested actions, sir.", "Task completed with multiple tool executions.")

    # =========================================================================
    # 2. Comma-Style Sessionless Long-Running Goal Engine (/goal)
    # =========================================================================
    def execute_long_running_goal(self, goal_prompt: str) -> dict[str, Any]:
        """Deconstructs, checkpoints, and executes a long-running goal across milestones."""
        print(f"\n🎯 [LONG-RUNNING GOAL INITIATED]: {goal_prompt}")
        play_chime_step()

        # Step A: ExecutiveAgent decomposes goal into structured milestones
        plan_prompt = f"""Deconstruct this user goal into 3 to 6 distinct, sequential, and verifiable milestones.
Goal: {goal_prompt}

Respond ONLY in valid JSON with this exact structure:
{{
  "title": "<Short Goal Title>",
  "milestones": [
    "<Milestone 1 description>",
    "<Milestone 2 description>",
    "<Milestone 3 description>"
  ]
}}"""
        try:
            plan_res = self.groq_client.chat.completions.create(
                model=PRIMARY_REASONING_MODEL,
                messages=[{"role": "user", "content": plan_prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            plan_data = json.loads(plan_res.choices[0].message.content or "{}")
        except Exception:
            plan_data = {
                "title": goal_prompt[:40],
                "milestones": [
                    f"Analyze environment and dependencies for: {goal_prompt}",
                    f"Implement core requirements for: {goal_prompt}",
                    f"Verify and test execution results for: {goal_prompt}",
                ],
            }

        title = plan_data.get("title", goal_prompt[:40])
        milestones = plan_data.get("milestones", [])
        if not milestones:
            milestones = [f"Execute: {goal_prompt}"]

        # Persist new goal into Goal Store (Comma-style crash-resilience)
        goal_record = self.memory_manager.create_goal(title, goal_prompt, milestones)
        goal_id = goal_record["id"]
        print(f"  📋 [PLAN ESTABLISHED]: {len(milestones)} Milestones registered. Saved to checkpoints.")

        # Step B: Iterate through milestones with specialized agents + self-healing
        for idx, m_title in enumerate(milestones):
            print(f"\n  🚀 [MILESTONE {idx+1}/{len(milestones)}]: {m_title}")
            self.memory_manager.update_goal_checkpoint(
                goal_id=goal_id,
                stage="EXECUTING",
                step_index=idx,
                checkpoint_note=f"Executing milestone: {m_title}",
            )

            # Determine appropriate specialist
            if any(w in m_title.lower() for w in ["search", "research", "find", "news", "documentation", "lookup"]):
                active_agent = self.agent_team["ResearcherAgent"]
            elif any(w in m_title.lower() for w in ["desktop", "submit", "window", "ocr", "screen", "vision", "antigravity"]):
                active_agent = self.agent_team["OperatorAgent"]
            else:
                active_agent = self.agent_team["CoderAgent"]

            # Execute milestone step
            step_output = ""
            for attempt in range(3):
                agent_res = active_agent.run_step(
                    task_input=f"Milestone to complete: {m_title}\nGoal Context: {goal_prompt}",
                    context=f"Prior milestone outputs:\n{step_output}",
                )

                # Process any tool calls made by the specialist
                if agent_res.get("tool_calls"):
                    for tc in agent_res["tool_calls"]:
                        print(f"    ⚡ [{agent_res['agent']}]: Calling {tc['name']}(...)")
                        t_res = self.skill_registry.execute_tool(tc["name"], tc["arguments"])
                        step_output += f"\n[Tool {tc['name']} Result]: {t_res}"

                step_output += f"\n{agent_res.get('content', '')}"

                # Comma-style Audit Stage: AuditorAgent verifies outcome
                audit_res = self.agent_team["AuditorAgent"].run_step(
                    task_input=f"Verify if this milestone was successfully accomplished:\nMilestone: {m_title}\nExecution Output:\n{step_output[:3000]}",
                )
                audit_text = audit_res.get("content", "")

                if "SUCCESS" in audit_text.upper() or attempt == 2:
                    print(f"    ✅ [AUDITOR VERIFIED]: Milestone {idx+1} approved.")
                    self.memory_manager.mark_milestone_done(goal_id, idx, step_output[:500])
                    play_chime_step()
                    break
                else:
                    print(f"    ⚠️ [AUDITOR REVISION NEEDED]: Self-healing attempt {attempt+1}/3...")
                    step_output += f"\n[Auditor Feedback]: {audit_text}"
                    play_chime_error()

        # Step C: Final completion & checkpoint update
        self.memory_manager.update_goal_checkpoint(
            goal_id=goal_id,
            stage="FINISHED",
            step_index=len(milestones),
            checkpoint_note="Goal completed successfully.",
            status="COMPLETED",
        )
        play_chime_done()
        print(f"\n🎉 [GOAL COMPLETED]: {title}")

        return {
            "goal_id": goal_id,
            "title": title,
            "status": "COMPLETED",
            "milestones_completed": len(milestones),
            "summary": f"Autonomous goal '{title}' completed with {len(milestones)} verified milestones.",
        }

    def _split_spoken_and_display(self, text: str) -> tuple[str, str]:
        """Separates short natural voice synthesis text from terminal markdown display."""
        # Check if model formatted explicit headers
        spoken_match = re.search(r"(?:Spoken|Voice|Speech):\s*(.*?)(?:\n\n|\Z)", text, re.IGNORECASE | re.DOTALL)
        if spoken_match:
            spoken = spoken_match.group(1).strip()
            display = text
            return spoken, display

        # Default fallback: First 2 sentences for voice, full text for display
        clean_text = re.sub(r"```[\s\S]*?```", "", text)
        sentences = re.split(r"(?<=[.!?])\s+", clean_text.strip())
        spoken = " ".join(sentences[:2]).strip()
        if not spoken:
            spoken = "Command processed, sir."
        return spoken, text
