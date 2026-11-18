export type NavTab = 'curriculum' | 'lab' | 'visualizer' | 'olympiad' | 'progress';

export type Difficulty = 'Бастауыш' | 'Орташа' | 'Олимпиада';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonExample {
  title: string;
  code: string;
  stdin?: string;
  explanation: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  order: number;
  title: string;
  durationMinutes: number;
  gradeRange: string;
  summary: string;
  theoryBlocks: {
    heading: string;
    body: string;
    codeSnippet?: string;
  }[];
  example: LessonExample;
  practiceTask: {
    title: string;
    prompt: string;
    starterCode: string;
    testCases: TestCase[];
  };
  quiz: QuizQuestion;
}

export interface CourseModule {
  id: string;
  order: number;
  title: string;
  gradeRange: string;
  description: string;
  imageUrl: string;
  lessons: Lesson[];
}

export interface OlympiadProblem {
  id: string;
  code: string;
  title: string;
  difficulty: Difficulty;
  gradeRange: string;
  topic: string;
  timeLimitMs: number;
  points: number;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  hint: string;
  starterCode: string;
  solutionCode: string;
  testCases: TestCase[];
}

export interface StudentProgress {
  completedLessons: string[];
  solvedProblems: string[];
  quizScores: Record<string, boolean>;
  lastActiveLessonId: string;
}

export interface RunResult {
  success: boolean;
  output: string;
  error?: string;
  errorLine?: number;
  executionTimeMs: number;
}

export interface TestCaseResult {
  testId: string;
  index: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
  isHidden?: boolean;
  executionTimeMs: number;
}
