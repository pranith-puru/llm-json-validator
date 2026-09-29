import { Token, TokenType } from './types';

export class Lexer {
  private text: string;
  private length: number;
  private pos: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(text: string) {
    this.text = text;
    this.length = text.length;
  }

  private peek(offset: number = 0): string {
    const target = this.pos + offset;
    return target < this.length ? this.text[target] : '';
  }

  private advance(): string {
    if (this.pos >= this.length) return '';
    const ch = this.text[this.pos];
    this.pos++;
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.length) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else if (ch === '/' && this.peek(1) === '/') {
        // Single-line comment
        while (this.pos < this.length && this.peek() !== '\n') {
          this.advance();
        }
      } else if (ch === '/' && this.peek(1) === '*') {
        // Multi-line comment
        this.advance();
        this.advance();
        while (this.pos < this.length) {
          if (this.peek() === '*' && this.peek(1) === '/') {
            this.advance();
            this.advance();
            break;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  private readString(): Token {
    const startLine = this.line;
    const startCol = this.column;
    const startPos = this.pos;
    const quoteChar = this.advance(); // " or '

    const chars: string[] = [];
    while (this.pos < this.length) {
      const ch = this.peek();
      if (ch === '\\') {
        this.advance();
        const esc = this.advance();
        chars.push('\\' + esc);
      } else if (ch === quoteChar) {
        this.advance();
        break;
      } else if (ch === '\n') {
        break;
      } else {
        chars.push(this.advance());
      }
    }

    return {
      type: 'STRING',
      value: chars.join(''),
      line: startLine,
      column: startCol,
      startPos,
      endPos: this.pos,
    };
  }

  private readNumber(): Token {
    const startLine = this.line;
    const startCol = this.column;
    const startPos = this.pos;
    const chars: string[] = [];

    if (this.peek() === '-') {
      chars.push(this.advance());
    }

    while (this.pos < this.length && /[0-9]/.test(this.peek())) {
      chars.push(this.advance());
    }

    if (this.peek() === '.') {
      chars.push(this.advance());
      while (this.pos < this.length && /[0-9]/.test(this.peek())) {
        chars.push(this.advance());
      }
    }

    if (this.peek() === 'e' || this.peek() === 'E') {
      chars.push(this.advance());
      if (this.peek() === '+' || this.peek() === '-') {
        chars.push(this.advance());
      }
      while (this.pos < this.length && /[0-9]/.test(this.peek())) {
        chars.push(this.advance());
      }
    }

    return {
      type: 'NUMBER',
      value: chars.join(''),
      line: startLine,
      column: startCol,
      startPos,
      endPos: this.pos,
    };
  }

  private readIdentifierOrKeyword(): Token {
    const startLine = this.line;
    const startCol = this.column;
    const startPos = this.pos;
    const chars: string[] = [];

    while (this.pos < this.length) {
      const ch = this.peek();
      if (/[a-zA-Z0-9_\-]/.test(ch)) {
        chars.push(this.advance());
      } else {
        break;
      }
    }

    const val = chars.join('');
    let type: TokenType = 'IDENTIFIER';
    if (val === 'true') type = 'TRUE';
    else if (val === 'false') type = 'FALSE';
    else if (val === 'null') type = 'NULL';

    return {
      type,
      value: val,
      line: startLine,
      column: startCol,
      startPos,
      endPos: this.pos,
    };
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.pos < this.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.length) break;

      const ch = this.peek();
      const startLine = this.line;
      const startCol = this.column;
      const startPos = this.pos;

      if (ch === '{') {
        this.advance();
        tokens.push({ type: 'LBRACE', value: '{', line: startLine, column: startCol, startPos, endPos: this.pos });
      } else if (ch === '}') {
        this.advance();
        tokens.push({ type: 'RBRACE', value: '}', line: startLine, column: startCol, startPos, endPos: this.pos });
      } else if (ch === '[') {
        this.advance();
        tokens.push({ type: 'LBRACKET', value: '[', line: startLine, column: startCol, startPos, endPos: this.pos });
      } else if (ch === ']') {
        this.advance();
        tokens.push({ type: 'RBRACKET', value: ']', line: startLine, column: startCol, startPos, endPos: this.pos });
      } else if (ch === ':') {
        this.advance();
        tokens.push({ type: 'COLON', value: ':', line: startLine, column: startCol, startPos, endPos: this.pos });
      } else if (ch === ',') {
        this.advance();
        tokens.push({ type: 'COMMA', value: ',', line: startLine, column: startCol, startPos, endPos: this.pos });
      } else if (ch === '"' || ch === "'") {
        tokens.push(this.readString());
      } else if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(this.peek(1)))) {
        tokens.push(this.readNumber());
      } else if (/[a-zA-Z_]/.test(ch)) {
        tokens.push(this.readIdentifierOrKeyword());
      } else {
        this.advance();
        tokens.push({ type: 'IDENTIFIER', value: ch, line: startLine, column: startCol, startPos, endPos: this.pos });
      }
    }

    tokens.push({
      type: 'EOF',
      value: '',
      line: this.line,
      column: this.column,
      startPos: this.pos,
      endPos: this.pos,
    });

    return tokens;
  }
}
