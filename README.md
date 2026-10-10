# LLM JSON Validator with Error Recovery

An Automata Theory and Formal Languages (TOC) driven JSON validator and error recovery engine designed to detect, locate, and automatically repair syntax defects in malformed, LLM-generated JSON payloads.

---

## 📌 Project Overview

Large Language Models (LLMs) frequently generate "almost-valid" JSON outputs—introducing subtle syntax defects such as trailing commas, unquoted keys, missing delimiter commas, or unclosed structural braces. Standard JSON parsers (such as Python's native `json.loads()`) reject these payloads instantly without providing actionable fix suggestions or context-aware error recovery.

This project implements a formal **Context-Free Grammar (CFG)** and **Pushdown Automaton (PDA)** stack execution engine in pure Python 3. It validates input payloads, tracks exact line and column coordinates, identifies specific defect patterns, and generates 1-click repair suggestions.

---

## 🚀 Key Features

- **Formal CFG & PDA Execution:** Implements recursive descent parsing with an explicit Pushdown Automaton stack (`$`, `}`, `]`) to enforce JSON context-free grammar invariants without relying on native C-level parsers.
- **Precise Location Metadata:** Tracks 1-indexed line and column coordinates across token streams for exact error reporting.
- **Automated Error Diagnosis & Repair Engine:** Detects and provides explicit fix suggestions for the 5 most common LLM syntax defects:
  1. **Trailing Comma:** `{"a": 1,}` $\rightarrow$ Suggests removing extraneous comma before `}` or `]`.
  2. **Unquoted Key:** `{name: "Alice"}` $\rightarrow$ Suggests wrapping unquoted identifier in double quotes.
  3. **Missing Comma:** `{"a": 1 "b": 2}` $\rightarrow$ Suggests inserting `,` between adjacent elements.
  4. **Missing Closing Brace:** `{"a": 1` $\rightarrow$ Detects unclosed object and suggests appending `}`.
  5. **Missing Closing Bracket:** `["a", "b"` $\rightarrow$ Detects unclosed array and suggests appending `]`.
- **Empirical Benchmarking Suite:** Evaluates performance over a 20-sample LLM dataset against Python's native `json.loads()`, tracking Accuracy, False-Negative Rate (FNR), and Diagnostic Accuracy.

---

## 🛠️ Project Architecture & File Division

```text
llm-json-validator/
├── main.py                # CLI entry point, interactive REPL shell & batch driver
├── lexer.py               # Lexical analyzer with precise line/column tracking
├── parser.py              # CFG recursive descent parser with PDA stack simulation
├── error_recovery.py      # Diagnostic engine & 1-click repair suggestion generator
├── validator.py           # Top-level API wrapper exposing validate_json(text)
├── test_cases.py          # Unit test suite verifying valid payloads & defect recovery
├── evaluation.py         # Comparative benchmark script vs native json.loads()
├── llm_dataset.json       # 20-sample benchmark dataset (5 valid, 15 malformed)
├── requirements.txt       # Project dependencies (pure Python standard library)
└── README.md              # Project documentation
