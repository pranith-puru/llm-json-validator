"""
validator.py
============
Main public API for JSON validation with error recovery.
Provides:
  - validate_json(text: str) -> Union[str, dict]
  - format_validation_output(input_index: int, result: Union[str, dict]) -> str
  - validate_batch(samples: List[str]) -> None
"""

from typing import Union, Dict, Any, List
from lexer import Lexer
from parser import Parser, ParseError
from error_recovery import ErrorRecoveryEngine


def validate_json(text: str) -> Union[str, Dict[str, Any]]:
    """
    Validates a JSON string using a custom Lexer and Pushdown Automaton-based Recursive
    Descent Parser. If the payload is well-formed, returns "VALID".
    If malformed, analyzes the syntax failure and returns a structured dictionary
    with the error type, location, and actionable recovery suggestion.

    Returns:
        "VALID" if input conforms to JSON Context-Free Grammar.
        {"valid": False, "error_type": str, "location": str, "suggestion": str} if invalid.
    """
    if not isinstance(text, str):
        return {
            "valid": False,
            "error_type": "TYPE_ERROR",
            "location": "line 1, column 1",
            "suggestion": "Input must be a string.",
        }

    try:
        lexer = Lexer(text)
        tokens = lexer.tokenize()
        parser = Parser(tokens)
        parser.parse()
        return "VALID"
    except ParseError as pe:
        engine = ErrorRecoveryEngine()
        diagnosis = engine.analyze(pe, parser.tokens if "parser" in locals() else [])
        return {
            "valid": False,
            "error_type": diagnosis["error_type"],
            "location": diagnosis["location"],
            "suggestion": diagnosis["suggestion"],
        }
    except Exception as e:
        return {
            "valid": False,
            "error_type": "UNKNOWN_ERROR",
            "location": "line 1, column 1",
            "suggestion": f"Parsing failed: {str(e)}",
        }


def format_validation_output(input_index: int, result: Union[str, Dict[str, Any]]) -> str:
    """
    Formats validation result strictly adhering to project specifications:
      * For valid:
        "Input 1: VALID"
      * For invalid:
        "Input 1: INVALID — <error_type/description>"
        "Location: line X, column Y"
        "Fix suggestion: <actionable fix>"
    """
    if result == "VALID":
        return f"Input {input_index}: VALID"

    if isinstance(result, dict):
        error_type = result.get("error_type", "Syntax Error")
        location = result.get("location", "line 1, column 1")
        suggestion = result.get("suggestion", "Check syntax according to RFC 8259.")
        return (
            f"Input {input_index}: INVALID — {error_type}\n"
            f"Location: {location}\n"
            f"Fix suggestion: {suggestion}"
        )

    return f"Input {input_index}: INVALID — Unknown Error"


def validate_batch(samples: List[str]) -> None:
    """
    Iterates through a list of sample strings and prints formatted results sequentially
    with clean divider lines.
    """
    print("=" * 60)
    print("           BATCH JSON VALIDATION EXECUTION                  ")
    print("=" * 60)
    for idx, sample in enumerate(samples, start=1):
        result = validate_json(sample)
        formatted_output = format_validation_output(idx, result)
        print(formatted_output)
        print("-" * 60)
