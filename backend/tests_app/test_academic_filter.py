import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.router.prompt_engineer import _is_academic_query

tests = [
    ('how to install mongodb', None, False),
    ('write a python script for sorting', None, False),
    ('what is the error in my code', None, False),
    ('how to deploy on render', None, False),
    ('explain newton third law', {'board': 'CBSE', 'grade': '10'}, True),
    ('derive ohms law', {'exam': 'JEE'}, True),
    ('what is photosynthesis', {'board': 'ICSE', 'grade': '9', 'subject': 'Biology'}, True),
    ('give me a recipe for pasta', None, False),
    ('how to create a website', None, False),
    ('what is the formula for kinetic energy', {'board': 'CBSE'}, True),
    ('explain refraction of light', {'board': 'CBSE', 'grade': '10'}, True),
    ('how to install python', {'board': 'CBSE', 'grade': '10'}, False),
    ('what is machine learning', None, False),
    ('define cell division', {'board': 'CBSE', 'grade': '9'}, True),
    ('how to setup react app', None, False),
    ('give me name of 5th chapter of 9th physics', None, False),
]

passed = 0
failed = 0
for query, ctx, expected in tests:
    result = _is_academic_query(query, ctx)
    status = 'PASS' if result == expected else 'FAIL'
    if result == expected:
        passed += 1
    else:
        failed += 1
    print(f'{status} "{query}" -> {result} (expected {expected})')

print(f"\n{passed}/{passed+failed} tests passed")
