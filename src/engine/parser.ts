import { Token, PDAStep, ParseResult } from './types';
import { Lexer } from './lexer';
import { ErrorRecoveryEngine } from './errorRecovery';

export class Parser {
  private tokens: Token[];
  private sourceText: string;
  private pos: number = 0;
  private pdaStack: string[] = ['$'];
  private steps: PDAStep[] = [];
  private stepCounter: number = 0;
  private maxDepth: number = 0;
  private stats = {
    objectCount: 0,
    arrayCount: 0,
    pairCount: 0,
    primitiveCount: 0,
  };

  constructor(tokens: Token[], sourceText: string) {
    this.tokens = tokens;
    this.sourceText = sourceText;
  }

  private currentToken(): Token {
    if (this.pos < this.tokens.length) {
      return this.tokens[this.pos];
    }
    return this.tokens[this.tokens.length - 1];
  }

  private advance(): Token {
    const tok = this.currentToken();
    if (this.pos < this.tokens.length - 1) {
      this.pos++;
    }
    return tok;
  }

  private match(type: string): boolean {
    return this.currentToken().type === type;
  }

  private recordStep(state: string, action: string, rule?: string) {
    this.stepCounter++;
    this.maxDepth = Math.max(this.maxDepth, this.pdaStack.length);
    this.steps.push({
      step: this.stepCounter,
      state,
      lookahead: this.currentToken(),
      stack: [...this.pdaStack],
      action,
      rule,
    });
  }

  private consume(type: string, desc?: string): Token {
    const tok = this.currentToken();
    if (tok.type === type) {
      this.recordStep('q_consume', `Shift token: '${tok.value}' (${tok.type})`);
      return this.advance();
    }
    const expected = desc || type;
    throw {
      message: `Expected '${expected}', found '${tok.value || tok.type}'`,
      token: tok,
      expected,
    };
  }

  public parse(): ParseResult {
    try {
      if (!this.tokens.length || (this.tokens.length === 1 && this.tokens[0].type === 'EOF')) {
        throw {
          message: 'Empty JSON input payload',
          token: this.currentToken(),
          expected: 'JSON value',
        };
      }

      this.recordStep('q0', 'Initialize PDA with bottom marker $ and start symbol VALUE', 'S -> VALUE EOF');
      this.pdaStack.push('VALUE');
      this.parseValue();
      this.pdaStack.pop();

      const tok = this.currentToken();
      if (tok.type !== 'EOF') {
        throw {
          message: `Unexpected trailing content '${tok.value}' after root element`,
          token: tok,
          expected: 'EOF',
        };
      }

      this.recordStep('q_accept', 'PDA reaches terminal state q_accept with empty stack', 'δ(q, ε, $) -> (q_accept, ε)');

      return {
        valid: true,
        tokens: this.tokens,
        pdaSteps: this.steps,
        depth: this.maxDepth,
        stats: this.stats,
      };
    } catch (err: any) {
      const errorEngine = new ErrorRecoveryEngine();
      const token = err.token || this.currentToken();
      const message = err.message || 'Syntax error';
      const expected = err.expected || 'valid syntax';
      const analysis = errorEngine.analyze(message, expected, token, this.tokens, this.sourceText);

      return {
        valid: false,
        error: analysis,
        tokens: this.tokens,
        pdaSteps: this.steps,
        depth: this.maxDepth,
        stats: this.stats,
      };
    }
  }

  private parseValue(): void {
    const tok = this.currentToken();

    if (tok.type === 'LBRACE') {
      this.parseObject();
    } else if (tok.type === 'LBRACKET') {
      this.parseArray();
    } else if (tok.type === 'STRING') {
      this.recordStep('q_val', `Reduce String '${tok.value}'`, 'VALUE -> STRING');
      this.stats.primitiveCount++;
      this.advance();
    } else if (tok.type === 'NUMBER') {
      this.recordStep('q_val', `Reduce Number ${tok.value}`, 'VALUE -> NUMBER');
      this.stats.primitiveCount++;
      this.advance();
    } else if (tok.type === 'TRUE' || tok.type === 'FALSE' || tok.type === 'NULL') {
      this.recordStep('q_val', `Reduce Keyword ${tok.value}`, 'VALUE -> TRUE | FALSE | NULL');
      this.stats.primitiveCount++;
      this.advance();
    } else if (tok.type === 'IDENTIFIER') {
      throw {
        message: `Unrecognized literal or unquoted value '${tok.value}'`,
        token: tok,
        expected: 'valid JSON value (string, number, boolean, null, object, or array)',
      };
    } else if (tok.type === 'EOF') {
      throw {
        message: 'Unexpected end of input while expecting JSON value',
        token: tok,
        expected: "value matching '" + (this.pdaStack[this.pdaStack.length - 1] || '$') + "'",
      };
    } else {
      throw {
        message: `Unexpected token '${tok.value}' in value position`,
        token: tok,
        expected: 'JSON value',
      };
    }
  }

