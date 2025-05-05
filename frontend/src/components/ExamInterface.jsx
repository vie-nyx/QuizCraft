import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Result from "./Result";
import "./exam.css";
import { BASE_URL } from '../config.js'
export const ExamInterface = () => {
  // State declarations
  const [student, setStudent] = useState(null);
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
  const [exitCount, setExitCount] = useState(0);
  const navigate = useNavigate();
  const [showResult, setShowResult] = useState(false);
  const [scoreData, setScoreData] = useState(null);
  const [markedForReview, setMarkedForReview] = useState([]);
  const [imageStatus, setImageStatus] = useState({});

  
  const timerRef = useRef(null);
  const suspiciousActivityRef = useRef(false);


  // Function to enter full-screen mode
  const enterFullScreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement
        .requestFullscreen()
        .catch((err) => console.error("Error entering fullscreen:", err));
    }
  };
  const progressKey = student ? `examProgress_${student["Roll Number"]}` : null;


  // Load saved progress on mount
  useEffect(() => {
    const storedStudent = sessionStorage.getItem("student");
    if (storedStudent) {
      const studentData = JSON.parse(storedStudent);
      setStudent(studentData);
      
      // Load progress from storage
      const savedProgress = sessionStorage.getItem(`examProgress_${studentData["Roll Number"]}`);
      if (savedProgress) {
        const { 
          selectedOption, 
          currentIndex, 
          marked, 
          attemptedQs, 
          selectedSubj 
        } = JSON.parse(savedProgress);
        
        setSelectedOption(selectedOption);
        setCurrentQuestionIndex(currentIndex);
        setMarkedForReview(marked);
        setAttempted(attemptedQs);
        setSelectedSubject(selectedSubj);
      }
    } else {
      window.location.href = "/login";
    }
  }, []);

// When saving progress
useEffect(() => {
  if (student && !submitted) {
    const progress = {
      selectedOption,
      currentIndex: currentQuestionIndex,
      marked: markedForReview,
      attemptedQs: attempted,
      selectedSubj: selectedSubject,
      // Add question IDs in their current order
      questionOrder: questions.map(q => q.id)
    };
    localStorage.setItem(
      `examProgress_${student["Roll Number"]}`,
      JSON.stringify(progress)
    );
  }
}, [selectedOption, currentQuestionIndex, markedForReview, attempted, selectedSubject, student, submitted, questions]);
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


// Check if image exists for a question
const checkImageExists = async (questionId) => {
  try {
    // First check for PNG
    const img = new Image();
    img.src = `/images/${questionId}.png`;
    
    await new Promise((resolve, reject) => {
      img.onload = () => {
        setImageStatus(prev => ({ ...prev, [questionId]: 'png' }));
        resolve();
      };
      img.onerror = () => {
        // If PNG fails, check for JPG
        const imgJpg = new Image();
        imgJpg.src = `/images/${questionId}.jpg`;
        imgJpg.onload = () => {
          setImageStatus(prev => ({ ...prev, [questionId]: 'jpg' }));
          resolve();
        };
        imgJpg.onerror = () => {
          setImageStatus(prev => ({ ...prev, [questionId]: false }));
          resolve();
        };
      };
    });
  } catch (error) {
    setImageStatus(prev => ({ ...prev, [questionId]: false }));
  }
};

 // Initialize image status when questions are loaded
 useEffect(() => {
  if (questions.length > 0) {
    questions.forEach(question => {
      // Only check if we haven't already checked this question
      if (imageStatus[question.id] === undefined) {
        checkImageExists(question.id);
      }
    });
  }
}, [questions]);



  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !submitted) {
      setExitCount((prev) => prev + 1);
      setSuspiciousActivity(true);
      alert(
        "Warning: You exited full-screen mode. Your attempt is marked as suspicious."
      );

      if (exitCount >= 2) {
        alert(
          "Multiple full-screen exits detected. Your exam is being auto-submitted."
        );
        handleSubmit();
      } else {
        enterFullScreen();
      }
    }
  };

 // When loading progress
useEffect(() => {
  const storedStudent = sessionStorage.getItem("student");
  if (storedStudent) {
    const studentData = JSON.parse(storedStudent);
    setStudent(studentData);
    
    // Load progress from storage
    const savedProgress = sessionStorage.getItem(`examProgress_${studentData["Roll Number"]}`);
    if (savedProgress) {
      const { 
        selectedOption, 
        currentIndex, 
        marked, 
        attemptedQs, 
        selectedSubj,
        questionOrder 
      } = JSON.parse(savedProgress);
      
      // If we have a saved question order, restore it
      if (questionOrder) {
        setQuestions(prevQuestions => {
          // Create a map for quick lookup
          const questionMap = new Map(prevQuestions.map(q => [q.id, q]));
          // Reconstruct the array in the saved order
          return questionOrder.map(id => questionMap.get(id)).filter(q => q);
        });
      }
      
      setSelectedOption(selectedOption);
      setCurrentQuestionIndex(currentIndex);
      setMarkedForReview(marked);
      setAttempted(attemptedQs);
      setSelectedSubject(selectedSubj);
    }
  } else {
    window.location.href = "/login";
  }
}, []);
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch(`${BASE_URL}/get-schedule`);
        if (!response.ok) throw new Error("Failed to fetch schedule");
        const data = await response.json();
        setTestSchedule(data);
      } catch (error) {
        console.error("Error fetching schedule:", error);
      }
    };
    fetchSchedule();
  }, []);
