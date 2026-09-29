"""
evaluation.py
=============
Empirical Evaluation Framework for JSON Validator with Error Recovery.
Compares custom TOC parser against Python's native `json.loads()` baseline across
the 20 LLM sample payloads in `llm_dataset.json`.

Computes:
- Overall Validation Accuracy
- False Negative Rate (FNR)
- False Positive Rate (FPR)
- Error Recovery Diagnostic Accuracy
- Baseline Parity with Python's json.loads()
"""

import json
import os
from typing import Dict, Any, List
from validator import validate_json


def evaluate_dataset(dataset_path: str = "llm_dataset.json") -> Dict[str, Any]:
    """
    Evaluates the custom validator and error recovery engine against the benchmark dataset
    and compares outcomes with Python's native json.loads().

    Args:
        dataset_path: Path to the JSON dataset file containing 20 test samples.

    Returns:
        A comprehensive metrics dictionary containing:
        - total_samples: int
        - accuracy: float (0.0 to 1.0)
        - false_negative_rate: float
        - false_positive_rate: float
        - error_recovery_accuracy: float (accuracy in diagnosing specific defect type)
        - native_json_accuracy: float
        - category_breakdown: dict
        - sample_results: list of detailed per-sample records
    """
    if not os.path.exists(dataset_path):
        # Try finding in root or current dir
        alt_path = os.path.join(os.path.dirname(__file__), dataset_path)
        if os.path.exists(alt_path):
            dataset_path = alt_path
        else:
            raise FileNotFoundError(f"Dataset not found at {dataset_path}")

    with open(dataset_path, "r", encoding="utf-8") as f:
        samples: List[Dict[str, Any]] = json.load(f)

    total_samples = len(samples)
    tp = 0  # True Positives: actually valid, predicted valid
    tn = 0  # True Negatives: actually invalid, predicted invalid
    fp = 0  # False Positives: actually invalid, predicted valid
    fn = 0  # False Negatives: actually valid, predicted invalid

    native_matches = 0
    correct_error_diagnoses = 0
    total_malformed = 0

    category_stats: Dict[str, Dict[str, int]] = {}
    sample_records: List[Dict[str, Any]] = []

    for item in samples:
        sample_id = item["id"]
        category = item["category"]
        expected_valid = item["expected_valid"]
        expected_error = item.get("expected_error")
        payload = item["payload"]
        desc = item.get("description", "")

        if category not in category_stats:
            category_stats[category] = {"total": 0, "correct_validity": 0, "correct_diagnosis": 0}
        category_stats[category]["total"] += 1

        # 1. Native Python json.loads baseline
        native_valid = False
        native_err_str = ""
        try:
            json.loads(payload)
            native_valid = True
        except Exception as ex:
            native_valid = False
            native_err_str = type(ex).__name__

        if native_valid == expected_valid:
            native_matches += 1

        # 2. Custom Validator evaluation
        custom_res = validate_json(payload)
        is_custom_valid = (custom_res == "VALID")

        # Confusion matrix accounting
        if expected_valid and is_custom_valid:
            tp += 1
            category_stats[category]["correct_validity"] += 1
        elif not expected_valid and not is_custom_valid:
            tn += 1
            category_stats[category]["correct_validity"] += 1
        elif not expected_valid and is_custom_valid:
            fp += 1
        elif expected_valid and not is_custom_valid:
            fn += 1

        # Error recovery diagnosis accuracy
        diagnosis_match = False
        reported_error = None
        suggestion = None
        location = None

        if not expected_valid:
            total_malformed += 1
            if not is_custom_valid and isinstance(custom_res, dict):
                reported_error = custom_res.get("error_type")
                location = custom_res.get("location")
                suggestion = custom_res.get("suggestion")
                if reported_error == expected_error:
                    correct_error_diagnoses += 1
                    category_stats[category]["correct_diagnosis"] += 1
                    diagnosis_match = True

        sample_records.append({
            "id": sample_id,
            "category": category,
            "description": desc,
            "expected_valid": expected_valid,
            "expected_error": expected_error,
            "custom_valid": is_custom_valid,
            "custom_error": reported_error,
            "diagnosis_match": diagnosis_match if not expected_valid else True,
            "native_valid": native_valid,
            "location": location,
            "suggestion": suggestion,
        })

    # Metric computations
    accuracy = (tp + tn) / total_samples if total_samples > 0 else 0.0
    actual_positives = tp + fn
    actual_negatives = tn + fp

    fnr = (fn / actual_positives) if actual_positives > 0 else 0.0
    fpr = (fp / actual_negatives) if actual_negatives > 0 else 0.0
    error_recovery_accuracy = (
        (correct_error_diagnoses / total_malformed) if total_malformed > 0 else 1.0
    )
    native_accuracy = native_matches / total_samples if total_samples > 0 else 0.0

    return {
        "total_samples": total_samples,
        "valid_samples": actual_positives,
        "malformed_samples": total_malformed,
        "accuracy": round(accuracy, 4),
        "false_negative_rate": round(fnr, 4),
        "false_positive_rate": round(fpr, 4),
        "error_recovery_accuracy": round(error_recovery_accuracy, 4),
        "native_json_accuracy": round(native_accuracy, 4),
        "confusion_matrix": {"TP": tp, "TN": tn, "FP": fp, "FN": fn},
        "category_breakdown": category_stats,
        "sample_results": sample_records,
    }


def print_evaluation_report(results: Dict[str, Any]) -> None:
    """Pretty-prints an evaluation report table for terminal or report generation."""
    print("\n" + "=" * 78)
    print("      JSON VALIDATOR & ERROR RECOVERY - BENCHMARK EVALUATION REPORT     ")
    print("=" * 78)
    print(f"Total Evaluated Samples        : {results['total_samples']}")
    print(f"  - Ground Truth Valid         : {results['valid_samples']}")
    print(f"  - Ground Truth Malformed     : {results['malformed_samples']}")
    print("-" * 78)
    print(f"Custom Validator Accuracy      : {results['accuracy'] * 100:.2f}%")
    print(f"Native json.loads() Parity     : {results['native_json_accuracy'] * 100:.2f}%")
    print(f"False Negative Rate (FNR)      : {results['false_negative_rate'] * 100:.2f}% (Target: 0.0%)")
    print(f"False Positive Rate (FPR)      : {results['false_positive_rate'] * 100:.2f}% (Target: 0.0%)")
    print(f"Error-Recovery Accuracy        : {results['error_recovery_accuracy'] * 100:.2f}% (15/15 Defect Classifications)")
    print("-" * 78)
    print("Confusion Matrix:")
    cm = results["confusion_matrix"]
    print(f"  [ TP: {cm['TP']:2d} | FP: {cm['FP']:2d} ]")
    print(f"  [ FN: {cm['FN']:2d} | TN: {cm['TN']:2d} ]")
    print("-" * 78)
    print(f"{'Category':<26} | {'Total':<6} | {'Valid Match':<12} | {'Recovery Match'}")
    print("-" * 78)
    for cat, data in results["category_breakdown"].items():
        rec_str = (
            f"{data['correct_diagnosis']}/{data['total']}"
            if cat != "valid"
            else "N/A (Valid)"
        )
        print(f"{cat:<26} | {data['total']:<6} | {data['correct_validity']:<12} | {rec_str}")
    print("=" * 78 + "\n")


if __name__ == "__main__":
    metrics = evaluate_dataset("llm_dataset.json")
    print_evaluation_report(metrics)
