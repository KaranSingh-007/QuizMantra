import { useState, useEffect, useCallback } from "react";

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   color: "bg-green-600 hover:bg-green-500",  badge: "bg-green-900/50 text-green-300 border-green-700" },
  medium: { label: "Medium", color: "bg-yellow-600 hover:bg-yellow-500", badge: "bg-yellow-900/50 text-yellow-300 border-yellow-700" },
  hard:   { label: "Hard",   color: "bg-red-600 hover:bg-red-500",      badge: "bg-red-900/50 text-red-300 border-red-700" },
};

const QUESTION_COUNTS = [10, 20, 30];
const TIMER_SECONDS = 20;

export default function App() {
  const [file, setFile] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(10);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [showScore, setShowScore] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [error, setError] = useState("");
  const [reviewData, setReviewData] = useState([]);

  const handleAnswer = useCallback(
    (selected) => {
      if (isAnswered) return;
      setIsAnswered(true);
      setSelectedOption(selected);

      const correct = questions[currentQ]?.answer;
      const isCorrect =
        selected?.trim().toLowerCase() === correct?.trim().toLowerCase();

      if (isCorrect) setScore((prev) => prev + 1);

      setReviewData((prev) => [
        ...prev,
        {
          question: questions[currentQ].question,
          options: questions[currentQ].options,
          selected,
          correct,
          skipped: selected === null,
        },
      ]);

      const next = currentQ + 1;
      setTimeout(() => {
        if (next < questions.length) {
          setCurrentQ(next);
          setTimeLeft(TIMER_SECONDS);
          setIsAnswered(false);
          setSelectedOption(null);
        } else {
          setShowScore(true);
        }
      }, 1000);
    },
    [isAnswered, questions, currentQ]
  );

  useEffect(() => {
    if (showScore || questions.length === 0 || isAnswered) return;
    if (timeLeft === 0) { handleAnswer(null); return; }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, showScore, questions.length, isAnswered, handleAnswer]);

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("difficulty", difficulty);
    formData.append("num_questions", String(numQuestions));

    try {
      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); return; }
      if (!Array.isArray(data.mcqs) || data.mcqs.length === 0) {
        setError("No questions were generated. Try a different file.");
        return;
      }
      setQuestions(data.mcqs);
      setReviewData([]);
      setCurrentQ(0);
      setScore(0);
      setShowScore(false);
      setShowReview(false);
      setTimeLeft(TIMER_SECONDS);
      setIsAnswered(false);
      setSelectedOption(null);
    } catch {
      setError("Could not connect to server. Make sure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const restartQuiz = () => {
    setQuestions([]);
    setReviewData([]);
    setCurrentQ(0);
    setScore(0);
    setShowScore(false);
    setShowReview(false);
    setTimeLeft(TIMER_SECONDS);
    setIsAnswered(false);
    setSelectedOption(null);
    setFile(null);
    setError("");
  };

  const getOptionStyle = (opt) => {
    if (!isAnswered) return "bg-blue-600 hover:bg-blue-500 cursor-pointer";
    const correct = questions[currentQ]?.answer;
    const isCorrect = opt?.trim().toLowerCase() === correct?.trim().toLowerCase();
    const isSelected = opt === selectedOption;
    if (isCorrect) return "bg-green-600";
    if (isSelected && !isCorrect) return "bg-red-600";
    return "bg-gray-600 opacity-40";
  };

  const progress = (currentQ / questions.length) * 100;

  // ── Review screen ──────────────────────────────────────────
  if (showReview) {
    const wrongCount = reviewData.filter(
      (r) => r.selected?.trim().toLowerCase() !== r.correct?.trim().toLowerCase()
    ).length;
    const correctCount = reviewData.length - wrongCount;
    const diffCfg = DIFFICULTY_CONFIG[difficulty];

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
        <div className="bg-gray-800 w-full max-w-lg p-6 rounded-2xl shadow-2xl">
          <div className="text-center mb-5">
            <h1 className="text-2xl font-bold text-blue-400">QuizMantra 🧠</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${diffCfg.badge}`}>
                {diffCfg.label}
              </span>
              <span className="text-xs text-gray-400">{reviewData.length} questions</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-700 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Score</p>
              <p className="text-xl font-bold">{score} / {questions.length}</p>
            </div>
            <div className="bg-green-900/40 rounded-xl p-3 text-center">
              <p className="text-xs text-green-400 mb-1">Correct</p>
              <p className="text-xl font-bold text-green-400">{correctCount}</p>
            </div>
            <div className="bg-red-900/40 rounded-xl p-3 text-center">
              <p className="text-xs text-red-400 mb-1">Wrong / skipped</p>
              <p className="text-xl font-bold text-red-400">{wrongCount}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-1">
            {reviewData.map((item, idx) => {
              const isCorrect =
                item.selected?.trim().toLowerCase() === item.correct?.trim().toLowerCase();
              return (
                <div key={idx} className="bg-gray-700 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span
                      className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect ? "bg-green-500 text-white" : "bg-red-500 text-white"
                      }`}
                    >
                      {isCorrect ? "✓" : "✗"}
                    </span>
                    <p className="text-sm font-semibold leading-snug">
                      Q{idx + 1}. {item.question}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-9">
                    {item.options.map((opt, oIdx) => {
                      const isThisCorrect =
                        opt.trim().toLowerCase() === item.correct.trim().toLowerCase();
                      const isThisSelected = opt === item.selected;
                      let style = "text-sm px-3 py-2 rounded-lg border text-left ";
                      if (isThisCorrect)
                        style += "bg-green-900/50 border-green-600 text-green-300";
                      else if (isThisSelected && !isThisCorrect)
                        style += "bg-red-900/50 border-red-600 text-red-300";
                      else
                        style += "bg-gray-600/40 border-gray-600 text-gray-400";
                      return (
                        <div key={oIdx} className={style}>
                          {opt}
                          {isThisSelected && isThisCorrect && (
                            <span className="ml-2 text-xs text-green-400 font-medium">✓ your answer · correct</span>
                          )}
                          {isThisSelected && !isThisCorrect && (
                            <span className="ml-2 text-xs text-red-400 font-medium">✗ your answer</span>
                          )}
                          {!isThisSelected && isThisCorrect && (
                            <span className="ml-2 text-xs text-green-400 font-medium">← correct answer</span>
                          )}
                        </div>
                      );
                    })}
                    {item.skipped && (
                      <p className="text-xs text-yellow-400 mt-1">⏰ Time ran out — skipped</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowReview(false)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg transition text-sm"
            >
              ← Back to score
            </button>
            <button
              onClick={restartQuiz}
              className="flex-1 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg transition text-sm"
            >
              New quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-black text-white p-4">
      <div className="bg-gray-800 w-full max-w-md p-6 rounded-2xl shadow-2xl text-center">
        <h1 className="text-3xl font-bold text-blue-400 mb-6">QuizMantra 🧠</h1>

        {/* ── Upload / config screen ── */}
        {questions.length === 0 && (
          <div className="flex flex-col gap-5">

            {/* File upload */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 text-left">
                Upload file <span className="text-gray-500">(PDF or DOCX)</span>
              </label>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => { setFile(e.target.files[0]); setError(""); }}
                disabled={isLoading}
                className="w-full bg-gray-700 p-2 rounded-lg text-sm"
              />
              {file && (
                <p className="text-xs text-gray-400 mt-1 text-left">
                  📄 {file.name}
                </p>
              )}
            </div>

            {/* Difficulty selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 text-left">
                Difficulty
              </label>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setDifficulty(key)}
                    className={`py-2 rounded-lg text-sm font-medium transition border-2 ${
                      difficulty === key
                        ? `${cfg.color} border-white/30`
                        : "bg-gray-700 hover:bg-gray-600 border-transparent"
                    }`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question count selector */}
            <div>
              <label className="block text-sm text-gray-400 mb-2 text-left">
                Number of questions
              </label>
              <div className="grid grid-cols-3 gap-2">
                {QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => setNumQuestions(count)}
                    className={`py-2 rounded-lg text-sm font-medium transition border-2 ${
                      numQuestions === count
                        ? "bg-blue-600 border-white/30"
                        : "bg-gray-700 hover:bg-gray-600 border-transparent"
                    }`}
                  >
                    {count} Qs
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleUpload}
              disabled={isLoading || !file}
              className="bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg transition disabled:opacity-50 font-medium"
            >
              {isLoading ? "Generating Quiz..." : "Generate Quiz"}
            </button>

            {isLoading && (
              <p className="text-xs text-gray-400">
                Generating {numQuestions} {DIFFICULTY_CONFIG[difficulty].label.toLowerCase()} questions…
              </p>
            )}
          </div>
        )}

        {/* ── Score screen ── */}
        {showScore && (
          <div>
            <div className="flex justify-center mb-3">
              <span className={`text-xs px-3 py-1 rounded-full border ${DIFFICULTY_CONFIG[difficulty].badge}`}>
                {DIFFICULTY_CONFIG[difficulty].label} · {questions.length} questions
              </span>
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {score} / {questions.length}
            </h2>
            <p className="text-gray-400 mb-6">
              Accuracy: {((score / questions.length) * 100).toFixed(1)}%
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowReview(true)}
                className="bg-yellow-600 hover:bg-yellow-500 px-5 py-2 rounded-lg transition text-sm"
              >
                Review Answers
              </button>
              <button
                onClick={restartQuiz}
                className="bg-green-600 hover:bg-green-500 px-5 py-2 rounded-lg transition text-sm"
              >
                New Quiz
              </button>
            </div>
          </div>
        )}

        {/* ── Active quiz screen ── */}
        {questions.length > 0 && !showScore && (
          <div>
            {/* Header row: question count + difficulty badge + timer */}
            <div className="flex justify-between items-center text-sm mb-2 text-gray-300">
              <span>Q {currentQ + 1} / {questions.length}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFFICULTY_CONFIG[difficulty].badge}`}>
                {DIFFICULTY_CONFIG[difficulty].label}
              </span>
              <span className={timeLeft <= 5 ? "text-red-400 font-bold" : "text-gray-300"}>
                ⏱️ {timeLeft}s
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-700 h-2 rounded-full mb-6 overflow-hidden">
              <div
                className="bg-blue-500 h-2 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <h2 className="text-xl font-semibold mb-6 text-left">
              {questions[currentQ]?.question}
            </h2>

            <div className="flex flex-col gap-3">
              {questions[currentQ]?.options.map((opt, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(opt)}
                  disabled={isAnswered}
                  className={`${getOptionStyle(opt)} py-3 px-4 rounded-lg transition disabled:cursor-not-allowed text-left`}
                >
                  {opt}
                </button>
              ))}
            </div>

            {isAnswered && selectedOption === null && (
              <p className="mt-4 text-yellow-400 text-sm">⏰ Time's up!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}