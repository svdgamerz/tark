"""Textbook service for Tark.
Handles textbook PDF resolution, PyMuPDF page rendering, chapter discovery,
and page-by-page study plan generation.
"""

from __future__ import annotations

import os
import re
import sqlite3
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pymupdf  # PyMuPDF

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAG_DB_PATH = BASE_DIR / "tark_rag.db"

# Normalization maps (consistent with retrieve.py)
BOARD_NORMALIZE = {
    "cbse": "CBSE (NCERT)",
    "ncert": "CBSE (NCERT)",
    "cbse (ncert)": "CBSE (NCERT)",
    "icse": "ICSE (CISCE)",
    "cisce": "ICSE (CISCE)",
    "icse (cisce)": "ICSE (CISCE)",
    "maharashtra": "Maharashtra State Board (Balbharati)",
    "balbharati": "Maharashtra State Board (Balbharati)",
    "balbharti": "Maharashtra State Board (Balbharati)",
    "msbshse": "Maharashtra State Board (Balbharati)",
    "maharashtra state board": "Maharashtra State Board (Balbharati)",
    "maharashtra state board (balbharati)": "Maharashtra State Board (Balbharati)",
    "maharashtra state board (balbharti)": "Maharashtra State Board (Balbharati)",
    "igcse": "IGCSE (Cambridge)",
    "cambridge": "IGCSE (Cambridge)",
    "igcse (cambridge)": "IGCSE (Cambridge)",
}

SUBJECT_NORMALIZE = {
    "mathematics": "Maths",
    "math": "Maths",
    "maths": "Maths",
    "maths 1": "Maths 1",
    "maths 1 (algebra)": "Maths 1",
    "algebra": "Maths 1",
    "maths 2": "Maths 2",
    "maths 2 (geometry)": "Maths 2",
    "geometry": "Maths 2",
    "science": "Science",
    "general science": "Science",
    "science 1": "Science 1",
    "science 1 (physics & chemistry)": "Science 1",
    "science & technology part 1": "Science 1",
    "science 2": "Science 2",
    "science 2 (biology & environment)": "Science 2",
    "science & technology part 2": "Science 2",
    "science & technology": "Science",
    "physics": "Physics",
    "chemistry": "Chemistry",
    "biology": "Biology",
    "social science": "Social Science",
    "social studies": "Social Studies",
    "history": "History & Civics",
    "history & civics": "History & Civics",
    "history & political science": "History & Political Science",
    "geography": "Geography",
    "english": "English",
    "english balbharati": "English",
    "english kumarbharati": "English",
    "english yuvakbharati": "English",
    "marathi": "Marathi",
    "marathi balbharati": "Marathi",
    "marathi sulabhbharati": "Marathi",
    "marathi kumarbharati": "Marathi",
    "marathi aksharbharati": "Marathi",
    "marathi yuvakbharati": "Marathi",
    "hindi": "Hindi",
    "hindi lokbharati": "Hindi",
    "hindi lokvani": "Hindi",
    "hindi sulabhbharati": "Hindi",
    "hindi yuvakbharati": "Hindi",
    "sanskrit": "Sanskrit",
    "sanskrit amod": "Sanskrit",
    "sanskrit anand": "Sanskrit",
    "sanskrit ruchira": "Sanskrit",
    "sanskrit shemushi": "Sanskrit",
    "sugam sanskrit": "Sanskrit",
    "information communication technology (ict)": "Computer Applications",
    "information communication technology": "Computer Applications",
    "ict": "Computer Applications",
    "defence studies": "Defence Studies",
    "economics": "Economics",
    "accountancy": "Accountancy",
    "book keeping & accountancy": "Accountancy",
    "organization of commerce & management (ocm)": "Commerce",
    "secretarial practice (sp)": "Commerce",
    "psychology": "Psychology",
    "sociology": "Sociology",
    "political science": "Political Science",
    "evs": "EVS",
    "environmental studies": "EVS",
    "computer applications": "Computer Applications",
    "computer studies": "Computer Studies",
    "information technology": "Information Technology",
}

# Known direct textbook source mappings
KNOWN_TEXTBOOK_MAP = {
    # Maharashtra State Board (Balbharati)
    ("Maharashtra State Board (Balbharati)", "10", "Science 1"): "1003000265.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Science 2"): "1003000270.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Science"): "1003000265.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Maths 1"): "1003000608.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Maths 2"): "1003000609.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Maths"): "1003000608.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Geography"): "1003020011.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "History & Political Science"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "History & Civics"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "English"): "1003030024.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Sanskrit"): "1001000604.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Hindi"): "1002030027.pdf",

    ("Maharashtra State Board (Balbharati)", "9", "Science"): "903020456.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Maths 1"): "903000608.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Maths 2"): "903000609.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Maths"): "903000608.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Geography"): "903020011.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "History & Political Science"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "English"): "903030024.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Sanskrit"): "901000604.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Hindi"): "902030027.pdf",

    ("Maharashtra State Board (Balbharati)", "8", "Science"): "803020012.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Maths"): "803020004.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "History & Civics"): "803000584.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Geography"): "803020011.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "English"): "803020001.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Sanskrit"): "801000604.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Marathi"): "801020020.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Hindi"): "802020020.pdf",

    ("Maharashtra State Board (Balbharati)", "11", "Defence Studies"): "1103010510.pdf",
    ("Maharashtra State Board (Balbharati)", "11", "EVS"): "1103020029.pdf",
    ("Maharashtra State Board (Balbharati)", "11", "Accountancy"): "1103020425.pdf",
    ("Maharashtra State Board (Balbharati)", "11", "Commerce"): "1103040026.pdf",

    ("Maharashtra State Board (Balbharati)", "12", "Defence Studies"): "1203010510.pdf",
    ("Maharashtra State Board (Balbharati)", "12", "EVS"): "1203020029.pdf",
    ("Maharashtra State Board (Balbharati)", "12", "Accountancy"): "1203020425.pdf",
    ("Maharashtra State Board (Balbharati)", "12", "Commerce"): "1203040026.pdf",

    ("Maharashtra State Board (Balbharati)", "7", "Science"): "703020012.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "Maths"): "703020004.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "History & Civics"): "703000584.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "Geography"): "703020011.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "English"): "703020001.pdf",

    ("Maharashtra State Board (Balbharati)", "6", "Science"): "603020012.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "Maths"): "603020004.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "History & Civics"): "603000584.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "Geography"): "603020011.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "English"): "603020001.pdf",
}

