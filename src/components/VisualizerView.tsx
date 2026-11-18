import { Pause, Play, RotateCcw, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type AlgoType = 'bubble' | 'binary' | 'euclid' | 'dp';

interface VizStep {
  description: string;
  activeLine: number;
  variables: Record<string, string | number>;
  // Bubble & Binary array state
  array?: number[];
  compareIndices?: number[];
  swappedIndices?: number[];
  sortedIndices?: number[];
  leftPtr?: number;
  rightPtr?: number;
  midPtr?: number;
  foundIdx?: number;
  // Euclid state
  euclidRows?: { a: number; b: number; q: number; r: number }[];
  // DP state
  dpArray?: (number | null)[];
  dpActiveIdx?: number;
  dpDepIndices?: number[];
}

const ALGO_CODE: Record<AlgoType, string[]> = {
  bubble: [
    'n = len(a)',
    'for i in range(n - 1):',
    '    for j in range(n - 1 - i):',
    '        if a[j] > a[j + 1]:',
    '            a[j], a[j + 1] = a[j + 1], a[j]',
  ],
  binary: [
    'l, r = 0, len(a) - 1',
    'while l <= r:',
    '    mid = (l + r) // 2',
    '    if a[mid] == target:',
    '        return mid',
    '    elif a[mid] < target:',
    '        l = mid + 1',
    '    else:',
    '        r = mid - 1',
  ],
  euclid: [
    'while b > 0:',
    '    q = a // b',
    '    r = a % b',
    '    a, b = b, r',
    'return a',
  ],
  dp: [
    'dp = [0] * (n + 1)',
    'dp[0], dp[1] = 1, 1',
    'for i in range(2, n + 1):',
    '    dp[i] = dp[i - 1] + dp[i - 2]',
    'return dp[n]',
  ],
};

function generateBubbleSteps(initial: number[]): VizStep[] {
  const arr = [...initial];
  const n = arr.length;
  const steps: VizStep[] = [
    {
      array: [...arr],
      sortedIndices: [],
      activeLine: 0,
      variables: { n, салыстыру: 0, алмасу: 0 },
      description: `Бастапқы массив: ${n} элемент. Көпіршікпен сұрыптау басталады.`,
    },
  ];

  let cmp = 0;
  let swp = 0;
  const sorted: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      cmp++;
      steps.push({
        array: [...arr],
        compareIndices: [j, j + 1],
        sortedIndices: [...sorted],
        activeLine: 3,
        variables: { i, j, 'a[j]': arr[j], 'a[j+1]': arr[j + 1], салыстыру: cmp, алмасу: swp },
        description: `a[${j}] = ${arr[j]} және a[${j + 1}] = ${arr[j + 1]} салыстырылады.`,
      });
      if (arr[j] > arr[j + 1]) {
        const tmp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = tmp;
        swp++;
        steps.push({
          array: [...arr],
          swappedIndices: [j, j + 1],
          sortedIndices: [...sorted],
          activeLine: 4,
          variables: { i, j, 'a[j]': arr[j], 'a[j+1]': arr[j + 1], салыстыру: cmp, алмасу: swp },
          description: `${arr[j + 1]} > ${arr[j]} болғандықтан орындары ауыстырылды.`,
        });
      }
    }
    sorted.push(n - 1 - i);
  }
  sorted.push(0);

  steps.push({
    array: [...arr],
    sortedIndices: Array.from({ length: n }, (_, k) => k),
    activeLine: 0,
    variables: { салыстыру: cmp, алмасу: swp },
    description: `Сұрыптау аяқталды! Барлығы ${cmp} салыстыру, ${swp} алмасу орындалды.`,
  });

  return steps;
}

