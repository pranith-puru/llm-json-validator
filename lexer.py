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
        
        class Lexer:
    """
    Lexical Analyzer for JSON.
    Tokenizes input strings into a sequence of Tokens while tracking 1-indexed
    line and column numbers.
    """
    TOKEN_LBRACE = "LBRACE"
    TOKEN_RBRACE = "RBRACE"
    TOKEN_LBRACKET = "LBRACKET"
    TOKEN_RBRACKET = "RBRACKET"
    TOKEN_COLON = "COLON"
    TOKEN_COMMA = "COMMA"
    TOKEN_STRING = "STRING"
    TOKEN_NUMBER = "NUMBER"
    TOKEN_TRUE = "TRUE"
    TOKEN_FALSE = "FALSE"
    TOKEN_NULL = "NULL"
    TOKEN_IDENTIFIER = "IDENTIFIER"
    TOKEN_EOF = "EOF"

    def __init__(self, text: str):
        self.text = text
        self.length = len(text)
        self.pos = 0
        self.line = 1
        self.column = 1

    def _peek(self, offset: int = 0) -> str:
        """Look ahead without consuming characters."""
        target = self.pos + offset
        if target < self.length:
            return self.text[target]
        return ""

    def _advance(self) -> str:
        """Consume and return current character, updating line and column."""
        if self.pos >= self.length:
            return ""
        ch = self.text[self.pos]
        self.pos += 1
        if ch == "\n":
            self.line += 1
            self.column = 1
        else:
            self.column += 1
        return ch
    
    def _skip_whitespace_and_comments(self) -> None:
        """Skip whitespace characters and single/multi-line comments."""
        while self.pos < self.length:
            ch = self._peek()
            if ch in " \t\r\n":
                self._advance()
            elif ch == "/" and self._peek(1) == "/":
                while self.pos < self.length and self._peek() != "\n":
                    self._advance()
            elif ch == "/" and self._peek(1) == "*":
                self._advance()  # /
                self._advance()  # *
                while self.pos < self.length:
                    if self._peek() == "*" and self._peek(1) == "/":
                        self._advance()
                        self._advance()
                        break
                    self._advance()
            else:
                break

    def _read_string(self) -> Token:
        start_line, start_col = self.line, self.column
        quote_char = self._advance()
        val_chars: List[str] = []
        while self.pos < self.length:
            ch = self._peek()
            if ch == "\\":
                self._advance()
                escaped = self._advance()
                if escaped:
                    val_chars.append("\\" + escaped)
            elif ch == quote_char or ch == "\n":
                if ch == quote_char:
                    self._advance()
                break
            else:
                val_chars.append(self._advance())
        return Token(self.TOKEN_STRING, "".join(val_chars), start_line, start_col)

    def _read_number(self) -> Token:
        start_line, start_col = self.line, self.column
        num_chars: List[str] = []
        if self._peek() == "-":
            num_chars.append(self._advance())
        while self.pos < self.length and self._peek().isdigit():
            num_chars.append(self._advance())
        if self._peek() == ".":
            num_chars.append(self._advance())
            while self.pos < self.length and self._peek().isdigit():
                num_chars.append(self._advance())
        if self._peek() in "eE":
            num_chars.append(self._advance())
            if self._peek() in "+-":
                num_chars.append(self._advance())
            while self.pos < self.length and self._peek().isdigit():
                num_chars.append(self._advance())
        return Token(self.TOKEN_NUMBER, "".join(num_chars), start_line, start_col)

    def _read_identifier_or_keyword(self) -> Token:
        start_line, start_col = self.line, self.column
        ident_chars: List[str] = []
        while self.pos < self.length:
            ch = self._peek()
            if ch.isalnum() or ch in "_-":
                ident_chars.append(self._advance())
            else:
                break
        val = "".join(ident_chars)
        if val == "true":
            return Token(self.TOKEN_TRUE, val, start_line, start_col)
        elif val == "false":
            return Token(self.TOKEN_FALSE, val, start_line, start_col)
        elif val == "null":
            return Token(self.TOKEN_NULL, val, start_line, start_col)
        else:
            return Token(self.TOKEN_IDENTIFIER, val, start_line, start_col)