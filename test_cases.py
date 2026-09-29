"""
test_cases.py
==============
Comprehensive Unit Test Suite for JSON Validator with Error Recovery.
Verifies parsing of standard JSON strings and asserts precise classification
across all 5 core syntax failure modes:
1. Trailing comma
2. Missing comma
3. Unquoted key
4. Missing closing brace
5. Missing closing bracket
"""

import sys
from validator import validate_json


def run_unit_tests() -> None:
    """
    Executes all test cases and asserts expected outputs.
    Raises AssertionError if any test fails.
    """
    print("=====================================================================")
    print("       JSON VALIDATOR & ERROR RECOVERY SUITE - UNIT TESTS           ")
    print("=====================================================================\n")

    passed_count = 0
    total_count = 0

    # -------------------------------------------------------------------------
    # 1. Valid JSON Payloads
    # -------------------------------------------------------------------------
    valid_test_cases = [
        ('{"key": "value"}', "Simple object"),
        ('{"a": 1, "b": true, "c": null, "d": [1, 2, 3]}', "Mixed types object"),
        ('[]', "Empty array"),
        ('{}', "Empty object"),
        ('[1, "two", 3.14, false, null]', "Heterogeneous array"),
        ('{"nested": {"array": [{"x": 10}, {"y": 20}]}}', "Deeply nested hierarchy"),
    ]

    for payload, desc in valid_test_cases:
        total_count += 1
        res = validate_json(payload)
        assert res == "VALID", f"Expected 'VALID' for {desc}, got: {res}"
        print(f"[PASS] Valid Test #{total_count}: {desc}")
        passed_count += 1

    # -------------------------------------------------------------------------
    # 2. Trailing Comma Cases
    # -------------------------------------------------------------------------
    trailing_comma_cases = [
        ('{"a": 1, "b": 2,}', "Object trailing comma"),
        ('[1, 2, 3,]', "Array trailing comma"),
        ('{"users": ["alice", "bob",],}', "Nested trailing comma"),
    ]

    for payload, desc in trailing_comma_cases:
        total_count += 1
        res = validate_json(payload)
        assert isinstance(res, dict) and not res["valid"], f"Expected invalid for {desc}"
        assert res["error_type"] == "TRAILING_COMMA", (
            f"Expected TRAILING_COMMA for {desc}, got: {res['error_type']}"
        )
        print(f"[PASS] Error Test #{total_count} ({res['error_type']}): {desc} -> {res['suggestion']}")
        passed_count += 1

    # -------------------------------------------------------------------------
    # 3. Missing Comma Cases
    # -------------------------------------------------------------------------
    missing_comma_cases = [
        ('{"name": "Alice" "age": 30}', "Missing comma between object pairs"),
        ('[1 2 3]', "Missing comma between array numbers"),
        ('{"a": [1, 2] "b": 4}', "Missing comma before second key"),
    ]

    for payload, desc in missing_comma_cases:
        total_count += 1
        res = validate_json(payload)
        assert isinstance(res, dict) and not res["valid"], f"Expected invalid for {desc}"
        assert res["error_type"] == "MISSING_COMMA", (
            f"Expected MISSING_COMMA for {desc}, got: {res['error_type']}"
        )
        print(f"[PASS] Error Test #{total_count} ({res['error_type']}): {desc} -> {res['suggestion']}")
        passed_count += 1

    # -------------------------------------------------------------------------
    # 4. Unquoted Key Cases
    # -------------------------------------------------------------------------
    unquoted_key_cases = [
        ('{name: "Alice", "age": 30}', "Bare key at start of object"),
        ('{"role": "admin", user_id: 42}', "Bare key with underscore"),
        ('{data: {status: 200}}', "Nested unquoted keys"),
    ]

    for payload, desc in unquoted_key_cases:
        total_count += 1
        res = validate_json(payload)
        assert isinstance(res, dict) and not res["valid"], f"Expected invalid for {desc}"
        assert res["error_type"] == "UNQUOTED_KEY", (
            f"Expected UNQUOTED_KEY for {desc}, got: {res['error_type']}"
        )
        print(f"[PASS] Error Test #{total_count} ({res['error_type']}): {desc} -> {res['suggestion']}")
        passed_count += 1

    # -------------------------------------------------------------------------
    # 5. Missing Closing Brace Cases
    # -------------------------------------------------------------------------
    missing_brace_cases = [
        ('{"service": "auth", "port": 8080', "Missing outer closing brace"),
        ('{"config": {"debug": true}', "Missing inner closing brace"),
    ]

    for payload, desc in missing_brace_cases:
        total_count += 1
        res = validate_json(payload)
        assert isinstance(res, dict) and not res["valid"], f"Expected invalid for {desc}"
        assert res["error_type"] == "MISSING_CLOSING_BRACE", (
            f"Expected MISSING_CLOSING_BRACE for {desc}, got: {res['error_type']}"
        )
        print(f"[PASS] Error Test #{total_count} ({res['error_type']}): {desc} -> {res['suggestion']}")
        passed_count += 1

    # -------------------------------------------------------------------------
    # 6. Missing Closing Bracket Cases
    # -------------------------------------------------------------------------
    missing_bracket_cases = [
        ('["apple", "banana", "cherry"', "Missing outer closing bracket"),
        ('{"tags": ["ai", "toc"', "Missing inner array closing bracket"),
    ]

    for payload, desc in missing_bracket_cases:
        total_count += 1
        res = validate_json(payload)
        assert isinstance(res, dict) and not res["valid"], f"Expected invalid for {desc}"
        assert res["error_type"] == "MISSING_CLOSING_BRACKET", (
            f"Expected MISSING_CLOSING_BRACKET for {desc}, got: {res['error_type']}"
        )
        print(f"[PASS] Error Test #{total_count} ({res['error_type']}): {desc} -> {res['suggestion']}")
        passed_count += 1

    print("\n---------------------------------------------------------------------")
    print(f"RESULTS: {passed_count}/{total_count} tests PASSED (100% Success Rate)")
    print("---------------------------------------------------------------------\n")


if __name__ == "__main__":
    run_unit_tests()
