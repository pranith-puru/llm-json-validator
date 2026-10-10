# LLM JSON Validator with Error Recovery

An Automata Theory and Formal Languages (TOC) college project implementing a **Context-Free Grammar (CFG) Parser** and **Pushdown Automaton (PDA) Stack Simulation** in Python to detect, locate, and automatically repair syntax defects in malformed, LLM-generated JSON payloads.

---

## 📌 Project Overview

Large Language Models (LLMs) like ChatGPT, Gemini, and Claude frequently generate "almost-valid" JSON outputs—exhibiting defects like trailing commas, unquoted object keys, missing delimiter commas, or unclosed braces/brackets due to output stream truncation.

Rather than using native parsers that throw generic errors and halt execution, this project implements a formal language processing pipeline that:
1. **Scans** input text using a custom Lexer with precise line and column metadata tracking.
2. **Validates** syntax via a Recursive Descent Parser that explicitly simulates Pushdown Automaton ($PDA$) stack transitions.
3. **Diagnoses & Repairs** common syntax violations using a dedicated Error Recovery Engine with actionable fix suggestions.
4. **Evaluates** comparative performance against Python's native `json.loads()` across a 20-sample LLM output dataset.

---

## 🏗️ Architecture & File Structure

```text
json-validator-with-error-recovery/
├── main.py                # CLI entry point (Interactive REPL, file validator, benchmark runner)
├── lexer.py               # Lexical Analyzer tracking line & column positions
├── parser.py              # Recursive Descent Parser with PDA stack simulation ($)
├── error_recovery.py      # Automated Repair & Diagnostic Engine for 5 LLM error modes
├── validator.py           # Core public API: validate_json(text)
├── test_cases.py          # Comprehensive Unit Test Suite
├── evaluation.py          # Benchmark Framework comparing performance against json.loads()
├── llm_dataset.json       # 20-sample LLM test dataset (5 valid, 15 malformed)
├── requirements.txt       # Dependencies (pure Python 3.8+ standard library)
└── README.md              # Project documentation
