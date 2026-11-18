import { useEffect, useState } from 'react';
import { CodeLabView, type LabTaskContext } from './components/CodeLabView';
import { CurriculumView } from './components/CurriculumView';
import { OlympiadBankView } from './components/OlympiadBankView';
import { ProgressView } from './components/ProgressView';
import { TopNav } from './components/TopNav';
import { VisualizerView } from './components/VisualizerView';
import { OLYMPIAD_PROBLEMS } from './data/curriculum';
import type { NavTab, OlympiadProblem, StudentProgress } from './types';

const STORAGE_KEY = 'infopy_olympiad_progress_v1';

const DEFAULT_PROGRESS: StudentProgress = {
  completedLessons: [],
  solvedProblems: [],
  quizScores: {},
  lastActiveLessonId: 'l-io-vars',
};

function loadProgress(): StudentProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<StudentProgress>;
    return {
      completedLessons: Array.isArray(parsed.completedLessons) ? parsed.completedLessons : [],
      solvedProblems: Array.isArray(parsed.solvedProblems) ? parsed.solvedProblems : [],
      quizScores: parsed.quizScores && typeof parsed.quizScores === 'object' ? parsed.quizScores : {},
      lastActiveLessonId:
        typeof parsed.lastActiveLessonId === 'string' ? parsed.lastActiveLessonId : 'l-io-vars',
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('curriculum');
  const [progress, setProgress] = useState<StudentProgress>(loadProgress);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const firstProblem = OLYMPIAD_PROBLEMS[0];
  const [labTask, setLabTask] = useState<LabTaskContext>({
    type: 'olympiad',
    problem: firstProblem,
  });
  const [labCode, setLabCode] = useState<string>(firstProblem.starterCode);
  const [labStdin, setLabStdin] = useState<string>(firstProblem.sampleInput);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Ignore storage quota errors
    }
  }, [progress]);

  const handleSelectLesson = (lessonId: string | null) => {
    setSelectedLessonId(lessonId);
    if (lessonId) {
      setProgress((prev) => ({ ...prev, lastActiveLessonId: lessonId }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleLessonComplete = (lessonId: string) => {
    setProgress((prev) => {
      const exists = prev.completedLessons.includes(lessonId);
      return {
        ...prev,
        completedLessons: exists
          ? prev.completedLessons.filter((id) => id !== lessonId)
          : [...prev.completedLessons, lessonId],
      };
    });
  };

  const handleMarkLessonComplete = (lessonId: string) => {
    setProgress((prev) => {
      if (prev.completedLessons.includes(lessonId)) return prev;
      return {
        ...prev,
        completedLessons: [...prev.completedLessons, lessonId],
      };
    });
  };

  const handleMarkProblemSolved = (problemId: string) => {
    setProgress((prev) => {
      if (prev.solvedProblems.includes(problemId)) return prev;
      return {
        ...prev,
        solvedProblems: [...prev.solvedProblems, problemId],
      };
    });
  };

  const handleRecordQuizAnswer = (quizId: string, isCorrect: boolean) => {
    setProgress((prev) => ({
      ...prev,
      quizScores: {
        ...prev.quizScores,
        [quizId]: isCorrect,
      },
    }));
  };

  const handleOpenProblemInLab = (problem: OlympiadProblem) => {
    setLabTask({ type: 'olympiad', problem });
    setLabCode(problem.starterCode);
    setLabStdin(problem.sampleInput);
    setActiveTab('lab');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'curriculum') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
        onStartPractice={() => {
          setActiveTab('lab');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <main className="flex-1">
        {activeTab === 'curriculum' && (
          <CurriculumView
            progress={progress}
            selectedLessonId={selectedLessonId}
            onSelectLesson={handleSelectLesson}
            onOpenInLab={(starterCode, ctx) => {
              setLabTask(ctx);
              setLabCode(starterCode);
              setLabStdin(ctx.lesson.practiceTask.testCases[0]?.input ?? '');
              setActiveTab('lab');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenFreeLab={(code, stdin = '') => {
              setLabTask({ type: 'free' });
              setLabCode(code);
              setLabStdin(stdin);
              setActiveTab('lab');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onGoToOlympiad={() => {
              setActiveTab('olympiad');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onToggleLessonComplete={handleToggleLessonComplete}
            onRecordQuizAnswer={handleRecordQuizAnswer}
          />
        )}

        {activeTab === 'lab' && (
          <CodeLabView
            taskContext={labTask}
            code={labCode}
            stdin={labStdin}
            progress={progress}
            onChangeCode={setLabCode}
            onChangeStdin={setLabStdin}
            onSelectTask={(ctx, starterCode, defaultStdin) => {
              setLabTask(ctx);
              setLabCode(starterCode);
              setLabStdin(defaultStdin);
            }}
            onMarkProblemSolved={handleMarkProblemSolved}
            onMarkLessonComplete={handleMarkLessonComplete}
          />
        )}

        {activeTab === 'visualizer' && <VisualizerView />}

        {activeTab === 'olympiad' && (
          <OlympiadBankView
            progress={progress}
            onSolveProblem={handleOpenProblemInLab}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            progress={progress}
            onResetProgress={() => setProgress(DEFAULT_PROGRESS)}
            onOpenLesson={(lessonId) => {
              setSelectedLessonId(lessonId);
              setActiveTab('curriculum');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSolveProblem={handleOpenProblemInLab}
          />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            InfoPy Lab · Мектеп оқушыларына арналған программалау және олимпиада зертханасы
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => {
                setSelectedLessonId(null);
                setActiveTab('curriculum');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-slate-800 cursor-pointer"
            >
              Курстар
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('lab')}
              className="hover:text-slate-800 cursor-pointer"
            >
              Код зертханасы
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('visualizer')}
              className="hover:text-slate-800 cursor-pointer"
            >
              Визуализатор
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('olympiad')}
              className="hover:text-slate-800 cursor-pointer"
            >
              Олимпиада
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
