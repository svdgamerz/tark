"""API router for Study Planner, Tasks, and AI Schedule Generation.
"""
from __future__ import annotations

import datetime
import json
import logging
import re
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from app.auth.security import decode_token
from app.config.settings import Settings
from app.tasks.store import TaskStore
from app.router.prompt_engineer import PromptOptimizer

logger = logging.getLogger("tark.tasks")


class GeneratePlanReq(BaseModel):
    track: str = Field(pattern="^(coursework|exam|research|page_by_page)$")
    answers: dict[str, Any]
    user_context: dict[str, Any] | None = None


class MilestoneItem(BaseModel):
    id: str
    title: str
    target_date: str = ""
    completed: bool = False
    notes: str = ""
    study_topic: str = ""
    textbook_source: str = ""
    page_number: int | None = None
    chapter: str = ""


class CreateTaskReq(BaseModel):
    track: str = Field(pattern="^(coursework|exam|research|page_by_page)$")
    title: str
    details: dict[str, Any]
    milestones: list[MilestoneItem]


class ToggleMilestoneReq(BaseModel):
    completed: bool | None = None


def parse_timeframe_info(answers: dict[str, Any], track: str) -> dict[str, Any]:
    today = datetime.date.today()
    target_str = str(
        answers.get("deadline")
        or answers.get("exam_date")
        or answers.get("target_date")
        or answers.get("timeline")
        or answers.get("date")
        or ""
    ).strip()

    exam_time = str(answers.get("exam_time") or "").strip()
    is_hourly = bool(answers.get("is_hourly"))

    total_days: int | None = None
    target_date_obj: datetime.date | None = None

    if answers.get("calculated_days") is not None and isinstance(answers["calculated_days"], (int, float)):
        total_days = max(0, int(answers["calculated_days"]))

    # 1. ISO format (YYYY-MM-DD)
    if total_days is None and target_str:
        try:
            target_date_obj = datetime.date.fromisoformat(target_str)
            diff = (target_date_obj - today).days
            total_days = max(0, diff)
        except ValueError:
            pass

    # 2. Text date like "30 September", "September 30", "30-09-2026"
    if total_days is None and target_str:
        months = {
            "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
            "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12
        }
        m = re.search(r"(\d{1,2})[\s\-\/]+([a-zA-Z]{3,9})[\s\-\/]*(\d{2,4})?", target_str)
        if not m:
            m = re.search(r"([a-zA-Z]{3,9})[\s\-\/]+(\d{1,2})[\s\-\/]*(\d{2,4})?", target_str)
            if m:
                mon_str, day_str, year_str = m.group(1).lower()[:3], m.group(2), m.group(3)
            else:
                mon_str = None
        else:
            day_str, mon_str, year_str = m.group(1), m.group(2).lower()[:3], m.group(3)

        if mon_str and mon_str in months:
            mon = months[mon_str]
            day = int(day_str)
            year = int(year_str) if year_str else (
                today.year if datetime.date(today.year, mon, day) >= today else today.year + 1
            )
            try:
                target_date_obj = datetime.date(year, mon, day)
                diff = (target_date_obj - today).days
                total_days = max(0, diff)
            except ValueError:
                pass

    # 3. Duration expressions like "20 days", "3 weeks", "2 months"
    if total_days is None and target_str:
        m = re.search(r"(\d+)\s*(day|week|month|year)", target_str, re.IGNORECASE)
        if m:
            num = int(m.group(1))
            unit = m.group(2).lower()
            if "day" in unit:
                total_days = num
            elif "week" in unit:
                total_days = num * 7
            elif "month" in unit:
                total_days = num * 30
            elif "year" in unit:
                total_days = num * 365

    if total_days is None or total_days < 0:
        total_days = 28  # default 4 weeks

    # Check if hourly countdown applies
    if (exam_time and total_days <= 5) or (is_hourly and total_days <= 5):
        is_hourly = True

    # Format human-readable summary
    if is_hourly:
        time_tag = f" at {exam_time}" if exam_time else ""
        if total_days == 0:
            dur_label = f"TODAY (Hourly Sprint before exam{time_tag})"
        elif total_days == 1:
            dur_label = f"1 day (24-Hour Sprint before exam{time_tag})"
        else:
            dur_label = f"{total_days} days (Hourly Countdown Sprint before exam{time_tag})"
        interval_guide = (
            f"CRITICAL HOURLY SPRINT DIRECTIVE: The student's exam is in {total_days} days{time_tag}. "
            "You MUST synthesize milestone phases as concrete session time blocks with specific hours "
            f"(e.g. 'Day 1 Morning (09:00 - 12:00, 3h)', 'Day 1 Afternoon (14:00 - 17:00, 3h)', "
            f"'Final Evening Revision (18:30 - 21:00, 2.5h)', 'Exam Morning Warmup: 2h Before {exam_time or 'Paper'}'). "
            "Prioritize formula sheet memorization, high-frequency PYQs, and rest."
        )
    elif total_days == 1:
        dur_label = "1 day"
        interval_guide = "Divide into hours/sessions for today."
    elif total_days <= 7:
        dur_label = f"{total_days} days (1-week sprint)"
        interval_guide = f"Use Day 1, Day 2... or 2-day blocks (e.g. 'Days 1-2', 'Days 3-4', 'Days 5-6', 'Day {total_days}')."
    elif total_days <= 21:
        weeks_approx = max(1, round(total_days / 7))
        dur_label = f"{total_days} days (~{weeks_approx} weeks)"
        interval_guide = f"Use multi-day phases spanning exactly {total_days} days (e.g. 'Days 1-5', 'Days 6-10', 'Days 11-16', 'Days 17-{total_days}'). DO NOT use months!"
    elif total_days <= 45:
        weeks_approx = round(total_days / 7)
        dur_label = f"{total_days} days (~{weeks_approx} weeks)"
        interval_guide = f"Use multi-day or weekly phases that conclude within {total_days} days (e.g. 'Week 1 (Days 1-7)', 'Week 2 (Days 8-14)', 'Week 3 (Days 15-21)', 'Final Sprint (Days 22-{total_days})'). DO NOT use multi-month timelines."
    elif total_days <= 90:
        months_approx = round(total_days / 30.4, 1)
        dur_label = f"{total_days} days (~{months_approx} months)"
        interval_guide = "Use weekly blocks (e.g. 'Weeks 1-2', 'Weeks 3-4', 'Weeks 5-7', 'Weeks 8-10')."
    else:
        months_approx = round(total_days / 30.4, 1)
        dur_label = f"{total_days} days (~{months_approx} months)"
        interval_guide = "Use monthly or bi-weekly blocks."

    target_display = target_date_obj.strftime("%B %d, %Y") if target_date_obj else (target_str or f"In {total_days} days")
    if exam_time:
        target_display += f" at {exam_time}"

    return {
        "total_days": total_days,
        "target_display": target_display,
        "dur_label": dur_label,
        "interval_guide": interval_guide,
        "today_str": today.strftime("%B %d, %Y"),
        "exam_time": exam_time,
        "is_hourly": is_hourly,
    }


