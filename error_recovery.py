"""
error_recovery.py
=================
Automated Error Recovery & Diagnosis Engine for JSON Syntax Violations.
Maps parser exceptions to actionable, human- and LLM-understandable repair suggestions.
Specifically resolves the 5 core LLM syntax failure modes:
1. Trailing comma
2. Missing comma
3. Unquoted key
4. Missing closing brace
5. Missing closing bracket
"""

from typing import List, Dict, Any
from lexer import Token, Lexer
from parser import ParseError


class ErrorRecoveryEngine:
    """
    Analyzes syntactic parsing failures against the Pushdown Automaton grammar state
    and produces deterministic diagnostic classifications and actionable repair suggestions.
    """

    ERROR_TRAILING_COMMA = "TRAILING_COMMA"
    ERROR_MISSING_COMMA = "MISSING_COMMA"
    ERROR_UNQUOTED_KEY = "UNQUOTED_KEY"
    ERROR_MISSING_CLOSING_BRACE = "MISSING_CLOSING_BRACE"
    ERROR_MISSING_CLOSING_BRACKET = "MISSING_CLOSING_BRACKET"
    ERROR_SYNTAX_ERROR = "SYNTAX_ERROR"

    def analyze(self, parse_error: ParseError, tokens: List[Token]) -> Dict[str, Any]:
        """
        Diagnoses the given ParseError using token lookahead and AST/PDA stack heuristics.
        Returns a dictionary with error_type, location, suggestion, and technical details.
        """
        tok = parse_error.token
        msg = parse_error.message.lower()
        expected = parse_error.expected

        # Compute formatted human-readable location
        location_str = f"line {tok.line}, column {tok.column}"

        # 1. Check for Trailing Comma
        if "trailing comma" in msg or (
            tok.type == Lexer.TOKEN_COMMA and self._is_followed_by_closer(tok, tokens)
        ):
            return {
                "error_type": self.ERROR_TRAILING_COMMA,
                "location": location_str,
                "suggestion": f"Remove the extraneous trailing comma at line {tok.line}, column {tok.column}.",
                "details": "JSON specification (RFC 8259) forbids trailing commas after the final element or key-value pair.",
                "token": tok.value,
            }

        # 2. Check for Unquoted Key
        if "unquoted" in msg or (tok.type == Lexer.TOKEN_IDENTIFIER and "key" in expected):
            return {
                "error_type": self.ERROR_UNQUOTED_KEY,
                "location": location_str,
                "suggestion": f'Wrap unquoted key {repr(tok.value)} in double quotes: "{tok.value}".',
                "details": f"Object keys in JSON must be double-quoted strings, but found unquoted identifier '{tok.value}'.",
                "token": tok.value,
            }

        # 3. Check for Missing Closing Brace '}'
        if "missing closing brace" in msg or (tok.type == Lexer.TOKEN_EOF and "}" in expected):
            return {
                "error_type": self.ERROR_MISSING_CLOSING_BRACE,
                "location": location_str,
                "suggestion": "Insert missing closing brace '}' at the end of the unclosed object.",
                "details": "The Pushdown Automaton reached EOF or an invalid state with an active '{' on the PDA stack.",
                "token": tok.value or "EOF",
            }

        # 4. Check for Missing Closing Bracket ']'
        if "missing closing bracket" in msg or (tok.type == Lexer.TOKEN_EOF and "]" in expected):
            return {
                "error_type": self.ERROR_MISSING_CLOSING_BRACKET,
                "location": location_str,
                "suggestion": "Insert missing closing bracket ']' at the end of the unclosed array.",
                "details": "The Pushdown Automaton reached EOF or an invalid state with an active '[' on the PDA stack.",
                "token": tok.value or "EOF",
            }

        # 5. Check for Missing Comma
        if "expected ','" in msg or expected == "','":
            return {
                "error_type": self.ERROR_MISSING_COMMA,
                "location": location_str,
                "suggestion": f"Insert a missing comma ',' before token '{tok.value}' at line {tok.line}, column {tok.column}.",
                "details": "Adjacent elements in an array or key-value pairs in an object must be separated by a comma.',",
                "token": tok.value,
            }

        # Secondary heuristics: check if EOF happened while brackets were unbalanced in tokens
        unbalanced_closer = self._detect_unbalanced_closer(tokens)
        if tok.type == Lexer.TOKEN_EOF and unbalanced_closer == "}":
            return {
                "error_type": self.ERROR_MISSING_CLOSING_BRACE,
                "location": location_str,
                "suggestion": "Insert missing closing brace '}' at end of object.",
                "details": "Input stream terminated prematurely before object closing delimiter '}'.",
                "token": "EOF",
            }
        elif tok.type == Lexer.TOKEN_EOF and unbalanced_closer == "]":
            return {
                "error_type": self.ERROR_MISSING_CLOSING_BRACKET,
                "location": location_str,
                "suggestion": "Insert missing closing bracket ']' at end of array.",
                "details": "Input stream terminated prematurely before array closing delimiter ']'.",
                "token": "EOF",
            }

        # Generic syntax error fallback
        return {
            "error_type": self.ERROR_SYNTAX_ERROR,
            "location": location_str,
            "suggestion": f"Expected {expected}, but found '{tok.value if tok.value else tok.type}'.",
            "details": parse_error.message,
            "token": tok.value,
        }

    def _is_followed_by_closer(self, token: Token, tokens: List[Token]) -> bool:
        """Helper to check if a comma token is directly succeeded by '}' or ']'."""
        try:
            idx = tokens.index(token)
            if idx + 1 < len(tokens):
                next_tok = tokens[idx + 1]
                return next_tok.type in (Lexer.TOKEN_RBRACE, Lexer.TOKEN_RBRACKET)
        except ValueError:
            pass
        return False

    def _detect_unbalanced_closer(self, tokens: List[Token]) -> str:
        """Scan tokens to determine if an unclosed '{' or '[' remains."""
        stack: List[str] = []
        for t in tokens:
            if t.type == Lexer.TOKEN_LBRACE:
                stack.append("}")
            elif t.type == Lexer.TOKEN_LBRACKET:
                stack.append("]")
            elif t.type == Lexer.TOKEN_RBRACE:
                if stack and stack[-1] == "}":
                    stack.pop()
            elif t.type == Lexer.TOKEN_RBRACKET:
                if stack and stack[-1] == "]":
                    stack.pop()
        return stack[-1] if stack else ""
