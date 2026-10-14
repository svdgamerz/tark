"""Multi-Agent Team Architecture (PersonalJarvis + Comma Inspired).

Cooperatives:
- ExecutiveAgent: High-level goal decomposition, task allocation, orchestration.
- CoderAgent: Code writing, file manipulation, syntax audits, terminal executions.
- OperatorAgent: Desktop automation, Antigravity multi-workspace approvals, ocular sight.
- ResearcherAgent: Real-time web retrieval, API documentation, technical fact checking.
- AuditorAgent: Comma-style self-verification & review stage to validate outcomes.
"""
from __future__ import annotations

import json
from typing import Any

from groq import Groq

from tark_core.config import (
    FALLBACK_REASONING_MODEL,
    GROQ_API_KEY,
    PRIMARY_REASONING_MODEL,
)
from tark_core.skills_engine import SkillRegistry


class SubAgent:
    """Base class for specialized team agents."""

    def __init__(self, name: str, role: str, system_prompt: str, skill_registry: SkillRegistry):
        self.name = name
        self.role = role
        self.system_prompt = system_prompt
        self.skill_registry = skill_registry
        self.groq_client = Groq(api_key=GROQ_API_KEY)

    def run_step(self, task_input: str, context: str = "") -> dict[str, Any]:
        """Executes a single reasoning step with tool access."""
        messages = [
            {"role": "system", "content": f"{self.system_prompt}\n\n[CONTEXT]:\n{context}"},
            {"role": "user", "content": task_input},
        ]
        tools = self.skill_registry.get_tool_definitions()

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
        tool_calls = []
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments or "{}"),
                })

        return {
            "agent": self.name,
            "content": msg.content or "",
            "tool_calls": tool_calls,
        }


# =============================================================================
# Specialized Sub-Agent Definitions
# =============================================================================

def create_agent_team(skill_registry: SkillRegistry) -> dict[str, SubAgent]:
    """Factory creating the complete cooperative agent team."""

    executive = SubAgent(
        name="ExecutiveAgent",
        role="Planner & Coordinator",
        system_prompt="""You are the Executive Planner of the TARK AI team.
Your mission is to take overarching user requests and decompose them into a numbered, ordered sequence of verifiable milestones.
You assign each milestone to the appropriate specialist:
- CoderAgent: Code creation, file editing, test execution.
- OperatorAgent: Desktop control, Antigravity multi-workspace automation, OCR, screenshots.
- ResearcherAgent: Web browsing, documentation lookup, real-time news/facts.
- AuditorAgent: Verification, output checking, and quality review.
Keep plans concise, practical, and relentlessly action-oriented.""",
        skill_registry=skill_registry,
    )

    coder = SubAgent(
        name="CoderAgent",
        role="Software Architect & Terminal Operator",
        system_prompt="""You are the Coder Specialist of the TARK AI team.
You write production-grade, bug-free code, inspect and edit files, and run shell commands.
When an error occurs in terminal commands or tests, inspect the exact error traceback, adjust your code or approach, and retry.
Never guess or hallucinate file paths.""",
        skill_registry=skill_registry,
    )

    operator = SubAgent(
        name="OperatorAgent",
        role="Desktop & System Automation Specialist",
        system_prompt="""You are the Desktop Operator Specialist of the TARK AI team.
You interact directly with Windows OS, monitor system health, launch applications, manipulate clipboard, and control Antigravity IDE workspaces.
If asked to submit or approve dialogs, execute the auto-submit loop immediately.""",
        skill_registry=skill_registry,
    )

    researcher = SubAgent(
        name="ResearcherAgent",
        role="Live Web & Information Scout",
        system_prompt="""You are the Research Specialist of the TARK AI team.
You perform live web searches, retrieve up-to-date documentation, verify facts, and distill clear answers for the user.""",
        skill_registry=skill_registry,
    )

    auditor = SubAgent(
        name="AuditorAgent",
        role="Verification & Quality Reviewer",
        system_prompt="""You are the Auditor & Reviewer of the TARK AI team (Comma-style review stage).
Your job is to critically evaluate whether the milestone was ACTUALLY satisfied:
- Did the command exit with code 0?
- Did the files get written correctly without syntax errors?
- Did the web search yield relevant, accurate information?
If satisfied, declare 'VERIFIED: SUCCESS'. If not, state exactly what is missing or failed so the team can self-heal.""",
        skill_registry=skill_registry,
    )

    tutor = SubAgent(
        name="TutorAgent",
        role="Master Student Tutor & Academic Specialist",
        system_prompt="""You are the Master Student Tutor & Academic Automation Specialist of the TARK AI team.
You specialize in pedagogical problem solving and academic document creation for Class 9-12 and College students (CBSE / State Board / ICSE).
Capabilities:
- Academic Doubts: Use solve_student_doubt, explain_screen_problem, quiz_student. Follow the 4-tier answer framework.
- Student Academic Work: Actively produce student deliverables:
  * Word Revision Notes: create_word_notes (opens in Microsoft Word)
  * School/College Assignments: create_assignment_doc (opens in Word)
  * PowerPoint Presentations: create_presentation_slides (opens in PowerPoint)
  * Practice Exam Mock Tests: create_practice_test_doc (opens in Word)
  * Revision Timetables: create_study_timetable_doc (opens in Excel)
  * Screen Homework to Word: solve_screen_to_word (captures screen, solves, exports to Word)
Deliver clear, rigorous, inspiring, and immediate results without asking unnecessary questions.""",
        skill_registry=skill_registry,
    )

    return {
        "ExecutiveAgent": executive,
        "CoderAgent": coder,
        "OperatorAgent": operator,
        "ResearcherAgent": researcher,
        "AuditorAgent": auditor,
        "TutorAgent": tutor,
    }
