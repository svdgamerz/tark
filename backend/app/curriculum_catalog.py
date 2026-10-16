"""Authoritative Multi-Board Curriculum Catalog for Tark.

Provides complete, verified Table of Contents and chapter metadata across:
- Maharashtra State Board (Balbharati) (Classes 6-12)
- CBSE (NCERT) (Classes 6-12)
- ICSE / CISCE (Classes 9-10)
- IGCSE (Cambridge) (Classes 9-10)

Covers all core subjects: Science, Mathematics, History, Civics / Political Science,
Geography, Social Science, Economics, English, Hindi, Marathi, Sanskrit, Accountancy, Commerce.
"""
from __future__ import annotations
from typing import Any, Dict, List, Tuple

# Direct PDF source mappings
KNOWN_TEXTBOOK_MAP: Dict[Tuple[str, str, str], str] = {
    # Maharashtra State Board (Balbharati)
    ("Maharashtra State Board (Balbharati)", "10", "Science 1"): "1003000265.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Science 2"): "1003000270.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Science"): "1003000265.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Maths 1"): "1003000608.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Maths 2"): "1003000609.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Maths"): "1003000608.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Geography"): "1003020011.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "History"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Political Science"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Civics"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "History & Political Science"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "History & Civics"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Social Science"): "1003010491.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "English"): "1003030024.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Sanskrit"): "1001000604.pdf",
    ("Maharashtra State Board (Balbharati)", "10", "Hindi"): "1002030027.pdf",

    ("Maharashtra State Board (Balbharati)", "9", "Science"): "903020456.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Maths 1"): "903000608.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Maths 2"): "903000609.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Maths"): "903000608.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Geography"): "903020011.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "History"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Political Science"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Civics"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "History & Political Science"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "History & Civics"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Social Science"): "903010491.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "English"): "903030024.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Sanskrit"): "901000604.pdf",
    ("Maharashtra State Board (Balbharati)", "9", "Hindi"): "902030027.pdf",

    ("Maharashtra State Board (Balbharati)", "8", "Science"): "803020012.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Maths"): "803020004.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "History"): "803000584.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Civics"): "803000584.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "History & Civics"): "803000584.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Social Science"): "803000584.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Geography"): "803020011.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "English"): "803020001.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Sanskrit"): "801000604.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Marathi"): "801020020.pdf",
    ("Maharashtra State Board (Balbharati)", "8", "Hindi"): "802020020.pdf",

    ("Maharashtra State Board (Balbharati)", "7", "Science"): "703020012.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "Maths"): "703020004.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "History"): "703000584.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "Civics"): "703000584.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "History & Civics"): "703000584.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "Social Science"): "703000584.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "Geography"): "703020011.pdf",
    ("Maharashtra State Board (Balbharati)", "7", "English"): "703020001.pdf",

    ("Maharashtra State Board (Balbharati)", "6", "Science"): "603020012.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "Maths"): "603020004.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "History"): "603000584.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "Civics"): "603000584.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "History & Civics"): "603000584.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "Social Science"): "603000584.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "Geography"): "603020011.pdf",
    ("Maharashtra State Board (Balbharati)", "6", "English"): "603020001.pdf",

    ("Maharashtra State Board (Balbharati)", "11", "Defence Studies"): "1103010510.pdf",
    ("Maharashtra State Board (Balbharati)", "11", "Economics"): "1103020029.pdf",
    ("Maharashtra State Board (Balbharati)", "11", "Accountancy"): "1103020425.pdf",
    ("Maharashtra State Board (Balbharati)", "11", "Commerce"): "1103040026.pdf",

    ("Maharashtra State Board (Balbharati)", "12", "Defence Studies"): "1203010510.pdf",
    ("Maharashtra State Board (Balbharati)", "12", "Economics"): "1203020029.pdf",
    ("Maharashtra State Board (Balbharati)", "12", "Accountancy"): "1203020425.pdf",
    ("Maharashtra State Board (Balbharati)", "12", "Commerce"): "1203040026.pdf",
}

