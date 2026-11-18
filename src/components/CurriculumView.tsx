import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Code2, Play, Terminal } from 'lucide-react';
import { useState } from 'react';
import { COURSE_MODULES, HERO_IMAGE_URL, OLYMPIAD_PROBLEMS } from '../data/curriculum';
import { runPython } from '../engine/pythonRunner';
import type { Lesson, StudentProgress } from '../types';

interface CurriculumViewProps {
  progress: StudentProgress;
  selectedLessonId: string | null;
  onSelectLesson: (lessonId: string | null) => void;
  onOpenInLab: (starterCode: string, taskContext: { type: 'lesson'; lesson: Lesson }) => void;
  onOpenFreeLab: (code: string, stdin?: string) => void;
  onGoToOlympiad: () => void;
  onToggleLessonComplete: (lessonId: string) => void;
  onRecordQuizAnswer: (quizId: string, isCorrect: boolean) => void;
}

export function CurriculumView({
  progress,
  selectedLessonId,
  onSelectLesson,
  onOpenInLab,
  onOpenFreeLab,
  onGoToOlympiad,
  onToggleLessonComplete,
  onRecordQuizAnswer,
}: CurriculumViewProps) {
  const [heroImgError, setHeroImgError] = useState(false);
  const [modImgErrors, setModImgErrors] = useState<Record<string, boolean>>({});
  const [inlineOutput, setInlineOutput] = useState<{ lessonId: string; output: string; error?: string } | null>(null);
  const [selectedQuizOption, setSelectedQuizOption] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});

  const allLessons = COURSE_MODULES.flatMap((m) => m.lessons);
  const activeLesson = selectedLessonId ? allLessons.find((l) => l.id === selectedLessonId) ?? null : null;
  const activeModule = activeLesson ? COURSE_MODULES.find((m) => m.id === activeLesson.moduleId) ?? null : null;

  const handleRunExample = (lesson: Lesson) => {
    const res = runPython(lesson.example.code, lesson.example.stdin ?? '');
    setInlineOutput({
      lessonId: lesson.id,
      output: res.output || '(Шығыс жоқ)',
      error: res.error,
    });
  };

  if (activeLesson && activeModule) {
    const lessonIdx = allLessons.findIndex((l) => l.id === activeLesson.id);
    const prevLesson = lessonIdx > 0 ? allLessons[lessonIdx - 1] : null;
    const nextLesson = lessonIdx < allLessons.length - 1 ? allLessons[lessonIdx + 1] : null;
    const isCompleted = progress.completedLessons.includes(activeLesson.id);
    const quizId = activeLesson.quiz.id;
    const chosen = selectedQuizOption[quizId];
    const submitted = quizSubmitted[quizId];
    const isQuizCorrect = chosen === activeLesson.quiz.correctIndex;

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb & Back */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => onSelectLesson(null)}
              className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Барлық модулдер
            </button>
            <span aria-hidden="true">/</span>
            <span className="truncate max-w-[220px] sm:max-w-none">{activeModule.title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
            <span>{activeLesson.gradeRange}</span>
            <span aria-hidden="true">·</span>
            <span>{activeLesson.durationMinutes} мин</span>
            <span aria-hidden="true">·</span>
            <span className={isCompleted ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
              {isCompleted ? 'Аяқталды' : 'Оқылуда'}
            </span>
          </div>
        </div>

        {/* Lesson Header */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 text-balance">
            {activeLesson.order}. {activeLesson.title}
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
            {activeLesson.summary}
          </p>
        </div>

        {/* Theory Blocks */}
        <div className="space-y-6">
          {activeLesson.theoryBlocks.map((block, idx) => (
            <section
              key={idx}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <h2 className="text-lg font-display font-semibold text-slate-900">
                {block.heading}
              </h2>
              <p className="text-slate-700 leading-relaxed text-[15px]">
                {block.body}
              </p>
              {block.codeSnippet && (
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm font-mono overflow-x-auto leading-relaxed">
                  <code>{block.codeSnippet}</code>
                </pre>
              )}
            </section>
          ))}
        </div>

        {/* Interactive Runnable Example */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-blue-600 mb-1">Интерактивті мысал</div>
              <h2 className="text-lg font-display font-semibold text-slate-900">
                {activeLesson.example.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleRunExample(activeLesson)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                Мысалды іске қосу
              </button>
              <button
                type="button"
                onClick={() => onOpenFreeLab(activeLesson.example.code, activeLesson.example.stdin)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Code2 className="w-4 h-4" />
                Редакторда ашу
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm font-mono overflow-x-auto leading-relaxed h-full">
                <code>{activeLesson.example.code}</code>
              </pre>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              {activeLesson.example.stdin && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Кіріс (Stdin)</div>
                  <pre className="text-xs font-mono text-slate-800 bg-white border border-slate-200 rounded p-2 whitespace-pre-wrap">
                    {activeLesson.example.stdin}
                  </pre>
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Түсіндірме</div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activeLesson.example.explanation}
                </p>
              </div>
              {inlineOutput && inlineOutput.lessonId === activeLesson.id && (
                <div>
                  <div className="text-xs font-medium text-emerald-700 mb-1 flex items-center gap-1">
                    <Terminal className="w-3.5 h-3.5" />
                    Нәтиже
                  </div>
                  <pre className="text-xs font-mono bg-slate-900 text-emerald-300 rounded p-2.5 whitespace-pre-wrap">
                    {inlineOutput.error ? inlineOutput.error : inlineOutput.output}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Practice Task Launch */}
        <section className="bg-slate-900 text-white rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-blue-300">Практикалық тапсырма</div>
            <h2 className="text-lg font-display font-semibold">{activeLesson.practiceTask.title}</h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {activeLesson.practiceTask.prompt}
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onOpenInLab(activeLesson.practiceTask.starterCode, {
                type: 'lesson',
                lesson: activeLesson,
              })
            }
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-slate-900 bg-white rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer whitespace-nowrap"
          >
            <Code2 className="w-4 h-4" />
            Код жазып тексеру
          </button>
        </section>

        {/* Quick Comprehension Quiz */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-500">Өзін-өзі тексеру сұрағы</div>
            <h2 className="text-base font-display font-semibold text-slate-900">
              {activeLesson.quiz.question}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeLesson.quiz.options.map((opt, idx) => {
              const isSelected = chosen === idx;
              const isCorrectOption = idx === activeLesson.quiz.correctIndex;
              let btnStyle = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
              if (submitted) {
                if (isCorrectOption) {
                  btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-900';
                } else if (isSelected && !isCorrectOption) {
                  btnStyle = 'border-rose-400 bg-rose-50 text-rose-900';
                }
              } else if (isSelected) {
                btnStyle = 'border-blue-600 bg-blue-50 text-blue-900';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (submitted) return;
                    setSelectedQuizOption((prev) => ({ ...prev, [quizId]: idx }));
                  }}
                  className={`text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${btnStyle}`}
                >
                  <span className="font-mono text-xs mr-2 text-slate-400">{idx + 1}.</span>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={chosen === undefined || submitted}
                onClick={() => {
                  setQuizSubmitted((prev) => ({ ...prev, [quizId]: true }));
                  onRecordQuizAnswer(quizId, chosen === activeLesson.quiz.correctIndex);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Жауапты тексеру
              </button>
              {submitted && (
                <span className={`text-sm font-medium ${isQuizCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {isQuizCorrect ? 'Дұрыс жауап' : 'Қайта қарап шығыңыз'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => onToggleLessonComplete(activeLesson.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                isCompleted
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isCompleted ? 'Сабақ аяқталды' : 'Аяқталды деп белгілеу'}
            </button>
          </div>

          {submitted && (
            <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
              {activeLesson.quiz.explanation}
            </p>
          )}
        </section>

        {/* Lesson Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {prevLesson ? (
            <button
              type="button"
              onClick={() => onSelectLesson(prevLesson.id)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Алдыңғы: {prevLesson.title}
            </button>
          ) : (
            <div />
          )}
          {nextLesson && (
            <button
              type="button"
              onClick={() => onSelectLesson(nextLesson.id)}
              className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              Келесі: {nextLesson.title}
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 py-2">
          <div className="text-sm font-medium text-blue-600">
            7–11 сынып · Python және олимпиадалық информатика зертханасы
          </div>
          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-slate-900 tracking-tight leading-[1.12] text-balance">
            Мектеп оқушыларына арналған интерактивті программалау платформасы
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
            Алғашқы Python командаларынан бастап аудандық және облыстық олимпиада есептеріне дейін. Кодты тікелей браузерде іске қосып, алгоритмдердің жұмысын қадамдап бақылаңыз.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => onSelectLesson(progress.lastActiveLessonId || 'l-io-vars')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              Оқуды бастау
            </button>
            <button
              type="button"
              onClick={onGoToOlympiad}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              Олимпиада есептерін көру
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-slate-200 bg-white">
            {!heroImgError ? (
              <img
                src={HERO_IMAGE_URL}
                alt="Информатика және алгоритмдік оқу зертханасы"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="w-full h-full lg:h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-slate-100 text-slate-600">
                <Code2 className="w-12 h-12 text-blue-600 mb-3" />
                <span className="font-display font-semibold text-slate-900">InfoPy Lab Studio</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Full-Width 4-Column Stat Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tabular-nums">
            {COURSE_MODULES.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Оқу модулі (7–11 сынып)</div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tabular-nums">
            {allLessons.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Интерактивті сабақ және тест</div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-slate-900 tabular-nums">
            {OLYMPIAD_PROBLEMS.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Автоматты тексерілетін есеп</div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="text-2xl sm:text-3xl font-display font-bold text-blue-600 tabular-nums">
            {progress.completedLessons.length}/{allLessons.length}
          </div>
          <div className="text-sm text-slate-600 mt-1">Аяқталған сабақтар</div>
        </div>
      </section>

      {/* Course Modules Section */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Оқу бағдарламасы мен модулдер
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Әр сабақ теория, тікелей іске қосылатын мысал, код жазу тапсырмасы және бақылау сұрағынан тұрады.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {COURSE_MODULES.map((mod) => {
            const doneCount = mod.lessons.filter((l) =>
              progress.completedLessons.includes(l.id)
            ).length;
            const pct = Math.round((doneCount / mod.lessons.length) * 100);

            return (
              <article
                key={mod.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="h-44 bg-slate-100 border-b border-slate-200 overflow-hidden">
                  {!modImgErrors[mod.id] ? (
                    <img
                      src={mod.imageUrl}
                      alt={mod.title}
                      referrerPolicy="no-referrer"
                      onError={() => setModImgErrors((p) => ({ ...p, [mod.id]: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span>{mod.gradeRange}</span>
                      <span aria-hidden="true">·</span>
                      <span>{mod.lessons.length} сабақ</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-blue-600 font-medium">{pct}% орындалды</span>
                    </div>
                    <h3 className="text-xl font-display font-bold text-slate-900">
                      {mod.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  {/* Clean Lesson Links inside Module */}
                  <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                    {mod.lessons.map((lesson) => {
                      const done = progress.completedLessons.includes(lesson.id);
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => onSelectLesson(lesson.id)}
                          className="w-full py-3 flex items-center justify-between gap-4 text-left hover:bg-slate-50 px-2 -mx-2 rounded-lg transition-colors cursor-pointer group"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                              {lesson.order}. {lesson.title}
                            </div>
                            <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                              {lesson.durationMinutes} мин · {lesson.practiceTask.title}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {done ? (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                Дайын
                              </span>
                            ) : (
                              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
