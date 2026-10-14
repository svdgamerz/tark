"""TARK Core — Frontier Autonomous Desktop AI Assistant & Omni-Agent Engine.
Synthesizes the best architectures from PersonalJarvis, OpenClaw, Comma, and Mark-XL.
"""
from __future__ import annotations

from tark_core.agent_team import create_agent_team
from tark_core.channel_bridge import ChannelGatewayServer
from tark_core.academic_worker import AcademicWorker, academic_worker
from tark_core.student_tutor import StudentTutor, student_tutor
from tark_core.config import (
    FALLBACK_REASONING_MODEL,
    GROQ_API_KEY,
    PRIMARY_REASONING_MODEL,
    WAKE_WORDS,
)
from tark_core.memory import MemoryManager
from tark_core.orchestrator import MasterOrchestrator
from tark_core.skills_engine import SkillRegistry
from tark_core.sound_fx import (
    play_chime_boot,
    play_chime_done,
    play_chime_error,
    play_chime_step,
    play_chime_wake,
)
from tark_core.system_operator import SystemOperator
from tark_core.voice_duplex import VoiceDuplex

__version__ = "8.0.0"
__all__ = [
    "AcademicWorker",
    "academic_worker",
    "StudentTutor",
    "student_tutor",
    "MemoryManager",
    "SkillRegistry",
    "SystemOperator",
    "VoiceDuplex",
    "MasterOrchestrator",
    "ChannelGatewayServer",
    "create_agent_team",
    "play_chime_boot",
    "play_chime_done",
    "play_chime_wake",
    "play_chime_step",
    "play_chime_error",
    "WAKE_WORDS",
    "PRIMARY_REASONING_MODEL",
    "FALLBACK_REASONING_MODEL",
]
