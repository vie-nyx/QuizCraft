import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Result from "./Result";
import "./exam.css";

export const ExamInterface = () => {
  const [student, setStudent] = useState(null); // Initialize state

  const [questions, setQuestions] = useState([]);
  const [testSchedule, setTestSchedule] = useState(null);

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState({});
  const [attempted, setAttempted] = useState([]);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [suspiciousActivity, setSuspiciousActivity] = useState(false);
  const [exitCount, setExitCount] = useState(0); // Track full-screen exits
  const navigate = useNavigate();
  const [showResult, setShowResult] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const timerRef = useRef(null);
  const [markedForReview, setMarkedForReview] = useState([]);
  // Function to enter full-screen mode
  const enterFullScreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen()
        .catch((err) => console.error("Error entering fullscreen:", err));
    }
  };
  useEffect(() => {
    const handlePopState = (e) => {
      // Prevent back navigation
      window.history.pushState(null, null, window.location.pathname);
    };
  
    // Push initial state
    window.history.pushState(null, null, window.location.pathname);
    window.addEventListener("popstate", handlePopState);
  
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);
  useEffect(() => {
    enterFullScreen(); // Enter full-screen on mount
  }, []);
  const suspiciousActivityRef = useRef(false);
  // Function to check full-screen status
  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !submitted) {
      // Check if the exam is not submitted
      setExitCount((prev) => prev + 1); // Track exits
      setSuspiciousActivity(true);
      alert(
        "Warning: You exited full-screen mode. Your attempt is marked as suspicious."
      );

      // Optionally force submit after multiple exits
      if (exitCount >= 2) {
        alert(
          "Multiple full-screen exits detected. Your exam is being auto-submitted."
        );
        handleSubmit();
      } else {
        enterFullScreen(); // Re-enter full-screen
      }
    }
  };

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [exitCount, submitted]);

  useEffect(() => {
    const storedStudent = sessionStorage.getItem("student");
    if (storedStudent) {
      setStudent(JSON.parse(storedStudent));
    } else {
      alert("Student details missing! Redirecting to login.");
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch("http://10.10.231.249:3002/get-schedule");
        if (!response.ok) throw new Error("Failed to fetch schedule");
        const data = await response.json();
        setTestSchedule(data);
      } catch (error) {
        console.error("Error fetching schedule:", error);
      }
    };
    fetchSchedule();
  }, []);
  const handleMarkForReview = () => {
    const currentQuestionId = filteredQuestions[currentQuestionIndex].id;
    setMarkedForReview((prev) =>
      prev.includes(currentQuestionId)
        ? prev.filter((id) => id !== currentQuestionId) // Unmark if already marked
        : [...prev, currentQuestionId] // Mark for review
    );
    setCurrentQuestionIndex((prev) =>
      Math.min(filteredQuestions.length - 1, prev + 1)
    );
  };
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("http://10.10.231.249:3002/api/questions");
        if (!response.ok) throw new Error("Failed to fetch questions");
        const data = await response.json();
        if (data.length > 0) {
          setQuestions(data);
          const uniqueSubjects = [...new Set(data.map((q) => q.subject))];
          setSubjects(uniqueSubjects);
          setSelectedSubject(uniqueSubjects[0]);
        } else {
          console.error("No questions received!");
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      }
    };
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (!student || !testSchedule) return;

    const now = new Date();
    const start = new Date(`${testSchedule.date}T${testSchedule.startTime}`);
    const end = new Date(`${testSchedule.date}T${testSchedule.endTime}`);

    if (now >= end) {
      handleSubmit();
      return;
    }

    if (now < start) {
      alert("Test has not started yet");
      navigate("/instructions");
      return;
    }

    const initialRemaining = Math.floor((end - now) / 1000);
    setTimer(initialRemaining > 0 ? initialRemaining : 0);

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        const currentTime = new Date();
        const newRemaining = Math.floor((end - currentTime) / 1000);

        if (newRemaining <= 0) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return newRemaining;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [student, testSchedule, navigate]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!submitted) {
        event.preventDefault();
        event.returnValue =
          "Are you sure you want to leave? Your progress will be lost.";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [submitted]);

  // const filteredQuestions = questions.filter((q) => q.subject.toLowerCase() === selectedSubject.toLowerCase());

  const handleOptionChange = (option) => {
    const key = filteredQuestions[currentQuestionIndex].id;
  
    setSelectedOption((prev) => ({
      ...prev,
      [key]: option,
    }));
  
    if (!attempted.includes(key)) {
      setAttempted([...attempted, key]);
    }
  
    // Remove the question from the markedForReview list if it was marked
    if (markedForReview.includes(key)) {
      setMarkedForReview((prev) => prev.filter((id) => id !== key));
    }
  };
  const handleSubmit = useCallback(async () => {
    if (submitted || !student) return;

    setSubmitted(true);
    sessionStorage.setItem(`examSubmitted_${student["Roll Number"]}`, "true");
    clearInterval(timerRef.current);

    let totalScore = 0;
    const correctAnswers = {};
    const sectionDetails = {};

    questions.forEach((question) => {
      const key = question.id;
      const isCorrect = selectedOption[key] === question.correctAnswer;
      const marks = question.marks || 1;

      if (isCorrect) {
        totalScore += marks;
        correctAnswers[key] = true;
      }
      // Section breakdown
      if (!sectionDetails[question.subject]) {
        sectionDetails[question.subject] = {
          attempted: 0,
          correct: 0,
          total: 0,
        };
      }
      sectionDetails[question.subject].total++;
      if (selectedOption[key] !== undefined) {
        sectionDetails[question.subject].attempted++;
        if (isCorrect) sectionDetails[question.subject].correct++;
      }
    });
    setScore(totalScore);

    // Prepare result data
    const totalPossible = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
    const sections = Object.entries(sectionDetails).map(([name, data]) => ({
      name,
      ...data,
    }));
    setScoreData({
      examName: "Final Examination",
      totalScore: Math.round((totalScore / totalPossible) * 100),
      correctAnswers: Object.keys(correctAnswers).length,
      totalQuestions: questions.length,
      sections,
      percentile: 75, // Should come from server
    });
    setShowResult(true);

    // Submit to backend
    try {
      await fetch("http://10.10.231.249:3002/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          studentName: student.Name,
          rollNumber: student["Roll Number"],
          responses: selectedOption,
          score: totalScore,
          sectionDetails,
          suspicious: suspiciousActivityRef.current,
        }),
      });
    } catch (error) {
      console.error("Submission failed:", error);
    }
  }, [submitted, student, questions, selectedOption]);

  useEffect(() => {
    suspiciousActivityRef.current = suspiciousActivity;
  }, [suspiciousActivity]);
  const handleReviewAnswers = () => {
    // Implement review functionality
    console.log("Reviewing answers...");
  };
  const filteredQuestions = questions.filter(
    (q) => q.subject.toLowerCase() === selectedSubject.toLowerCase()
  );

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!filteredQuestions.length) return <h2>Loading questions...</h2>;

  return (
    <div className="exam-container">
      {showResult ? (
        <Result scoreData={scoreData} onReviewAnswers={handleReviewAnswers} />
      ) : (
        <>
          <div className="exam-left">
            <div className="exam-topbar">
              <div className="subject-buttons">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    className={`selectedSubject ${
                      selectedSubject === subject ? "active" : ""
                    }`}
                    onClick={() => {
                      setSelectedSubject(subject);
                      setCurrentQuestionIndex(0);
                    }}
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
            {filteredQuestions[currentQuestionIndex] && (
              <div className="question-box">
                <h2>
                  Question {currentQuestionIndex + 1} of{" "}
                  {filteredQuestions.length}
                  <span>
                    ({filteredQuestions[currentQuestionIndex].marks || 1} marks)
                  </span>
                </h2>

                <div className="question-content">
                  <p>{filteredQuestions[currentQuestionIndex].question}</p>

                  {filteredQuestions[currentQuestionIndex].options?.map(
                    (option, index) => (
                      <label key={index} className="option-label">
                        <input
                          type="radio"
                          name={`question-${filteredQuestions[currentQuestionIndex].id}`}
                          checked={
                            selectedOption[
                              filteredQuestions[currentQuestionIndex].id
                            ] === option
                          }
                          onChange={() => handleOptionChange(option)}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    )
                  )}
                </div>

                <button
                  className="prevbtn"
                  onClick={() =>
                    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentQuestionIndex === 0}
                >
                  Previous
                </button>
                <button
                    className="mark-review-btn"
                    onClick={handleMarkForReview}
                    disabled={currentQuestionIndex >= filteredQuestions.length - 1}
                  >
                    Mark as Review & Next
                  </button>
                <button
                  className="nextbtn"
                  onClick={() =>
                    setCurrentQuestionIndex((prev) =>
                      Math.min(filteredQuestions.length - 1, prev + 1)
                    )
                  }
                  disabled={
                    currentQuestionIndex >= filteredQuestions.length - 1
                  }
                >
                  Save & Next
                </button>
              </div>
            )}
          </div>
          <div className="exam-right">
            <div className="student">
              <div className="student-info">
                {student && (
                  <h3>
                    {student.Name} | Roll No: {student["Roll Number"]}
                  </h3>
                )}
              </div>
              <div className="timer">Time Left: {formatTime(timer)}</div>
            </div>

            <div className="question-progress">
              <h3>Question Navigator</h3>
              <div className="question-nav">
                {filteredQuestions.map((q, index) => (
                  <button
                    key={q.id}
                    className={`question-btn 
                        ${currentQuestionIndex === index ? "active" : ""} 
                        ${attempted.includes(q.id) ? "attempted" : ""}
                        ${markedForReview.includes(q.id) ? "marked" : ""}`}
                    onClick={() => setCurrentQuestionIndex(index)}
                  >
                    {index + 1}
                  </button>
                ))}
                 <button
                  className="submitbtn"
                  onClick={handleSubmit}
                  disabled={submitted}
                >
                  {submitted ? "Submitting..." : "Submit Exam"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