# Fallback structured chapters for curriculum textbooks where PDF TOC lacks a text stream
KNOWN_CHAPTERS_MAP = {
    ("Maharashtra State Board (Balbharati)", "8", "Science"): [
        {"source": "803020012.pdf", "chapter": "Chapter 1: Living World and Classification of Microbes", "start_page": 11, "end_page": 16, "total_doc_pages": 140, "chunks_count": 6},
        {"source": "803020012.pdf", "chapter": "Chapter 2: Health and Diseases", "start_page": 17, "end_page": 23, "total_doc_pages": 140, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 3: Force and Pressure", "start_page": 24, "end_page": 31, "total_doc_pages": 140, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 4: Current Electricity and Magnetism", "start_page": 32, "end_page": 38, "total_doc_pages": 140, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 5: Inside the Atom", "start_page": 39, "end_page": 48, "total_doc_pages": 140, "chunks_count": 10},
        {"source": "803020012.pdf", "chapter": "Chapter 6: Composition of Matter", "start_page": 49, "end_page": 59, "total_doc_pages": 140, "chunks_count": 11},
        {"source": "803020012.pdf", "chapter": "Chapter 7: Metals and Nonmetals", "start_page": 60, "end_page": 66, "total_doc_pages": 140, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 8: Pollution", "start_page": 67, "end_page": 75, "total_doc_pages": 140, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 9: Disaster Management", "start_page": 76, "end_page": 84, "total_doc_pages": 140, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 10: Cell and Cell Organelles", "start_page": 85, "end_page": 93, "total_doc_pages": 140, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 11: Human Body and Organ System", "start_page": 94, "end_page": 102, "total_doc_pages": 140, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 12: Introduction to Acid & Base", "start_page": 103, "end_page": 110, "total_doc_pages": 140, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 13: Chemical Change and Chemical Bond", "start_page": 111, "end_page": 118, "total_doc_pages": 140, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 14: Measurement and Effects of Heat", "start_page": 119, "end_page": 126, "total_doc_pages": 140, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 15: Sound", "start_page": 127, "end_page": 133, "total_doc_pages": 140, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 16: Reflection of Light", "start_page": 134, "end_page": 140, "total_doc_pages": 140, "chunks_count": 7},
    ],
    ("Maharashtra State Board (Balbharati)", "9", "Science"): [
        {"source": "903020456.pdf", "chapter": "Chapter 1: Laws of Motion", "start_page": 11, "end_page": 27, "total_doc_pages": 228, "chunks_count": 17},
        {"source": "903020456.pdf", "chapter": "Chapter 2: Work and Energy", "start_page": 28, "end_page": 39, "total_doc_pages": 228, "chunks_count": 12},
        {"source": "903020456.pdf", "chapter": "Chapter 3: Current Electricity", "start_page": 40, "end_page": 55, "total_doc_pages": 228, "chunks_count": 16},
        {"source": "903020456.pdf", "chapter": "Chapter 4: Measurement of Matter", "start_page": 56, "end_page": 67, "total_doc_pages": 228, "chunks_count": 12},
        {"source": "903020456.pdf", "chapter": "Chapter 5: Acids, Bases and Salts", "start_page": 68, "end_page": 84, "total_doc_pages": 228, "chunks_count": 17},
        {"source": "903020456.pdf", "chapter": "Chapter 6: Classification of Plants", "start_page": 85, "end_page": 90, "total_doc_pages": 228, "chunks_count": 6},
        {"source": "903020456.pdf", "chapter": "Chapter 7: Energy Flow in an Ecosystem", "start_page": 91, "end_page": 97, "total_doc_pages": 228, "chunks_count": 7},
        {"source": "903020456.pdf", "chapter": "Chapter 8: Useful and Harmful Microbes", "start_page": 98, "end_page": 105, "total_doc_pages": 228, "chunks_count": 8},
        {"source": "903020456.pdf", "chapter": "Chapter 9: Environmental Management", "start_page": 106, "end_page": 117, "total_doc_pages": 228, "chunks_count": 12},
        {"source": "903020456.pdf", "chapter": "Chapter 10: Information Communication Technology (ICT)", "start_page": 118, "end_page": 124, "total_doc_pages": 228, "chunks_count": 7},
        {"source": "903020456.pdf", "chapter": "Chapter 11: Reflection of Light", "start_page": 125, "end_page": 137, "total_doc_pages": 228, "chunks_count": 13},
        {"source": "903020456.pdf", "chapter": "Chapter 12: Study of Sound", "start_page": 138, "end_page": 147, "total_doc_pages": 228, "chunks_count": 10},
        {"source": "903020456.pdf", "chapter": "Chapter 13: Carbon : An Important Element", "start_page": 148, "end_page": 159, "total_doc_pages": 228, "chunks_count": 12},
        {"source": "903020456.pdf", "chapter": "Chapter 14: Substances in Common Use", "start_page": 160, "end_page": 172, "total_doc_pages": 228, "chunks_count": 13},
        {"source": "903020456.pdf", "chapter": "Chapter 15: Life Processes in Living Organisms", "start_page": 173, "end_page": 188, "total_doc_pages": 228, "chunks_count": 16},
        {"source": "903020456.pdf", "chapter": "Chapter 16: Heredity and Variation", "start_page": 189, "end_page": 203, "total_doc_pages": 228, "chunks_count": 15},
        {"source": "903020456.pdf", "chapter": "Chapter 17: Introduction to Biotechnology", "start_page": 204, "end_page": 218, "total_doc_pages": 228, "chunks_count": 15},
        {"source": "903020456.pdf", "chapter": "Chapter 18: Observing Space : Telescopes", "start_page": 219, "end_page": 228, "total_doc_pages": 228, "chunks_count": 10},
    ],
    ("Maharashtra State Board (Balbharati)", "10", "Science 1"): [
        {"source": "1003000265.pdf", "chapter": "Chapter 1: Gravitation", "start_page": 11, "end_page": 25, "total_doc_pages": 156, "chunks_count": 15},
        {"source": "1003000265.pdf", "chapter": "Chapter 2: Periodic Classification of Elements", "start_page": 26, "end_page": 39, "total_doc_pages": 156, "chunks_count": 14},
        {"source": "1003000265.pdf", "chapter": "Chapter 3: Chemical Reactions and Equations", "start_page": 40, "end_page": 56, "total_doc_pages": 156, "chunks_count": 17},
        {"source": "1003000265.pdf", "chapter": "Chapter 4: Effects of Electric Current", "start_page": 57, "end_page": 71, "total_doc_pages": 156, "chunks_count": 15},
        {"source": "1003000265.pdf", "chapter": "Chapter 5: Heat", "start_page": 72, "end_page": 82, "total_doc_pages": 156, "chunks_count": 11},
        {"source": "1003000265.pdf", "chapter": "Chapter 6: Refraction of Light", "start_page": 83, "end_page": 89, "total_doc_pages": 156, "chunks_count": 7},
        {"source": "1003000265.pdf", "chapter": "Chapter 7: Lenses", "start_page": 90, "end_page": 102, "total_doc_pages": 156, "chunks_count": 13},
        {"source": "1003000265.pdf", "chapter": "Chapter 8: Metallurgy", "start_page": 103, "end_page": 119, "total_doc_pages": 156, "chunks_count": 17},
        {"source": "1003000265.pdf", "chapter": "Chapter 9: Carbon Compounds", "start_page": 120, "end_page": 144, "total_doc_pages": 156, "chunks_count": 25},
        {"source": "1003000265.pdf", "chapter": "Chapter 10: Space Missions", "start_page": 145, "end_page": 156, "total_doc_pages": 156, "chunks_count": 12},
    ],
    ("Maharashtra State Board (Balbharati)", "10", "Science 2"): [
        {"source": "1003000270.pdf", "chapter": "Chapter 1: Heredity and Evolution", "start_page": 11, "end_page": 24, "total_doc_pages": 156, "chunks_count": 14},
        {"source": "1003000270.pdf", "chapter": "Chapter 2: Life Processes in Living Organisms Part 1", "start_page": 25, "end_page": 37, "total_doc_pages": 156, "chunks_count": 13},
        {"source": "1003000270.pdf", "chapter": "Chapter 3: Life Processes in Living Organisms Part 2", "start_page": 38, "end_page": 55, "total_doc_pages": 156, "chunks_count": 18},
        {"source": "1003000270.pdf", "chapter": "Chapter 4: Environmental Management", "start_page": 56, "end_page": 75, "total_doc_pages": 156, "chunks_count": 20},
        {"source": "1003000270.pdf", "chapter": "Chapter 5: Towards Green Energy", "start_page": 76, "end_page": 91, "total_doc_pages": 156, "chunks_count": 16},
        {"source": "1003000270.pdf", "chapter": "Chapter 6: Animal Classification", "start_page": 92, "end_page": 110, "total_doc_pages": 156, "chunks_count": 19},
        {"source": "1003000270.pdf", "chapter": "Chapter 7: Introduction to Microbiology", "start_page": 111, "end_page": 124, "total_doc_pages": 156, "chunks_count": 14},
        {"source": "1003000270.pdf", "chapter": "Chapter 8: Cell Biology and Biotechnology", "start_page": 125, "end_page": 142, "total_doc_pages": 156, "chunks_count": 18},
        {"source": "1003000270.pdf", "chapter": "Chapter 9: Social Health", "start_page": 143, "end_page": 154, "total_doc_pages": 156, "chunks_count": 12},
        {"source": "1003000270.pdf", "chapter": "Chapter 10: Disaster Management", "start_page": 155, "end_page": 166, "total_doc_pages": 156, "chunks_count": 12},
    ],
    ("Maharashtra State Board (Balbharati)", "10", "Maths 1"): [
        {"source": "1003000608.pdf", "chapter": "Chapter 1: Linear Equations in Two Variables", "start_page": 11, "end_page": 39, "total_doc_pages": 188, "chunks_count": 29},
        {"source": "1003000608.pdf", "chapter": "Chapter 2: Quadratic Equations", "start_page": 40, "end_page": 63, "total_doc_pages": 188, "chunks_count": 24},
        {"source": "1003000608.pdf", "chapter": "Chapter 3: Arithmetic Progression", "start_page": 64, "end_page": 90, "total_doc_pages": 188, "chunks_count": 27},
        {"source": "1003000608.pdf", "chapter": "Chapter 4: Financial Planning", "start_page": 91, "end_page": 124, "total_doc_pages": 188, "chunks_count": 34},
        {"source": "1003000608.pdf", "chapter": "Chapter 5: Probability", "start_page": 125, "end_page": 146, "total_doc_pages": 188, "chunks_count": 22},
        {"source": "1003000608.pdf", "chapter": "Chapter 6: Statistics", "start_page": 147, "end_page": 188, "total_doc_pages": 188, "chunks_count": 42},
    ],
    ("Maharashtra State Board (Balbharati)", "10", "Maths 2"): [
        {"source": "1003000609.pdf", "chapter": "Chapter 1: Similarity", "start_page": 11, "end_page": 38, "total_doc_pages": 172, "chunks_count": 28},
        {"source": "1003000609.pdf", "chapter": "Chapter 2: Pythagoras Theorem", "start_page": 39, "end_page": 54, "total_doc_pages": 172, "chunks_count": 16},
        {"source": "1003000609.pdf", "chapter": "Chapter 3: Circle", "start_page": 55, "end_page": 104, "total_doc_pages": 172, "chunks_count": 50},
        {"source": "1003000609.pdf", "chapter": "Chapter 4: Geometric Constructions", "start_page": 105, "end_page": 124, "total_doc_pages": 172, "chunks_count": 20},
        {"source": "1003000609.pdf", "chapter": "Chapter 5: Coordinate Geometry", "start_page": 125, "end_page": 148, "total_doc_pages": 172, "chunks_count": 24},
        {"source": "1003000609.pdf", "chapter": "Chapter 6: Trigonometry", "start_page": 149, "end_page": 166, "total_doc_pages": 172, "chunks_count": 18},
        {"source": "1003000609.pdf", "chapter": "Chapter 7: Mensuration", "start_page": 167, "end_page": 172, "total_doc_pages": 172, "chunks_count": 6},
    ],
    ("Maharashtra State Board (Balbharati)", "9", "Maths 1"): [
        {"source": "903000608.pdf", "chapter": "Chapter 1: Sets", "start_page": 11, "end_page": 28, "total_doc_pages": 148, "chunks_count": 18},
        {"source": "903000608.pdf", "chapter": "Chapter 2: Real Numbers", "start_page": 29, "end_page": 47, "total_doc_pages": 148, "chunks_count": 19},
        {"source": "903000608.pdf", "chapter": "Chapter 3: Polynomials", "start_page": 48, "end_page": 65, "total_doc_pages": 148, "chunks_count": 18},
        {"source": "903000608.pdf", "chapter": "Chapter 4: Ratio and Proportion", "start_page": 66, "end_page": 83, "total_doc_pages": 148, "chunks_count": 18},
        {"source": "903000608.pdf", "chapter": "Chapter 5: Linear Equations in Two Variables", "start_page": 84, "end_page": 97, "total_doc_pages": 148, "chunks_count": 14},
        {"source": "903000608.pdf", "chapter": "Chapter 6: Financial Planning", "start_page": 98, "end_page": 116, "total_doc_pages": 148, "chunks_count": 19},
        {"source": "903000608.pdf", "chapter": "Chapter 7: Statistics", "start_page": 117, "end_page": 148, "total_doc_pages": 148, "chunks_count": 32},
    ],
    ("Maharashtra State Board (Balbharati)", "9", "Maths 2"): [
        {"source": "903000609.pdf", "chapter": "Chapter 1: Basic Concepts in Geometry", "start_page": 11, "end_page": 22, "total_doc_pages": 140, "chunks_count": 12},
        {"source": "903000609.pdf", "chapter": "Chapter 2: Parallel Lines", "start_page": 23, "end_page": 38, "total_doc_pages": 140, "chunks_count": 16},
        {"source": "903000609.pdf", "chapter": "Chapter 3: Triangles", "start_page": 39, "end_page": 61, "total_doc_pages": 140, "chunks_count": 23},
        {"source": "903000609.pdf", "chapter": "Chapter 4: Constructions of Triangles", "start_page": 62, "end_page": 70, "total_doc_pages": 140, "chunks_count": 9},
        {"source": "903000609.pdf", "chapter": "Chapter 5: Quadrilaterals", "start_page": 71, "end_page": 87, "total_doc_pages": 140, "chunks_count": 17},
        {"source": "903000609.pdf", "chapter": "Chapter 6: Circle", "start_page": 88, "end_page": 102, "total_doc_pages": 140, "chunks_count": 15},
        {"source": "903000609.pdf", "chapter": "Chapter 7: Coordinate Geometry", "start_page": 103, "end_page": 113, "total_doc_pages": 140, "chunks_count": 11},
        {"source": "903000609.pdf", "chapter": "Chapter 8: Trigonometry", "start_page": 114, "end_page": 129, "total_doc_pages": 140, "chunks_count": 16},
        {"source": "903000609.pdf", "chapter": "Chapter 9: Surface Area and Volume", "start_page": 130, "end_page": 140, "total_doc_pages": 140, "chunks_count": 11},
    ],
    ("Maharashtra State Board (Balbharati)", "10", "Sanskrit"): [
        {"source": "1001000604.pdf", "chapter": "Chapter 1: चित्रपदकोषः / सुगमसंस्कृतम्", "start_page": 11, "end_page": 17, "total_doc_pages": 132, "chunks_count": 7},
        {"source": "1001000604.pdf", "chapter": "Chapter 2: आद्यकृषकः पृथुवैन्यः", "start_page": 18, "end_page": 23, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "1001000604.pdf", "chapter": "Chapter 3: व्यसने मित्रपरीक्षा", "start_page": 24, "end_page": 30, "total_doc_pages": 132, "chunks_count": 7},
        {"source": "1001000604.pdf", "chapter": "Chapter 4: सूक्तिसुधा", "start_page": 31, "end_page": 38, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "1001000604.pdf", "chapter": "Chapter 5: अमूल्यं कमलम्", "start_page": 39, "end_page": 46, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "1001000604.pdf", "chapter": "Chapter 6: स एव परमाणुः", "start_page": 47, "end_page": 55, "total_doc_pages": 132, "chunks_count": 9},
        {"source": "1001000604.pdf", "chapter": "Chapter 7: युग्ममाला", "start_page": 56, "end_page": 64, "total_doc_pages": 132, "chunks_count": 9},
        {"source": "1001000604.pdf", "chapter": "Chapter 8: संस्कृतनाट्यस्तबकः", "start_page": 65, "end_page": 76, "total_doc_pages": 132, "chunks_count": 12},
    ],
    ("Maharashtra State Board (Balbharati)", "9", "Sanskrit"): [
        {"source": "901000604.pdf", "chapter": "Chapter 1: चित्रपदकोषः (Chitrapadakosha)", "start_page": 11, "end_page": 13, "total_doc_pages": 116, "chunks_count": 3},
        {"source": "901000604.pdf", "chapter": "Chapter 2: संवादः / धातुसाधितरूपाणि", "start_page": 14, "end_page": 20, "total_doc_pages": 116, "chunks_count": 7},
        {"source": "901000604.pdf", "chapter": "Chapter 3: सुगमसंस्कृतम्", "start_page": 21, "end_page": 28, "total_doc_pages": 116, "chunks_count": 8},
        {"source": "901000604.pdf", "chapter": "Chapter 4: अव्ययमाला", "start_page": 29, "end_page": 36, "total_doc_pages": 116, "chunks_count": 8},
        {"source": "901000604.pdf", "chapter": "Chapter 5: धन्यः स नृपः", "start_page": 37, "end_page": 44, "total_doc_pages": 116, "chunks_count": 8},
        {"source": "901000604.pdf", "chapter": "Chapter 6: वीरवन्दिता", "start_page": 45, "end_page": 54, "total_doc_pages": 116, "chunks_count": 10},
    ],
    ("Maharashtra State Board (Balbharati)", "8", "Sanskrit"): [
        {"source": "801000604.pdf", "chapter": "Chapter 1: चित्रपदकोषः (Chitrapadakosha)", "start_page": 11, "end_page": 13, "total_doc_pages": 66, "chunks_count": 3},
        {"source": "801000604.pdf", "chapter": "Chapter 2: कः का किम् (Kah Ka Kim)", "start_page": 14, "end_page": 18, "total_doc_pages": 66, "chunks_count": 5},
        {"source": "801000604.pdf", "chapter": "Chapter 3: एषः एषा एतत् (Eshah Esha Etat)", "start_page": 19, "end_page": 24, "total_doc_pages": 66, "chunks_count": 6},
        {"source": "801000604.pdf", "chapter": "Chapter 4: अहम् त्वम् (Aham Tvam)", "start_page": 25, "end_page": 30, "total_doc_pages": 66, "chunks_count": 6},
        {"source": "801000604.pdf", "chapter": "Chapter 5: क्रियापदानि (Kriyapadani)", "start_page": 31, "end_page": 36, "total_doc_pages": 66, "chunks_count": 6},
        {"source": "801000604.pdf", "chapter": "Chapter 6: सङ्ख्या (Sankhya)", "start_page": 37, "end_page": 42, "total_doc_pages": 66, "chunks_count": 6},
        {"source": "801000604.pdf", "chapter": "Chapter 7: समयः (Samayah)", "start_page": 43, "end_page": 50, "total_doc_pages": 66, "chunks_count": 8},
        {"source": "801000604.pdf", "chapter": "Chapter 8: सुभाषितानि (Subhashitani)", "start_page": 51, "end_page": 66, "total_doc_pages": 66, "chunks_count": 16},
    ],
    ("Maharashtra State Board (Balbharati)", "9", "Hindi"): [
        {"source": "902030027.pdf", "chapter": "Chapter 1: चाँदनी रात (मैथिलीशरण गुप्त)", "start_page": 11, "end_page": 12, "total_doc_pages": 100, "chunks_count": 2},
        {"source": "902030027.pdf", "chapter": "Chapter 2: बिल्ली का बिलांगुड़ा", "start_page": 13, "end_page": 16, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "902030027.pdf", "chapter": "Chapter 3: कबीर (हजारी प्रसाद द्विवेदी)", "start_page": 17, "end_page": 21, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "902030027.pdf", "chapter": "Chapter 4: किताबें (गुलज़ार)", "start_page": 22, "end_page": 25, "total_doc_pages": 100, "chunks_count": 4},
    ],
    ("Maharashtra State Board (Balbharati)", "10", "Hindi"): [
        {"source": "1002030027.pdf", "chapter": "Chapter 1: भारत महिमा (जयशंकर प्रसाद)", "start_page": 11, "end_page": 12, "total_doc_pages": 116, "chunks_count": 2},
        {"source": "1002030027.pdf", "chapter": "Chapter 2: लक्ष्मी (गुरुदयाल सिंह)", "start_page": 13, "end_page": 17, "total_doc_pages": 116, "chunks_count": 5},
        {"source": "1002030027.pdf", "chapter": "Chapter 3: वाह रे ! हमदर्द", "start_page": 18, "end_page": 22, "total_doc_pages": 116, "chunks_count": 5},
    ],
    ("Maharashtra State Board (Balbharati)", "8", "Marathi"): [
        {"source": "801020020.pdf", "chapter": "Chapter 1: आम्ही चालवू हा पुढे वारसा", "start_page": 12, "end_page": 12, "total_doc_pages": 66, "chunks_count": 1},
        {"source": "801020020.pdf", "chapter": "Chapter 2: मी चित्रकार कसा झालो", "start_page": 13, "end_page": 16, "total_doc_pages": 66, "chunks_count": 4},
        {"source": "801020020.pdf", "chapter": "Chapter 3: प्रभात (कविता)", "start_page": 17, "end_page": 20, "total_doc_pages": 66, "chunks_count": 4},
    ],
    ("Maharashtra State Board (Balbharati)", "11", "Accountancy"): [
        {"source": "1103020425.pdf", "chapter": "Chapter 1: Introduction to Book-keeping and Accountancy", "start_page": 11, "end_page": 29, "total_doc_pages": 392, "chunks_count": 19},
        {"source": "1103020425.pdf", "chapter": "Chapter 2: Meaning and Fundamentals of Double Entry Book-keeping", "start_page": 30, "end_page": 62, "total_doc_pages": 392, "chunks_count": 33},
        {"source": "1103020425.pdf", "chapter": "Chapter 3: Journal", "start_page": 63, "end_page": 105, "total_doc_pages": 392, "chunks_count": 43},
    ],
    ("Maharashtra State Board (Balbharati)", "12", "Accountancy"): [
        {"source": "1203020425.pdf", "chapter": "Chapter 1: Introduction to Partnership and Partnership Final Accounts", "start_page": 11, "end_page": 65, "total_doc_pages": 412, "chunks_count": 55},
        {"source": "1203020425.pdf", "chapter": "Chapter 2: Accounts of 'Not for Profit' Concerns", "start_page": 66, "end_page": 124, "total_doc_pages": 412, "chunks_count": 59},
    ],
    ("CBSE", "10", "Sanskrit"): [
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 1: शुचिपर्यावरणम्", "start_page": 1, "end_page": 8, "total_doc_pages": 88, "chunks_count": 8},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 2: बुद्धिर्बलवती सदा", "start_page": 9, "end_page": 16, "total_doc_pages": 88, "chunks_count": 8},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 3: जननी तुल्यवत्सला", "start_page": 17, "end_page": 24, "total_doc_pages": 88, "chunks_count": 8},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 4: सुभाषितानि", "start_page": 25, "end_page": 32, "total_doc_pages": 88, "chunks_count": 8},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 5: सौहार्दं प्रकृतेः शोभा", "start_page": 33, "end_page": 42, "total_doc_pages": 88, "chunks_count": 10},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 6: विचित्राः साक्षी", "start_page": 43, "end_page": 50, "total_doc_pages": 88, "chunks_count": 8},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 7: सूक्तयः", "start_page": 51, "end_page": 58, "total_doc_pages": 88, "chunks_count": 8},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 8: भूकम्पविभीषिका", "start_page": 59, "end_page": 68, "total_doc_pages": 88, "chunks_count": 10},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 9: प्राणेभ्योऽपि प्रियः सुहृद्", "start_page": 69, "end_page": 78, "total_doc_pages": 88, "chunks_count": 10},
        {"source": "CBSE_Class10_Sanskrit_Shemushi.pdf", "chapter": "Chapter 10: अन्योक्तयः", "start_page": 79, "end_page": 88, "total_doc_pages": 88, "chunks_count": 10},
    ],
    ("CBSE", "8", "Sanskrit"): [
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 1: सुभाषितानि", "start_page": 1, "end_page": 6, "total_doc_pages": 52, "chunks_count": 6},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 2: बिलस्य वाणी न कदापि मे श्रुता", "start_page": 7, "end_page": 12, "total_doc_pages": 52, "chunks_count": 6},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 3: डिजीभारतम्", "start_page": 13, "end_page": 18, "total_doc_pages": 52, "chunks_count": 6},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 4: सदैव पुरतो निधेहि चरणम्", "start_page": 19, "end_page": 24, "total_doc_pages": 52, "chunks_count": 6},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 5: कण्टकेनैव कण्टकम्", "start_page": 25, "end_page": 30, "total_doc_pages": 52, "chunks_count": 6},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 6: गृहं शून्यं सुतां विना", "start_page": 31, "end_page": 38, "total_doc_pages": 52, "chunks_count": 8},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 7: भारतजनताऽहम्", "start_page": 39, "end_page": 44, "total_doc_pages": 52, "chunks_count": 6},
        {"source": "CBSE_Class8_Sanskrit_Ruchira.pdf", "chapter": "Chapter 8: संसारसागरस्य नायकाः", "start_page": 45, "end_page": 52, "total_doc_pages": 52, "chunks_count": 8},
    ],
    ("ICSE (CISCE)", "10", "Sanskrit"): [
        {"source": "ICSE_Class10_Sanskrit.pdf", "chapter": "Chapter 1: विद्यामहिमा", "start_page": 1, "end_page": 10, "total_doc_pages": 52, "chunks_count": 10},
        {"source": "ICSE_Class10_Sanskrit.pdf", "chapter": "Chapter 2: सत्सङ्गतिः", "start_page": 11, "end_page": 20, "total_doc_pages": 52, "chunks_count": 10},
        {"source": "ICSE_Class10_Sanskrit.pdf", "chapter": "Chapter 3: कर्मण्येवाधिकारस्ते", "start_page": 21, "end_page": 30, "total_doc_pages": 52, "chunks_count": 10},
        {"source": "ICSE_Class10_Sanskrit.pdf", "chapter": "Chapter 4: परोपकारः", "start_page": 31, "end_page": 40, "total_doc_pages": 52, "chunks_count": 10},
        {"source": "ICSE_Class10_Sanskrit.pdf", "chapter": "Chapter 5: नीतिश्लोकाः", "start_page": 41, "end_page": 52, "total_doc_pages": 52, "chunks_count": 12},
    ],
}


