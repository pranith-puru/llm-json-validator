import { Token } from './types';

export class ErrorRecoveryEngine {
  public static readonly ERROR_TRAILING_COMMA = 'TRAILING_COMMA';
  public static readonly ERROR_MISSING_COMMA = 'MISSING_COMMA';
  public static readonly ERROR_UNQUOTED_KEY = 'UNQUOTED_KEY';
  public static readonly ERROR_MISSING_CLOSING_BRACE = 'MISSING_CLOSING_BRACE';
  public static readonly ERROR_MISSING_CLOSING_BRACKET = 'MISSING_CLOSING_BRACKET';
  public static readonly ERROR_SYNTAX_ERROR = 'SYNTAX_ERROR';

  public analyze(
    message: string,
    expected: string,
    token: Token,
    tokens: Token[],
    sourceText: string
  ): {
    type: string;
    message: string;
    location: string;
    line: number;
    column: number;
    suggestion: string;
    details: string;
    repairedText: string;
  } {
    const loc = `Line ${token.line}, Column ${token.column}`;
    const msgLower = message.toLowerCase();

    // 1. Trailing Comma
    if (
      msgLower.includes('trailing comma') ||
      (token.type === 'COMMA' && this.isFollowedByCloser(token, tokens))
    ) {
      const repaired = this.fixTrailingComma(sourceText, token);
      return {
        type: ErrorRecoveryEngine.ERROR_TRAILING_COMMA,
        message,
        location: loc,
        line: token.line,
        column: token.column,
        suggestion: `Remove the extraneous trailing comma at line ${token.line}, column ${token.column}.`,
        details: 'JSON specification (RFC 8259) forbids trailing commas after the final element or key-value pair.',
        repairedText: repaired,
      };
    }

    // 2. Unquoted Key
    if (msgLower.includes('unquoted') || (token.type === 'IDENTIFIER' && expected.includes('key'))) {
      const repaired = this.fixUnquotedKey(sourceText, token);
      return {
        type: ErrorRecoveryEngine.ERROR_UNQUOTED_KEY,
        message,
        location: loc,
        line: token.line,
        column: token.column,
        suggestion: `Wrap unquoted key '${token.value}' in double quotes: "${token.value}".`,
        details: `Object keys in JSON must be double-quoted strings, but found unquoted identifier '${token.value}'.`,
        repairedText: repaired,
      };
    }

    // 3. Missing Closing Brace
    if (
      msgLower.includes('missing closing brace') ||
      (token.type === 'EOF' && expected.includes('}')) ||
      (expected.includes('}') && this.detectUnbalancedCloser(tokens) === '}')
    ) {
      const repaired = sourceText.trimEnd() + '\n}';
      return {
        type: ErrorRecoveryEngine.ERROR_MISSING_CLOSING_BRACE,
        message,
        location: loc,
        line: token.line,
        column: token.column,
        suggestion: "Insert missing closing brace '}' at the end of the unclosed object.",
        details: "The Pushdown Automaton reached EOF or an invalid state with an active '{' on the PDA stack.",
        repairedText: repaired,
      };
    }

    // 4. Missing Closing Bracket
    if (
      msgLower.includes('missing closing bracket') ||
      (token.type === 'EOF' && expected.includes(']')) ||
      (expected.includes(']') && this.detectUnbalancedCloser(tokens) === ']')
    ) {
      const repaired = sourceText.trimEnd() + '\n]';
      return {
        type: ErrorRecoveryEngine.ERROR_MISSING_CLOSING_BRACKET,
        message,
        location: loc,
        line: token.line,
        column: token.column,
        suggestion: "Insert missing closing bracket ']' at the end of the unclosed array.",
        details: "The Pushdown Automaton reached EOF or an invalid state with an active '[' on the PDA stack.",
        repairedText: repaired,
      };
    }

    // 5. Missing Comma
    if (msgLower.includes("expected ','") || expected === "','") {
      const repaired = this.fixMissingComma(sourceText, token);
      return {
        type: ErrorRecoveryEngine.ERROR_MISSING_COMMA,
        message,
        location: loc,
        line: token.line,
        column: token.column,
        suggestion: `Insert a missing comma ',' before token '${token.value}' at line ${token.line}, column ${token.column}.`,
        details: "Adjacent elements in an array or key-value pairs in an object must be separated by a comma ','.",
        repairedText: repaired,
      };
    }

    // Fallback
    return {
      type: ErrorRecoveryEngine.ERROR_SYNTAX_ERROR,
      message,
      location: loc,
      line: token.line,
      column: token.column,
      suggestion: `Expected ${expected}, but found '${token.value || token.type}'.`,
      details: message,
      repairedText: sourceText,
    };
  }

  private isFollowedByCloser(token: Token, tokens: Token[]): boolean {
    const idx = tokens.indexOf(token);
    if (idx !== -1 && idx + 1 < tokens.length) {
      const next = tokens[idx + 1];
      return next.type === 'RBRACE' || next.type === 'RBRACKET';
    }
    return false;
  }

  private detectUnbalancedCloser(tokens: Token[]): string {
    const stack: string[] = [];
    for (const t of tokens) {
      if (t.type === 'LBRACE') stack.push('}');
      else if (t.type === 'LBRACKET') stack.push(']');
      else if (t.type === 'RBRACE') {
        if (stack.length && stack[stack.length - 1] === '}') stack.pop();
      } else if (t.type === 'RBRACKET') {
        if (stack.length && stack[stack.length - 1] === ']') stack.pop();
      }
    }
    return stack.length ? stack[stack.length - 1] : '';
  }

  private fixTrailingComma(text: string, token: Token): string {
    if (token.startPos !== undefined && token.endPos !== undefined) {
      return text.slice(0, token.startPos) + text.slice(token.endPos);
    }
    // Fallback: replace last comma before closing brace or bracket
    return text.replace(/,(\s*[}\]])/g, '$1');
  }

  private fixUnquotedKey(text: string, token: Token): string {
    if (token.startPos !== undefined && token.endPos !== undefined) {
      return text.slice(0, token.startPos) + `"${token.value}"` + text.slice(token.endPos);
    }
    return text.replace(new RegExp(`\\b${token.value}\\b(\\s*:)`), `"${token.value}"$1`);
  }

  private fixMissingComma(text: string, token: Token): string {
    if (token.startPos !== undefined) {
      return text.slice(0, token.startPos) + ', ' + text.slice(token.startPos);
    }
    return text;
  }
}
