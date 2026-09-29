export type TokenType =
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COLON'
  | 'COMMA'
  | 'STRING'
  | 'NUMBER'
  | 'TRUE'
  | 'FALSE'
  | 'NULL'
  | 'IDENTIFIER'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
  startPos?: number;
  endPos?: number;
}

export interface PDAStep {
  step: number;
  state: string;
  lookahead: Token;
  stack: string[];
  action: string;
  rule?: string;
}

export interface ParseResult {
  valid: boolean;
  error?: {
    type: string;
    message: string;
    location: string;
    line: number;
    column: number;
    token: Token;
    expected: string;
    suggestion: string;
    details: string;
    repairedText?: string;
  };
  tokens: Token[];
  pdaSteps: PDAStep[];
  depth: number;
  stats: {
    objectCount: number;
    arrayCount: number;
    pairCount: number;
    primitiveCount: number;
  };
}

export interface BenchmarkSample {
  id: number;
  category: string;
  expected_valid: boolean;
  expected_error: string | null;
  description: string;
  payload: string;
}