def normalize_board(raw: str) -> str:
    if not raw:
        return ""
    key = raw.strip().lower()
    return BOARD_NORMALIZE.get(key, raw.strip())


def normalize_grade(raw: str) -> str:
    if not raw:
        return ""
    m = re.search(r"\b(1[0-2]|[1-9])\b", str(raw))
    return m.group(1) if m else str(raw).strip()


def normalize_subject(raw: str) -> str:
    if not raw:
        return ""
    clean = raw.strip().lower()
    # Strip parenthetical annotations if needed
    base_match = re.sub(r"\s*\([^)]*\)", "", clean).strip()
    return SUBJECT_NORMALIZE.get(clean, SUBJECT_NORMALIZE.get(base_match, raw.strip().title()))


# Global cache for PDF filename -> filepath on disk
_PDF_FILE_INDEX: Dict[str, str] = {}


def build_pdf_file_index() -> Dict[str, str]:
    """Scan backend/data directory and project root for all PDF files and index by filename."""
    global _PDF_FILE_INDEX
    if _PDF_FILE_INDEX:
        return _PDF_FILE_INDEX

    index: Dict[str, str] = {}
    search_dirs = [DATA_DIR, BASE_DIR.parent, BASE_DIR]
    for sdir in search_dirs:
        if sdir.exists():
            for root, _, files in os.walk(sdir):
                if any(ignored in root.lower() for ignored in ["node_modules", ".git", "venv", ".venv", "dist", ".system_generated"]):
                    continue
                for file in files:
                    if file.lower().endswith(".pdf"):
                        full_path = os.path.join(root, file)
                        index[file.lower()] = full_path
    _PDF_FILE_INDEX = index
    return _PDF_FILE_INDEX


