"""
main.py
=======
CLI Entry Point for JSON Validator with Error Recovery.
Supports:
  1. Interactive single-string testing
  2. Batch sample validation printing using validate_batch()
  3. Automated benchmark dataset evaluation against Python's json.loads()
  4. Comprehensive unit test suite execution
  5. Direct file validation
"""

import sys
import json
import argparse
from validator import validate_json, format_validation_output, validate_batch
from test_cases import run_unit_tests
from evaluation import evaluate_dataset, print_evaluation_report
from lexer import Lexer


def run_interactive_mode() -> None:
    """Runs an interactive command-line loop for validating user-supplied JSON."""
    print("=" * 70)
    print("  JSON Validator & Error Recovery Engine - Interactive Shell (TOC) ")
    print("=" * 70)
    print("Commands:")
    print("  - Type or paste your JSON payload, then press Enter.")
    print("  - Type 'multiline' to enter multi-line input mode (end with 'EOF').")
    print("  - Type 'tokens <json>' to inspect the token stream.")
    print("  - Type 'batch' to run batch validation on all 20 LLM samples.")
    print("  - Type 'exit' or 'quit' to terminate.\n")

    input_counter = 1
    while True:
        try:
            user_input = input("json-validator> ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting JSON Validator. Goodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit"):
            print("Session terminated.")
            break

        if user_input.lower() == "batch":
            run_batch_mode()
            continue

        if user_input.lower() == "multiline":
            print("--- Entering Multi-line Input Mode (type 'EOF' on a new line to submit) ---")
            lines = []
            while True:
                try:
                    line = input()
                    if line.strip() == "EOF":
                        break
                    lines.append(line)
                except (KeyboardInterrupt, EOFError):
                    break
            payload = "\n".join(lines)
            res = validate_json(payload)
            print("\n" + format_validation_output(input_counter, res) + "\n")
            input_counter += 1
            continue

        if user_input.startswith("tokens "):
            payload = user_input[7:].strip()
            _show_tokens(payload)
            continue

        res = validate_json(user_input)
        print("\n" + format_validation_output(input_counter, res) + "\n")
        input_counter += 1


def run_batch_mode(dataset_path: str = "llm_dataset.json") -> None:
    """Executes batch validation against the dataset payloads using validate_batch()."""
    try:
        with open(dataset_path, "r", encoding="utf-8") as f:
            dataset = json.load(f)
        samples = [item["payload"] for item in dataset]
        validate_batch(samples)
    except Exception as e:
        print(f"Error loading dataset for batch validation: {e}", file=sys.stderr)


def _show_tokens(payload: str) -> None:
    """Helper to display the lexer's token stream."""
    lexer = Lexer(payload)
    tokens = lexer.tokenize()
    print(f"\n--- Lexer Token Stream ({len(tokens)} tokens) ---")
    for idx, tok in enumerate(tokens):
        print(f"[{idx:2d}] {tok.type:<12} | val={repr(tok.value):<16} | line={tok.line}, col={tok.column}")
    print("--------------------------------------------------\n")


def main() -> None:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="JSON Validator with Error Recovery (Formal Languages & Automata Theory Project)"
    )
    parser.add_argument(
        "-e", "--evaluate",
        action="store_true",
        help="Run benchmark evaluation over the 20-sample LLM dataset against json.loads().",
    )
    parser.add_argument(
        "-b", "--batch",
        action="store_true",
        help="Run sequential batch validation on sample payloads and print formatted output.",
    )
    parser.add_argument(
        "-t", "--test",
        action="store_true",
        help="Execute unit test suite verifying valid cases and 5 core error recoveries.",
    )
    parser.add_argument(
        "-f", "--file",
        type=str,
        help="Path to a JSON file to validate.",
    )
    parser.add_argument(
        "-s", "--string",
        type=str,
        help="Validate a single JSON string provided directly via argument.",
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Launch interactive REPL mode (default if no flags provided).",
    )

    args = parser.parse_args()

    if args.evaluate:
        metrics = evaluate_dataset("llm_dataset.json")
        print_evaluation_report(metrics)
    elif args.batch:
        run_batch_mode("llm_dataset.json")
    elif args.test:
        run_unit_tests()
    elif args.string:
        result = validate_json(args.string)
        print(format_validation_output(1, result))
    elif args.file:
        try:
            with open(args.file, "r", encoding="utf-8") as f:
                content = f.read()
            result = validate_json(content)
            print(format_validation_output(1, result))
        except Exception as err:
            print(f"Error reading file '{args.file}': {err}", file=sys.stderr)
            sys.exit(1)
    else:
        run_interactive_mode()


if __name__ == "__main__":
    main()
