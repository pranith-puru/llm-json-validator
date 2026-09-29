"""
parser.py
=========
Recursive Descent Parser simulating a Pushdown Automaton (PDA) stack for JSON.
Validates Context-Free Grammar (CFG) rules and generates explicit ParseError
exceptions containing token context and expected grammar symbols.
"""

from typing import List, Optional
from lexer import Token, Lexer


class ParseError(Exception):
    """
    Raised when a syntax error violates the JSON Context-Free Grammar.
    Carries the problematic Token, an explanatory message, and expected grammar symbol.
    """

    def __init__(self, message: str, token: Token, expected: str):
        super().__init__(message)
        self.message = message
        self.token = token
        self.expected = expected

    def __str__(self) -> str:
        return f"{self.message} at line {self.token.line}, column {self.token.column} (Expected: {self.expected})"


class Parser:
    """
    Simulates a Pushdown Automaton (PDA) via Recursive Descent to parse JSON strings.
    The internal `pda_stack` explicitly tracks grammar non-terminals and expected closing
    delimiters, bridging theoretical automata theory with practical compiler engineering.
    """

    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.pos = 0
        # Simulates the PDA stack (Context-Free Grammar symbols & expected brackets)
        self.pda_stack: List[str] = ["$"]  # Bottom of stack marker

    def _current_token(self) -> Token:
        """Returns the current lookahead token."""
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return self.tokens[-1]

    def _previous_token(self) -> Token:
        """Returns the token immediately preceding the current position."""
        if self.pos > 0:
            return self.tokens[self.pos - 1]
        return self.tokens[0]

    def _advance(self) -> Token:
        """Consumes and returns the current token."""
        tok = self._current_token()
        if self.pos < len(self.tokens) - 1:
            self.pos += 1
        return tok

    def _match(self, expected_type: str) -> bool:
        """Checks if current token matches expected type."""
        return self._current_token().type == expected_type

    def _consume(self, expected_type: str, description: Optional[str] = None) -> Token:
        """Consumes expected token or raises ParseError."""
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
        """
        Entry point: Parses root JSON value according to production S -> VALUE EOF.
        Simulates PDA transition δ(q0, ε, Z0) -> (q1, S Z0).
        """
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
        """
        Parses a JSON value non-terminal:
        VALUE -> OBJECT | ARRAY | STRING | NUMBER | TRUE | FALSE | NULL
        """
        tok = self._current_token()

        if tok.type == Lexer.TOKEN_LBRACE:
            self.parse_object()
        elif tok.type == Lexer.TOKEN_LBRACKET:
            self.parse_array()
        elif tok.type == Lexer.TOKEN_STRING:
            self._advance()
        elif tok.type == Lexer.TOKEN_NUMBER:
            self._advance()
        elif tok.type in (Lexer.TOKEN_TRUE, Lexer.TOKEN_FALSE, Lexer.TOKEN_NULL):
            self._advance()
        elif tok.type == Lexer.TOKEN_IDENTIFIER:
            # An identifier where a value was expected (e.g. unquoted string value or misplaced key)
            raise ParseError(
                message=f"Unrecognized literal or unquoted value '{tok.value}'",
                token=tok,
                expected="valid JSON value (string, number, boolean, null, object, or array)",
            )
        elif tok.type == Lexer.TOKEN_EOF:
            # Premature end of file while expecting value
            top_symbol = self.pda_stack[-1] if self.pda_stack else "$"
            raise ParseError(
                message="Unexpected end of input while expecting JSON value",
                token=tok,
                expected=f"value matching '{top_symbol}'",
            )
        else:
            raise ParseError(
                message=f"Unexpected token '{tok.value}' in value position",
                token=tok,
                expected="JSON value",
            )

    def parse_object(self) -> None:
        """
        Parses an object non-terminal:
        OBJECT -> '{' [ MEMBERS ] '}'
        MEMBERS -> PAIR { ',' PAIR }
        """
        lbrace_tok = self._consume(Lexer.TOKEN_LBRACE, "{")
        self.pda_stack.append("}")  # PDA stack pushes expected closing brace

        # Check for empty object: {}
        if self._match(Lexer.TOKEN_RBRACE):
            self._advance()
            self.pda_stack.pop()
            return

        while True:
            # Parse key-value pair
            self.parse_pair()

            # Inspect what follows the pair
            if self._match(Lexer.TOKEN_COMMA):
                comma_tok = self._advance()
                # Check for Trailing Comma (e.g. { "a": 1, })
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
            elif self._match(Lexer.TOKEN_RBRACKET):
                # Ancestor delimiter encountered: unclosed object inside array
                tok = self._current_token()
                raise ParseError(
                    message=f"Missing closing brace '}}' for object: encountered ']' at line {tok.line}, column {tok.column}",
                    token=tok,
                    expected="'}'",
                )
            elif self._match(Lexer.TOKEN_EOF):
                # Missing closing brace
                raise ParseError(
                    message="Missing closing brace '}' for object starting at line "
                    f"{lbrace_tok.line}, column {lbrace_tok.column}",
                    token=self._current_token(),
                    expected="'}'",
                )
            else:
                # Neither comma nor closing brace -> likely missing comma!
                tok = self._current_token()
                raise ParseError(
                    message=f"Expected ',' delimiter between object members, found '{tok.value}'",
                    token=tok,
                    expected="','",
                )

    def parse_array(self) -> None:
        """
        Parses an array non-terminal:
        ARRAY -> '[' [ ELEMENTS ] ']'
        ELEMENTS -> VALUE { ',' VALUE }
        """
        lbracket_tok = self._consume(Lexer.TOKEN_LBRACKET, "[")
        self.pda_stack.append("]")  # PDA stack pushes expected closing bracket

        # Check for empty array: []
        if self._match(Lexer.TOKEN_RBRACKET):
            self._advance()
            self.pda_stack.pop()
            return

        while True:
            # Parse array element
            self.parse_value()

            # Inspect delimiter
            if self._match(Lexer.TOKEN_COMMA):
                comma_tok = self._advance()
                # Check for Trailing Comma (e.g. [1, 2, ])
                if self._match(Lexer.TOKEN_RBRACKET):
                    raise ParseError(
                        message="Trailing comma detected before closing bracket ']'",
                        token=comma_tok,
                        expected="array element or remove comma",
                    )
            elif self._match(Lexer.TOKEN_RBRACKET):
                self._advance()
                self.pda_stack.pop()
                break
            elif self._match(Lexer.TOKEN_RBRACE):
                # Ancestor delimiter encountered: unclosed array inside object
                tok = self._current_token()
                raise ParseError(
                    message=f"Missing closing bracket ']' for array: encountered '}}' at line {tok.line}, column {tok.column}",
                    token=tok,
                    expected="']'",
                )
            elif self._match(Lexer.TOKEN_EOF):
                # Missing closing bracket
                raise ParseError(
                    message="Missing closing bracket ']' for array starting at line "
                    f"{lbracket_tok.line}, column {lbracket_tok.column}",
                    token=self._current_token(),
                    expected="']'",
                )
            else:
                # Neither comma nor closing bracket -> likely missing comma
                tok = self._current_token()
                raise ParseError(
                    message=f"Expected ',' delimiter between array elements, found '{tok.value}'",
                    token=tok,
                    expected="','",
                )

    def parse_pair(self) -> None:
        """
        Parses a key-value pair non-terminal:
        PAIR -> STRING ':' VALUE
        Handles detection of UNQUOTED_KEY defects.
        """
        tok = self._current_token()

        if tok.type == Lexer.TOKEN_STRING:
            self._advance()
        elif tok.type == Lexer.TOKEN_IDENTIFIER:
            # Defect: Unquoted object key!
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

        # Must be followed by a colon ':'
        if self._match(Lexer.TOKEN_COLON):
            self._advance()
        else:
            raise ParseError(
                message=f"Expected ':' after object key, found '{self._current_token().value}'",
                token=self._current_token(),
                expected="':'",
            )

        # Followed by a value
        self.parse_value()