def find_pdf_path(source_name: str) -> Optional[str]:
    """Resolve a source filename (e.g., 'ICSE_Class10_Physics_Textbook.pdf') to absolute path on disk."""
    if not source_name:
        return None

    if os.path.exists(source_name):
        return os.path.abspath(source_name)

    pdf_index = build_pdf_file_index()
    key = os.path.basename(source_name).lower()
    if key in pdf_index:
        return pdf_index[key]

    for name, path in pdf_index.items():
        if key in name or name in key:
            return path

    return None


@lru_cache(maxsize=256)
def render_pdf_page_png(
    pdf_path: str,
    page_number: int,
    chapter: str = "",
    dpi: int = 150,
) -> Optional[bytes]:
    """Render a textbook page to PNG bytes using PyMuPDF, properly handling book-relative vs PDF-absolute offsets."""
    resolved_path = find_pdf_path(pdf_path) or pdf_path
    if not os.path.exists(resolved_path):
        return None

    try:
        doc = pymupdf.open(resolved_path)
        total_doc_pages = len(doc)
        base_name = os.path.basename(resolved_path).lower()

        target_page = page_number

        # 1. Check if a chapter was provided to calculate exact chapter-based offset
        ch_offset = None
        if chapter:
            c_num_match = re.search(r'\b(?:chapter|chp|unit)?\s*(\d{1,2})\b', chapter, re.I)
            c_num = int(c_num_match.group(1)) if c_num_match else None
            # Search in KNOWN_CHAPTERS_MAP
            for (b, g, s), ch_list in KNOWN_CHAPTERS_MAP.items():
                for ch_item in ch_list:
                    if ch_item.get("source", "").lower() == base_name or base_name in ch_item.get("source", "").lower():
                        match_title = chapter.lower() in ch_item["chapter"].lower() or ch_item["chapter"].lower() in chapter.lower()
                        match_num = c_num is not None and (f"chapter {c_num}:" in ch_item["chapter"].lower() or f"chapter {c_num}" == ch_item["chapter"].lower())
                        if match_title or match_num:
                            ch_offset = ch_item["start_page"]
                            break
                if ch_offset is not None:
                    break

        if ch_offset is not None:
            # If the user passed a relative page number (e.g. page 1, 2, 3 of that chapter)
            if page_number < ch_offset:
                target_page = ch_offset + (page_number - 1)
            else:
                target_page = page_number
        elif page_number < 11 and total_doc_pages >= 20:
            # In official full-book PDF scans (Balbharti / State Board / NCERT), pages 1..10 are front matter (cover, preface, TOC).
            # Printed Page 1 of lesson content begins at PDF page 11 (doc[10]).
            target_page = 10 + page_number

        target_page = max(1, min(target_page, total_doc_pages))
        page = doc[target_page - 1]
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        doc.close()
        return img_bytes
    except Exception as e:
        print(f"[textbook_service] Error rendering PDF page {pdf_path}:{page_number}: {e}")
        return None


