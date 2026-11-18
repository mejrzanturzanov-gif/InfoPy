import {
  CheckCircle2,
  Eye,
  Lightbulb,
  Play,
  RotateCcw,
  Terminal,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COURSE_MODULES, OLYMPIAD_PROBLEMS } from '../data/curriculum';
import { judgePython, runPython } from '../engine/pythonRunner';
import type { Lesson, OlympiadProblem, RunResult, StudentProgress, TestCaseResult } from '../types';

export type LabTaskContext =
  | { type: 'free' }
  | { type: 'lesson'; lesson: Lesson }
  | { type: 'olympiad'; problem: OlympiadProblem };

interface CodeLabViewProps {
  taskContext: LabTaskContext;
  code: string;
  stdin: string;
  progress: StudentProgress;
  onChangeCode: (code: string) => void;
  onChangeStdin: (stdin: string) => void;
  onSelectTask: (context: LabTaskContext, starterCode: string, defaultStdin: string) => void;
  onMarkProblemSolved: (problemId: string) => void;
  onMarkLessonComplete: (lessonId: string) => void;
}

const SNIPPETS = [
  { label: 'map(int, ...)', code: 'a, b = map(int, input().split())\n' },
  { label: 'list(map(...))', code: 'a = list(map(int, input().split()))\n' },
  { label: 'for range', code: 'for i in range(n):\n    \n' },
  { label: 'if / else', code: 'if x > 0:\n    print("YES")\nelse:\n    print("NO")\n' },
];