  private parseObject(): void {
    this.stats.objectCount++;
    const lbrace = this.consume('LBRACE', '{');
    this.pdaStack.push('}');
    this.recordStep('q_obj', "Push '}' to PDA stack for Object scope", 'OBJECT -> { MEMBERS }');

    if (this.match('RBRACE')) {
      this.advance();
      this.pdaStack.pop();
      this.recordStep('q_obj_end', "Pop '}' from PDA stack (Empty Object)", 'OBJECT -> {}');
      return;
    }

    while (true) {
      this.parsePair();

      if (this.match('COMMA')) {
        const commaTok = this.advance();
        this.recordStep('q_delim', "Shift comma ',' between object pairs");
        if (this.match('RBRACE')) {
          throw {
            message: "Trailing comma detected before closing brace '}'",
            token: commaTok,
            expected: 'key-value pair or remove comma',
          };
        }
      } else if (this.match('RBRACE')) {
        this.advance();
        this.pdaStack.pop();
        this.recordStep('q_obj_end', "Pop '}' from PDA stack (Object complete)");
        break;
      } else if (this.match('RBRACKET')) {
        const tok = this.currentToken();
        throw {
          message: `Missing closing brace '}' for object: encountered ']' at line ${tok.line}, column ${tok.column}`,
          token: tok,
          expected: "'}'",
        };
      } else if (this.match('EOF')) {
        throw {
          message: `Missing closing brace '}' for object starting at line ${lbrace.line}, column ${lbrace.column}`,
          token: this.currentToken(),
          expected: "'}'",
        };
      } else {
        const tok = this.currentToken();
        throw {
          message: `Expected ',' delimiter between object members, found '${tok.value}'`,
          token: tok,
          expected: "','",
        };
      }
    }
  }

  private parseArray(): void {
    this.stats.arrayCount++;
    const lbracket = this.consume('LBRACKET', '[');
    this.pdaStack.push(']');
    this.recordStep('q_arr', "Push ']' to PDA stack for Array scope", 'ARRAY -> [ ELEMENTS ]');

    if (this.match('RBRACKET')) {
      this.advance();
      this.pdaStack.pop();
      this.recordStep('q_arr_end', "Pop ']' from PDA stack (Empty Array)", 'ARRAY -> []');
      return;
    }

    while (true) {
      this.parseValue();

      if (this.match('COMMA')) {
        const commaTok = this.advance();
        this.recordStep('q_delim', "Shift comma ',' between array elements");
        if (this.match('RBRACKET')) {
          throw {
            message: "Trailing comma detected before closing bracket ']'",
            token: commaTok,
            expected: 'array element or remove comma',
          };
        }
      } else if (this.match('RBRACKET')) {
        this.advance();
        this.pdaStack.pop();
        this.recordStep('q_arr_end', "Pop ']' from PDA stack (Array complete)");
        break;
      } else if (this.match('RBRACE')) {
        const tok = this.currentToken();
        throw {
          message: `Missing closing bracket ']' for array: encountered '}' at line ${tok.line}, column ${tok.column}`,
          token: tok,
          expected: "']'",
        };
      } else if (this.match('EOF')) {
        throw {
          message: `Missing closing bracket ']' for array starting at line ${lbracket.line}, column ${lbracket.column}`,
          token: this.currentToken(),
          expected: "']'",
        };
      } else {
        const tok = this.currentToken();
        throw {
          message: `Expected ',' delimiter between array elements, found '${tok.value}'`,
          token: tok,
          expected: "','",
        };
      }
    }
  }

  private parsePair(): void {
    this.stats.pairCount++;
    const tok = this.currentToken();

    if (tok.type === 'STRING') {
      this.recordStep('q_key', `Shift key '${tok.value}'`, 'PAIR -> STRING : VALUE');
      this.advance();
    } else if (tok.type === 'IDENTIFIER') {
      this.advance();
      throw {
        message: `Unquoted object key '${tok.value}'`,
        token: tok,
        expected: `"${tok.value}"`,
      };
    } else {
      throw {
        message: `Expected string key in object pair, found '${tok.value || tok.type}'`,
        token: tok,
        expected: 'quoted string key',
      };
    }

    if (this.match('COLON')) {
      this.consume('COLON', ':');
    } else {
      throw {
        message: `Expected ':' after object key, found '${this.currentToken().value}'`,
        token: this.currentToken(),
        expected: "':'",
      };
    }

    this.parseValue();
  }
}

export function validateJsonClient(text: string): ParseResult {
  const lexer = new Lexer(text);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, text);
  return parser.parse();
}