def build_fallback_milestones(portion: str, dur: dict[str, Any]) -> list[dict[str, Any]]:
    days = dur["total_days"]
    p_name = portion[:50]
    is_hourly = dur.get("is_hourly", False)
    time_str = dur.get("exam_time") or "09:00 AM"

    if is_hourly:
        if days == 0:
            dates = [
                "Morning Block: 08:30 – 11:00 (2.5h)",
                "Midday Core Revision: 11:45 – 14:00 (2.25h)",
                "Afternoon Final Drill: 14:45 – 17:00 (2.25h)",
                f"Pre-Exam Warmup: 1.5h before {time_str}",
            ]
        elif days == 1:
            dates = [
                "Day 1 Morning (3h): Formula Sheet & Core Theorem Recall",
                "Day 1 Afternoon (3.5h): 5-Year PYQs & Numerical Speed Drill",
                "Day 1 Evening (2.5h): Error Log Patching & Weak Areas",
                f"Exam Morning Warmup: 1.5h before {time_str}",
            ]
        elif days <= 3:
            dates = [
                "Day 1: High-Yield Formula Memorization & Principles (4h)",
                "Day 2: 5-Year Past Paper Speed Drill & Tricky Patterns (4h)",
                "Day 3: Full-Length Timed Simulation & Error Log (3.5h)",
                f"Final Countdown: Formula Cheat Sheet (Before {time_str})",
            ]
        else:  # 4 or 5 days
            dates = [
                "Days 1–2: High-Yield Formula Drilling & Core Unit Review",
                "Day 3: Past 5-Year Board PYQs & Numerical Speed Practice",
                "Day 4: Full-Length Timed Mock & Error Log Deep Dive",
                f"Day 5 Final Countdown: Formula Sheet & Mindset (Before {time_str})",
            ]
    elif days <= 7:
        d1 = max(1, days // 4)
        d2 = max(d1 + 1, days // 2)
        d3 = max(d2 + 1, (3 * days) // 4)
        dates = [f"Days 1–{d1}", f"Days {d1+1}–{d2}", f"Days {d2+1}–{d3}", f"Days {d3+1}–{days}"]
    elif days <= 35:
        d1 = max(1, days // 4)
        d2 = max(d1 + 1, days // 2)
        d3 = max(d2 + 1, (3 * days) // 4)
        dates = [f"Days 1–{d1}", f"Days {d1+1}–{d2}", f"Days {d2+1}–{d3}", f"Days {d3+1}–{days}"]
    elif days <= 70:
        w_total = max(4, round(days / 7))
        w1 = max(1, w_total // 4)
        w2 = max(w1 + 1, w_total // 2)
        w3 = max(w2 + 1, (3 * w_total) // 4)
        dates = [f"Weeks 1–{w1}", f"Weeks {w1+1}–{w2}", f"Weeks {w2+1}–{w3}", f"Weeks {w3+1}–{w_total}"]
    else:
        m_total = max(3, round(days / 30.4))
        m1 = max(1, m_total // 4)
        m2 = max(m1 + 1, m_total // 2)
        m3 = max(m2 + 1, (3 * m_total) // 4)
        dates = [f"Month 1–{m1}", f"Months {m1+1}–{m2}", f"Months {m2+1}–{m3}", f"Months {m3+1}–{m_total}"]

    return [
        {
            "id": "m1",
            "title": "Phase 1: Conceptual Foundations & Core Theorems" if not is_hourly else "Phase 1: Core Formula Memorization & High-Yield Principles",
            "target_date": dates[0],
            "notes": f"Read definitions and foundational principles for {p_name}.",
            "study_topic": f"Explain foundational concepts and principles of {p_name}",
            "completed": False,
        },
        {
            "id": "m2",
            "title": "Phase 2: Step-by-Step Derivations & Worked Examples" if not is_hourly else "Phase 2: High-Frequency PYQ Problem Sets & Fast Calculations",
            "target_date": dates[1],
            "notes": "Work through standard problems, formula derivations, and numericals.",
            "study_topic": f"Step-by-step problem derivations for {p_name}",
            "completed": False,
        },
        {
            "id": "m3",
            "title": "Phase 3: High-Yield Problem Sets & Exam Patterns" if not is_hourly else "Phase 3: Timed Speed Simulation & Error Log Elimination",
            "target_date": dates[2],
            "notes": "Target frequent exam questions, speed techniques, and edge cases.",
            "study_topic": f"High yield practice problems on {p_name}",
            "completed": False,
        },
        {
            "id": "m4",
            "title": "Phase 4: Synthesis, Mock Testing & Final Review" if not is_hourly else f"Phase 4: Rapid Memory Sheet & Calm Readiness (Before {time_str})",
            "target_date": dates[3],
            "notes": "Complete comprehensive self-assessment and review weak points.",
            "study_topic": f"Review and quiz me on {p_name}",
            "completed": False,
        },
    ]


def create_task_router(
    settings: Settings,
    store: TaskStore,
    prompt_optimizer: PromptOptimizer,
) -> APIRouter:
    router = APIRouter(prefix="/tasks", tags=["tasks"])

    def _user_info(authorization: str | None, anon_id: str | None = None) -> tuple[str, bool]:
        """Return (user_key, is_admin)."""
        if authorization and authorization.lower().startswith("bearer "):
            token = authorization.split(" ", 1)[1]
            payload = decode_token(token, settings.token_secret)
            if payload and payload.get("email"):
                return str(payload["email"]).lower(), bool(payload.get("is_admin", False))
        return (anon_id or "anon").lower(), False

    @router.post("/generate")
    async def generate_schedule(
        req: GeneratePlanReq,
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        """AI endpoint that synthesizes a tailored study schedule & milestones from questionnaire answers."""
        track = req.track
        answers = req.answers
        ctx = req.user_context or {}

        dur = parse_timeframe_info(answers, track)

        if track == "page_by_page":
            from app.textbook_service import generate_page_schedule_milestones
            board = str(answers.get("board") or ctx.get("board") or "ICSE (CISCE)")
            grade = str(answers.get("grade") or ctx.get("grade") or "10")
            subject = str(answers.get("subject") or "Physics")
            chapter = str(answers.get("chapter") or "Chapter 1")
            start_page = int(answers.get("start_page")) if answers.get("start_page") else None
            end_page = int(answers.get("end_page")) if answers.get("end_page") else None
            source = str(answers.get("source") or "")
            selected_chapters = answers.get("selected_chapters")

            raw_milestones = generate_page_schedule_milestones(
                board=board,
                grade=grade,
                subject=subject,
                chapter_name=chapter,
                start_page=start_page,
                end_page=end_page,
                source=source,
                selected_chapters=selected_chapters,
            )

            formatted_milestones = []
            for i, m in enumerate(raw_milestones):
                p_num = m.get("page_number", i + 1)
                ch_name = m.get("chapter", chapter)
                formatted_milestones.append({
                    "id": f"p{i + 1}",
                    "title": m["title"],
                    "target_date": m.get("target_date") or f"Session {i + 1}",
                    "notes": m.get("notes") or m.get("description") or f"Master Page {p_num} of {ch_name}",
                    "study_topic": f"Textbook Page {p_num} of {ch_name}: {subject}",
                    "textbook_source": m.get("textbook_source", ""),
                    "page_number": p_num,
                    "chapter": ch_name,
                    "completed": False,
                })

            total_pages = len(formatted_milestones)
            unique_chapters = list(dict.fromkeys(m["chapter"] for m in formatted_milestones))
            chap_summary = f"{len(unique_chapters)} Chapters" if len(unique_chapters) > 1 else (unique_chapters[0] if unique_chapters else chapter)
            title = f"{board} Class {grade} {subject} — {chap_summary} (Page-by-Page Guided Mastery)"
            summary = (
                f"Interactive line-by-line textbook guided study covering {total_pages} pages across {len(unique_chapters)} chapter(s). "
                f"Tark will display each page's authentic scan, teach concept-by-concept, and verify understanding before turning the page."
            )
            confirmation = f"Loaded {total_pages} textbook pages for {board} Class {grade} {subject}: {chap_summary}."

            return {
                "title": title,
                "summary": summary,
                "chapter_confirmation": confirmation,
                "needs_chapters": False,
                "milestones": formatted_milestones,
            }

        system_instruction = (
            "You are an expert academic curriculum strategist and educational planning engine.\n"
            "Given a student's academic goal, track, and questionnaire answers, synthesize a realistic, "
            "high-yield study schedule with 4 to 6 sequential milestones.\n\n"
            "TRACK GUIDELINES:\n"
            "- coursework: Break the portion logically into foundational concepts, deep dive units, practice sets, and review checkpoint.\n"
            "- exam: Organize milestones backwards from the exam date, prioritizing high-yield topics, problem drilling, formula cheat sheets, Daily 3-Question Spaced Repetition Workouts, and full mock tests.\n"
            "- research: Structure into Literature Review & Formulation, Methodology & Investigation, Data Synthesis, and Final Documentation.\n\n"
            "CRITICAL TIMEFRAME RULES (STRICT - MUST OBEY):\n"
            f"- Today's Reference Date: {dur['today_str']}\n"
            f"- Target Deadline / Date: {dur['target_display']}\n"
            f"- TOTAL AVAILABLE TIMEFRAME: {dur['total_days']} DAYS ({dur['dur_label']})\n"
            f"- NON-NEGOTIABLE RULE: The entire roadmap MUST fit strictly within these {dur['total_days']} days.\n"
            f"- DO NOT output a schedule that exceeds {dur['total_days']} days. If duration is {dur['total_days']} days, NEVER output a multi-month or 6-month roadmap!\n"
            f"- Target date format requirement: {dur['interval_guide']}\n\n"
            "CHAPTER RESOLUTION & CONFIRMATION DIRECTIVES:\n"
            "1. If the exam is a standard known board (CBSE, ICSE/ISC, State Board, JEE, NEET, etc.) and the student entered chapter numbers (e.g. 'ch 1, 2, 3', 'chapter 1 to 4', 'ch 5, 6'):\n"
            "   - Use your curriculum knowledge for that board, grade, and the selected subject to resolve the EXACT official chapter titles.\n"
            "   - In 'chapter_confirmation', provide an explicit, encouraging confirmation listing each mapped chapter name: "
            "e.g., 'Referencing your [Board/Exam] [Subject] syllabus: Chapter 1 ([Title 1]), Chapter 2 ([Title 2]), Chapter 3 ([Title 3]). Please confirm these are the chapters you are preparing for.'\n"
            "2. If chapter names were already clearly specified by the student, summarize them neatly in 'chapter_confirmation': e.g., 'Targeting [Subject] chapters: [Chapter Titles].'\n"
            "3. If this is a custom/other exam (is_custom_exam is true) AND the student provided ONLY numbers (e.g. 'ch 1, 2, 3') without chapter names or topics:\n"
            "   - Set 'needs_chapters': true\n"
            "   - Set 'clarification_message': 'Since this is a custom exam, please specify the chapter names or topics for these chapters so Tark can tailor your roadmap.'\n"
            "   - Set 'milestones': []\n\n"
            "OUTPUT FORMAT:\n"
            "Return ONLY a valid JSON object with keys:\n"
            '- "title": Short descriptive title (e.g. "Class 10 Physics: Mechanics & Light 8-Day Sprint")\n'
            '- "summary": 1-2 sentence executive overview of the roadmap strategy calibrated to the timeframe.\n'
            '- "chapter_confirmation": String listing and confirming the resolved/provided chapters, or null.\n'
            '- "needs_chapters": boolean (true if custom exam and chapter names are missing, false otherwise)\n'
            '- "clarification_message": string or null\n'
            '- "milestones": JSON array of objects with keys:\n'
            '    "id": unique string (e.g. "m1", "m2", ...)\n'
            '    "title": Clear action milestone title\n'
            '    "target_date": Suggested timeframe matching the window (e.g. "Days 1-5", "Days 6-10", etc.)\n'
            '    "notes": Specific high-yield concepts or focus points\n'
            '    "study_topic": A precise search/study query for Tark (e.g. "Derive Snell Law and Refraction at Plane Surfaces")\n'
            '    "completed": false\n'
            "JSON ONLY, no other markdown text, no commentary."
        )

        user_prompt = (
            f"ACADEMIC TRACK: {track}\n"
            f"EXACT AVAILABLE TIMEFRAME: {dur['total_days']} DAYS ({dur['dur_label']}) — Deadline: {dur['target_display']}\n"
            f"STUDENT QUESTIONNAIRE RESPONSES:\n{json.dumps(answers, indent=2)}\n"
        )
        if ctx:
            user_prompt += f"\nSTUDENT PROFILE CONTEXT:\n{json.dumps(ctx, indent=2)}"

        # Use prompt_optimizer's client if available, else standard fallback
        if prompt_optimizer.is_available:
            try:
                assert prompt_optimizer._client is not None
                res = await prompt_optimizer._client.chat.completions.create(
                    model=prompt_optimizer.primary_model,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=950,
                )
                raw = res.choices[0].message.content or ""
                # Strip json markdown blocks if wrapped
                raw = raw.strip()
                if raw.startswith("```json"):
                    raw = raw[7:]
                if raw.startswith("```"):
                    raw = raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                data = json.loads(raw.strip())
                if ("milestones" in data and "title" in data) or data.get("needs_chapters"):
                    return data
            except Exception as e:
                logger.warning(f"AI schedule generation failed: {e}")

        # Fallback heuristic schedule if model generation fails or key unavailable
        subj = answers.get("subject") or answers.get("exam_subject") or ""
        default_title = {
            "coursework": f"Study Schedule: {answers.get('subject', 'Coursework')} ({dur['dur_label']})",
            "exam": f"Exam Preparation: {answers.get('exam_name', 'Upcoming Exam')}{f' ({subj})' if subj else ''} ({dur['dur_label']})",
            "research": f"Research Roadmap: {answers.get('domain', 'Academic Research')} ({dur['dur_label']})",
        }.get(track, f"Custom Study Roadmap ({dur['dur_label']})")

        syllabus = str(answers.get("syllabus") or answers.get("portion") or answers.get("portion_focus") or answers.get("research_question") or "Core syllabus")
        priority = str(answers.get("priority_focus") or answers.get("weak_areas") or "")
        portion = f"{subj + ': ' if subj and track == 'exam' else ''}{syllabus}" + (f" (Focus: {priority})" if priority else "")

        chapter_confirmation = None
        if track == "exam" and syllabus:
            chapter_confirmation = f"Targeting {subj + ' ' if subj else ''}exam syllabus: {syllabus[:120]}"

        return {
            "title": default_title,
            "summary": f"Structured progressive milestones to master {portion[:70]} within {dur['dur_label']}.",
            "chapter_confirmation": chapter_confirmation,
            "needs_chapters": False,
            "milestones": build_fallback_milestones(portion, dur),
        }

    @router.get("")
    def get_tasks(
        authorization: str | None = Header(default=None),
        anon_id: str | None = None,
    ) -> dict[str, Any]:
        """List all study tasks for the current user."""
        key, is_admin = _user_info(authorization, anon_id)
        tasks = store.list_tasks(user_key=key, anon_id=anon_id, is_admin=is_admin)
        return {"tasks": tasks}

    @router.post("")
    def create_task(
        req: CreateTaskReq,
        authorization: str | None = Header(default=None),
        anon_id: str | None = None,
    ) -> dict[str, Any]:
        """Save a new study task and milestone schedule."""
        key, _ = _user_info(authorization, anon_id)
        task = store.create_task(
            user_key=key,
            track=req.track,
            title=req.title,
            details=req.details,
            milestones=[m.model_dump() for m in req.milestones],
        )
        return {"ok": True, "task": task}

    @router.patch("/{task_id}/milestones/{milestone_id}")
    def toggle_milestone(
        task_id: int,
        milestone_id: str,
        req: ToggleMilestoneReq,
        authorization: str | None = Header(default=None),
        anon_id: str | None = None,
    ) -> dict[str, Any]:
        """Toggle or set milestone completion state."""
        key, is_admin = _user_info(authorization, anon_id)
        updated = store.toggle_milestone(
            task_id=task_id,
            user_key=key,
            milestone_id=milestone_id,
            completed=req.completed,
            is_admin=is_admin,
            anon_id=anon_id,
        )
        if not updated:
            raise HTTPException(404, "Task or milestone not found.")
        return {"ok": True, "task": updated}

    @router.delete("/{task_id}")
    def delete_task(
        task_id: int,
        authorization: str | None = Header(default=None),
        anon_id: str | None = None,
    ) -> dict[str, Any]:
        """Delete a study task."""
        key, is_admin = _user_info(authorization, anon_id)
        deleted = store.delete_task(
            task_id=task_id,
            user_key=key,
            is_admin=is_admin,
            anon_id=anon_id,
        )
        if not deleted:
            raise HTTPException(403, "Permission denied to delete this study schedule.")
        return {"ok": True}

    return router