export function CodeLabView({
  taskContext,
  code,
  stdin,
  progress,
  onChangeCode,
  onChangeStdin,
  onSelectTask,
  onMarkProblemSolved,
  onMarkLessonComplete,
}: CodeLabViewProps) {
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [judgeResults, setJudgeResults] = useState<TestCaseResult[] | null>(null);
  const [outputTab, setOutputTab] = useState<'console' | 'tests'>('console');
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const allLessons = COURSE_MODULES.flatMap((m) => m.lessons);

  useEffect(() => {
    setRunResult(null);
    setJudgeResults(null);
    setShowHint(false);
    setShowSolution(false);
    setOutputTab('console');
  }, [taskContext]);

  const activeTestCases =
    taskContext.type === 'olympiad'
      ? taskContext.problem.testCases
      : taskContext.type === 'lesson'
      ? taskContext.lesson.practiceTask.testCases
      : [];

  const handleRunCustom = () => {
    const res = runPython(code, stdin);
    setRunResult(res);
    setOutputTab('console');
  };

  const handleRunJudge = () => {
    if (activeTestCases.length === 0) return;
    const results = judgePython(code, activeTestCases);
    setJudgeResults(results);
    setOutputTab('tests');

    const allPassed = results.every((r) => r.passed);
    if (allPassed) {
      if (taskContext.type === 'olympiad') {
        onMarkProblemSolved(taskContext.problem.id);
      } else if (taskContext.type === 'lesson') {
        onMarkLessonComplete(taskContext.lesson.id);
      }
    }
  };

  const handleReset = () => {
    if (taskContext.type === 'olympiad') {
      onChangeCode(taskContext.problem.starterCode);
      onChangeStdin(taskContext.problem.sampleInput);
    } else if (taskContext.type === 'lesson') {
      onChangeCode(taskContext.lesson.practiceTask.starterCode);
      onChangeStdin(taskContext.lesson.practiceTask.testCases[0]?.input ?? '');
    } else {
      onChangeCode('# Еркін Python жаттығу алаңы\nname = "Оқушы"\nfor i in range(1, 6):\n    print(f"{i}-қадам: Сәлем, {name}!")\n');
      onChangeStdin('');
    }
    setRunResult(null);
    setJudgeResults(null);
  };

  const insertSnippet = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChangeCode(code + snippet);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = code.slice(0, start) + snippet + code.slice(end);
    onChangeCode(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = code.slice(0, start) + '    ' + code.slice(end);
      onChangeCode(next);
      requestAnimationFrame(() => {
        el.setSelectionRange(start + 4, start + 4);
      });
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCustom();
    }
  };

  const lineCount = Math.max(12, code.split('\n').length);
  const passedCount = judgeResults ? judgeResults.filter((r) => r.passed).length : 0;
  const allPassed = judgeResults !== null && judgeResults.length > 0 && passedCount === judgeResults.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Task Switcher Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="task-selector" className="text-sm font-medium text-slate-700 whitespace-nowrap">
            Тапсырманы таңдау:
          </label>
          <select
            id="task-selector"
            value={
              taskContext.type === 'free'
                ? 'free'
                : taskContext.type === 'olympiad'
                ? `olympiad:${taskContext.problem.id}`
                : `lesson:${taskContext.lesson.id}`
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'free') {
                onSelectTask(
                  { type: 'free' },
                  '# Еркін Python жаттығу алаңы\na, b = map(int, input().split())\nprint("Қосынды:", a + b)\n',
                  '12 8'
                );
              } else if (val.startsWith('olympiad:')) {
                const id = val.replace('olympiad:', '');
                const prob = OLYMPIAD_PROBLEMS.find((p) => p.id === id);
                if (prob) {
                  onSelectTask({ type: 'olympiad', problem: prob }, prob.starterCode, prob.sampleInput);
                }
              } else if (val.startsWith('lesson:')) {
                const id = val.replace('lesson:', '');
                const lesson = allLessons.find((l) => l.id === id);
                if (lesson) {
                  onSelectTask(
                    { type: 'lesson', lesson },
                    lesson.practiceTask.starterCode,
                    lesson.practiceTask.testCases[0]?.input ?? ''
                  );
                }
              }
            }}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 max-w-full sm:max-w-md focus:outline-2 focus:outline-blue-600"
          >
            <option value="free">Еркін Python жаттығу алаңы (Sandbox)</option>
            <optgroup label="Сабақ тапсырмалары">
              {allLessons.map((l) => (
                <option key={l.id} value={`lesson:${l.id}`}>
                  Сабақ · {l.practiceTask.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="Олимпиада есептері">
              {OLYMPIAD_PROBLEMS.map((p) => (
                <option key={p.id} value={`olympiad:${p.id}`}>
                  {p.code} · {p.title} ({p.difficulty})
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
          <span>Жылдам іске қосу: Ctrl + Enter</span>
          <span aria-hidden="true">·</span>
          <span>Tab = 4 бос орын</span>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: Problem / Task Statement */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          {taskContext.type === 'free' && (
            <div className="space-y-4">
              <div className="text-xs font-medium text-blue-600">Еркін режим</div>
              <h1 className="text-xl font-display font-bold text-slate-900">
                Python код зертханасы
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Бұл алаңда кез келген Python алгоритмін жазып, тексеруге болады. Кіріс деректерін оң жақтағы «Кіріс (Stdin)» өрісіне жазып, <code className="font-mono text-slate-800 bg-slate-100 px-1 rounded">input()</code> арқылы оқыңыз.
              </p>
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <h2 className="text-sm font-semibold text-slate-900">Қолжетімді мүмкіндіктер</h2>
                <ul className="text-sm text-slate-600 space-y-1.5 list-disc list-inside">
                  <li>Толық <code className="font-mono">if / elif / else</code>, <code className="font-mono">for</code>, <code className="font-mono">while</code>, <code className="font-mono">def</code></li>
                  <li>Тізімдер, сөздіктер, жиындар, тізім генераторлары</li>
                  <li><code className="font-mono">math</code> модулі (<code className="font-mono">gcd</code>, <code className="font-mono">sqrt</code>, <code className="font-mono">factorial</code>)</li>
                  <li>Қазақ тіліндегі синтаксис және орындалу қателері</li>
                </ul>
              </div>
            </div>
          )}

          {taskContext.type === 'lesson' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                <span>Сабақ тапсырмасы · {taskContext.lesson.gradeRange}</span>
                {progress.completedLessons.includes(taskContext.lesson.id) && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Орындалды
                  </span>
                )}
              </div>
              <h1 className="text-xl font-display font-bold text-slate-900">
                {taskContext.lesson.practiceTask.title}
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                {taskContext.lesson.practiceTask.prompt}
              </p>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <h2 className="text-sm font-semibold text-slate-900">Ашық тест мысалдары</h2>
                {taskContext.lesson.practiceTask.testCases
                  .filter((tc) => !tc.isHidden)
                  .map((tc, idx) => (
                    <div
                      key={tc.id}
                      className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3"
                    >
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Кіріс #{idx + 1}</div>
                        <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">{tc.input}</pre>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Шығыс #{idx + 1}</div>
                        <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {taskContext.type === 'olympiad' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
                <div>
                  <span className="font-mono font-semibold text-slate-700">{taskContext.problem.code}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{taskContext.problem.difficulty}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{taskContext.problem.topic}</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span>{taskContext.problem.points} ұпай</span>
                </div>
                {progress.solvedProblems.includes(taskContext.problem.id) && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Шешілді
                  </span>
                )}
              </div>

              <h1 className="text-xl font-display font-bold text-slate-900">
                {taskContext.problem.title}
              </h1>
              <p className="text-sm text-slate-700 leading-relaxed">
                {taskContext.problem.statement}
              </p>

              <div className="space-y-3 border-t border-slate-200 pt-4 text-sm">
                <div>
                  <div className="font-semibold text-slate-900 mb-0.5">Кіріс деректері</div>
                  <p className="text-slate-600">{taskContext.problem.inputFormat}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-0.5">Шығыс деректері</div>
                  <p className="text-slate-600">{taskContext.problem.outputFormat}</p>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 mb-0.5">Шектеулер</div>
                  <p className="font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 inline-block">
                    {taskContext.problem.constraints}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Мысал кіріс</div>
                  <pre className="text-xs font-mono text-slate-900 whitespace-pre-wrap">
                    {taskContext.problem.sampleInput}
                  </pre>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Мысал шығыс</div>
                  <pre className="text-xs font-mono text-slate-900 whitespace-pre-wrap">
                    {taskContext.problem.sampleOutput}
                  </pre>
                </div>
              </div>

              {/* Hint & Solution Helpers */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowHint((p) => !p)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  {showHint ? 'Кеңесті жасыру' : 'Кеңес алу'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSolution((p) => !p)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showSolution ? 'Шешімді жасыру' : 'Үлгі шешімді көру'}
                </button>
              </div>

              {showHint && (
                <div className="text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-3 leading-relaxed">
                  {taskContext.problem.hint}
                </div>
              )}

              {showSolution && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Үлгі шешім (Python)</span>
                    <button
                      type="button"
                      onClick={() => onChangeCode(taskContext.problem.solutionCode)}
                      className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                    >
                      Редакторға көшіру
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>{taskContext.problem.solutionCode}</code>
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Pane: Code Editor, Stdin, & Console/Judge */}
        <section className="lg:col-span-7 space-y-4">
          {/* Code Editor Card */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            {/* Editor Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                <span>solution.py</span>
                <span className="text-slate-600" aria-hidden="true">·</span>
                <span className="text-slate-400">Python 3</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SNIPPETS.map((sn) => (
                  <button
                    key={sn.label}
                    type="button"
                    onClick={() => insertSnippet(sn.code)}
                    className="px-2 py-1 text-[11px] font-mono text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                  >
                    + {sn.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer ml-1"
                  title="Бастапқы кодқа қайтару"
                >
                  <RotateCcw className="w-3 h-3" />
                  Тазалау
                </button>
              </div>
            </div>

            {/* Editor Body with Line Numbers */}
            <div className="flex font-mono text-sm leading-6">
              <div
                aria-hidden="true"
                className="select-none py-4 px-3 text-right text-slate-600 bg-slate-950/50 border-r border-slate-800 tabular-nums text-xs leading-6 min-w-[3rem]"
              >
                {Array.from({ length: lineCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className={
                      runResult?.errorLine === idx + 1 ? 'text-rose-400 font-bold' : ''
                    }
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => onChangeCode(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                spellCheck={false}
                aria-label="Python код редакторы"
                rows={14}
                className="code-editor flex-1 w-full bg-slate-900 text-slate-100 p-4 focus:outline-none resize-y leading-6 text-sm"
              />
            </div>

            {/* Stdin & Run Bar */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label htmlFor="stdin-box" className="block text-xs font-medium text-slate-400 mb-1">
                    Кіріс деректері (Stdin)
                  </label>
                  <textarea
                    id="stdin-box"
                    value={stdin}
                    onChange={(e) => onChangeStdin(e.target.value)}
                    rows={2}
                    placeholder="Мысалы: 5 8"
                    className="w-full font-mono text-xs bg-slate-900 text-slate-100 border border-slate-700 rounded-lg px-3 py-2 focus:outline-2 focus:outline-blue-500 resize-y"
                  />
                </div>
                <div className="sm:col-span-5 flex flex-wrap sm:justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleRunCustom}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    Іске қосу
                  </button>
                  {activeTestCases.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRunJudge}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Тесттерді тексеру ({activeTestCases.length})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Output & Test Judge Panel */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
                <button
                  type="button"
                  onClick={() => setOutputTab('console')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    outputTab === 'console'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Консоль
                </button>
                {activeTestCases.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOutputTab('tests')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      outputTab === 'tests'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Авто-тесттер {judgeResults ? `(${passedCount}/${judgeResults.length})` : ''}
                  </button>
                )}
              </div>

              {runResult && outputTab === 'console' && (
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  Уақыт: {runResult.executionTimeMs} мс
                </span>
              )}
            </div>

            <div className="p-4">
              {outputTab === 'console' && (
                <div>
                  {!runResult ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 py-3">
                      <Terminal className="w-4 h-4 text-slate-400" />
                      <span>Нәтижені көру үшін «Іске қосу» батырмасын басыңыз.</span>
                    </div>
                  ) : runResult.success ? (
                    <pre className="font-mono text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-3.5 whitespace-pre-wrap">
                      {runResult.output || '(Бағдарлама бос нәтиже шығарды)'}
                    </pre>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3.5 space-y-1">
                      <div className="text-xs font-semibold text-rose-800 flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        Орындалу қатесі {runResult.errorLine ? `(${runResult.errorLine}-жол)` : ''}
                      </div>
                      <pre className="font-mono text-xs text-rose-900 whitespace-pre-wrap">
                        {runResult.error}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {outputTab === 'tests' && (
                <div className="space-y-4">
                  {!judgeResults ? (
                    <div className="text-sm text-slate-500 py-3">
                      Барлық тесттер бойынша тексеру үшін «Тесттерді тексеру» батырмасын басыңыз.
                    </div>
                  ) : (
                    <>
                      {allPassed ? (
                        <div className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <Trophy className="w-4 h-4 text-emerald-700" />
                            <span>Барлық {judgeResults.length} тест сәтті өтті! (Accepted)</span>
                          </div>
                          <span className="text-xs font-mono tabular-nums text-emerald-800">
                            100%
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm font-medium">
                          <span>
                            {passedCount} / {judgeResults.length} тест өтті. Қате тесттерді тексеріп, кодты түзетіңіз.
                          </span>
                        </div>
                      )}

                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold">Тест</th>
                              <th className="py-2.5 px-3 font-semibold">Кіріс</th>
                              <th className="py-2.5 px-3 font-semibold">Күтілетін</th>
                              <th className="py-2.5 px-3 font-semibold">Сіздің жауап</th>
                              <th className="py-2.5 px-3 font-semibold">Күйі</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono">
                            {judgeResults.map((r) => (
                              <tr key={r.testId} className={r.passed ? 'bg-white' : 'bg-rose-50/40'}>
                                <td className="py-2.5 px-3 font-sans font-medium text-slate-800 tabular-nums">
                                  #{r.index} {r.isHidden ? '(Жабық)' : ''}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 whitespace-pre-wrap">
                                  {r.isHidden ? '•••' : r.input}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 whitespace-pre-wrap">
                                  {r.isHidden ? '•••' : r.expectedOutput}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 whitespace-pre-wrap">
                                  {r.error ? (
                                    <span className="text-rose-700">{r.error}</span>
                                  ) : r.isHidden && !r.passed ? (
                                    'Сәйкес емес'
                                  ) : (
                                    r.actualOutput || '(бос)'
                                  )}
                                </td>
                                <td className="py-2.5 px-3 font-sans">
                                  {r.passed ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Өтті
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                                      <XCircle className="w-3.5 h-3.5" />
                                      Қате
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
