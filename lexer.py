"""
lexer.py
========
Token class definition for JSON Lexical Analysis with location tracking.
"""
from typing import List

class Token:
    """Represents a lexical token with type, literal value, and source location."""
    def __init__(self, type: str, value: str, line: int, column: int):
        self.type = type
        self.value = value
        self.line = line
        self.column = column

    def __repr__(self) -> str:
        return f"Token({self.type}, {repr(self.value)}, line={self.line}, col={self.column})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Token):
            return False
        return (
            self.type == other.type
            and self.value == other.value
            and self.line == other.line
            and self.column == other.column
        )