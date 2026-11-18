import { ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { OLYMPIAD_PROBLEMS } from '../data/curriculum';
import type { Difficulty, OlympiadProblem, StudentProgress } from '../types';

interface OlympiadBankViewProps {
  progress: StudentProgress;
  onSolveProblem: (problem: OlympiadProblem) => void;
}

const DIFFICULTY_FILTERS: ('Барлығы' | Difficulty)[] = [
  'Барлығы',
  'Бастауыш',
  'Орташа',
  'Олимпиада',
];

export function OlympiadBankView({ progress, onSolveProblem }: OlympiadBankViewProps) {
  const [difficultyFilter, setDifficultyFilter] = useState<'Барлығы' | Difficulty>('Барлығы');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return OLYMPIAD_PROBLEMS.filter((p) => {
      const matchesDiff = difficultyFilter === 'Барлығы' || p.difficulty === difficultyFilter;
      const matchesQuery =
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q);
      return matchesDiff && matchesQuery;
    });
  }, [difficultyFilter, searchQuery]);

  const earnedPoints = OLYMPIAD_PROBLEMS.filter((p) =>
    progress.solvedProblems.includes(p.id)
  ).reduce((acc, p) => acc + p.points, 0);

  const totalPoints = OLYMPIAD_PROBLEMS.reduce((acc, p) => acc + p.points, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
            Олимпиада есептерінің жинағы
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Мектепшілік, аудандық және облыстық информатика олимпиадаларына дайындық есептері. Әр есеп бірнеше ашық және жабық тесттермен тексеріледі.
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm tabular-nums shrink-0">
          <div>
            <span className="text-slate-500">Шешілгені: </span>
            <span className="font-bold text-slate-900">
              {progress.solvedProblems.length} / {OLYMPIAD_PROBLEMS.length}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Ұпай: </span>
            <span className="font-bold text-blue-600">
              {earnedPoints} / {totalPoints}
            </span>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {DIFFICULTY_FILTERS.map((df) => (
            <button
              key={df}
              type="button"
              onClick={() => setDifficultyFilter(df)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                difficultyFilter === df
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {df}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Тақырып немесе код бойынша іздеу..."
            aria-label="Есептерді іздеу"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-600"
          />
        </div>
      </div>

      {/* Problems List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <div className="text-base font-medium text-slate-900">Сәйкес есептер табылмады</div>
          <p className="text-sm text-slate-500">Іздеу сұрауын немесе деңгей сүзгісін өзгертіп көріңіз.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
          {filtered.map((problem) => {
            const solved = progress.solvedProblems.includes(problem.id);
            return (
              <div
                key={problem.id}
                className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                    <span className="font-mono font-semibold text-slate-700">{problem.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{problem.difficulty}</span>
                    <span aria-hidden="true">·</span>
                    <span>{problem.gradeRange}</span>
                    <span aria-hidden="true">·</span>
                    <span>{problem.topic}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">{problem.points} ұпай</span>
                  </div>
                  <h2 className="text-lg font-display font-bold text-slate-900">
                    {problem.title}
                  </h2>
                  <p className="text-sm text-slate-600 line-clamp-2 max-w-3xl">
                    {problem.statement}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {solved && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4" />
                      Шешілді
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onSolveProblem(problem)}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      solved
                        ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {solved ? 'Қайта қарау' : 'Шешу'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
