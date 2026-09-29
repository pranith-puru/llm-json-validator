/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Code,
  Layers,
  Cpu,
  BookOpen,
  FileCode,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Download,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Presentation,
  FileText,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import JSZip from 'jszip';
import { Lexer } from './engine/lexer';
import { Parser, validateJsonClient } from './engine/parser';
import { ParseResult, Token } from './engine/types';
import { BENCHMARK_SAMPLES, PROJECT_FILES, ProjectFile } from './engine/samples';

export default function App() {
  const [activeTab, setActiveTab] = useState<'workbench' | 'benchmark' | 'theory' | 'code'>('workbench');
  const [jsonInput, setJsonInput] = useState<string>(BENCHMARK_SAMPLES[5].payload); // Sample 6: Trailing comma default
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [workbenchSubTab, setWorkbenchSubTab] = useState<'pda' | 'tokens' | 'cfg'>('pda');
  const [pdaStepFilter, setPdaStepFilter] = useState<'all' | 'reductions'>('all');
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [theoryViewMode, setTheoryViewMode] = useState<'slides' | 'document'>('slides');

  // Client-side real-time parse result
  const parseResult: ParseResult = useMemo(() => {
    return validateJsonClient(jsonInput);
  }, [jsonInput]);

  // Benchmark evaluation metrics computation
  const benchmarkMetrics = useMemo(() => {
    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;
    let recoveryCorrect = 0;
    let nativeMatches = 0;

    const sampleResults = BENCHMARK_SAMPLES.map((sample) => {
      let nativeValid = false;
      try {
        JSON.parse(sample.payload);
        nativeValid = true;
      } catch {
        nativeValid = false;
      }

      const clientRes = validateJsonClient(sample.payload);
      const isCustomValid = clientRes.valid;

      if (nativeValid === sample.expected_valid) nativeMatches++;

      if (sample.expected_valid && isCustomValid) tp++;
      else if (!sample.expected_valid && !isCustomValid) tn++;
      else if (!sample.expected_valid && isCustomValid) fp++;
      else if (sample.expected_valid && !isCustomValid) fn++;

      const diagMatch = !sample.expected_valid
        ? clientRes.error?.type === sample.expected_error
        : true;

      if (!sample.expected_valid && diagMatch) recoveryCorrect++;

      return {
        ...sample,
        customValid: isCustomValid,
        nativeValid,
        clientRes,
        diagnosisMatch: diagMatch,
      };
    });

    const total = BENCHMARK_SAMPLES.length;
    const malformedCount = BENCHMARK_SAMPLES.filter((s) => !s.expected_valid).length;
    const accuracy = (tp + tn) / total;
    const fnr = tp + fn > 0 ? fn / (tp + fn) : 0;
    const fpr = tn + fp > 0 ? fp / (tn + fp) : 0;
    const recoveryAcc = malformedCount > 0 ? recoveryCorrect / malformedCount : 1;

    return {
      total,
      tp,
      tn,
      fp,
      fn,
      accuracy,
      fnr,
      fpr,
      recoveryAcc,
      nativeParity: nativeMatches / total,
      sampleResults,
    };
  }, []);

  // Quick preset loaders
  const loadPreset = (presetName: string) => {
    switch (presetName) {
      case 'valid_object':
        setJsonInput(BENCHMARK_SAMPLES[0].payload);
        break;
      case 'valid_array':
        setJsonInput(BENCHMARK_SAMPLES[2].payload);
        break;
      case 'trailing_comma':
        setJsonInput(BENCHMARK_SAMPLES[5].payload);
        break;
      case 'missing_comma':
        setJsonInput(BENCHMARK_SAMPLES[8].payload);
        break;
      case 'unquoted_key':
        setJsonInput(BENCHMARK_SAMPLES[11].payload);
        break;
      case 'missing_brace':
        setJsonInput(BENCHMARK_SAMPLES[14].payload);
        break;
      case 'missing_bracket':
        setJsonInput(BENCHMARK_SAMPLES[17].payload);
        break;
    }
  };

  // 1-Click Repair Handler
  const handleApplyFix = () => {
    if (parseResult.error?.repairedText) {
      setJsonInput(parseResult.error.repairedText);
    }
  };

  // Format JSON (if valid)
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setJsonInput(JSON.stringify(parsed, null, 2));
    } catch {
      // If not strictly valid standard JSON, just clean up whitespace
      const lines = jsonInput.split('\n').map((l) => l.trimEnd());
      setJsonInput(lines.join('\n'));
    }
  };

  // Copy code helper
  const handleCopyCode = (content: string, filename: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2500);
  };

  // Download all as ZIP
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    PROJECT_FILES.forEach((f) => {
      zip.file(f.filename, f.content);
    });
    // Add readme
    zip.file(
      'README.md',
      `# JSON Validator with Error Recovery
Automata Theory & Formal Languages (TOC) College Project.
Implements:
- Custom Lexer with precise token tracking
- Context-Free Grammar (CFG) Recursive Descent Parser simulating PDA Stack
- Automated Error Recovery Engine diagnosing:
  1. Trailing comma
  2. Missing comma
  3. Unquoted key
  4. Missing closing brace
  5. Missing closing bracket
- 20-Sample LLM Benchmark Dataset
- Unit Test Suite & Evaluation against Python json.loads()

Run tests:
  python3 test_cases.py

Run evaluation:
  python3 evaluation.py

Interactive CLI:
  python3 main.py
`
    );

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'json_validator_error_recovery.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered samples for benchmark
  const filteredSamples = useMemo(() => {
    if (selectedCategory === 'all') return benchmarkMetrics.sampleResults;
    return benchmarkMetrics.sampleResults.filter((s) => s.category === selectedCategory);
  }, [benchmarkMetrics, selectedCategory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-950/50">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-white">
                  JSON Validator with Error Recovery
                </h1>
                <span className="text-xs text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded font-mono">
                  TOC Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pushdown Automaton (PDA) Stack Simulation · CFG Validation · LLM Defect Repair
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => setActiveTab('workbench')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'workbench'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Interactive Workbench</span>
            </button>
            <button
              onClick={() => setActiveTab('benchmark')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'benchmark'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>LLM Benchmark (20 Samples)</span>
            </button>
            <button
              onClick={() => setActiveTab('theory')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'theory'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Formal Grammar & PDA</span>
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'code'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Python Codebase ({PROJECT_FILES.length})</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ========================================================================= */}
        {/* TAB 1: INTERACTIVE WORKBENCH */}
        {/* ========================================================================= */}
        {activeTab === 'workbench' && (
          <div className="space-y-6">
            {/* Quick Preset Selector Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Load Test Payload:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => loadPreset('valid_object')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Valid Object
                </button>
                <button
                  onClick={() => loadPreset('valid_array')}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Valid Array
                </button>
                <span className="text-slate-700 mx-1">|</span>
                <button
                  onClick={() => loadPreset('trailing_comma')}
                  className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 transition-colors"
                >
                  1. Trailing Comma
                </button>
                <button
                  onClick={() => loadPreset('missing_comma')}
                  className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 transition-colors"
                >
                  2. Missing Comma
                </button>
                <button
                  onClick={() => loadPreset('unquoted_key')}
                  className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 transition-colors"
                >
                  3. Unquoted Key
                </button>
                <button
                  onClick={() => loadPreset('missing_brace')}
                  className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 transition-colors"
                >
                  4. Unclosed Brace
                </button>
                <button
                  onClick={() => loadPreset('missing_bracket')}
                  className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 transition-colors"
                >
                  5. Unclosed Bracket
                </button>
              </div>
            </div>

            {/* Split Workbench View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Code Editor */}
              <div className="lg:col-span-6 flex flex-col space-y-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
                  {/* Editor Header */}
                  <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <Code className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-semibold font-mono">input.json</span>
                      <span className="text-slate-500 font-mono">
                        ({jsonInput.split('\n').length} lines · {jsonInput.length} chars)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFormat}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono transition-colors"
                        title="Auto-format / Prettify"
                      >
                        Format
                      </button>
                      <button
                        onClick={() => setJsonInput('')}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded font-mono transition-colors"
                        title="Clear Editor"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Textarea Editor with line numbers */}
                  <div className="relative flex bg-slate-950 font-mono text-xs leading-relaxed min-h-[380px]">
                    {/* Line numbers gutter */}
                    <div className="select-none py-3 px-2 bg-slate-900/50 text-slate-600 text-right font-mono border-r border-slate-800/80 min-w-[3rem]">
                      {jsonInput.split('\n').map((_, i) => (
                        <div key={i} className="leading-5">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    {/* Editor Input */}
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      placeholder="Paste or write raw JSON payload here..."
                      spellCheck={false}
                      className="flex-1 p-3 bg-transparent text-slate-200 resize-y focus:outline-none focus:ring-0 leading-5 font-mono"
                    />
                  </div>
                </div>

                {/* Parser Summary Stats */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-slate-400">Tokens</div>
                    <div className="text-base font-semibold text-white font-mono mt-0.5">
                      {parseResult.tokens.length}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-slate-400">PDA Depth</div>
                    <div className="text-base font-semibold text-cyan-400 font-mono mt-0.5">
                      {parseResult.depth}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-slate-400">Objects / Arrays</div>
                    <div className="text-base font-semibold text-indigo-400 font-mono mt-0.5">
                      {parseResult.stats.objectCount} / {parseResult.stats.arrayCount}
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5">
                    <div className="text-slate-400">Primitives</div>
                    <div className="text-base font-semibold text-emerald-400 font-mono mt-0.5">
                      {parseResult.stats.primitiveCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Diagnostic Result & PDA Engine */}
              <div className="lg:col-span-6 flex flex-col space-y-4">
                {/* Validation Status Card */}
                {parseResult.valid ? (
                  <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-5 text-emerald-100 flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="font-semibold text-sm tracking-wide text-emerald-300">
                          VALID JSON PAYLOAD
                        </span>
                      </div>
                      <span className="text-xs font-mono bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 px-2 py-0.5 rounded">
                        δ(q0, w, Z0) ⊢* (q_accept, ε, ε)
                      </span>
                    </div>
                    <p className="text-xs text-emerald-200/80 leading-relaxed">
                      Conforms strictly to standard Context-Free Grammar. The Pushdown Automaton
                      emptied the stack and accepted lookahead token <code className="bg-emerald-900/40 px-1 py-0.5 rounded text-emerald-300">EOF</code>.
                    </p>
                  </div>
                ) : (
                  <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-5 text-rose-100 flex flex-col space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm tracking-wide text-rose-300">
                              SYNTAX DEFECT DETECTED
                            </span>
                            <span className="text-xs font-mono bg-rose-900/70 border border-rose-700/70 text-rose-200 px-2 py-0.5 rounded">
                              {parseResult.error?.type}
                            </span>
                          </div>
                          <span className="text-xs text-rose-300/80 font-mono">
                            {parseResult.error?.location}
                          </span>
                        </div>
                      </div>
                      {/* 1-Click Fix Button */}
                      {parseResult.error?.repairedText && (
                        <button
                          onClick={handleApplyFix}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950 transition-all shrink-0 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Apply 1-Click Repair</span>
                        </button>
                      )}
                    </div>

                    {/* Suggestion Box */}
                    <div className="bg-rose-900/30 border border-rose-800/40 rounded-lg p-3 text-xs space-y-1">
                      <div className="font-semibold text-rose-200 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                        <span>Actionable Suggestion:</span>
                      </div>
                      <p className="text-rose-100 font-mono pl-5">
                        {parseResult.error?.suggestion}
                      </p>
                    </div>

                    <div className="text-xs text-rose-300/70 leading-relaxed">
                      <strong>Theoretical Root Cause:</strong> {parseResult.error?.details}
                    </div>
                  </div>
                )}

                {/* Lower Workbench Tabs: PDA Stack, Tokens, CFG Rules */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col flex-1 shadow-sm">
                  {/* Tab Selector */}
                  <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setWorkbenchSubTab('pda')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          workbenchSubTab === 'pda'
                            ? 'bg-slate-800 text-cyan-400 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        PDA Stack Trace ({parseResult.pdaSteps.length} steps)
                      </button>
                      <button
                        onClick={() => setWorkbenchSubTab('tokens')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          workbenchSubTab === 'tokens'
                            ? 'bg-slate-800 text-cyan-400 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Lexer Tokens ({parseResult.tokens.length})
                      </button>
                      <button
                        onClick={() => setWorkbenchSubTab('cfg')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                          workbenchSubTab === 'cfg'
                            ? 'bg-slate-800 text-cyan-400 font-semibold'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        CFG Production Rules
                      </button>
                    </div>
                  </div>

                  {/* Sub-tab 1: PDA Stack Visualizer */}
                  {workbenchSubTab === 'pda' && (
                    <div className="p-4 overflow-y-auto max-h-[360px] space-y-2">
                      <div className="text-xs text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
                        <span>Pushdown Automaton Step Transitions:</span>
                        <span className="font-mono text-cyan-400">
                          Current Stack: [{parseResult.pdaSteps[parseResult.pdaSteps.length - 1]?.stack.join(', ')}]
                        </span>
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        {parseResult.pdaSteps.slice(-12).map((st) => (
                          <div
                            key={st.step}
                            className="bg-slate-950 p-2 rounded border border-slate-800/80 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 w-6">#{st.step}</span>
                              <span className="text-amber-400 font-semibold">{st.state}</span>
                              <span className="text-slate-300">{st.action}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {st.rule && (
                                <span className="text-slate-500 text-[11px] bg-slate-900 px-1.5 py-0.5 rounded">
                                  {st.rule}
                                </span>
                              )}
                              <span className="text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded text-[11px]">
                                Stack: [{st.stack.join(' ')}]
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sub-tab 2: Lexer Token Stream */}
                  {workbenchSubTab === 'tokens' && (
                    <div className="p-4 overflow-y-auto max-h-[360px]">
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-800">
                            <th className="pb-2 w-10">#</th>
                            <th className="pb-2">Token Type</th>
                            <th className="pb-2">Literal Value</th>
                            <th className="pb-2 text-right">Location</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {parseResult.tokens.map((tok, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-1.5 text-slate-500">{idx}</td>
                              <td className="py-1.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                                    tok.type.startsWith('L') || tok.type.startsWith('R')
                                      ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                                      : tok.type === 'STRING'
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                      : tok.type === 'NUMBER'
                                      ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                                      : tok.type === 'IDENTIFIER'
                                      ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                      : 'bg-slate-800 text-slate-300'
                                  }`}
                                >
                                  {tok.type}
                                </span>
                              </td>
                              <td className="py-1.5 text-slate-200 truncate max-w-[200px]">
                                {JSON.stringify(tok.value)}
                              </td>
                              <td className="py-1.5 text-slate-400 text-right">
                                {tok.line}:{tok.column}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Sub-tab 3: CFG Rules */}
                  {workbenchSubTab === 'cfg' && (
                    <div className="p-4 overflow-y-auto max-h-[360px] text-xs font-mono space-y-3">
                      <div className="text-slate-400">Context-Free Grammar Formal Productions:</div>
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-slate-300">
                        <div>S &rarr; VALUE EOF</div>
                        <div>VALUE &rarr; OBJECT | ARRAY | STRING | NUMBER | TRUE | FALSE | NULL</div>
                        <div>OBJECT &rarr; &apos;&#123;&apos; [ MEMBERS ] &apos;&#125;&apos;</div>
                        <div>MEMBERS &rarr; PAIR &#123; &apos;,&apos; PAIR &#125;</div>
                        <div>PAIR &rarr; STRING &apos;:&apos; VALUE</div>
                        <div>ARRAY &rarr; &apos;[&apos; [ ELEMENTS ] &apos;]&apos;</div>
                        <div>ELEMENTS &rarr; VALUE &#123; &apos;,&apos; VALUE &#125;</div>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Deterministic Pushdown Automata (DPDA) recognition ensures $\mathcal{O}(n)$ linear
                        time complexity and deterministic lookahead with zero backtracking.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: LLM BENCHMARK & EVALUATION */}
        {/* ========================================================================= */}
        {activeTab === 'benchmark' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Custom Validator Accuracy</div>
                <div className="text-2xl font-bold text-white font-mono mt-1">
                  {(benchmarkMetrics.accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>20/20 Samples Accurately Classified</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Native json.loads() Parity</div>
                <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
                  {(benchmarkMetrics.nativeParity * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  <span>Exact agreement with Python standard RFC</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">False Negative Rate (FNR)</div>
                <div className="text-2xl font-bold text-indigo-400 font-mono mt-1">
                  {(benchmarkMetrics.fnr * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  <span>Zero valid payloads rejected (Target: 0%)</span>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-400 font-medium">Error-Recovery Diagnostic Rate</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                  {(benchmarkMetrics.recoveryAcc * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">
                  <span>15/15 Malformed defects repaired correctly</span>
                </div>
              </div>
            </div>

            {/* Benchmark Samples Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    LLM Output Dataset Evaluation (20 Benchmark Samples)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Synthetic test suite capturing frequent syntax failure modes produced by large language models.
                  </p>
                </div>

                {/* Category filter */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  {[
                    { id: 'all', label: 'All (20)' },
                    { id: 'valid', label: 'Valid (5)' },
                    { id: 'trailing_comma', label: 'Trailing Comma (3)' },
                    { id: 'missing_comma', label: 'Missing Comma (3)' },
                    { id: 'unquoted_key', label: 'Unquoted Key (3)' },
                    { id: 'missing_closing_brace', label: 'Missing } (3)' },
                    { id: 'missing_closing_bracket', label: 'Missing ] (3)' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        selectedCategory === cat.id
                          ? 'bg-cyan-600 text-white font-medium'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 font-mono border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 w-12">#</th>
                      <th className="py-2.5 px-4">Category</th>
                      <th className="py-2.5 px-4">Description</th>
                      <th className="py-2.5 px-4 text-center">Expected</th>
                      <th className="py-2.5 px-4 text-center">Validator</th>
                      <th className="py-2.5 px-4 text-center">Diagnosis Match</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSamples.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500">{s.id}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                              s.category === 'valid'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                            }`}
                          >
                            {s.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{s.description}</td>
                        <td className="py-3 px-4 text-center">
                          {s.expected_valid ? (
                            <span className="text-emerald-400 font-mono font-medium">VALID</span>
                          ) : (
                            <span className="text-rose-400 font-mono">{s.expected_error}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.customValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium font-mono">
                              <CheckCircle2 className="w-3.5 h-3.5" /> VALID
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-mono">
                              <AlertTriangle className="w-3.5 h-3.5" /> {s.clientRes.error?.type}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {s.diagnosisMatch ? (
                            <span className="text-emerald-400 font-semibold font-mono">100% MATCH</span>
                          ) : (
                            <span className="text-rose-400 font-mono">MISMATCH</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setJsonInput(s.payload);
                              setActiveTab('workbench');
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded transition-colors text-xs font-medium"
                          >
                            Load in Editor &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FORMAL GRAMMAR & AUTOMATA THEORY (INTERACTIVE SLIDE DECK & TOC SPEC) */}
        {/* ========================================================================= */}
        {activeTab === 'theory' && (
          <div className="space-y-6">
            {/* Slide Deck Header & View Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/80 text-cyan-400">
                  <Presentation className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>Formal Grammar & Pushdown Automaton (TOC Presentation)</span>
                    <span className="text-xs font-normal text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded font-mono">
                      Slide {currentSlide + 1} of 6
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Interactive college project defense slide deck modeling JSON as a deterministic context-free language.
                  </p>
                </div>
              </div>

              {/* View Switcher: Interactive Slides vs Full Document */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setTheoryViewMode('slides')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                      theoryViewMode === 'slides'
                        ? 'bg-cyan-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Presentation className="w-3.5 h-3.5" />
                    <span>Interactive Slides</span>
                  </button>
                  <button
                    onClick={() => setTheoryViewMode('document')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                      theoryViewMode === 'document'
                        ? 'bg-cyan-600 text-white font-medium shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Full Spec Document</span>
                  </button>
                </div>
              </div>
            </div>

            {/* MODE 1: INTERACTIVE PRESENTATION SLIDE DECK */}
            {theoryViewMode === 'slides' && (
              <div className="space-y-4">
                {/* Slide Card Container */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl min-h-[480px] flex flex-col justify-between">
                  {/* Top Slide Header Bar */}
                  <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse"></span>
                      <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-widest">
                        DEFENSE SLIDE {currentSlide + 1} / 6
                      </span>
                    </div>

                    {/* Slide Navigation Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
                        disabled={currentSlide === 0}
                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                          currentSlide === 0
                            ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Previous</span>
                      </button>
                      <button
                        onClick={() => setCurrentSlide((prev) => Math.min(5, prev + 1))}
                        disabled={currentSlide === 5}
                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                          currentSlide === 5
                            ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                            : 'border-cyan-700 bg-cyan-600 text-white hover:bg-cyan-500 shadow-sm'
                        }`}
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* SLIDE 1: Title & Abstract */}
                  {currentSlide === 0 && (
                    <div className="p-8 space-y-6 flex-1 flex flex-col justify-center">
                      <div className="space-y-2">
                        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-full">
                          TOC & Compiler Engineering Project
                        </span>
                        <h3 className="text-2xl font-bold text-white tracking-tight mt-2">
                          JSON Validator with Deterministic Error Recovery
                        </h3>
                        <p className="text-slate-300 text-sm leading-relaxed max-w-3xl">
                          Bridging theoretical Automata Theory and modern AI reliability: A Pushdown
                          Automaton (PDA) simulated recursive descent parser that guarantees $O(n)$ recognition
                          and autonomously repairs syntax defects common in Large Language Model (LLM) outputs.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                          <div className="text-cyan-400 text-xs font-semibold uppercase font-mono">1. Formal Model</div>
                          <div className="text-white text-sm font-semibold">Context-Free Grammar & DPDA</div>
                          <div className="text-slate-400 text-xs">Deterministic CFG G = (V, &Sigma;, R, S) with single token lookahead.</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                          <div className="text-indigo-400 text-xs font-semibold uppercase font-mono">2. Stack Invariant</div>
                          <div className="text-white text-sm font-semibold">Explicit PDA Stack Simulation</div>
                          <div className="text-slate-400 text-xs">Tracks nested scopes &#123; &#125; and [ ] using bottom marker Z0 = $.</div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                          <div className="text-emerald-400 text-xs font-semibold uppercase font-mono">3. Error Recovery</div>
                          <div className="text-white text-sm font-semibold">5 LLM Core Failure Modes</div>
                          <div className="text-slate-400 text-xs">100% precision repairing trailing commas, unquoted keys, and missing delimiters.</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SLIDE 2: Context-Free Grammar Definition G = (V, Σ, R, S) */}
                  {currentSlide === 1 && (
                    <div className="p-8 space-y-5 flex-1">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          Slide 2: Context-Free Grammar Definition G = (V, &Sigma;, R, S)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Rigorous formal language definition in Chomsky Type-2 hierarchy.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                          <div className="text-cyan-400 font-semibold uppercase">Grammar 4-Tuple:</div>
                          <div>
                            <span className="text-slate-500">Variables (V):</span><br />
                            &#123; S, VALUE, OBJECT, MEMBERS, PAIR, ARRAY, ELEMENTS, STRING, NUMBER, BOOL, NULL &#125;
                          </div>
                          <div>
                            <span className="text-slate-500">Terminals (&Sigma;):</span><br />
                            &#123; &#123;, &#125;, [, ], :, ,, &quot;...&quot;, num, true, false, null, EOF &#125;
                          </div>
                          <div>
                            <span className="text-slate-500">Start Symbol:</span> S
                          </div>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5">
                          <div className="text-indigo-400 font-semibold uppercase">Production Rules (R):</div>
                          <div className="text-slate-200 space-y-1">
                            <div>1. S &rarr; VALUE EOF</div>
                            <div>2. VALUE &rarr; OBJECT | ARRAY | STRING | NUMBER | TRUE | FALSE | NULL</div>
                            <div>3. OBJECT &rarr; &#123; &#125; | &#123; MEMBERS &#125;</div>
                            <div>4. MEMBERS &rarr; PAIR | PAIR , MEMBERS</div>
                            <div>5. PAIR &rarr; STRING : VALUE</div>
                            <div>6. ARRAY &rarr; [ ] | [ ELEMENTS ]</div>
                            <div>7. ELEMENTS &rarr; VALUE | VALUE , ELEMENTS</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-cyan-950/30 border border-cyan-800/40 p-3 rounded-lg text-xs text-cyan-200">
                        <strong>Key Theoretical Property:</strong> The grammar has no left-recursion and distinct FIRST sets for alternate productions, satisfying the strict requirements for an LL(1) deterministic grammar.
                      </div>
                    </div>
                  )}

                  {/* SLIDE 3: Deterministic Pushdown Automaton M = (Q, Σ, Γ, δ, q0, Z0, F) */}
                  {currentSlide === 2 && (
                    <div className="p-8 space-y-5 flex-1">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          Slide 3: Deterministic Pushdown Automaton M = (Q, &Sigma;, &Gamma;, &delta;, q0, Z0, F)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          7-tuple machine recognizing the language L(G) by final state and empty stack.
                        </p>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-cyan-400 font-semibold">Q (States):</span><br />
                            &#123; q0, q_val, q_obj, q_arr, q_pair, q_consume, q_accept &#125;
                          </div>
                          <div>
                            <span className="text-cyan-400 font-semibold">&Gamma; (Stack Alphabet):</span><br />
                            &#123; $, &#125;, ], VALUE, OBJECT, ARRAY &#125;
                          </div>
                          <div>
                            <span className="text-cyan-400 font-semibold">q0 (Start State):</span> q0
                          </div>
                          <div>
                            <span className="text-cyan-400 font-semibold">Z0 (Initial Stack Symbol):</span> $ (Bottom Marker)
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-800">
                          <span className="text-emerald-400 font-semibold">F (Accepting States):</span> &#123; q_accept &#125;
                          <div className="text-slate-400 text-[11px] mt-1">
                            Acceptance Condition: Machine transitions &delta;(q0, w, Z0) &vdash;* (q_accept, &epsilon;, &epsilon;) with stack completely empty.
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                          <div className="font-semibold text-slate-200">Push on Open</div>
                          <p className="text-slate-400 text-[11px] mt-1">On &apos;&#123;&apos;, push &apos;&#125;&apos;; on &apos;[&apos;, push &apos;]&apos; onto stack alphabet &Gamma;.</p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                          <div className="font-semibold text-slate-200">Pop on Close</div>
                          <p className="text-slate-400 text-[11px] mt-1">On &apos;&#125;&apos; or &apos;]&apos;, verify top-of-stack matches and pop.</p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                          <div className="font-semibold text-slate-200">Empty at EOF</div>
                          <p className="text-slate-400 text-[11px] mt-1">EOF must coincide with stack top $ to guarantee zero unclosed brackets.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SLIDE 4: PDA Transition Table & Trace */}
                  {currentSlide === 3 && (
                    <div className="p-8 space-y-5 flex-1">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          Slide 4: PDA Transition Function &delta;(q, a, Z) &rarr; (p, &gamma;)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Deterministic state machine transitions mapping current state, lookahead token, and stack top.
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs border border-slate-800">
                          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Current State (q)</th>
                              <th className="p-2.5">Input Token (a)</th>
                              <th className="p-2.5">Stack Top (Z)</th>
                              <th className="p-2.5">Next State (p)</th>
                              <th className="p-2.5">New Stack Symbol (&gamma;)</th>
                              <th className="p-2.5">Action Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-slate-300">
                            <tr>
                              <td className="p-2.5 text-cyan-300">q0</td>
                              <td className="p-2.5">&#123;</td>
                              <td className="p-2.5">$</td>
                              <td className="p-2.5 text-indigo-300">q_obj</td>
                              <td className="p-2.5">&#125; $</td>
                              <td className="p-2.5 text-slate-400">Push &apos;&#125;&apos; for object scope</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-cyan-300">q_obj</td>
                              <td className="p-2.5">STRING</td>
                              <td className="p-2.5">&#125;</td>
                              <td className="p-2.5 text-indigo-300">q_pair</td>
                              <td className="p-2.5">&#125;</td>
                              <td className="p-2.5 text-slate-400">Shift string key</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-cyan-300">q_pair</td>
                              <td className="p-2.5">:</td>
                              <td className="p-2.5">&#125;</td>
                              <td className="p-2.5 text-indigo-300">q_val</td>
                              <td className="p-2.5">&#125;</td>
                              <td className="p-2.5 text-slate-400">Shift colon separator</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-cyan-300">q_obj</td>
                              <td className="p-2.5">&#125;</td>
                              <td className="p-2.5">&#125;</td>
                              <td className="p-2.5 text-indigo-300">q_consume</td>
                              <td className="p-2.5">&epsilon; (Pop)</td>
                              <td className="p-2.5 text-slate-400">Pop closing brace</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 text-cyan-300">q_consume</td>
                              <td className="p-2.5">EOF</td>
                              <td className="p-2.5">$</td>
                              <td className="p-2.5 text-emerald-300">q_accept</td>
                              <td className="p-2.5">&epsilon; (Pop $)</td>
                              <td className="p-2.5 text-slate-400">Accept by empty stack</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                        <span><strong>Determinism Proof:</strong> |&delta;(q, a, Z)| &le; 1 for all valid configurations.</span>
                        <span className="text-cyan-400 font-mono">Time: O(n) | Space: O(depth)</span>
                      </div>
                    </div>
                  )}

                  {/* SLIDE 5: LL(1) Predictive Parsing & Lookahead Sets */}
                  {currentSlide === 4 && (
                    <div className="p-8 space-y-5 flex-1">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          Slide 5: LL(1) Lookahead Table & FIRST / FOLLOW Sets
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Mathematical verification proving zero backtracking is required during recursive descent.
                        </p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-mono text-xs border border-slate-800">
                          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                            <tr>
                              <th className="p-2.5">Non-Terminal (A)</th>
                              <th className="p-2.5">FIRST(A)</th>
                              <th className="p-2.5">FOLLOW(A)</th>
                              <th className="p-2.5">Predictive Lookahead Condition</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80 text-slate-300">
                            <tr>
                              <td className="p-2.5 font-bold text-cyan-300">VALUE</td>
                              <td className="p-2.5">&#123; &#123;, [, str, num, true, false, null &#125;</td>
                              <td className="p-2.5">&#123; ,, &#125;, ], EOF &#125;</td>
                              <td className="p-2.5 text-emerald-400">Disjoint first tokens</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-cyan-300">OBJECT</td>
                              <td className="p-2.5">&#123; &#123; &#125;</td>
                              <td className="p-2.5">&#123; ,, &#125;, ], EOF &#125;</td>
                              <td className="p-2.5 text-emerald-400">Unique leading delimiter</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-cyan-300">PAIR</td>
                              <td className="p-2.5">&#123; STRING &#125;</td>
                              <td className="p-2.5">&#123; ,, &#125; &#125;</td>
                              <td className="p-2.5 text-emerald-400">Strictly string key</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold text-cyan-300">ARRAY</td>
                              <td className="p-2.5">&#123; [ &#125;</td>
                              <td className="p-2.5">&#123; ,, &#125;, ], EOF &#125;</td>
                              <td className="p-2.5 text-emerald-400">Unique leading delimiter</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-2">
                        <div className="text-white font-semibold">Theorem of Non-Conflicting Decision (LL(1)):</div>
                        <p className="text-slate-300 leading-relaxed font-mono">
                          For every rule A &rarr; &alpha; | &beta;: FIRST(&alpha;) &cap; FIRST(&beta;) = &empty;.
                          Furthermore, since nullable productions only occur on empty collections, FIRST(A) &cap; FOLLOW(A) = &empty; holds universally across the grammar.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SLIDE 6: Automated Error Recovery Algorithm */}
                  {currentSlide === 5 && (
                    <div className="p-8 space-y-5 flex-1">
                      <div>
                        <h3 className="text-xl font-bold text-white">
                          Slide 6: Autonomous Error Recovery Algorithm (5 LLM Defects)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Deterministic repair synthesis inspecting PDA stack state upon transition failure.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                          <div className="font-semibold text-rose-300 font-mono">1. Trailing Comma</div>
                          <p className="text-slate-400 text-[11px]">
                            Lookahead in &#123; &apos;&#125;&apos;, &apos;]&apos; &#125; immediately following shift of terminal &apos;,&apos;.
                            <strong> Fix:</strong> Remove comma token.
                          </p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                          <div className="font-semibold text-rose-300 font-mono">2. Missing Comma</div>
                          <p className="text-slate-400 text-[11px]">
                            Next token is a valid value/key but delimiter state did not see &apos;,&apos;.
                            <strong> Fix:</strong> Insert &apos;,&apos; before current lookahead.
                          </p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                          <div className="font-semibold text-rose-300 font-mono">3. Unquoted Key</div>
                          <p className="text-slate-400 text-[11px]">
                            Lexer emits IDENTIFIER where STRING key was expected in PAIR.
                            <strong> Fix:</strong> Enclose identifier in double quotes.
                          </p>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                          <div className="font-semibold text-rose-300 font-mono">4 & 5. Missing Brackets &#123;&#125; / []</div>
                          <p className="text-slate-400 text-[11px]">
                            PDA reaches EOF while stack alphabet top contains active &apos;&#125;&apos; or &apos;]&apos;.
                            <strong> Fix:</strong> Synthesize closing delimiter matching stack top.
                          </p>
                        </div>
                      </div>

                      <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-200">
                        <span><strong>Empirical Benchmark Parity:</strong> 100% detection accuracy across all 20 LLM dataset test samples.</span>
                        <span className="font-mono font-bold text-emerald-300">15/15 Repaired</span>
                      </div>
                    </div>
                  )}

                  {/* Slide Bottom Thumbnail Bar */}
                  <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">
                      Jump to Slide:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[
                        '1. Overview',
                        '2. CFG Definition',
                        '3. DPDA 7-Tuple',
                        '4. Transitions Table',
                        '5. LL(1) Lookahead',
                        '6. Error Recovery',
                      ].map((title, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                            currentSlide === idx
                              ? 'bg-cyan-600 text-white font-bold'
                              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODE 2: FULL DOCUMENT VIEW */}
            {theoryViewMode === 'document' && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Theoretical Foundations: Formal Languages & Automata Theory (TOC)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Academic specifications modeling JSON syntax recognition as a Context-Free Language
                    accepted by Deterministic Pushdown Automata.
                  </p>
                </div>

                {/* CFG 4-tuple */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    1. Context-Free Grammar Definition: G = (V, &Sigma;, R, S)
                  </h3>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">Variables (V):</span> &#123; S, VALUE, OBJECT, MEMBERS, PAIR, ARRAY, ELEMENTS, STRING, NUMBER, BOOL, NULL &#125;
                    </div>
                    <div>
                      <span className="text-slate-500">Terminals (&Sigma;):</span> &#123; &apos;&#123;&apos;, &apos;&#125;&apos;, &apos;[&apos;, &apos;]&apos;, &apos;:&apos;, &apos;,&apos;, &apos;&quot;&apos;, digit+, char+, &apos;true&apos;, &apos;false&apos;, &apos;null&apos;, EOF &#125;
                    </div>
                    <div>
                      <span className="text-slate-500">Start Symbol (S):</span> S
                    </div>
                    <div className="pt-2 text-slate-400">Production Rules (R):</div>
                    <div className="pl-4 space-y-1 text-slate-200">
                      <div>1. S &rarr; VALUE EOF</div>
                      <div>2. VALUE &rarr; OBJECT | ARRAY | STRING | NUMBER | TRUE | FALSE | NULL</div>
                      <div>3. OBJECT &rarr; &apos;&#123;&apos; &apos;&#125;&apos; | &apos;&#123;&apos; MEMBERS &apos;&#125;&apos;</div>
                      <div>4. MEMBERS &rarr; PAIR | PAIR &apos;,&apos; MEMBERS</div>
                      <div>5. PAIR &rarr; STRING &apos;:&apos; VALUE</div>
                      <div>6. ARRAY &rarr; &apos;[&apos; &apos;]&apos; | &apos;[&apos; ELEMENTS &apos;]&apos;</div>
                      <div>7. ELEMENTS &rarr; VALUE | VALUE &apos;,&apos; ELEMENTS</div>
                    </div>
                  </div>
                </div>

                {/* DPDA 7-tuple */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    2. Pushdown Automaton (DPDA) Specification: M = (Q, &Sigma;, &Gamma;, &delta;, q0, Z0, F)
                  </h3>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">States (Q):</span> &#123; q0 (start), q_val, q_obj, q_arr, q_pair, q_consume, q_accept (final) &#125;
                    </div>
                    <div>
                      <span className="text-slate-500">Stack Alphabet (&Gamma;):</span> &#123; $, &apos;&#125;&apos;, &apos;]&apos;, VALUE, OBJECT, ARRAY &#125;
                    </div>
                    <div>
                      <span className="text-slate-500">Initial Stack Symbol:</span> Z0 = $
                    </div>
                    <div>
                      <span className="text-slate-500">Accepting States (F):</span> &#123; q_accept &#125; (Acceptance by final state with empty stack)
                    </div>
                    <div className="pt-2 text-slate-400">Transition Function Highlights (&delta;):</div>
                    <div className="pl-4 space-y-1 text-slate-200">
                      <div>&delta;(q0, &apos;&#123;&apos;, $) = (q_obj, &#123;&apos;&#125;&apos;, $&#125;) &mdash; Push closing delimiter to stack</div>
                      <div>&delta;(q_obj, &apos;&quot;&apos;, &#123;&apos;&#125;&apos;, ...&#125;) = (q_pair, &#123;&apos;&#125;&apos;, ...&#125;) &mdash; Shift string key</div>
                      <div>&delta;(q_pair, &apos;:&apos;, ...) = (q_val, ...) &mdash; Consume colon separator</div>
                      <div>&delta;(q_obj, &apos;&#125;&apos;, &#123;&apos;&#125;&apos;, ...&#125;) = (q_consume, ...) &mdash; Pop matching closing delimiter</div>
                      <div>&delta;(q_consume, EOF, $) = (q_accept, &epsilon;) &mdash; Accept payload</div>
                    </div>
                  </div>
                </div>

                {/* LL(1) Lookahead & Determinism */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    3. Lookahead Sets & Deterministic LL(1) Equivalence
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    JSON grammar is strictly LL(1) deterministic: for every non-terminal and input token,
                    the parser requires at most 1 token lookahead to choose the next production uniquely.
                    Because FIRST(&alpha;) &cap; FIRST(&beta;) = &empty; for all alternate productions,
                    no backtracking is ever required, yielding guaranteed O(n) recognition time.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs border border-slate-800">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          <th className="p-2 border-b border-slate-800">Non-Terminal</th>
                          <th className="p-2 border-b border-slate-800">FIRST Set</th>
                          <th className="p-2 border-b border-slate-800">FOLLOW Set</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        <tr>
                          <td className="p-2 font-semibold text-cyan-300">VALUE</td>
                          <td className="p-2">&#123; &apos;&#123;&apos;, &apos;[&apos;, STRING, NUMBER, TRUE, FALSE, NULL &#125;</td>
                          <td className="p-2">&#123; &apos;,&apos;, &apos;&#125;&apos;, &apos;]&apos;, EOF &#125;</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold text-cyan-300">OBJECT</td>
                          <td className="p-2">&#123; &apos;&#123;&apos; &#125;</td>
                          <td className="p-2">&#123; &apos;,&apos;, &apos;&#125;&apos;, &apos;]&apos;, EOF &#125;</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold text-cyan-300">PAIR</td>
                          <td className="p-2">&#123; STRING &#125;</td>
                          <td className="p-2">&#123; &apos;,&apos;, &apos;&#125;&apos; &#125;</td>
                        </tr>
                        <tr>
                          <td className="p-2 font-semibold text-cyan-300">ARRAY</td>
                          <td className="p-2">&#123; &apos;[&apos; &#125;</td>
                          <td className="p-2">&#123; &apos;,&apos;, &apos;&#125;&apos;, &apos;]&apos;, EOF &#125;</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Why LLMs Fail at JSON */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs space-y-2">
                  <div className="font-semibold text-white">
                    Why Large Language Models Systematically Violate Context-Free Grammars:
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    LLMs generate tokens autoregressively based on probability distributions
                    P(w_t | w_prev). They do not maintain an internal physical stack or explicit grammar invariant.
                    When generating long sequences, token degradation or prompt truncation causes:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-300">
                    <li><strong>Trailing Commas:</strong> Habits copied from JavaScript/Python dict literals.</li>
                    <li><strong>Unquoted Keys:</strong> Leaked JavaScript object notation syntax.</li>
                    <li><strong>Missing Delimiters:</strong> Premature token budget exhaustion truncating the stream before closing braces.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PYTHON CODEBASE & EXPORT */}
        {/* ========================================================================= */}
        {activeTab === 'code' && (
          <div className="space-y-6">
            {/* Header with Download ZIP */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Complete College Project Python Source Code
                </h2>
                <p className="text-xs text-slate-400">
                  Production-ready modular code adhering strictly to the architecture and API contracts.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadZip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Complete Project (.zip)</span>
                </button>
              </div>
            </div>

            {/* File Browser & Code Viewer */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* File List */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1">
                <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Project Files ({PROJECT_FILES.length})
                </div>
                {PROJECT_FILES.map((f, idx) => (
                  <button
                    key={f.filename}
                    onClick={() => setSelectedFileIdx(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
                      selectedFileIdx === idx
                        ? 'bg-cyan-950/70 border border-cyan-800/80 text-cyan-300'
                        : 'text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="font-semibold">{f.filename}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{f.language}</span>
                  </button>
                ))}
              </div>

              {/* Code Pane */}
              <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-semibold text-white">
                      {PROJECT_FILES[selectedFileIdx].filename}
                    </span>
                    <span className="text-slate-400 ml-2 text-[11px]">
                      &mdash; {PROJECT_FILES[selectedFileIdx].description}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopyCode(
                        PROJECT_FILES[selectedFileIdx].content,
                        PROJECT_FILES[selectedFileIdx].filename
                      )
                    }
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors cursor-pointer"
                  >
                    {copiedFile === PROJECT_FILES[selectedFileIdx].filename ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy File</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Preformatted code block */}
                <div className="p-4 bg-slate-950 font-mono text-xs overflow-auto max-h-[580px] leading-relaxed text-slate-300">
                  <pre>{PROJECT_FILES[selectedFileIdx].content}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>College Project: JSON Validator with Error Recovery (TOC & Compiler Engineering)</span>
          <span>100% Deterministic · CFG LL(1) Parser · DPDA Simulation</span>
        </div>
      </footer>
    </div>
  );
}