function generateBinarySteps(sortedArr: number[], target: number): VizStep[] {
  const n = sortedArr.length;
  let l = 0;
  let r = n - 1;
  let stepCount = 0;

  const steps: VizStep[] = [
    {
      array: [...sortedArr],
      leftPtr: l,
      rightPtr: r,
      activeLine: 0,
      variables: { target, l, r, қадам: 0 },
      description: `Іздеу шекаралары орнатылды: l = 0, r = ${r}. Ізделетін мән = ${target}.`,
    },
  ];

  while (l <= r) {
    stepCount++;
    const mid = Math.floor((l + r) / 2);
    steps.push({
      array: [...sortedArr],
      leftPtr: l,
      rightPtr: r,
      midPtr: mid,
      activeLine: 2,
      variables: { target, l, r, mid, 'a[mid]': sortedArr[mid], қадам: stepCount },
      description: `Ортаңғы индекс mid = (${l} + ${r}) // 2 = ${mid}. Мәні a[${mid}] = ${sortedArr[mid]}.`,
    });

    if (sortedArr[mid] === target) {
      steps.push({
        array: [...sortedArr],
        leftPtr: l,
        rightPtr: r,
        midPtr: mid,
        foundIdx: mid,
        activeLine: 4,
        variables: { target, mid, нәтиже: mid, қадам: stepCount },
        description: `Табылды! a[${mid}] == ${target}. ${stepCount} қадамда аяқталды.`,
      });
      return steps;
    } else if (sortedArr[mid] < target) {
      l = mid + 1;
      steps.push({
        array: [...sortedArr],
        leftPtr: l,
        rightPtr: r,
        activeLine: 6,
        variables: { target, l, r, қадам: stepCount },
        description: `a[${mid}] < ${target} болғандықтан, сол жақ бөлік алынып, l = ${l} болады.`,
      });
    } else {
      r = mid - 1;
      steps.push({
        array: [...sortedArr],
        leftPtr: l,
        rightPtr: r,
        activeLine: 8,
        variables: { target, l, r, қадам: stepCount },
        description: `a[${mid}] > ${target} болғандықтан, оң жақ бөлік алынып, r = ${r} болады.`,
      });
    }
  }

  steps.push({
    array: [...sortedArr],
    leftPtr: l,
    rightPtr: r,
    activeLine: 1,
    variables: { target, l, r, нәтиже: -1, қадам: stepCount },
    description: `l > r болды. ${target} саны массивте табылмады (нәтиже: -1).`,
  });
  return steps;
}

function generateEuclidSteps(initA: number, initB: number): VizStep[] {
  let a = Math.max(1, Math.abs(Math.trunc(initA)));
  let b = Math.max(0, Math.abs(Math.trunc(initB)));
  const rows: { a: number; b: number; q: number; r: number }[] = [];
  const steps: VizStep[] = [
    {
      euclidRows: [],
      activeLine: 0,
      variables: { a, b },
      description: `ЕҮОБ(${a}, ${b}) есептеу басталды.`,
    },
  ];

  while (b > 0) {
    const q = Math.floor(a / b);
    const r = a % b;
    rows.push({ a, b, q, r });
    steps.push({
      euclidRows: [...rows],
      activeLine: 2,
      variables: { a, b, q, r },
      description: `${a} = ${b} × ${q} + ${r} (қалдық r = ${r}).`,
    });
    a = b;
    b = r;
    steps.push({
      euclidRows: [...rows],
      activeLine: 3,
      variables: { a, b },
      description: `Ауыстыру: жаңа (a, b) = (${a}, ${b}).`,
    });
  }

  steps.push({
    euclidRows: [...rows],
    activeLine: 4,
    variables: { a, b, ЕҮОБ: a },
    description: `b = 0 болды! Ең үлкен ортақ бөлгіш: ${a}.`,
  });

  return steps;
}

function generateDpSteps(n: number): VizStep[] {
  const count = Math.min(10, Math.max(3, n));
  const dp: (number | null)[] = Array(count + 1).fill(null);
  const steps: VizStep[] = [
    {
      dpArray: [...dp],
      activeLine: 0,
      variables: { n: count },
      description: `${count + 1} элементтен тұратын бос DP кестесі құрылды.`,
    },
  ];

  dp[0] = 1;
  dp[1] = 1;
  steps.push({
    dpArray: [...dp],
    dpActiveIdx: 1,
    activeLine: 1,
    variables: { 'dp[0]': 1, 'dp[1]': 1 },
    description: `Базалық күйлер орнатылды: dp[0] = 1, dp[1] = 1.`,
  });

  for (let i = 2; i <= count; i++) {
    const v1 = dp[i - 1] ?? 0;
    const v2 = dp[i - 2] ?? 0;
    dp[i] = v1 + v2;
    steps.push({
      dpArray: [...dp],
      dpActiveIdx: i,
      dpDepIndices: [i - 1, i - 2],
      activeLine: 3,
      variables: { i, 'dp[i-1]': v1, 'dp[i-2]': v2, 'dp[i]': dp[i]! },
      description: `dp[${i}] = dp[${i - 1}] (${v1}) + dp[${i - 2}] (${v2}) = ${dp[i]}.`,
    });
  }

  steps.push({
    dpArray: [...dp],
    dpActiveIdx: count,
    activeLine: 4,
    variables: { n: count, жауап: dp[count]! },
    description: `Дайын! ${count}-ші сатыға көтерілу тәсілдерінің саны: ${dp[count]}.`,
  });
  return steps;
}