# Authoritative structured curriculum chapters
KNOWN_CHAPTERS_MAP: Dict[Tuple[str, str, str], List[Dict[str, Any]]] = {
    # =========================================================================
    # MAHARASHTRA STATE BOARD (BALBHARATI)
    # =========================================================================

    # --- STD 9 HISTORY (India after Independence 1961-2000) ---
    ("Maharashtra State Board (Balbharati)", "9", "History"): [
        {"source": "903010491.pdf", "chapter": "Chapter 1: Sources of History", "start_page": 10, "end_page": 13, "total_doc_pages": 108, "chunks_count": 4},
        {"source": "903010491.pdf", "chapter": "Chapter 2: India : Events after 1960", "start_page": 14, "end_page": 18, "total_doc_pages": 108, "chunks_count": 5},
        {"source": "903010491.pdf", "chapter": "Chapter 3: India's Internal Challenges", "start_page": 19, "end_page": 23, "total_doc_pages": 108, "chunks_count": 5},
        {"source": "903010491.pdf", "chapter": "Chapter 4: Economic Development", "start_page": 24, "end_page": 31, "total_doc_pages": 108, "chunks_count": 8},
        {"source": "903010491.pdf", "chapter": "Chapter 5: Education", "start_page": 32, "end_page": 39, "total_doc_pages": 108, "chunks_count": 8},
        {"source": "903010491.pdf", "chapter": "Chapter 6: Empowerment of Women and other Weaker Sections", "start_page": 40, "end_page": 45, "total_doc_pages": 108, "chunks_count": 6},
        {"source": "903010491.pdf", "chapter": "Chapter 7: Science and Technology", "start_page": 46, "end_page": 51, "total_doc_pages": 108, "chunks_count": 6},
        {"source": "903010491.pdf", "chapter": "Chapter 8: Industry and Trade", "start_page": 52, "end_page": 55, "total_doc_pages": 108, "chunks_count": 4},
        {"source": "903010491.pdf", "chapter": "Chapter 9: Changing Life : 1", "start_page": 56, "end_page": 60, "total_doc_pages": 108, "chunks_count": 5},
        {"source": "903010491.pdf", "chapter": "Chapter 10: Changing Life : 2", "start_page": 61, "end_page": 66, "total_doc_pages": 108, "chunks_count": 6},
    ],

    # --- STD 9 POLITICAL SCIENCE ---
    ("Maharashtra State Board (Balbharati)", "9", "Political Science"): [
        {"source": "903010491.pdf", "chapter": "Chapter 1: Post World War II Political Developments", "start_page": 67, "end_page": 73, "total_doc_pages": 108, "chunks_count": 7},
        {"source": "903010491.pdf", "chapter": "Chapter 2: India’s Foreign Policy", "start_page": 74, "end_page": 79, "total_doc_pages": 108, "chunks_count": 6},
        {"source": "903010491.pdf", "chapter": "Chapter 3: India’s Defence System", "start_page": 80, "end_page": 85, "total_doc_pages": 108, "chunks_count": 6},
        {"source": "903010491.pdf", "chapter": "Chapter 4: The United Nations", "start_page": 86, "end_page": 92, "total_doc_pages": 108, "chunks_count": 7},
        {"source": "903010491.pdf", "chapter": "Chapter 5: India and other countries", "start_page": 93, "end_page": 99, "total_doc_pages": 108, "chunks_count": 7},
        {"source": "903010491.pdf", "chapter": "Chapter 6: International Problems", "start_page": 100, "end_page": 108, "total_doc_pages": 108, "chunks_count": 9},
    ],

    # --- STD 9 GEOGRAPHY ---
    ("Maharashtra State Board (Balbharati)", "9", "Geography"): [
        {"source": "903020011.pdf", "chapter": "Chapter 1: Distributional Maps", "start_page": 11, "end_page": 18, "total_doc_pages": 116, "chunks_count": 8},
        {"source": "903020011.pdf", "chapter": "Chapter 2: Endogenetic Movements", "start_page": 19, "end_page": 32, "total_doc_pages": 116, "chunks_count": 14},
        {"source": "903020011.pdf", "chapter": "Chapter 3: Exogenetic Processes Part-1", "start_page": 33, "end_page": 39, "total_doc_pages": 116, "chunks_count": 7},
        {"source": "903020011.pdf", "chapter": "Chapter 4: Exogenetic Processes Part-2", "start_page": 40, "end_page": 50, "total_doc_pages": 116, "chunks_count": 11},
        {"source": "903020011.pdf", "chapter": "Chapter 5: Precipitation", "start_page": 51, "end_page": 59, "total_doc_pages": 116, "chunks_count": 9},
        {"source": "903020011.pdf", "chapter": "Chapter 6: The Properties of Sea Water", "start_page": 60, "end_page": 66, "total_doc_pages": 116, "chunks_count": 7},
        {"source": "903020011.pdf", "chapter": "Chapter 7: International Date Line", "start_page": 67, "end_page": 73, "total_doc_pages": 116, "chunks_count": 7},
        {"source": "903020011.pdf", "chapter": "Chapter 8: Introduction to Economics", "start_page": 74, "end_page": 76, "total_doc_pages": 116, "chunks_count": 3},
        {"source": "903020011.pdf", "chapter": "Chapter 9: Trade", "start_page": 77, "end_page": 84, "total_doc_pages": 116, "chunks_count": 8},
        {"source": "903020011.pdf", "chapter": "Chapter 10: Urbanisation", "start_page": 85, "end_page": 91, "total_doc_pages": 116, "chunks_count": 7},
        {"source": "903020011.pdf", "chapter": "Chapter 11: Transport and Communication", "start_page": 92, "end_page": 97, "total_doc_pages": 116, "chunks_count": 6},
        {"source": "903020011.pdf", "chapter": "Chapter 12: Tourism", "start_page": 98, "end_page": 116, "total_doc_pages": 116, "chunks_count": 19},
    ],

    # --- STD 9 SCIENCE AND TECHNOLOGY ---
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

    # --- STD 9 MATHEMATICS 1 (Algebra) ---
    ("Maharashtra State Board (Balbharati)", "9", "Maths 1"): [
        {"source": "903000608.pdf", "chapter": "Chapter 1: Sets", "start_page": 11, "end_page": 28, "total_doc_pages": 148, "chunks_count": 18},
        {"source": "903000608.pdf", "chapter": "Chapter 2: Real Numbers", "start_page": 29, "end_page": 47, "total_doc_pages": 148, "chunks_count": 19},
        {"source": "903000608.pdf", "chapter": "Chapter 3: Polynomials", "start_page": 48, "end_page": 65, "total_doc_pages": 148, "chunks_count": 18},
        {"source": "903000608.pdf", "chapter": "Chapter 4: Ratio and Proportion", "start_page": 66, "end_page": 83, "total_doc_pages": 148, "chunks_count": 18},
        {"source": "903000608.pdf", "chapter": "Chapter 5: Linear Equations in Two Variables", "start_page": 84, "end_page": 97, "total_doc_pages": 148, "chunks_count": 14},
        {"source": "903000608.pdf", "chapter": "Chapter 6: Financial Planning", "start_page": 98, "end_page": 116, "total_doc_pages": 148, "chunks_count": 19},
        {"source": "903000608.pdf", "chapter": "Chapter 7: Statistics", "start_page": 117, "end_page": 148, "total_doc_pages": 148, "chunks_count": 32},
    ],

    # --- STD 9 MATHEMATICS 2 (Geometry) ---
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

    # --- STD 10 HISTORY ---
    ("Maharashtra State Board (Balbharati)", "10", "History"): [
        {"source": "1003010491.pdf", "chapter": "Chapter 1: Historiography : Development in the West", "start_page": 10, "end_page": 16, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 2: Historiography : Indian Tradition", "start_page": 17, "end_page": 24, "total_doc_pages": 112, "chunks_count": 8},
        {"source": "1003010491.pdf", "chapter": "Chapter 3: Applied History", "start_page": 25, "end_page": 31, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 4: History of Indian Arts", "start_page": 32, "end_page": 41, "total_doc_pages": 112, "chunks_count": 10},
        {"source": "1003010491.pdf", "chapter": "Chapter 5: Mass Media and History", "start_page": 42, "end_page": 48, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 6: Entertainment and History", "start_page": 49, "end_page": 55, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 7: Sports and History", "start_page": 56, "end_page": 61, "total_doc_pages": 112, "chunks_count": 6},
        {"source": "1003010491.pdf", "chapter": "Chapter 8: Tourism and History", "start_page": 62, "end_page": 68, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 9: Heritage Management", "start_page": 69, "end_page": 76, "total_doc_pages": 112, "chunks_count": 8},
    ],

    # --- STD 10 POLITICAL SCIENCE ---
    ("Maharashtra State Board (Balbharati)", "10", "Political Science"): [
        {"source": "1003010491.pdf", "chapter": "Chapter 1: Working of the Constitution", "start_page": 77, "end_page": 83, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 2: The Electoral Process", "start_page": 84, "end_page": 90, "total_doc_pages": 112, "chunks_count": 7},
        {"source": "1003010491.pdf", "chapter": "Chapter 3: Political Parties", "start_page": 91, "end_page": 99, "total_doc_pages": 112, "chunks_count": 9},
        {"source": "1003010491.pdf", "chapter": "Chapter 4: Social and Political Movements", "start_page": 100, "end_page": 105, "total_doc_pages": 112, "chunks_count": 6},
        {"source": "1003010491.pdf", "chapter": "Chapter 5: Challenges faced by Indian Democracy", "start_page": 106, "end_page": 112, "total_doc_pages": 112, "chunks_count": 7},
    ],

    # --- STD 10 GEOGRAPHY ---
    ("Maharashtra State Board (Balbharati)", "10", "Geography"): [
        {"source": "1003020011.pdf", "chapter": "Chapter 1: Field Visit", "start_page": 11, "end_page": 18, "total_doc_pages": 82, "chunks_count": 8},
        {"source": "1003020011.pdf", "chapter": "Chapter 2: Location and Extent", "start_page": 19, "end_page": 23, "total_doc_pages": 82, "chunks_count": 5},
        {"source": "1003020011.pdf", "chapter": "Chapter 3: Physiography and Drainage", "start_page": 24, "end_page": 34, "total_doc_pages": 82, "chunks_count": 11},
        {"source": "1003020011.pdf", "chapter": "Chapter 4: Climate", "start_page": 35, "end_page": 41, "total_doc_pages": 82, "chunks_count": 7},
        {"source": "1003020011.pdf", "chapter": "Chapter 5: Natural Vegetation and Wildlife", "start_page": 42, "end_page": 47, "total_doc_pages": 82, "chunks_count": 6},
        {"source": "1003020011.pdf", "chapter": "Chapter 6: Population", "start_page": 48, "end_page": 55, "total_doc_pages": 82, "chunks_count": 8},
        {"source": "1003020011.pdf", "chapter": "Chapter 7: Human Settlements", "start_page": 56, "end_page": 61, "total_doc_pages": 82, "chunks_count": 6},
        {"source": "1003020011.pdf", "chapter": "Chapter 8: Economy and Occupations", "start_page": 62, "end_page": 70, "total_doc_pages": 82, "chunks_count": 9},
        {"source": "1003020011.pdf", "chapter": "Chapter 9: Tourism, Transport and Communication", "start_page": 71, "end_page": 82, "total_doc_pages": 82, "chunks_count": 12},
    ],

    # --- STD 10 SCIENCE 1 ---
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

    # --- STD 10 SCIENCE 2 ---
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

    # --- STD 10 MATHEMATICS 1 (Algebra) ---
    ("Maharashtra State Board (Balbharati)", "10", "Maths 1"): [
        {"source": "1003000608.pdf", "chapter": "Chapter 1: Linear Equations in Two Variables", "start_page": 11, "end_page": 39, "total_doc_pages": 188, "chunks_count": 29},
        {"source": "1003000608.pdf", "chapter": "Chapter 2: Quadratic Equations", "start_page": 40, "end_page": 63, "total_doc_pages": 188, "chunks_count": 24},
        {"source": "1003000608.pdf", "chapter": "Chapter 3: Arithmetic Progression", "start_page": 64, "end_page": 90, "total_doc_pages": 188, "chunks_count": 27},
        {"source": "1003000608.pdf", "chapter": "Chapter 4: Financial Planning", "start_page": 91, "end_page": 124, "total_doc_pages": 188, "chunks_count": 34},
        {"source": "1003000608.pdf", "chapter": "Chapter 5: Probability", "start_page": 125, "end_page": 146, "total_doc_pages": 188, "chunks_count": 22},
        {"source": "1003000608.pdf", "chapter": "Chapter 6: Statistics", "start_page": 147, "end_page": 188, "total_doc_pages": 188, "chunks_count": 42},
    ],

    # --- STD 10 MATHEMATICS 2 (Geometry) ---
    ("Maharashtra State Board (Balbharati)", "10", "Maths 2"): [
        {"source": "1003000609.pdf", "chapter": "Chapter 1: Similarity", "start_page": 11, "end_page": 38, "total_doc_pages": 172, "chunks_count": 28},
        {"source": "1003000609.pdf", "chapter": "Chapter 2: Pythagoras Theorem", "start_page": 39, "end_page": 54, "total_doc_pages": 172, "chunks_count": 16},
        {"source": "1003000609.pdf", "chapter": "Chapter 3: Circle", "start_page": 55, "end_page": 104, "total_doc_pages": 172, "chunks_count": 50},
        {"source": "1003000609.pdf", "chapter": "Chapter 4: Geometric Constructions", "start_page": 105, "end_page": 124, "total_doc_pages": 172, "chunks_count": 20},
        {"source": "1003000609.pdf", "chapter": "Chapter 5: Coordinate Geometry", "start_page": 125, "end_page": 148, "total_doc_pages": 172, "chunks_count": 24},
        {"source": "1003000609.pdf", "chapter": "Chapter 6: Trigonometry", "start_page": 149, "end_page": 166, "total_doc_pages": 172, "chunks_count": 18},
        {"source": "1003000609.pdf", "chapter": "Chapter 7: Mensuration", "start_page": 167, "end_page": 172, "total_doc_pages": 172, "chunks_count": 6},
    ],

    # --- STD 8 HISTORY ---
    ("Maharashtra State Board (Balbharati)", "8", "History"): [
        {"source": "803000584.pdf", "chapter": "Chapter 1: Sources of History", "start_page": 9, "end_page": 12, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 2: Europe and India", "start_page": 13, "end_page": 17, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "803000584.pdf", "chapter": "Chapter 3: Effects of British rule", "start_page": 18, "end_page": 22, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "803000584.pdf", "chapter": "Chapter 4: The Freedom Struggle of 1857", "start_page": 23, "end_page": 28, "total_doc_pages": 100, "chunks_count": 6},
        {"source": "803000584.pdf", "chapter": "Chapter 5: Social and Religious Reforms", "start_page": 29, "end_page": 32, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 6: Beginning of Freedom Movement", "start_page": 33, "end_page": 38, "total_doc_pages": 100, "chunks_count": 6},
        {"source": "803000584.pdf", "chapter": "Chapter 7: Non-co-operation Movement", "start_page": 39, "end_page": 43, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "803000584.pdf", "chapter": "Chapter 8: Civil Disobedience Movement", "start_page": 44, "end_page": 47, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 9: Last Phase of Struggle for Independence", "start_page": 48, "end_page": 52, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "803000584.pdf", "chapter": "Chapter 10: Armed Revolutionary Movement", "start_page": 53, "end_page": 57, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "803000584.pdf", "chapter": "Chapter 11: Struggle for Equality", "start_page": 58, "end_page": 63, "total_doc_pages": 100, "chunks_count": 6},
        {"source": "803000584.pdf", "chapter": "Chapter 12: India gains Independence", "start_page": 64, "end_page": 66, "total_doc_pages": 100, "chunks_count": 3},
        {"source": "803000584.pdf", "chapter": "Chapter 13: Fulfillment of Struggle for Independence", "start_page": 67, "end_page": 69, "total_doc_pages": 100, "chunks_count": 3},
        {"source": "803000584.pdf", "chapter": "Chapter 14: Formation of State of Maharashtra", "start_page": 70, "end_page": 75, "total_doc_pages": 100, "chunks_count": 6},
    ],

    # --- STD 8 CIVICS ---
    ("Maharashtra State Board (Balbharati)", "8", "Civics"): [
        {"source": "803000584.pdf", "chapter": "Chapter 1: Introduction to the Parliamentary System", "start_page": 76, "end_page": 78, "total_doc_pages": 100, "chunks_count": 3},
        {"source": "803000584.pdf", "chapter": "Chapter 2: The Indian Parliament", "start_page": 79, "end_page": 82, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 3: The Union Executive", "start_page": 83, "end_page": 86, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 4: The Indian Judicial System", "start_page": 87, "end_page": 90, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 5: The State Government", "start_page": 91, "end_page": 94, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "803000584.pdf", "chapter": "Chapter 6: Bureaucracy", "start_page": 95, "end_page": 100, "total_doc_pages": 100, "chunks_count": 6},
    ],

    # --- STD 8 SCIENCE ---
    ("Maharashtra State Board (Balbharati)", "8", "Science"): [
        {"source": "803020012.pdf", "chapter": "Chapter 1: Living World and Classification of Microbes", "start_page": 11, "end_page": 16, "total_doc_pages": 148, "chunks_count": 6},
        {"source": "803020012.pdf", "chapter": "Chapter 2: Health and Diseases", "start_page": 17, "end_page": 23, "total_doc_pages": 148, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 3: Force and Pressure", "start_page": 24, "end_page": 31, "total_doc_pages": 148, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 4: Current Electricity and Magnetism", "start_page": 32, "end_page": 38, "total_doc_pages": 148, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 5: Inside the Atom", "start_page": 39, "end_page": 48, "total_doc_pages": 148, "chunks_count": 10},
        {"source": "803020012.pdf", "chapter": "Chapter 6: Composition of Matter", "start_page": 49, "end_page": 59, "total_doc_pages": 148, "chunks_count": 11},
        {"source": "803020012.pdf", "chapter": "Chapter 7: Metals and Nonmetals", "start_page": 60, "end_page": 66, "total_doc_pages": 148, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 8: Pollution", "start_page": 67, "end_page": 75, "total_doc_pages": 148, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 9: Disaster Management", "start_page": 76, "end_page": 84, "total_doc_pages": 148, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 10: Cell and Cell Organelles", "start_page": 85, "end_page": 93, "total_doc_pages": 148, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 11: Human Body and Organ System", "start_page": 94, "end_page": 102, "total_doc_pages": 148, "chunks_count": 9},
        {"source": "803020012.pdf", "chapter": "Chapter 12: Introduction to Acid & Base", "start_page": 103, "end_page": 110, "total_doc_pages": 148, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 13: Chemical Change and Chemical Bond", "start_page": 111, "end_page": 118, "total_doc_pages": 148, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 14: Measurement and Effects of Heat", "start_page": 119, "end_page": 126, "total_doc_pages": 148, "chunks_count": 8},
        {"source": "803020012.pdf", "chapter": "Chapter 15: Sound", "start_page": 127, "end_page": 133, "total_doc_pages": 148, "chunks_count": 7},
        {"source": "803020012.pdf", "chapter": "Chapter 16: Reflection of Light", "start_page": 134, "end_page": 148, "total_doc_pages": 148, "chunks_count": 15},
    ],

    # --- STD 8 MATHEMATICS ---
    ("Maharashtra State Board (Balbharati)", "8", "Maths"): [
        {"source": "803020004.pdf", "chapter": "Chapter 1: Rational and Irrational numbers", "start_page": 11, "end_page": 16, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "803020004.pdf", "chapter": "Chapter 2: Parallel lines and transversals", "start_page": 17, "end_page": 24, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "803020004.pdf", "chapter": "Chapter 3: Indices and Cube root", "start_page": 25, "end_page": 30, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "803020004.pdf", "chapter": "Chapter 4: Altitudes and Medians of a triangle", "start_page": 31, "end_page": 36, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "803020004.pdf", "chapter": "Chapter 5: Expansion formulae", "start_page": 37, "end_page": 43, "total_doc_pages": 132, "chunks_count": 7},
        {"source": "803020004.pdf", "chapter": "Chapter 6: Factorisation of Algebraic expressions", "start_page": 44, "end_page": 49, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "803020004.pdf", "chapter": "Chapter 7: Variation", "start_page": 50, "end_page": 56, "total_doc_pages": 132, "chunks_count": 7},
        {"source": "803020004.pdf", "chapter": "Chapter 8: Quadrilateral : Constructions and Types", "start_page": 57, "end_page": 67, "total_doc_pages": 132, "chunks_count": 11},
        {"source": "803020004.pdf", "chapter": "Chapter 9: Discount and Commission", "start_page": 68, "end_page": 74, "total_doc_pages": 132, "chunks_count": 7},
        {"source": "803020004.pdf", "chapter": "Chapter 10: Division of Polynomials", "start_page": 75, "end_page": 80, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "803020004.pdf", "chapter": "Chapter 11: Statistics", "start_page": 81, "end_page": 88, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "803020004.pdf", "chapter": "Chapter 12: Equations in one variable", "start_page": 89, "end_page": 96, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "803020004.pdf", "chapter": "Chapter 13: Congruence of triangles", "start_page": 97, "end_page": 104, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "803020004.pdf", "chapter": "Chapter 14: Compound interest", "start_page": 105, "end_page": 110, "total_doc_pages": 132, "chunks_count": 6},
        {"source": "803020004.pdf", "chapter": "Chapter 15: Area", "start_page": 111, "end_page": 118, "total_doc_pages": 132, "chunks_count": 8},
        {"source": "803020004.pdf", "chapter": "Chapter 16: Surface area and Volume", "start_page": 119, "end_page": 125, "total_doc_pages": 132, "chunks_count": 7},
        {"source": "803020004.pdf", "chapter": "Chapter 17: Circle - Chord and Arc", "start_page": 126, "end_page": 132, "total_doc_pages": 132, "chunks_count": 7},
    ],

    # --- STD 7 HISTORY ---
    ("Maharashtra State Board (Balbharati)", "7", "History"): [
        {"source": "703000584.pdf", "chapter": "Chapter 1: Sources of History", "start_page": 9, "end_page": 13, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "703000584.pdf", "chapter": "Chapter 2: India before the Times of Shivaji Maharaj", "start_page": 14, "end_page": 19, "total_doc_pages": 100, "chunks_count": 6},
        {"source": "703000584.pdf", "chapter": "Chapter 3: Religious Synthesis", "start_page": 20, "end_page": 23, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 4: Maharashtra before the Times of Shivaji Maharaj", "start_page": 24, "end_page": 28, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "703000584.pdf", "chapter": "Chapter 5: The Foundation of the Swaraj", "start_page": 29, "end_page": 33, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "703000584.pdf", "chapter": "Chapter 6: Conflict with the Mughals", "start_page": 34, "end_page": 38, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "703000584.pdf", "chapter": "Chapter 7: The Administration of the Swaraj", "start_page": 39, "end_page": 42, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 8: An Ideal Ruler", "start_page": 43, "end_page": 46, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 9: The Maratha War of Independence", "start_page": 47, "end_page": 53, "total_doc_pages": 100, "chunks_count": 7},
        {"source": "703000584.pdf", "chapter": "Chapter 10: The Expansion of the Maratha Power", "start_page": 54, "end_page": 56, "total_doc_pages": 100, "chunks_count": 3},
        {"source": "703000584.pdf", "chapter": "Chapter 11: Marathas - The Protectors of the Nation", "start_page": 57, "end_page": 62, "total_doc_pages": 100, "chunks_count": 6},
        {"source": "703000584.pdf", "chapter": "Chapter 12: Progression of the Empire", "start_page": 63, "end_page": 66, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 13: Life of the People in Maharashtra", "start_page": 67, "end_page": 70, "total_doc_pages": 100, "chunks_count": 4},
    ],

    # --- STD 7 CIVICS ---
    ("Maharashtra State Board (Balbharati)", "7", "Civics"): [
        {"source": "703000584.pdf", "chapter": "Chapter 1: Introduction to our Constitution", "start_page": 71, "end_page": 75, "total_doc_pages": 100, "chunks_count": 5},
        {"source": "703000584.pdf", "chapter": "Chapter 2: Preamble to the Constitution", "start_page": 76, "end_page": 79, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 3: Features of the Constitution", "start_page": 80, "end_page": 83, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 4: Fundamental Rights – Part I", "start_page": 84, "end_page": 87, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 5: Fundamental Rights – Part II", "start_page": 88, "end_page": 91, "total_doc_pages": 100, "chunks_count": 4},
        {"source": "703000584.pdf", "chapter": "Chapter 6: Directive Principles of State Policy and Fundamental Duties", "start_page": 92, "end_page": 100, "total_doc_pages": 100, "chunks_count": 9},
    ],

    # --- STD 6 HISTORY ---
    ("Maharashtra State Board (Balbharati)", "6", "History"): [
        {"source": "603000584.pdf", "chapter": "Chapter 1: The Indian Subcontinent and History", "start_page": 9, "end_page": 13, "total_doc_pages": 92, "chunks_count": 5},
        {"source": "603000584.pdf", "chapter": "Chapter 2: Sources of History", "start_page": 14, "end_page": 17, "total_doc_pages": 92, "chunks_count": 4},
        {"source": "603000584.pdf", "chapter": "Chapter 3: The Harappan Civilization", "start_page": 18, "end_page": 22, "total_doc_pages": 92, "chunks_count": 5},
        {"source": "603000584.pdf", "chapter": "Chapter 4: The Vedic Civilization", "start_page": 23, "end_page": 27, "total_doc_pages": 92, "chunks_count": 5},
        {"source": "603000584.pdf", "chapter": "Chapter 5: Religious Trends in Ancient India", "start_page": 28, "end_page": 33, "total_doc_pages": 92, "chunks_count": 6},
        {"source": "603000584.pdf", "chapter": "Chapter 6: Janapadas and Mahajanapadas", "start_page": 34, "end_page": 37, "total_doc_pages": 92, "chunks_count": 4},
        {"source": "603000584.pdf", "chapter": "Chapter 7: India during the Maurya Period", "start_page": 38, "end_page": 43, "total_doc_pages": 92, "chunks_count": 6},
        {"source": "603000584.pdf", "chapter": "Chapter 8: States after the Maurya Empire", "start_page": 44, "end_page": 49, "total_doc_pages": 92, "chunks_count": 6},
        {"source": "603000584.pdf", "chapter": "Chapter 9: Ancient Kingdoms of the South", "start_page": 50, "end_page": 55, "total_doc_pages": 92, "chunks_count": 6},
        {"source": "603000584.pdf", "chapter": "Chapter 10: Ancient India : Cultural", "start_page": 56, "end_page": 61, "total_doc_pages": 92, "chunks_count": 6},
        {"source": "603000584.pdf", "chapter": "Chapter 11: Ancient India and the World", "start_page": 62, "end_page": 67, "total_doc_pages": 92, "chunks_count": 6},
    ],

    # --- STD 6 CIVICS ---
    ("Maharashtra State Board (Balbharati)", "6", "Civics"): [
        {"source": "603000584.pdf", "chapter": "Chapter 1: Our Life in Society", "start_page": 68, "end_page": 71, "total_doc_pages": 92, "chunks_count": 4},
        {"source": "603000584.pdf", "chapter": "Chapter 2: Diversity in Society", "start_page": 72, "end_page": 75, "total_doc_pages": 92, "chunks_count": 4},
        {"source": "603000584.pdf", "chapter": "Chapter 3: Rural Local Government Bodies", "start_page": 76, "end_page": 80, "total_doc_pages": 92, "chunks_count": 5},
        {"source": "603000584.pdf", "chapter": "Chapter 4: Urban Local Government Bodies", "start_page": 81, "end_page": 85, "total_doc_pages": 92, "chunks_count": 5},
        {"source": "603000584.pdf", "chapter": "Chapter 5: District Administration", "start_page": 86, "end_page": 92, "total_doc_pages": 92, "chunks_count": 7},
    ],

    # =========================================================================
    # CBSE (NCERT)
    # =========================================================================

    # --- CLASS 10 HISTORY (India and the Contemporary World - II) ---
    ("CBSE (NCERT)", "10", "History"): [
        {"source": "jess101.pdf", "chapter": "Chapter 1: The Rise of Nationalism in Europe", "start_page": 1, "end_page": 28, "total_doc_pages": 140, "chunks_count": 28},
        {"source": "jess102.pdf", "chapter": "Chapter 2: Nationalism in India", "start_page": 29, "end_page": 52, "total_doc_pages": 140, "chunks_count": 24},
        {"source": "jess103.pdf", "chapter": "Chapter 3: The Making of a Global World", "start_page": 53, "end_page": 76, "total_doc_pages": 140, "chunks_count": 24},
        {"source": "jess104.pdf", "chapter": "Chapter 4: The Age of Industrialisation", "start_page": 77, "end_page": 100, "total_doc_pages": 140, "chunks_count": 24},
        {"source": "jess105.pdf", "chapter": "Chapter 5: Print Culture and the Modern World", "start_page": 101, "end_page": 128, "total_doc_pages": 140, "chunks_count": 28},
    ],

    # --- CLASS 10 GEOGRAPHY (Contemporary India - II) ---
    ("CBSE (NCERT)", "10", "Geography"): [
        {"source": "jess201.pdf", "chapter": "Chapter 1: Resources and Development", "start_page": 1, "end_page": 14, "total_doc_pages": 96, "chunks_count": 14},
        {"source": "jess202.pdf", "chapter": "Chapter 2: Forest and Wildlife Resources", "start_page": 15, "end_page": 26, "total_doc_pages": 96, "chunks_count": 12},
        {"source": "jess203.pdf", "chapter": "Chapter 3: Water Resources", "start_page": 27, "end_page": 38, "total_doc_pages": 96, "chunks_count": 12},
        {"source": "jess204.pdf", "chapter": "Chapter 4: Agriculture", "start_page": 39, "end_page": 54, "total_doc_pages": 96, "chunks_count": 16},
        {"source": "jess205.pdf", "chapter": "Chapter 5: Minerals and Energy Resources", "start_page": 55, "end_page": 70, "total_doc_pages": 96, "chunks_count": 16},
        {"source": "jess206.pdf", "chapter": "Chapter 6: Manufacturing Industries", "start_page": 71, "end_page": 84, "total_doc_pages": 96, "chunks_count": 14},
        {"source": "jess207.pdf", "chapter": "Chapter 7: Lifelines of National Economy", "start_page": 85, "end_page": 96, "total_doc_pages": 96, "chunks_count": 12},
    ],

    # --- CLASS 10 POLITICAL SCIENCE (Democratic Politics - II) ---
    ("CBSE (NCERT)", "10", "Political Science"): [
        {"source": "jess301.pdf", "chapter": "Chapter 1: Power-sharing", "start_page": 1, "end_page": 12, "total_doc_pages": 80, "chunks_count": 12},
        {"source": "jess302.pdf", "chapter": "Chapter 2: Federalism", "start_page": 13, "end_page": 28, "total_doc_pages": 80, "chunks_count": 16},
        {"source": "jess303.pdf", "chapter": "Chapter 3: Gender, Religion and Caste", "start_page": 29, "end_page": 44, "total_doc_pages": 80, "chunks_count": 16},
        {"source": "jess304.pdf", "chapter": "Chapter 4: Political Parties", "start_page": 45, "end_page": 62, "total_doc_pages": 80, "chunks_count": 18},
        {"source": "jess305.pdf", "chapter": "Chapter 5: Outcomes of Democracy", "start_page": 63, "end_page": 80, "total_doc_pages": 80, "chunks_count": 18},
    ],

    # --- CLASS 10 ECONOMICS (Understanding Economic Development) ---
    ("CBSE (NCERT)", "10", "Economics"): [
        {"source": "jess401.pdf", "chapter": "Chapter 1: Development", "start_page": 1, "end_page": 18, "total_doc_pages": 90, "chunks_count": 18},
        {"source": "jess402.pdf", "chapter": "Chapter 2: Sectors of the Indian Economy", "start_page": 19, "end_page": 38, "total_doc_pages": 90, "chunks_count": 20},
        {"source": "jess403.pdf", "chapter": "Chapter 3: Money and Credit", "start_page": 39, "end_page": 54, "total_doc_pages": 90, "chunks_count": 16},
        {"source": "jess404.pdf", "chapter": "Chapter 4: Globalisation and the Indian Economy", "start_page": 55, "end_page": 74, "total_doc_pages": 90, "chunks_count": 20},
        {"source": "jess405.pdf", "chapter": "Chapter 5: Consumer Rights", "start_page": 75, "end_page": 90, "total_doc_pages": 90, "chunks_count": 16},
    ],

    # --- CLASS 9 HISTORY (India and the Contemporary World - I) ---
    ("CBSE (NCERT)", "9", "History"): [
        {"source": "iess101.pdf", "chapter": "Chapter 1: The French Revolution", "start_page": 1, "end_page": 24, "total_doc_pages": 120, "chunks_count": 24},
        {"source": "iess102.pdf", "chapter": "Chapter 2: Socialism in Europe and the Russian Revolution", "start_page": 25, "end_page": 48, "total_doc_pages": 120, "chunks_count": 24},
        {"source": "iess103.pdf", "chapter": "Chapter 3: Nazism and the Rise of Hitler", "start_page": 49, "end_page": 74, "total_doc_pages": 120, "chunks_count": 26},
        {"source": "iess104.pdf", "chapter": "Chapter 4: Forest Society and Colonialism", "start_page": 75, "end_page": 96, "total_doc_pages": 120, "chunks_count": 22},
        {"source": "iess105.pdf", "chapter": "Chapter 5: Pastoralists in the Modern World", "start_page": 97, "end_page": 120, "total_doc_pages": 120, "chunks_count": 24},
    ],

    # --- CLASS 9 GEOGRAPHY (Contemporary India - I) ---
    ("CBSE (NCERT)", "9", "Geography"): [
        {"source": "iess201.pdf", "chapter": "Chapter 1: India - Size and Location", "start_page": 1, "end_page": 8, "total_doc_pages": 64, "chunks_count": 8},
        {"source": "iess202.pdf", "chapter": "Chapter 2: Physical Features of India", "start_page": 9, "end_page": 20, "total_doc_pages": 64, "chunks_count": 12},
        {"source": "iess203.pdf", "chapter": "Chapter 3: Drainage", "start_page": 21, "end_page": 32, "total_doc_pages": 64, "chunks_count": 12},
        {"source": "iess204.pdf", "chapter": "Chapter 4: Climate", "start_page": 33, "end_page": 46, "total_doc_pages": 64, "chunks_count": 14},
        {"source": "iess205.pdf", "chapter": "Chapter 5: Natural Vegetation and Wild Life", "start_page": 47, "end_page": 56, "total_doc_pages": 64, "chunks_count": 10},
        {"source": "iess206.pdf", "chapter": "Chapter 6: Population", "start_page": 57, "end_page": 64, "total_doc_pages": 64, "chunks_count": 8},
    ],

    # --- CLASS 9 POLITICAL SCIENCE (Democratic Politics - I) ---
    ("CBSE (NCERT)", "9", "Political Science"): [
        {"source": "iess301.pdf", "chapter": "Chapter 1: What is Democracy? Why Democracy?", "start_page": 1, "end_page": 18, "total_doc_pages": 90, "chunks_count": 18},
        {"source": "iess302.pdf", "chapter": "Chapter 2: Constitutional Design", "start_page": 19, "end_page": 36, "total_doc_pages": 90, "chunks_count": 18},
        {"source": "iess303.pdf", "chapter": "Chapter 3: Electoral Politics", "start_page": 37, "end_page": 56, "total_doc_pages": 90, "chunks_count": 20},
        {"source": "iess304.pdf", "chapter": "Chapter 4: Working of Institutions", "start_page": 57, "end_page": 76, "total_doc_pages": 90, "chunks_count": 20},
        {"source": "iess305.pdf", "chapter": "Chapter 5: Democratic Rights", "start_page": 77, "end_page": 90, "total_doc_pages": 90, "chunks_count": 14},
    ],

    # --- CLASS 9 ECONOMICS ---
    ("CBSE (NCERT)", "9", "Economics"): [
        {"source": "iess401.pdf", "chapter": "Chapter 1: The Story of Village Palampur", "start_page": 1, "end_page": 16, "total_doc_pages": 60, "chunks_count": 16},
        {"source": "iess402.pdf", "chapter": "Chapter 2: People as Resource", "start_page": 17, "end_page": 30, "total_doc_pages": 60, "chunks_count": 14},
        {"source": "iess403.pdf", "chapter": "Chapter 3: Poverty as a Challenge", "start_page": 31, "end_page": 46, "total_doc_pages": 60, "chunks_count": 16},
        {"source": "iess404.pdf", "chapter": "Chapter 4: Food Security in India", "start_page": 47, "end_page": 60, "total_doc_pages": 60, "chunks_count": 14},
    ],

    # --- CLASS 8 HISTORY (Our Pasts - III) ---
    ("CBSE (NCERT)", "8", "History"): [
        {"source": "hees101.pdf", "chapter": "Chapter 1: Introduction: How, When and Where", "start_page": 1, "end_page": 10, "total_doc_pages": 110, "chunks_count": 10},
        {"source": "hees102.pdf", "chapter": "Chapter 2: From Trade to Territory", "start_page": 11, "end_page": 26, "total_doc_pages": 110, "chunks_count": 16},
        {"source": "hees103.pdf", "chapter": "Chapter 3: Ruling the Countryside", "start_page": 27, "end_page": 38, "total_doc_pages": 110, "chunks_count": 12},
        {"source": "hees104.pdf", "chapter": "Chapter 4: Tribals, Dikus and the Vision of a Golden Age", "start_page": 39, "end_page": 50, "total_doc_pages": 110, "chunks_count": 12},
        {"source": "hees105.pdf", "chapter": "Chapter 5: When People Rebel 1857 and After", "start_page": 51, "end_page": 64, "total_doc_pages": 110, "chunks_count": 14},
        {"source": "hees106.pdf", "chapter": "Chapter 6: Civilising the \"Native\", Educating the Nation", "start_page": 65, "end_page": 78, "total_doc_pages": 110, "chunks_count": 14},
        {"source": "hees107.pdf", "chapter": "Chapter 7: Women, Caste and Reform", "start_page": 79, "end_page": 94, "total_doc_pages": 110, "chunks_count": 16},
        {"source": "hees108.pdf", "chapter": "Chapter 8: The Making of the National Movement: 1870s-1947", "start_page": 95, "end_page": 110, "total_doc_pages": 110, "chunks_count": 16},
    ],

    # =========================================================================
    # ICSE (CISCE)
    # =========================================================================

    # --- CLASS 10 HISTORY & CIVICS ---
    ("ICSE (CISCE)", "10", "History & Civics"): [
        # Part I: Civics
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 1: The Union Parliament", "start_page": 1, "end_page": 14, "total_doc_pages": 240, "chunks_count": 14},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 2: The President and The Vice-President", "start_page": 15, "end_page": 28, "total_doc_pages": 240, "chunks_count": 14},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 3: Prime Minister and Council of Ministers", "start_page": 29, "end_page": 40, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 4: The Supreme Court", "start_page": 41, "end_page": 52, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 5: The High Courts and Subordinate Courts", "start_page": 53, "end_page": 64, "total_doc_pages": 240, "chunks_count": 12},
        # Part II: History
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 6: The First War of Independence (1857)", "start_page": 65, "end_page": 80, "total_doc_pages": 240, "chunks_count": 16},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 7: Growth of Nationalism", "start_page": 81, "end_page": 94, "total_doc_pages": 240, "chunks_count": 14},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 8: First Phase of the Indian National Movement", "start_page": 95, "end_page": 106, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 9: Second Phase of the Indian National Movement", "start_page": 107, "end_page": 120, "total_doc_pages": 240, "chunks_count": 14},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 10: The Muslim League", "start_page": 121, "end_page": 130, "total_doc_pages": 240, "chunks_count": 10},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 11: Mahatma Gandhi and the National Movement", "start_page": 131, "end_page": 150, "total_doc_pages": 240, "chunks_count": 20},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 12: Quit India Movement", "start_page": 151, "end_page": 162, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 13: Forward Bloc and the INA", "start_page": 163, "end_page": 172, "total_doc_pages": 240, "chunks_count": 10},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 14: Independence and Partition of India", "start_page": 173, "end_page": 184, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 15: The First World War", "start_page": 185, "end_page": 196, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 16: Rise of Dictatorships", "start_page": 197, "end_page": 208, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 17: The Second World War", "start_page": 209, "end_page": 220, "total_doc_pages": 240, "chunks_count": 12},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 18: United Nations", "start_page": 221, "end_page": 230, "total_doc_pages": 240, "chunks_count": 10},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 19: Major Agencies of the United Nations", "start_page": 231, "end_page": 236, "total_doc_pages": 240, "chunks_count": 6},
        {"source": "ICSE_Class10_History.pdf", "chapter": "Chapter 20: Non-Aligned Movement", "start_page": 237, "end_page": 240, "total_doc_pages": 240, "chunks_count": 4},
    ],

    # --- CLASS 10 GEOGRAPHY ---
    ("ICSE (CISCE)", "10", "Geography"): [
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 1: Interpretation of Topographical Maps", "start_page": 1, "end_page": 20, "total_doc_pages": 190, "chunks_count": 20},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 2: Map of India", "start_page": 21, "end_page": 32, "total_doc_pages": 190, "chunks_count": 12},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 3: Climate of India", "start_page": 33, "end_page": 50, "total_doc_pages": 190, "chunks_count": 18},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 4: Soils of India", "start_page": 51, "end_page": 64, "total_doc_pages": 190, "chunks_count": 14},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 5: Natural Vegetation of India", "start_page": 65, "end_page": 78, "total_doc_pages": 190, "chunks_count": 14},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 6: Water Resources", "start_page": 79, "end_page": 94, "total_doc_pages": 190, "chunks_count": 16},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 7: Mineral and Energy Resources", "start_page": 95, "end_page": 118, "total_doc_pages": 190, "chunks_count": 24},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 8: Agriculture in India", "start_page": 119, "end_page": 144, "total_doc_pages": 190, "chunks_count": 26},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 9: Manufacturing Industries of India", "start_page": 145, "end_page": 168, "total_doc_pages": 190, "chunks_count": 24},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 10: Transport", "start_page": 169, "end_page": 180, "total_doc_pages": 190, "chunks_count": 12},
        {"source": "ICSE_Class10_Geography.pdf", "chapter": "Chapter 11: Waste Management", "start_page": 181, "end_page": 190, "total_doc_pages": 190, "chunks_count": 10},
    ],

    # --- CLASS 10 CHEMISTRY ---
    ("ICSE (CISCE)", "10", "Chemistry"): [
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 1: Periodic Properties and Variations of Properties", "start_page": 1, "end_page": 20, "total_doc_pages": 210, "chunks_count": 20},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 2: Chemical Bonding", "start_page": 21, "end_page": 38, "total_doc_pages": 210, "chunks_count": 18},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 3: Study of Acids, Bases and Salts", "start_page": 39, "end_page": 60, "total_doc_pages": 210, "chunks_count": 22},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 4: Analytical Chemistry", "start_page": 61, "end_page": 72, "total_doc_pages": 210, "chunks_count": 12},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 5: Mole Concept and Stoichiometry", "start_page": 73, "end_page": 96, "total_doc_pages": 210, "chunks_count": 24},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 6: Electrolysis", "start_page": 97, "end_page": 118, "total_doc_pages": 210, "chunks_count": 22},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 7: Metallurgy", "start_page": 119, "end_page": 140, "total_doc_pages": 210, "chunks_count": 22},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 8: Study of Compounds - Hydrogen Chloride", "start_page": 141, "end_page": 154, "total_doc_pages": 210, "chunks_count": 14},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 9: Study of Compounds - Ammonia", "start_page": 155, "end_page": 168, "total_doc_pages": 210, "chunks_count": 14},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 10: Study of Compounds - Nitric Acid", "start_page": 169, "end_page": 180, "total_doc_pages": 210, "chunks_count": 12},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 11: Study of Compounds - Sulphuric Acid", "start_page": 181, "end_page": 194, "total_doc_pages": 210, "chunks_count": 14},
        {"source": "ICSE_Class10_Chemistry_Textbook.pdf", "chapter": "Chapter 12: Organic Chemistry", "start_page": 195, "end_page": 210, "total_doc_pages": 210, "chunks_count": 16},
    ],

    # --- CLASS 10 BIOLOGY ---
    ("ICSE (CISCE)", "10", "Biology"): [
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 1: Cell Division: Structure of Chromosomes & Mitosis", "start_page": 1, "end_page": 16, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 2: Fundamentals of Genetics", "start_page": 17, "end_page": 32, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 3: Absorption by Roots", "start_page": 33, "end_page": 48, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 4: Transpiration", "start_page": 49, "end_page": 62, "total_doc_pages": 220, "chunks_count": 14},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 5: Photosynthesis", "start_page": 63, "end_page": 78, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 6: Chemical Coordination in Plants", "start_page": 79, "end_page": 90, "total_doc_pages": 220, "chunks_count": 12},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 7: The Circulatory System", "start_page": 91, "end_page": 110, "total_doc_pages": 220, "chunks_count": 20},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 8: The Excretory System", "start_page": 111, "end_page": 126, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 9: The Nervous System", "start_page": 127, "end_page": 146, "total_doc_pages": 220, "chunks_count": 20},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 10: Sense Organs", "start_page": 147, "end_page": 162, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 11: The Endocrine System", "start_page": 163, "end_page": 176, "total_doc_pages": 220, "chunks_count": 14},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 12: The Reproductive System", "start_page": 177, "end_page": 192, "total_doc_pages": 220, "chunks_count": 16},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 13: Population: The Increasing Numbers", "start_page": 193, "end_page": 202, "total_doc_pages": 220, "chunks_count": 10},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 14: Human Evolution", "start_page": 203, "end_page": 210, "total_doc_pages": 220, "chunks_count": 8},
        {"source": "ICSE_Class10_Biology_Textbook.pdf", "chapter": "Chapter 15: Pollution: A Rising Environmental Problem", "start_page": 211, "end_page": 220, "total_doc_pages": 220, "chunks_count": 10},
    ],

    # --- IGCSE (CAMBRIDGE) ---
    ("IGCSE (Cambridge)", "10", "Physics"): [
        {"source": "ilide.info-igcse-physics-new-textbook-pr_064af9a6620ebb56e1068ab2f21b3aa1.pdf", "chapter": "Chapter 1: Motion, Forces and Energy", "start_page": 1, "end_page": 60, "total_doc_pages": 300, "chunks_count": 60},
        {"source": "ilide.info-igcse-physics-new-textbook-pr_064af9a6620ebb56e1068ab2f21b3aa1.pdf", "chapter": "Chapter 2: Thermal Physics", "start_page": 61, "end_page": 110, "total_doc_pages": 300, "chunks_count": 50},
        {"source": "ilide.info-igcse-physics-new-textbook-pr_064af9a6620ebb56e1068ab2f21b3aa1.pdf", "chapter": "Chapter 3: Waves (Light and Sound)", "start_page": 111, "end_page": 170, "total_doc_pages": 300, "chunks_count": 60},
        {"source": "ilide.info-igcse-physics-new-textbook-pr_064af9a6620ebb56e1068ab2f21b3aa1.pdf", "chapter": "Chapter 4: Electricity and Magnetism", "start_page": 171, "end_page": 230, "total_doc_pages": 300, "chunks_count": 60},
        {"source": "ilide.info-igcse-physics-new-textbook-pr_064af9a6620ebb56e1068ab2f21b3aa1.pdf", "chapter": "Chapter 5: Nuclear Physics", "start_page": 231, "end_page": 270, "total_doc_pages": 300, "chunks_count": 40},
        {"source": "ilide.info-igcse-physics-new-textbook-pr_064af9a6620ebb56e1068ab2f21b3aa1.pdf", "chapter": "Chapter 6: Space Physics", "start_page": 271, "end_page": 300, "total_doc_pages": 300, "chunks_count": 30},
    ],

    ("IGCSE (Cambridge)", "10", "Chemistry"): [
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 1: States of Matter", "start_page": 1, "end_page": 25, "total_doc_pages": 320, "chunks_count": 25},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 2: Atoms, Elements and Compounds", "start_page": 26, "end_page": 55, "total_doc_pages": 320, "chunks_count": 30},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 3: Stoichiometry", "start_page": 56, "end_page": 85, "total_doc_pages": 320, "chunks_count": 30},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 4: Electrochemistry", "start_page": 86, "end_page": 115, "total_doc_pages": 320, "chunks_count": 30},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 5: Chemical Energetics", "start_page": 116, "end_page": 140, "total_doc_pages": 320, "chunks_count": 25},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 6: Chemical Reactions", "start_page": 141, "end_page": 175, "total_doc_pages": 320, "chunks_count": 35},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 7: Acids, Bases and Salts", "start_page": 176, "end_page": 205, "total_doc_pages": 320, "chunks_count": 30},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 8: The Periodic Table", "start_page": 206, "end_page": 230, "total_doc_pages": 320, "chunks_count": 25},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 9: Metals", "start_page": 231, "end_page": 260, "total_doc_pages": 320, "chunks_count": 30},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 10: Chemistry of the Environment", "start_page": 261, "end_page": 285, "total_doc_pages": 320, "chunks_count": 25},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 11: Organic Chemistry", "start_page": 286, "end_page": 310, "total_doc_pages": 320, "chunks_count": 25},
        {"source": "ilide.info-chemistry-for-cambridge-igcse-coursebook-pr_cd625865fad21cf49bbcfed5d065e118.pdf", "chapter": "Chapter 12: Experimental Techniques and Analysis", "start_page": 311, "end_page": 320, "total_doc_pages": 320, "chunks_count": 10},
    ],

    ("IGCSE (Cambridge)", "10", "Biology"): [
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 1: Characteristics and Classification of Living Organisms", "start_page": 1, "end_page": 18, "total_doc_pages": 350, "chunks_count": 18},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 2: Organisation of the Organism", "start_page": 19, "end_page": 34, "total_doc_pages": 350, "chunks_count": 16},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 3: Movement into and out of Cells", "start_page": 35, "end_page": 48, "total_doc_pages": 350, "chunks_count": 14},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 4: Biological Molecules", "start_page": 49, "end_page": 60, "total_doc_pages": 350, "chunks_count": 12},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 5: Enzymes", "start_page": 61, "end_page": 74, "total_doc_pages": 350, "chunks_count": 14},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 6: Plant Nutrition", "start_page": 75, "end_page": 94, "total_doc_pages": 350, "chunks_count": 20},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 7: Human Nutrition", "start_page": 95, "end_page": 118, "total_doc_pages": 350, "chunks_count": 24},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 8: Transport in Plants", "start_page": 119, "end_page": 136, "total_doc_pages": 350, "chunks_count": 18},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 9: Transport in Animals", "start_page": 137, "end_page": 158, "total_doc_pages": 350, "chunks_count": 22},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 10: Diseases and Immunity", "start_page": 159, "end_page": 174, "total_doc_pages": 350, "chunks_count": 16},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 11: Gas Exchange in Humans", "start_page": 175, "end_page": 188, "total_doc_pages": 350, "chunks_count": 14},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 12: Respiration", "start_page": 189, "end_page": 200, "total_doc_pages": 350, "chunks_count": 12},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 13: Excretion in Humans", "start_page": 201, "end_page": 212, "total_doc_pages": 350, "chunks_count": 12},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 14: Coordination and Response", "start_page": 213, "end_page": 236, "total_doc_pages": 350, "chunks_count": 24},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 15: Drugs", "start_page": 237, "end_page": 246, "total_doc_pages": 350, "chunks_count": 10},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 16: Reproduction", "start_page": 247, "end_page": 272, "total_doc_pages": 350, "chunks_count": 26},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 17: Inheritance", "start_page": 273, "end_page": 292, "total_doc_pages": 350, "chunks_count": 20},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 18: Variation and Selection", "start_page": 293, "end_page": 308, "total_doc_pages": 350, "chunks_count": 16},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 19: Organisms and their Environment", "start_page": 309, "end_page": 326, "total_doc_pages": 350, "chunks_count": 18},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 20: Human Influences on Ecosystems", "start_page": 327, "end_page": 340, "total_doc_pages": 350, "chunks_count": 14},
        {"source": "ilide.info-biology-4th-edition-coursebook-0610-pr_e0dc67d76cb4179ef278db40ea76923b.pdf", "chapter": "Chapter 21: Biotechnology and Genetic Modification", "start_page": 341, "end_page": 350, "total_doc_pages": 350, "chunks_count": 10},
    ],
}