@lru_cache(maxsize=256)
def render_generated_textbook_page_png(
    board: str = "",
    grade: str = "",
    subject: str = "",
    chapter: str = "",
    page_number: int = 1,
    topic: str = "",
    dpi: int = 150,
) -> Optional[bytes]:
    """Generate an authentic textbook chapter study page image using PIL with dynamic page content."""
    try:
        from PIL import Image, ImageDraw
        import io

        w, h = 800, 1100
        img = Image.new("RGB", (w, h), color="#FAF9F6")
        draw = ImageDraw.Draw(img)

        # Double borders
        draw.rectangle([(16, 16), (w - 16, h - 16)], outline="#D0D7DE", width=2)
        draw.rectangle([(22, 22), (w - 22, h - 22)], outline="#E1E4E8", width=1)

        # Top Header Bar
        draw.rectangle([(22, 22), (w - 22, 95)], fill="#0F172A")

        board_clean = (board or "OFFICIAL BOARD CURRICULUM").upper()
        grade_clean = f"CLASS {grade}" if grade else "SECONDARY CURRICULUM"
        subj_clean = (subject or "STUDY SUBJECT").upper()
        chap_clean = (chapter or f"{subj_clean} CHAPTER").upper()

        # Header text
        draw.text((40, 36), board_clean[:55], fill="#94A3B8")
        draw.text((40, 58), f"{grade_clean} • {subj_clean} • GUIDED MASTERY", fill="#FFFFFF")

        # Chapter Banner with Page Indicator
        draw.rectangle([(40, 115), (w - 40, 195)], fill="#F1F5F9", outline="#CBD5E1", width=1)
        draw.text((60, 130), f"PAGE {page_number} STUDY SCAN", fill="#2563EB")
        draw.text((60, 155), chap_clean[:65], fill="#0F172A")

        # Dynamic Section Content based on page_number
        if page_number == 1:
            sec1_title = "SECTION 1: CHAPTER FOUNDATIONS & CORE DEFINITIONS"
            sec1_bullets = [
                f"• Focus: Foundational principles and kickoff concepts of {chap_clean[:40]}.",
                "• Key Terminology: Core definitions, terminology, and historical context.",
                "• Line-by-Line Pedagogy: Day-1 classroom breakdown with real-world hook.",
                "• Learning Objective: Build strong conceptual bedrock before moving to derivations.",
            ]
            sec2_title = "SECTION 2: WORKED INTRODUCTORY EXAMPLES"
            sec2_bullets = [
                "1. Fundamental Rule / Formula Statement & Context.",
                "2. Standard Example 1.1: Step-by-step breakdown and primary application.",
                "3. Common Pitfalls: Frequent misunderstandings and memory cues.",
            ]
            sec3_q = f"✓ Comprehension Check: Explain the core definition of this page in your own words."
        elif page_number == 2:
            sec1_title = "SECTION 1: MATHEMATICAL / CONCEPTUAL FORMULATIONS"
            sec1_bullets = [
                f"• Focus: In-depth formulas, relations, and equations for {chap_clean[:40]}.",
                "• Step-by-Step Derivation: Logical flow from first principles.",
                "• Scientific Insights: Variable relationships and dimensional units.",
                "• Line Pacing: Detailed examination of textbook diagrams and graphs.",
            ]
            sec2_title = "SECTION 2: APPLICATION DRILLS & NUMERICAL EXAMPLES"
            sec2_bullets = [
                "1. Worked Problem 2.1: Intermediate complexity problem walkthrough.",
                "2. Calculation Strategy: Unit conversion and algebraic simplification.",
                "3. Exam Tip: High-yield board exam presentation format.",
            ]
            sec3_q = f"✓ Comprehension Check: Solve the Page 2 check question posed by Tark in the chat."
        elif page_number == 3:
            sec1_title = "SECTION 1: ADVANCED MECHANISMS & EXPERIMENTAL ANALYSIS"
            sec1_bullets = [
                f"• Focus: Advanced sub-topics, experimental procedures, and case studies.",
                "• Process Flow: Sequential steps in experiments and chemical/physical processes.",
                "• Observational Table & Data Interpretation: Analysis of textbook figures.",
                "• Critical Thinking: Connecting micro-mechanisms to macro-observations.",
            ]
            sec2_title = "SECTION 2: CRITICAL CASE STUDIES & EXCEPTIONS"
            sec2_bullets = [
                "1. Case Study 3.1: Real-world industrial or natural manifestation.",
                "2. Boundary Conditions: Where standard assumptions change.",
                "3. Comparison Matrix: Distinguishing closely related concepts.",
            ]
            sec3_q = f"✓ Comprehension Check: Identify key differences between Case A and Case B from this page."
        else:
            sec1_title = f"SECTION 1: COMPREHENSIVE SYNTHESIS & REVIEW (PAGE {page_number})"
            sec1_bullets = [
                f"• Focus: Synthesis of {chap_clean[:40]} and mastery consolidation.",
                "• Cumulative Linking: How this concept bridges to upcoming chapters.",
                "• High-Yield Exam Trends: Past 5-year paper problem formats.",
                "• Speed Drills: Rapid-recall memory sheets and flashcard prompts.",
            ]
            sec2_title = "SECTION 2: PAST PAPER QUESTIONS & EXERCISES"
            sec2_bullets = [
                f"1. Section Exercise {page_number}.1: High-weightage multi-step problem.",
                "2. Self-Evaluation: Model answer rubric and marking scheme.",
                "3. Speed Shortcut: Efficient calculation techniques.",
            ]
            sec3_q = f"✓ Comprehension Check: Ready for the chapter milestone quiz? Type 'ready' in chat!"

        # Section 1
        draw.rectangle([(40, 215), (w - 40, 480)], fill="#FFFFFF", outline="#E2E8F0", width=1)
        draw.rectangle([(40, 215), (w - 40, 255)], fill="#F8FAFC")
        draw.text((60, 227), sec1_title, fill="#334155")
        for idx, b in enumerate(sec1_bullets):
            draw.text((60, 275 + (idx * 35)), b, fill="#1E293B" if idx == 0 else "#475569")
        draw.text((60, 425), "✦ Official Textbook Syllabus Grounded Learning Card ✦", fill="#64748B")

        # Section 2
        draw.rectangle([(40, 505), (w - 40, 780)], fill="#FFFFFF", outline="#E2E8F0", width=1)
        draw.rectangle([(40, 505), (w - 40, 545)], fill="#F8FAFC")
        draw.text((60, 517), sec2_title, fill="#334155")
        draw.text((60, 565), "• Key Breakdown & Walkthrough:", fill="#1E293B")
        for idx, b in enumerate(sec2_bullets):
            draw.text((60, 600 + (idx * 35)), f"  {b}", fill="#475569")
        draw.text((60, 715), "TIP: You can upload your physical school textbook photo anytime to match exact lines!", fill="#2563EB")

        # Section 3
        draw.rectangle([(40, 805), (w - 40, 1020)], fill="#F8FAFC", outline="#CBD5E1", width=1)
        draw.rectangle([(40, 805), (w - 40, 845)], fill="#E2E8F0")
        draw.text((60, 817), "SECTION 3: INTERACTIVE CHECKPOINT", fill="#0F172A")
        draw.text((60, 865), sec3_q, fill="#334155")
        draw.text((60, 905), f"✓ Dialogue: Answer Tark's check question in the chat to advance to Page {page_number + 1}.", fill="#475569")
        draw.text((60, 945), "✓ Progress: Recorded automatically to your study milestone dashboard.", fill="#475569")

        # Footer
        draw.line([(40, 1045), (w - 40, 1045)], fill="#E2E8F0", width=1)
        draw.text((40, 1060), f"{board_clean[:40]} • {subj_clean[:20]} • {grade_clean}", fill="#94A3B8")
        draw.text((w - 240, 1060), f"PAGE {page_number} OF CHAPTER", fill="#64748B")

        out = io.BytesIO()
        img.save(out, format="PNG")
        return out.getvalue()
    except Exception as e:
        print(f"[textbook_service] Error generating textbook page PNG: {e}")
        return None