export function VisualizerView() {
  const [algo, setAlgo] = useState<AlgoType>('bubble');
  const [bubbleInput, setBubbleInput] = useState<number[]>([38, 15, 52, 9, 44, 23, 61, 12]);
  const [binaryArr] = useState<number[]>([3, 8, 14, 19, 25, 31, 42, 56, 68, 74]);
  const [binaryTarget, setBinaryTarget] = useState<number>(42);
  const [euclidA, setEuclidA] = useState<number>(252);
  const [euclidB, setEuclidB] = useState<number>(105);
  const [dpN, setDpN] = useState<number>(7);

  const [stepIdx, setStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const steps = useMemo(() => {
    switch (algo) {
      case 'bubble':
        return generateBubbleSteps(bubbleInput);
      case 'binary':
        return generateBinarySteps(binaryArr, binaryTarget);
      case 'euclid':
        return generateEuclidSteps(euclidA, euclidB);
      case 'dp':
        return generateDpSteps(dpN);
    }
  }, [algo, bubbleInput, binaryArr, binaryTarget, euclidA, euclidB, dpN]);

  const currentStep = steps[Math.min(stepIdx, steps.length - 1)];

  useEffect(() => {
    setStepIdx(0);
    setIsPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!isPlaying) return;
    if (stepIdx >= steps.length - 1) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setStepIdx((prev) => Math.min(prev + 1, steps.length - 1));
    }, Math.round(750 / speed));
    return () => window.clearTimeout(timer);
  }, [isPlaying, stepIdx, steps.length, speed]);

  const randomizeBubble = () => {
    const next = Array.from({ length: 8 }, () => Math.floor(Math.random() * 65) + 8);
    setBubbleInput(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Algorithm Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Алгоритмдер визуализаторы
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Әр қадамдағы айнымалылар мәнін, салыстыруларды және орындалып жатқан Python жолын бақылаңыз.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {[
            { id: 'bubble', label: 'Көпіршікпен сұрыптау' },
            { id: 'binary', label: 'Бинарлы іздеу' },
            { id: 'euclid', label: 'Евклид (ЕҮОБ)' },
            { id: 'dp', label: 'Динамикалық кесте (ДБ)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAlgo(tab.id as AlgoType)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                algo === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-Zone Sandbox Layout: Left Stage (65%) + Right Control Deck (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Stage */}
        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-900">
              {currentStep.description}
            </div>
            <span className="text-xs font-mono text-slate-500 tabular-nums whitespace-nowrap">
              Қадам {stepIdx + 1} / {steps.length}
            </span>
          </div>

          {/* Bubble Sort Stage */}
          {algo === 'bubble' && currentStep.array && (
            <div className="space-y-4">
              <div className="h-64 bg-slate-50 border border-slate-200 rounded-lg p-6 flex items-end justify-center gap-3">
                {currentStep.array.map((val, idx) => {
                  const isCompare = currentStep.compareIndices?.includes(idx);
                  const isSwap = currentStep.swappedIndices?.includes(idx);
                  const isSorted = currentStep.sortedIndices?.includes(idx);

                  let barColor = 'bg-slate-400';
                  let statusLabel = '';
                  if (isSwap) {
                    barColor = 'bg-amber-500';
                    statusLabel = 'Алмасу';
                  } else if (isCompare) {
                    barColor = 'bg-blue-600';
                    statusLabel = 'Салыстыру';
                  } else if (isSorted) {
                    barColor = 'bg-emerald-600';
                  }

                  const heightPct = Math.max(15, Math.round((val / 75) * 100));

                  return (
                    <div key={idx} className="flex-1 max-w-[56px] flex flex-col items-center gap-1.5 h-full justify-end">
                      {statusLabel && (
                        <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                          {statusLabel}
                        </span>
                      )}
                      <span className="text-xs font-mono font-semibold text-slate-800 tabular-nums">
                        {val}
                      </span>
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-md transition-all duration-200 ${barColor}`}
                      />
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                        [{idx}]
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
                  <span>Салыстыру</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block" />
                  <span>Алмасу</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />
                  <span>Сұрыпталған</span>
                </div>
              </div>
            </div>
          )}

          {/* Binary Search Stage */}
          {algo === 'binary' && currentStep.array && (
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 overflow-x-auto">
                <div className="grid grid-cols-10 gap-2 min-w-[540px]">
                  {currentStep.array.map((val, idx) => {
                    const l = currentStep.leftPtr ?? 0;
                    const r = currentStep.rightPtr ?? currentStep.array!.length - 1;
                    const mid = currentStep.midPtr;
                    const found = currentStep.foundIdx === idx;
                    const inRange = idx >= l && idx <= r;

                    let boxStyle = 'bg-white border-slate-300 text-slate-900';
                    if (found) {
                      boxStyle = 'bg-emerald-600 border-emerald-700 text-white';
                    } else if (mid === idx) {
                      boxStyle = 'bg-blue-600 border-blue-700 text-white';
                    } else if (!inRange) {
                      boxStyle = 'bg-slate-100 border-slate-200 text-slate-400 opacity-50';
                    }

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5">
                        <div className="h-5 text-[11px] font-mono font-semibold text-blue-700">
                          {l === idx && 'L '}
                          {mid === idx && 'M '}
                          {r === idx && 'R'}
                        </div>
                        <div
                          className={`w-full py-3 rounded-lg border text-center font-mono font-bold text-sm tabular-nums transition-colors ${boxStyle}`}
                        >
                          {val}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {idx}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="text-xs text-slate-600">
                Белгілер: <span className="font-mono font-semibold text-slate-900">L</span> — сол шек,{' '}
                <span className="font-mono font-semibold text-slate-900">M</span> — орта (mid),{' '}
                <span className="font-mono font-semibold text-slate-900">R</span> — оң шек.
              </div>
            </div>
          )}

          {/* Euclid Stage */}
          {algo === 'euclid' && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4">
              {(!currentStep.euclidRows || currentStep.euclidRows.length === 0) ? (
                <div className="text-sm text-slate-500 py-8 text-center">
                  Қадамдарды көру үшін «Ойнату» немесе «Келесі қадам» батырмасын басыңыз.
                </div>
              ) : (
                <table className="w-full text-left text-sm font-mono tabular-nums">
                  <thead className="border-b border-slate-200 text-xs text-slate-500 font-sans">
                    <tr>
                      <th className="py-2 px-3">Қадам</th>
                      <th className="py-2 px-3">a</th>
                      <th className="py-2 px-3">b</th>
                      <th className="py-2 px-3">Бөлінді (a // b)</th>
                      <th className="py-2 px-3">Қалдық (a % b)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {currentStep.euclidRows.map((row, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="py-2.5 px-3 font-sans text-xs text-slate-500">#{idx + 1}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{row.a}</td>
                        <td className="py-2.5 px-3 font-semibold text-blue-700">{row.b}</td>
                        <td className="py-2.5 px-3 text-slate-700">{row.q}</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-700">{row.r}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* DP Table Stage */}
          {algo === 'dp' && currentStep.dpArray && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-4 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-[460px]">
                {currentStep.dpArray.map((val, idx) => {
                  const isActive = currentStep.dpActiveIdx === idx;
                  const isDep = currentStep.dpDepIndices?.includes(idx);
                  let cellStyle = 'bg-white border-slate-200 text-slate-400';
                  if (isActive) {
                    cellStyle = 'bg-blue-600 border-blue-700 text-white';
                  } else if (isDep) {
                    cellStyle = 'bg-amber-50 border-amber-400 text-amber-900';
                  } else if (val !== null) {
                    cellStyle = 'bg-white border-slate-300 text-slate-900';
                  }
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        dp[{idx}]
                      </span>
                      <div
                        className={`w-full py-3 rounded-lg border text-center font-mono font-bold text-sm tabular-nums ${cellStyle}`}
                      >
                        {val === null ? '—' : val}
                      </div>
                      <span className="text-[10px] text-slate-500 h-4">
                        {isActive ? 'Есептелді' : isDep ? 'Қосылады' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Synchronized Python Code Trace */}
          <div className="border-t border-slate-200 pt-4">
            <div className="text-xs font-medium text-slate-500 mb-2">
              Орындалып жатқан Python коды
            </div>
            <div className="bg-slate-900 rounded-lg p-3.5 font-mono text-xs sm:text-sm space-y-0.5 overflow-x-auto">
              {ALGO_CODE[algo].map((line, idx) => {
                const active = currentStep.activeLine === idx;
                return (
                  <div
                    key={idx}
                    className={`px-2.5 py-1 rounded flex items-center gap-3 ${
                      active ? 'bg-blue-600/30 text-white' : 'text-slate-400'
                    }`}
                  >
                    <span className="w-4 text-right text-slate-600 select-none tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right Control & Variable Deck (35%) */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {/* Parameters */}
          <div className="space-y-4">
            <h2 className="text-base font-display font-bold text-slate-900">
              Баптау және басқару
            </h2>

            {algo === 'bubble' && (
              <button
                type="button"
                onClick={randomizeBubble}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <Shuffle className="w-4 h-4" />
                Жаңа кездейсоқ массив
              </button>
            )}

            {algo === 'binary' && (
              <div className="space-y-1.5">
                <label htmlFor="target-input" className="block text-xs font-medium text-slate-600">
                  Ізделетін сан (target):
                </label>
                <div className="flex gap-2">
                  <input
                    id="target-input"
                    type="number"
                    value={binaryTarget}
                    onChange={(e) => setBinaryTarget(Number(e.target.value))}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setBinaryTarget(binaryArr[Math.floor(Math.random() * binaryArr.length)])
                    }
                    className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer"
                  >
                    Массивтен
                  </button>
                </div>
              </div>
            )}

            {algo === 'euclid' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="euclid-a" className="block text-xs font-medium text-slate-600 mb-1">
                    A саны:
                  </label>
                  <input
                    id="euclid-a"
                    type="number"
                    min={1}
                    max={99999}
                    value={euclidA}
                    onChange={(e) => setEuclidA(Number(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="euclid-b" className="block text-xs font-medium text-slate-600 mb-1">
                    B саны:
                  </label>
                  <input
                    id="euclid-b"
                    type="number"
                    min={1}
                    max={99999}
                    value={euclidB}
                    onChange={(e) => setEuclidB(Number(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>
            )}

            {algo === 'dp' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium text-slate-600">
                  <label htmlFor="dp-n-slider">Баспалдақ саны (N):</label>
                  <span className="font-mono text-slate-900 tabular-nums">{dpN} саты</span>
                </div>
                <input
                  id="dp-n-slider"
                  type="range"
                  min={3}
                  max={10}
                  step={1}
                  value={dpN}
                  onChange={(e) => setDpN(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className="space-y-4 border-t border-slate-200 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (stepIdx >= steps.length - 1) setStepIdx(0);
                  setIsPlaying((p) => !p);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Кідірту' : 'Ойнату'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setStepIdx(0);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Басына
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={stepIdx === 0}
                onClick={() => {
                  setIsPlaying(false);
                  setStepIdx((p) => Math.max(0, p - 1));
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <SkipBack className="w-3.5 h-3.5" />
                Артқа
              </button>
              <button
                type="button"
                disabled={stepIdx >= steps.length - 1}
                onClick={() => {
                  setIsPlaying(false);
                  setStepIdx((p) => Math.min(steps.length - 1, p + 1));
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Келесі қадам
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Labeled Speed Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-slate-600">
                <label htmlFor="speed-slider">Жылдамдық:</label>
                <span className="font-mono text-slate-900 tabular-nums">{speed.toFixed(1)}x</span>
              </div>
              <input
                id="speed-slider"
                type="range"
                min={0.5}
                max={2.5}
                step={0.5}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Live Variables Inspector */}
          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-500">Айнымалылар күйі</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(currentStep.variables).map(([k, v]) => (
                <div
                  key={k}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-mono text-slate-600">{k}</span>
                  <span className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