# Auto-generate cross-board aliases (e.g. History & Political Science, History & Civics, Social Science)
for (b, g, s), chaps in list(KNOWN_CHAPTERS_MAP.items()):
    if b == "Maharashtra State Board (Balbharati)":
        if s == "History":
            pol = KNOWN_CHAPTERS_MAP.get((b, g, "Political Science")) or KNOWN_CHAPTERS_MAP.get((b, g, "Civics")) or []
            combined = chaps + pol
            KNOWN_CHAPTERS_MAP.setdefault((b, g, "History & Political Science" if int(g) >= 9 else "History & Civics"), combined)
            KNOWN_CHAPTERS_MAP.setdefault((b, g, "Social Science"), combined)
        elif s == "Civics" and int(g) >= 9:
            KNOWN_CHAPTERS_MAP.setdefault((b, g, "Political Science"), chaps)
        elif s == "Political Science" and int(g) < 9:
            KNOWN_CHAPTERS_MAP.setdefault((b, g, "Civics"), chaps)

    elif b == "CBSE (NCERT)":
        # Mirror under "CBSE"
        KNOWN_CHAPTERS_MAP.setdefault(("CBSE", g, s), chaps)
        if s in ("History", "Geography", "Political Science", "Economics", "Civics"):
            KNOWN_CHAPTERS_MAP.setdefault(("CBSE", g, "Social Science"), chaps)
            KNOWN_CHAPTERS_MAP.setdefault(("CBSE (NCERT)", g, "Social Science"), chaps)