def get_pdf_page_text(pdf_path: str, page_number: int, chapter: str = "") -> str:
    """Extract raw text from a textbook PDF page with proper offset resolution."""
    resolved_path = find_pdf_path(pdf_path) or pdf_path
    if not os.path.exists(resolved_path):
        return ""

    try:
        doc = pymupdf.open(resolved_path)
        total_doc_pages = len(doc)
        base_name = os.path.basename(resolved_path).lower()

        target_page = page_number

        # 1. Check if a chapter was provided to calculate exact chapter-based offset
        ch_offset = None
        if chapter:
            c_num_match = re.search(r'\b(?:chapter|chp|unit)?\s*(\d{1,2})\b', chapter, re.I)
            c_num = int(c_num_match.group(1)) if c_num_match else None
            for (b, g, s), ch_list in KNOWN_CHAPTERS_MAP.items():
                for ch_item in ch_list:
                    if ch_item.get("source", "").lower() == base_name or base_name in ch_item.get("source", "").lower():
                        match_title = chapter.lower() in ch_item["chapter"].lower() or ch_item["chapter"].lower() in chapter.lower()
                        match_num = c_num is not None and (f"chapter {c_num}:" in ch_item["chapter"].lower() or f"chapter {c_num}" == ch_item["chapter"].lower())
                        if match_title or match_num:
                            ch_offset = ch_item["start_page"]
                            break
                if ch_offset is not None:
                    break

        if ch_offset is not None:
            if page_number < ch_offset:
                target_page = ch_offset + (page_number - 1)
            else:
                target_page = page_number
        elif page_number < 11 and total_doc_pages >= 20:
            target_page = 10 + page_number

        target_page = max(1, min(target_page, total_doc_pages))
        page = doc[target_page - 1]
        text = page.get_text("text")
        doc.close()
        return text.strip()
    except Exception as e:
        print(f"[textbook_service] Error getting PDF text {pdf_path}:{page_number}: {e}")
        return ""