// Fisher-Yates shuffle algorithm
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};
useEffect(() => {
  const fetchQuestions = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/questions`);
      if (!response.ok) throw new Error("Failed to fetch questions");
      const data = await response.json();
      if (data.length > 0) {
        const shuffledQuestions = shuffleArray(data);
        setQuestions(shuffledQuestions);
        const uniqueSubjects = [...new Set(shuffledQuestions.map((q) => q.subject))];
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

  // Timer and exam control
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
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [exitCount, submitted]);

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

  useEffect(() => {
    enterFullScreen();
  }, []);

  useEffect(() => {
    suspiciousActivityRef.current = suspiciousActivity;
  }, [suspiciousActivity]);

  // Question handling
  const filteredQuestions = questions
  ? questions.filter(q => q?.subject?.toLowerCase() === selectedSubject?.toLowerCase())
  : [];

  const handleOptionChange = (option) => {
    if (!filteredQuestions[currentQuestionIndex]?.id) return;

    const key = filteredQuestions[currentQuestionIndex].id;
    setSelectedOption((prev) => ({ ...prev, [key]: option }));

    if (!attempted.includes(key)) {
      setAttempted([...attempted, key]);
    }

    if (markedForReview.includes(key)) {
      setMarkedForReview((prev) => prev.filter((id) => id !== key));
    }
  };

  const handleMarkForReview = () => {
    if (!filteredQuestions[currentQuestionIndex]?.id) return;

    const currentQuestionId = filteredQuestions[currentQuestionIndex].id;
    setMarkedForReview((prev) =>
      prev.includes(currentQuestionId)
        ? prev.filter((id) => id !== currentQuestionId)
        : [...prev, currentQuestionId]
    );
    setCurrentQuestionIndex((prev) =>
      Math.min(filteredQuestions.length - 1, prev + 1)
    );
  };

  // Exam submission
  const handleSubmit = useCallback(async () => {
    if (submitted || !student) return;

    setSubmitted(true);
    sessionStorage.setItem(`examSubmitted_${student["Roll Number"]}`, "true");
    clearInterval(timerRef.current);
    sessionStorage.removeItem(`examProgress_${student["Roll Number"]}`);
    sessionStorage.setItem(`examSubmitted_${student["Roll Number"]}`, "true");
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
      await fetch(`${BASE_URL}/submit`, {
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

  const handleReviewAnswers = () => {
    console.log("Reviewing answers...");
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submitted && student) {
        const progress = {
          selectedOption,
          currentIndex: currentQuestionIndex,
          marked: markedForReview,
          attemptedQs: attempted,
          selectedSubj: selectedSubject
        };
        sessionStorage.setItem(
          `examProgress_${student["Roll Number"]}`,  // Added backticks (`) here
          JSON.stringify(progress)
        );
      }
    };
  
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [selectedOption, currentQuestionIndex, markedForReview, attempted, selectedSubject, student, submitted]);
   
  // Auto-save every 30 seconds

  useEffect(() => {
    const autoSave = setInterval(() => {
      if (!submitted && student) {
        fetch('http://your-api/save-progress', {
          method: 'POST',
          body: JSON.stringify({
            studentId: student["Roll Number"],
            progress: {
              selectedOption,
              currentQuestionIndex,
              markedForReview,
              attempted,
              selectedSubject
            }
          })
        });
      }
    }, 30000);
  
    return () => clearInterval(autoSave);
  }, [submitted, student, selectedOption, currentQuestionIndex, markedForReview, attempted, selectedSubject]);
  // Detect multiple tabs
  useEffect(() => {
    const channel = new BroadcastChannel('exam_tab');
    channel.onmessage = (e) => {
      if (e.data === 'duplicate_tab') {
        alert('Only one exam session allowed!');
        document.body.innerHTML = '<h1>Duplicate exam session detected. This tab is blocked.</h1>';

  
      }
    };
    channel.postMessage('duplicate_tab');
  }, []);
  if (!filteredQuestions.length) return <h2>Loading questions...</h2>;

  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const imageExtension = imageStatus[currentQuestion?.id];

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

            {currentQuestion && (
              <div className="question-box">
                <h2>
                  Question {currentQuestionIndex + 1} of{" "}
                  {filteredQuestions.length}
                  <span>
                    ({currentQuestion.marks || 1} marks)
                  </span>
                </h2>

                <div className="question-content">
                  <p>{currentQuestion.question}</p>

                  {imageExtension && (
                    <div className="question-image-container">
                      <img
                        src={`/images/${currentQuestion.id}.${imageExtension}`}
                        className="question-image"
                        alt="Question illustration"
                        onError={(e) => {
                          // Hide the image if it fails to load
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {currentQuestion.options?.map(
                    (option, index) => (
                      <label key={index} className="option-label">
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          checked={
                            selectedOption[currentQuestion.id] === option
                          }
                          onChange={() => handleOptionChange(option)}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    )
                  )}
                </div>

                <div className="question-navigation">
                  <button
                    className="prevbtn"
                    onClick={() =>
                      setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                    }
                    disabled={
                      currentQuestionIndex === 0 || !filteredQuestions.length
                    }
                  >
                    Previous
                  </button>
                  <button
                    className="mark-review-btn"
                    onClick={handleMarkForReview}
                    disabled={
                      currentQuestionIndex >= filteredQuestions.length - 1
                    }
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
                      currentQuestionIndex >= filteredQuestions.length - 1 ||
                      !filteredQuestions.length
                    }
                  >
                    Save & Next
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="exam-right">
          <div className="student">
              <div className="student-info">
                {student && (
                  <>
                    <h3>{student.Name} | Roll No: {student["Roll Number"]}</h3>
                    <div className="timer">Time Left: {formatTime(timer)}</div>
                  </>
                )}
              </div>
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