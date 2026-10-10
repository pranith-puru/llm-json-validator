"""
parser.py
=========
Recursive Descent Parser simulating a Pushdown Automaton (PDA) stack for JSON.
"""
from typing import List, Optional
from lexer import Token, Lexer

class ParseError(Exception):
    """Raised when a syntax error violates the JSON Context-Free Grammar."""
    def __init__(self, message: str, token: Token, expected: str):
        super().__init__(message)
        self.message = message
        self.token = token
        self.expected = expected

    def __str__(self) -> str:
        return f"{self.message} at line {self.token.line}, column {self.token.column} (Expected: {self.expected})"

class Parser:
    """Simulates a Pushdown Automaton (PDA) via Recursive Descent to parse JSON strings."""
    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos = 0
        self.pda_stack: List[str] = ["$"]