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
        
        def _current_token(self) -> Token:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return self.tokens[-1]

    def _advance(self) -> Token:
        tok = self._current_token()
        if self.pos < len(self.tokens) - 1:
            self.pos += 1
        return tok

    def _match(self, expected_type: str) -> bool:
        return self._current_token().type == expected_type

    def _consume(self, expected_type: str, description: Optional[str] = None) -> Token:
        tok = self._current_token()
        if tok.type == expected_type:
            return self._advance()
        desc = description if description else expected_type
        raise ParseError(
            message=f"Expected '{desc}', found '{tok.value if tok.value else tok.type}'",
            token=tok,
            expected=desc,
        )

    def parse(self) -> bool:
        if not self.tokens or (len(self.tokens) == 1 and self.tokens[0].type == Lexer.TOKEN_EOF):
            raise ParseError(
                message="Empty JSON input payload",
                token=self._current_token(),
                expected="JSON value",
            )
        self.pda_stack.append("VALUE")
        self.parse_value()
        self.pda_stack.pop()
        tok = self._current_token()
        if tok.type != Lexer.TOKEN_EOF:
            raise ParseError(
                message=f"Unexpected trailing content '{tok.value}' after root JSON element",
                token=tok,
                expected="EOF",
            )
        return True

    def parse_value(self) -> None:
        tok = self._current_token()
        if tok.type == Lexer.TOKEN_LBRACE:
            self.parse_object()
        elif tok.type == Lexer.TOKEN_LBRACKET:
            self.parse_array()
        elif tok.type in (Lexer.TOKEN_STRING, Lexer.TOKEN_NUMBER, Lexer.TOKEN_TRUE, Lexer.TOKEN_FALSE, Lexer.TOKEN_NULL):
            self._advance()
        elif tok.type == Lexer.TOKEN_IDENTIFIER:
            raise ParseError(
                message=f"Unrecognized literal or unquoted value '{tok.value}'",
                token=tok,
                expected="valid JSON value",
            )
        else:
            raise ParseError(
                message=f"Unexpected token '{tok.value}' in value position",
                token=tok,
                expected="JSON value",
            )
            
            def parse_object(self) -> None:
        lbrace_tok = self._consume(Lexer.TOKEN_LBRACE, "{")
        self.pda_stack.append("}")
        if self._match(Lexer.TOKEN_RBRACE):
            self._advance()
            self.pda_stack.pop()
            return
        while True:
            self.parse_pair()
            if self._match(Lexer.TOKEN_COMMA):
                comma_tok = self._advance()
                if self._match(Lexer.TOKEN_RBRACE):
                    raise ParseError(
                        message="Trailing comma detected before closing brace '}'",
                        token=comma_tok,
                        expected="key-value pair or remove comma",
                    )
            elif self._match(Lexer.TOKEN_RBRACE):
                self._advance()
                self.pda_stack.pop()
                break
            elif self._match(Lexer.TOKEN_EOF):
                raise ParseError(
                    message=f"Missing closing brace '}}' for object starting at line {lbrace_tok.line}, column {lbrace_tok.column}",
                    token=self._current_token(),
                    expected="'}'",
                )
            else:
                tok = self._current_token()
                raise ParseError(
                    message=f"Expected ',' delimiter between object members, found '{tok.value}'",
                    token=tok,
                    expected="','",
                )

    def parse_pair(self) -> None:
        tok = self._current_token()
        if tok.type == Lexer.TOKEN_STRING:
            self._advance()
        elif tok.type == Lexer.TOKEN_IDENTIFIER:
            self._advance()
            raise ParseError(
                message=f"Unquoted object key '{tok.value}'",
                token=tok,
                expected=f'"{tok.value}"',
            )
        else:
            raise ParseError(
                message=f"Expected string key in object pair, found '{tok.value if tok.value else tok.type}'",
                token=tok,
                expected="quoted string key",
            )
        if self._match(Lexer.TOKEN_COLON):
            self._advance()
        else:
            raise ParseError(
                message=f"Expected ':' after object key, found '{self._current_token().value}'",
                token=self._current_token(),
                expected="':'",
            )
        self.parse_value()