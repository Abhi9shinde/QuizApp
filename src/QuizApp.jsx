import { useState, useEffect } from "react";
import { Clock, CheckCircle, History, Award } from "lucide-react";
import questionData from './questions.json'

const QuizApp = () => {
    const [questions] = useState(questionData);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [score, setScore] = useState(0);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [attempts, setAttempts] = useState([]);
    const [timeLeft, setTimeLeft] = useState(30);
    const [quizStarted, setQuizStarted] = useState(false);
    const [userInput, setUserInput] = useState("");
    const [showHistory, setShowHistory] = useState(false);
    const [db, setDb] = useState(null);
    const [feedback, setFeedback] = useState(null);

    // Initialize IndexedDB
    useEffect(() => {
        const request = indexedDB.open("QuizDatabase", 1);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("attempts")) {
                db.createObjectStore("attempts", { keyPath: "timestamp" });
            }
        };

        request.onsuccess = (event) => {
            setDb(event.target.result);
            loadAttemptsFromDB(event.target.result);
        };
    }, []);

    const loadAttemptsFromDB = async (database) => {
        const transaction = database.transaction(["attempts"], "readonly");
        const store = transaction.objectStore("attempts");
        const request = store.getAll();

        request.onsuccess = () => {
            setAttempts(request.result);
        };
    };

    useEffect(() => {
        let timer;
        if (quizStarted && timeLeft > 0 && !quizCompleted) {
            timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        handleTimeout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [quizStarted, timeLeft, quizCompleted]);

    const handleTimeout = () => {
        setFeedback({
            correct: false,
            message: "Time's up!"
        });
        setTimeout(() => {
            setFeedback(null);
            if (currentQuestion < questions.length - 1) {
                setCurrentQuestion(prev => prev + 1);
                setTimeLeft(30);
                setSelectedAnswer(null);
                setUserInput("");
            } else {
                setQuizCompleted(true);
                saveAttempt();
            }
        }, 1000);
    };

    const handleAnswer = (answer) => {
        setSelectedAnswer(answer);
        const isCorrect = answer === questions[currentQuestion].correctAnswer;
        // setFeedback({
        //     correct: isCorrect,
        //     message: isCorrect ? "Correct!" : "Incorrect!"
        // });
        if (isCorrect) {
            setScore((prev) => prev + 1);
        }
        setTimeout(() => {
            setFeedback(null);
            nextQuestion();
        }, 1000);
    };

    const handleInputSubmit = () => {
        const isCorrect = userInput.trim().toLowerCase() === questions[currentQuestion].correctAnswer.toLowerCase();
        setFeedback({
            correct: isCorrect,
            message: isCorrect ? "Correct!" : "Incorrect!"
        });
        if (isCorrect) {
            setScore((prev) => prev + 1);
        }
        setTimeout(() => {
            setFeedback(null);
            nextQuestion();
        }, 1000);
    };

    const nextQuestion = () => {
        if (currentQuestion + 1 < questions.length) {
            setCurrentQuestion(currentQuestion + 1);
            setSelectedAnswer(null);
            setTimeLeft(30);
            setUserInput("");
        } else {
            setQuizCompleted(true);
            saveAttempt(score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0));
        }
    };

    const saveAttempt = (finalScore) => {
        const percentage = ((finalScore / questions.length) * 100).toFixed(1);
        const newAttempt = {
            score: finalScore,
            totalQuestions: questions.length,
            timestamp: new Date().toISOString(),
            formattedTime: new Date().toLocaleString(),
            percentage: percentage
        };

        // Save to IndexedDB
        if (db) {
            const transaction = db.transaction(["attempts"], "readwrite");
            const store = transaction.objectStore("attempts");
            { console.log("Saving attempt:", newAttempt) }
            store.add(newAttempt);

            transaction.oncomplete = () => {
                loadAttemptsFromDB(db);
            };
        }
    };

    const startQuiz = () => {
        setQuizStarted(true);
        setTimeLeft(30);
        setCurrentQuestion(0);
        setScore(1);
        setSelectedAnswer(null);
        setQuizCompleted(false);
        setUserInput("");
        setShowHistory(false);
    };

    const renderQuestion = () => {
        const currentQ = questions[currentQuestion];
        if (!currentQ) return null;

        return (
            <div className="mt-4">
                {feedback && (
                    <div className={`p-3 mb-4 rounded-lg text-white text-center ${feedback.correct ? 'bg-green-500' : 'bg-red-500'}`}>
                        {feedback.message}
                    </div>
                )}
                {currentQ.answers ? (
                    currentQ.answers.map((option, index) => (
                        <button
                            key={index}
                            onClick={() => handleAnswer(option)}
                            className={`w-full p-3 mt-2 text-lg rounded-lg ${selectedAnswer === option
                                ? (option === currentQ.correctAnswer
                                    ? 'bg-green-500 text-white'
                                    : 'bg-red-500 text-white')
                                : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                            disabled={selectedAnswer !== null}
                        >
                            {option}
                        </button>
                    ))
                ) : (
                    <div className="mt-4">
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className="w-full p-3 border rounded-lg"
                            placeholder="Type your answer"
                        />
                        <button
                            onClick={handleInputSubmit}
                            className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg"
                        >
                            Submit
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderAttemptHistory = () => (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Attempt History</h2>
                <button
                    onClick={() => setShowHistory(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                >
                    Back
                </button>
            </div>
            {attempts.length === 0 ? (
                <p className="text-center text-gray-500">No attempts yet</p>
            ) : (
                <div className="space-y-4">
                    {attempts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).map((attempt, index) => (
                        <div key={attempt.timestamp} className="p-4 border rounded-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold">Attempt #{attempts.length - index}</p>
                                    <p className="text-sm text-gray-500">{attempt.formattedTime}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">{parseFloat(attempt.percentage).toFixed(1)}%</p>
                                    <p className="text-sm text-gray-500">
                                        {attempt.score}/{attempt.totalQuestions} correct
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    if (showHistory) {
        return renderAttemptHistory();
    }

    if (!quizStarted && !quizCompleted) {
        return (
            <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg">
                <h1 className="text-4xl font-bold text-center">Interactive Quiz Challenge</h1>
                <p className="text-center mt-4">{questions.length} questions - 30 seconds per question</p>
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={startQuiz}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white text-lg rounded-lg"
                    >
                        Start Quiz
                    </button>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="flex-1 px-6 py-3 bg-gray-600 text-white text-lg rounded-lg flex items-center justify-center gap-2"
                    >
                        <History className="w-5 h-5" />
                        View History
                    </button>
                </div>
            </div>
        );
    }

    if (quizCompleted) {
        return (
            <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg text-center">
                <Award className="w-16 h-16 text-yellow-500 mx-auto" />
                <h2 className="text-3xl font-bold mt-4">Quiz Completed!</h2>
                <p className="text-xl mt-4">
                    Score: {score - 1} / {questions.length} ({(((score - 1) / questions.length) * 100).toFixed(1)}%)
                </p>
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={startQuiz}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => setShowHistory(true)}
                        className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg flex items-center justify-center gap-2"
                    >
                        <History className="w-5 h-5" />
                        View History
                    </button>

                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-8 bg-white rounded-xl shadow-lg">
            <div className="flex justify-between items-center">
                <p>Question {currentQuestion + 1} / {questions.length}</p>
                <div className="flex items-center space-x-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className={timeLeft <= 10 ? "text-red-500" : "text-blue-600"}>
                        {timeLeft}s
                    </span>
                </div>
            </div>
            <h2 className="text-2xl font-semibold mt-6">
                {questions[currentQuestion]?.question}
            </h2>
            {renderQuestion()}
        </div>
    );
};

export default QuizApp;