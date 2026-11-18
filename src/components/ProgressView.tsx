import { CheckCircle2, Download, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { COURSE_MODULES, OLYMPIAD_PROBLEMS } from '../data/curriculum';
import type { OlympiadProblem, StudentProgress } from '../types';

interface ProgressViewProps {
  progress: StudentProgress;
  onResetProgress: () => void;
  onOpenLesson: (lessonId: string) => void;
  onSolveProblem: (problem: OlympiadProblem) => void;
}

export function ProgressView({
  progress,
  onResetProgress,
  onOpenLesson,
  onSolveProblem,
}: ProgressViewProps) {
  const [studentName, setStudentName] = useState('Оқушы');
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const allLessons = COURSE_MODULES.flatMap((m) => m.lessons);
  const completedCount = progress.completedLessons.length;
  const solvedCount = progress.solvedProblems.length;

  const quizEntries = Object.values(progress.quizScores);
  const quizCorrectCount = quizEntries.filter(Boolean).length;
  const quizPct =
    quizEntries.length > 0 ? Math.round((quizCorrectCount / quizEntries.length) * 100) : 0;

  const earnedPoints = OLYMPIAD_PROBLEMS.filter((p) =>
    progress.solvedProblems.includes(p.id)
  ).reduce((acc, p) => acc + p.points, 0);
  const totalPoints = OLYMPIAD_PROBLEMS.reduce((acc, p) => acc + p.points, 0);

  const handleDownloadReport = () => {
    const lines = [
      'InfoPy Lab — Оқушы үлгерімі туралы есеп',
      `Күні: ${new Date().toLocaleDateString('kk-KZ')}`,
      `Оқушы: ${studentName.trim() || 'Аты-жөні көрсетілмеген'}`,
      '----------------------------------------',
      `Аяқталған сабақтар: ${completedCount} / ${allLessons.length}`,
      `Шешілген олимпиада есептері: ${solvedCount} / ${OLYMPIAD_PROBLEMS.length}`,
      `Жиналған ұпай: ${earnedPoints} / ${totalPoints}`,
      `Тест сұрақтары дәлдігі: ${quizCorrectCount} / ${quizEntries.length} (${quizPct}%)`,
      '',
      'Модульдер бойынша:',
      ...COURSE_MODULES.map((m) => {
        const done = m.lessons.filter((l) => progress.completedLessons.includes(l.id)).length;
        return `- ${m.title}: ${done}/${m.lessons.length} сабақ`;
      }),
      '',
      'Шешілген олимпиада есептері:',
      ...OLYMPIAD_PROBLEMS.filter((p) => progress.solvedProblems.includes(p.id)).map(
        (p) => `- [${p.code}] ${p.title} (${p.points} ұпай)`
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'infopy-lab-progress.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Teacher Export */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
            Оқу үлгерімі және нәтижелер
          </h1>
          <p className="text-sm text-slate-600">
            Барлық аяқталған сабақтар мен шешілген есептер осы құрылғыда сақталады. Мұғалімге тапсыру үшін есепті жүктеп алуға болады.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            aria-label="Оқушының аты-жөні"
            placeholder="Оқушының аты-жөні"
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-2 focus:outline-blue-600"
          />
          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Есепті жүктеу
          </button>
          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            Нөлге түсіру
          </button>
        </div>
      </div>

      {/* Confirm Reset Inline Banner (no window.confirm) */}
      {confirmResetOpen && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-amber-950 font-medium">
            Барлық аяқталған сабақтар мен шешілген есептер тарихын өшіруді растайсыз ба?
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmResetOpen(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Бас тарту
            </button>
            <button
              type="button"
              onClick={() => {
                onResetProgress();
                setConfirmResetOpen(false);
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 cursor-pointer"
            >
              Иә, өшіру
            </button>
          </div>
        </div>
      )}

      {/* 4-Column Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tabular-nums">
            {completedCount}/{allLessons.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Аяқталған сабақтар</div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tabular-nums">
            {solvedCount}/{OLYMPIAD_PROBLEMS.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Олимпиада есептері</div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-blue-600 tabular-nums">
            {earnedPoints}/{totalPoints}
          </div>
          <div className="text-sm text-slate-600 mt-1">Олимпиада ұпайы</div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-700 tabular-nums">
            {quizPct}%
          </div>
          <div className="text-sm text-slate-600 mt-1">
            Тест дәлдігі ({quizCorrectCount}/{quizEntries.length})
          </div>
        </div>
      </section>

      {/* Module Breakdown */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-display font-bold text-slate-900">
          Модульдер бойынша орындалу барысы
        </h2>
        <div className="space-y-5">
          {COURSE_MODULES.map((mod) => {
            const done = mod.lessons.filter((l) =>
              progress.completedLessons.includes(l.id)
            ).length;
            const pct = Math.round((done / mod.lessons.length) * 100);
            return (
              <div key={mod.id} className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-900">{mod.title}</span>
                  <span className="font-mono text-xs text-slate-600 tabular-nums">
                    {done} / {mod.lessons.length} сабақ ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  {mod.lessons.map((lesson) => {
                    const isDone = progress.completedLessons.includes(lesson.id);
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => onOpenLesson(lesson.id)}
                        className={`text-xs font-medium inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                          isDone
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{lesson.order}. {lesson.practiceTask.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Olympiad Problems Status Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-display font-bold text-slate-900">
            Олимпиада есептерінің кестесі
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold">Код</th>
                <th className="py-3 px-4 font-semibold">Есеп атауы</th>
                <th className="py-3 px-4 font-semibold">Деңгейі</th>
                <th className="py-3 px-4 font-semibold">Ұпай</th>
                <th className="py-3 px-4 font-semibold">Күйі</th>
                <th className="py-3 px-4 font-semibold text-right">Әрекет</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {OLYMPIAD_PROBLEMS.map((p) => {
                const solved = progress.solvedProblems.includes(p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700 tabular-nums">
                      {p.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{p.title}</td>
                    <td className="py-3 px-4 text-slate-600 text-xs">{p.difficulty}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {p.points}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {solved ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Шешілді
                        </span>
                      ) : (
                        <span className="text-slate-400">Шешілмеген</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSolveProblem(p)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        {solved ? 'Ашу' : 'Шешу'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