def get_available_textbook_catalog() -> List[Dict[str, Any]]:
    """Query tark_rag.db for available Board + Grade + Subject + Source catalog."""
    if not RAG_DB_PATH.exists():
        return []

    try:
        conn = sqlite3.connect(RAG_DB_PATH)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT board, grade, subject, count(DISTINCT source), count(*) 
            FROM chunks 
            WHERE source IS NOT NULL 
            GROUP BY board, grade, subject 
            ORDER BY board, CAST(grade AS INTEGER), subject
            """
        )
        rows = cur.fetchall()
        conn.close()

        catalog = []
        for board, grade, subject, source_count, chunk_count in rows:
            catalog.append({
                "board": board,
                "grade": grade,
                "subject": subject,
                "sources_count": source_count,
                "chunks_count": chunk_count,
            })
        return catalog
    except Exception as e:
        print(f"[textbook_service] Error querying catalog: {e}")
        return []


def parse_textbook_toc(pdf_path: str, source_name: str = "") -> List[Dict[str, Any]]:
    """Robust universal Table of Contents and Chapter offset parser."""
    if not pdf_path or not os.path.exists(pdf_path):
        return []

    try:
        doc = pymupdf.open(pdf_path)
        total_pages = len(doc)

        # 1. Identify TOC page(s)
        toc_pages = []
        for pno in range(1, min(16, total_pages + 1)):
            text = doc[pno - 1].get_text("text")
            if re.search(r'\b(?:INDEX|CONTENTS|Index|Contents|Anukramanika|Title of Lesson|Sr No\.)\b', text, re.I):
                if not re.search(r'\b(?:practicals|specimen|activity sheet)\b', text, re.I):
                    toc_pages.append(pno)

        # If none found without practicals, fallback
        if not toc_pages:
            for pno in range(1, min(16, total_pages + 1)):
                text = doc[pno - 1].get_text("text")
                if re.search(r'\b(?:INDEX|CONTENTS|Index|Contents|Anukramanika|Title of Lesson)\b', text, re.I):
                    toc_pages.append(pno)

        raw_chapters = []

        for tp in toc_pages:
            text = doc[tp - 1].get_text("text")
            raw_lines = text.splitlines()
            lines = [re.sub(r'[\t\r\xa0\u2009]+', ' ', l).strip() for l in raw_lines]
            lines = [l for l in lines if l]

            for i, line in enumerate(lines):
                # Case A: Standalone number line like '1.'
                m_num_only = re.match(r'^(?:(?:CHAPTER|Chapter)\s+)?(\d{1,2})[\.\:\)]*$', line)
                if m_num_only:
                    cnum = int(m_num_only.group(1))
                    if 1 <= cnum <= 40 and i + 1 < len(lines):
                        next_line = lines[i + 1]
                        clean_title = re.sub(r'[\.\s_–—\-]+$', '', next_line).strip()
                        sp, ep = None, None
                        for look in lines[i+1:i+4]:
                            pm = re.search(r'(\d{1,3})\s+to\s+(\d{1,3})', look)
                            if pm:
                                sp, ep = int(pm.group(1)), int(pm.group(2))
                                break
                            pm2 = re.search(r'^\s*(\d{1,3})\s*$', look)
                            if pm2 and int(pm2.group(1)) > 0:
                                sp = int(pm2.group(1))
                                break
                        if len(clean_title) >= 3 and not any(bad in clean_title.lower() for bad in ['chapters', 'pages', 'standard', 'index', 'contents', 'practicals', 'specimen', 'answers', 'fundamental']):
                            raw_chapters.append({
                                "num": cnum,
                                "title": f"Chapter {cnum}: {clean_title}",
                                "book_sp": sp,
                                "book_ep": ep,
                                "toc_page": tp,
                            })
                    continue

                # Case B: Number and title on same line
                m_inline = re.match(r'^(?:(?:CHAPTER|Chapter)\s+)?(\d{1,2})[\.\:\)]\s+([A-Za-z][^0-9]+)', line)
                if m_inline:
                    cnum = int(m_inline.group(1))
                    raw_title = m_inline.group(2)
                    clean_title = re.sub(r'[\.\s_–—\-]+$', '', raw_title).strip()
                    sp, ep = None, None
                    pm_curr = re.search(r'[\.\s_–—\-]{2,}\s*(\d{1,3})(?:\s+to\s+(\d{1,3}))?', line)
                    if pm_curr:
                        sp = int(pm_curr.group(1))
                        if pm_curr.group(2):
                            ep = int(pm_curr.group(2))
                    if sp is None:
                        for look in lines[i+1:i+3]:
                            pm = re.search(r'(\d{1,3})\s+to\s+(\d{1,3})', look)
                            if pm:
                                sp, ep = int(pm.group(1)), int(pm.group(2))
                                break
                            pm2 = re.search(r'^\s*(\d{1,3})\s*$', look)
                            if pm2 and int(pm2.group(1)) > 0:
                                sp = int(pm2.group(1))
                                break
                    if len(clean_title) >= 3 and not any(bad in clean_title.lower() for bad in ['chapters', 'pages', 'standard', 'index', 'contents', 'practicals', 'specimen', 'answers', 'fundamental']):
                        raw_chapters.append({
                            "num": cnum,
                            "title": f"Chapter {cnum}: {clean_title}",
                            "book_sp": sp,
                            "book_ep": ep,
                            "toc_page": tp,
                        })
                    continue

        # Deduplicate
        seen_nums = set()
        unique_chapters = []
        for c in raw_chapters:
            if c["num"] not in seen_nums:
                seen_nums.add(c["num"])
                unique_chapters.append(c)

        unique_chapters.sort(key=lambda x: x["num"])

        if unique_chapters:
            first_ch = unique_chapters[0]
            first_title_core = re.sub(r'^Chapter \d+:\s*', '', first_ch["title"]).strip().lower()

            pdf_offset = None
            search_start = (first_ch.get("toc_page") or 1) + 1
            for pno in range(search_start, min(total_pages + 1, search_start + 25)):
                text = doc[pno - 1].get_text("text").lower()
                if first_title_core[:15] in text or (f"1." in text and first_title_core[:8] in text) or ("chapter 1" in text):
                    if first_ch.get("book_sp") is not None:
                        pdf_offset = (pno - first_ch["book_sp"])
                    else:
                        pdf_offset = pno - 1
                    break

            if pdf_offset is None:
                last_toc = max(toc_pages) if toc_pages else 1
                pdf_offset = max(0, last_toc)

            # For books without explicit book_sp, search body headings
            if any(c.get("book_sp") is None for c in unique_chapters):
                for ch in unique_chapters:
                    cnum = ch["num"]
                    core_title = re.sub(r'^Chapter \d+:\s*', '', ch["title"]).strip().lower()
                    for pno in range(1, total_pages + 1):
                        if pno in toc_pages:
                            continue
                        ptext = doc[pno - 1].get_text("text").lower()
                        if f"chapter {cnum}" in ptext or (core_title[:15] in ptext and f"{cnum}" in ptext):
                            ch["pdf_sp"] = pno
                            break

            final_list = []
            for i, ch in enumerate(unique_chapters):
                if ch.get("pdf_sp") is not None:
                    pdf_sp = ch["pdf_sp"]
                elif ch.get("book_sp") is not None:
                    pdf_sp = ch["book_sp"] + pdf_offset
                else:
                    pdf_sp = (i + 1) * 2 + pdf_offset

                pdf_sp = max(1, min(pdf_sp, total_pages))

                if ch.get("book_ep") is not None:
                    pdf_ep = ch["book_ep"] + pdf_offset
                elif i + 1 < len(unique_chapters):
                    next_ch = unique_chapters[i + 1]
                    if next_ch.get("pdf_sp") is not None:
                        pdf_ep = next_ch["pdf_sp"] - 1
                    elif next_ch.get("book_sp") is not None:
                        pdf_ep = next_ch["book_sp"] + pdf_offset - 1
                    else:
                        pdf_ep = pdf_sp + 1
                else:
                    pdf_ep = total_pages

                pdf_ep = max(pdf_sp, min(pdf_ep, total_pages))

                final_list.append({
                    "source": source_name or os.path.basename(pdf_path),
                    "chapter": ch["title"],
                    "start_page": pdf_sp,
                    "end_page": pdf_ep,
                    "total_doc_pages": total_pages,
                    "chunks_count": max(1, pdf_ep - pdf_sp + 1),
                })

            doc.close()
            return final_list

        doc.close()
    except Exception as e:
        print(f"[textbook_service] Error parsing TOC in {pdf_path}: {e}")

    return []


def get_chapters_for_subject(board: str, grade: str, subject: str) -> List[Dict[str, Any]]:
    """Discover chapters and starting pages for a board/grade/subject."""
    nb = normalize_board(board)
    ng = normalize_grade(grade)
    ns = normalize_subject(subject)

    # 0. Check known chapters map
    known_chs = KNOWN_CHAPTERS_MAP.get((nb, ng, ns)) or KNOWN_CHAPTERS_MAP.get((nb, ng, subject.strip()))
    if known_chs:
        return known_chs

    # 1. Check known textbook map for direct file match
    direct_file = KNOWN_TEXTBOOK_MAP.get((nb, ng, ns)) or KNOWN_TEXTBOOK_MAP.get((nb, ng, subject.strip()))
    if direct_file:
        pdf_path = find_pdf_path(direct_file)
        if pdf_path:
            chs = parse_textbook_toc(pdf_path, direct_file)
            if chs:
                return chs

    # 2. Check ICSE generated textbooks pattern: ICSE_Class{grade}_{subject}_Textbook.pdf
    if "icse" in nb.lower():
        clean_subj = ns.replace(" ", "")
        candidate_name = f"ICSE_Class{ng}_{clean_subj}_Textbook.pdf"
        pdf_path = find_pdf_path(candidate_name)
        if pdf_path:
            chs = parse_textbook_toc(pdf_path, candidate_name)
            if chs:
                return chs

    # 3. Query tark_rag.db for sources and chunks
    if RAG_DB_PATH.exists():
        try:
            conn = sqlite3.connect(RAG_DB_PATH)
            cur = conn.cursor()
            cur.execute(
                """
                SELECT source, chapter, MIN(page), MAX(page), COUNT(*)
                FROM chunks
                WHERE (board = ? OR board LIKE ?)
                  AND grade = ?
                  AND (subject = ? OR subject LIKE ?)
                GROUP BY source, chapter
                ORDER BY MIN(page) ASC
                """,
                (nb, f"%{nb}%", ng, ns, f"%{ns}%")
            )
            rows = cur.fetchall()
            conn.close()

            results = []
            for source, chapter, min_page, max_page, count in rows:
                if not source:
                    continue
                pdf_path = find_pdf_path(source)
                if pdf_path:
                    # Try parsing TOC from this PDF
                    parsed = parse_textbook_toc(pdf_path, source)
                    if parsed:
                        return parsed

                title = chapter
                if not title or title.lower() in ("none", "null", ""):
                    title = f"{ns} Chapter {len(results)+1}"

                results.append({
                    "source": source,
                    "chapter": title,
                    "start_page": min_page or 1,
                    "end_page": max_page or min_page or 1,
                    "total_doc_pages": max_page or min_page or 1,
                    "chunks_count": count,
                })

            if results:
                return results
        except Exception as e:
            print(f"[textbook_service] Error querying RAG DB: {e}")

    return []


def generate_page_schedule_milestones(
    board: str,
    grade: str,
    subject: str,
    chapter_name: str = "",
    start_page: Optional[int] = None,
    end_page: Optional[int] = None,
    source: Optional[str] = None,
    pages_per_day: int = 1,
    selected_chapters: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Generate structured page-by-page milestones for a study schedule across one or multiple chapters."""
    nb = normalize_board(board)
    ng = normalize_grade(grade)
    ns = normalize_subject(subject)

    all_known_chapters = get_chapters_for_subject(nb, ng, ns)

    # 1. If explicit list of selected chapters was provided
    target_chapters: List[Dict[str, Any]] = []
    if selected_chapters and len(selected_chapters) > 0:
        for sc in selected_chapters:
            if isinstance(sc, dict):
                target_chapters.append(sc)
            elif isinstance(sc, str):
                target_chapters.append({"chapter": sc})

    # 2. Check if chapter_name contains multiple chapters or numbers (e.g. "chp 1, 2, 3" or "Chapter 1, Chapter 2")
    if not target_chapters and chapter_name:
        raw_str = chapter_name.strip()
        # Check for multiple numbers like "chp 1,2,3" or "1, 2, 3"
        nums = re.findall(r'\b\d{1,2}\b', raw_str)
        if len(nums) > 1 and any(kw in raw_str.lower() for kw in ('chp', 'chapter', 'chapters', 'unit', ',', 'and', 'to', '-')):
            # Multiple chapters requested
            matched_chaps = []
            for n_str in nums:
                c_num = int(n_str)
                # Find in known chapters
                found = None
                for kc in all_known_chapters:
                    m = re.search(r'\b(?:chapter|chp|unit)?\s*(\d{1,2})\b', kc["chapter"], re.I)
                    if m and int(m.group(1)) == c_num:
                        found = kc
                        break
                if found:
                    matched_chaps.append(found)
                else:
                    matched_chaps.append({
                        "chapter": f"Chapter {c_num}",
                        "start_page": 1,
                        "end_page": 6,
                        "source": source or "",
                    })
            if matched_chaps:
                target_chapters = matched_chaps

    # 3. Fallback: single chapter
    if not target_chapters:
        ch_title = chapter_name or (all_known_chapters[0]["chapter"] if all_known_chapters else f"{ns} Chapter 1")
        ch_src = source
        ch_sp = start_page
        ch_ep = end_page

        for ch in all_known_chapters:
            if ch_title and (ch_title.lower() in ch["chapter"].lower() or ch["chapter"].lower() in ch_title.lower()):
                ch_src = ch_src or ch.get("source")
                ch_sp = ch_sp or ch.get("start_page")
                ch_ep = ch_ep or ch.get("end_page")
                ch_title = ch.get("chapter", ch_title)
                break

        target_chapters = [{
            "chapter": ch_title,
            "start_page": ch_sp or 1,
            "end_page": ch_ep or ((ch_sp or 1) + 5),
            "source": ch_src or "",
        }]

    # Build sequential milestones across all target chapters
    milestones = []
    m_idx = 1

    for ch_info in target_chapters:
        c_title = ch_info.get("chapter", f"{ns} Chapter")
        c_clean = re.sub(r'\(Pages\s+\d+–\d+\)', '', c_title).strip()
        c_src = ch_info.get("source") or source or ""
        sp = int(ch_info.get("start_page") or 1)
        ep = int(ch_info.get("end_page") or (sp + 5))
        if ep < sp:
            ep = sp

        curr_page = sp
        while curr_page <= ep:
            batch_end = min(curr_page + pages_per_day - 1, ep)
            if curr_page == batch_end:
                page_label = f"Page {curr_page}"
                desc = f"Read and master Page {curr_page} of {c_clean}. Understand core concepts, diagrams, and formulas with Tark's step-by-step guidance."
            else:
                page_label = f"Pages {curr_page}–{batch_end}"
                desc = f"Read and master Pages {curr_page} to {batch_end} of {c_clean}. Complete concept breakdowns and interactive checkpoints."

            milestones.append({
                "id": f"m-pbp-{m_idx}",
                "title": f"{page_label}: {c_clean}",
                "target_date": f"Session {m_idx}",
                "completed": False,
                "notes": desc,
                "study_topic": f"{c_clean} - {page_label}",
                "textbook_source": c_src,
                "page_number": curr_page,
                "chapter": c_clean,
            })
            curr_page = batch_end + 1
            m_idx += 1

    return milestones
