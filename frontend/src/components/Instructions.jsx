import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./instructions.css";
import { BASE_URL } from "../config.js";
export const InstructionsPage = () => {
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [isChecked, setIsChecked] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [testSchedule, setTestSchedule] = useState(null);

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
    // Fetch student data
    const storedStudent = sessionStorage.getItem("student");
    if (!storedStudent) {
      navigate("/login");
      return;
    }
    setStudent(JSON.parse(storedStudent));

    // Fetch test schedule
    const fetchSchedule = () => {
      fetch(`${BASE_URL}/get-schedule`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch schedule");
          return res.json();
        })
        .then((data) => setTestSchedule(data))
        .catch((error) => {
          console.error(error);
          setPopupMessage("Error fetching schedule. Please try again later.");
          setShowPopup(true);
        });
    };

    fetchSchedule();

    // Listen for schedule updates via WebSocket
    const socket = io(`BASE_URL`);
    socket.on("schedule-updated", fetchSchedule);

    return () => socket.disconnect();
  }, [navigate]);

  // Helper function to format time
  const formatTime = (time) => {
    if (!time) return "N/A";
    const [hours, minutes] = time.split(":");
    return new Date(0, 0, 0, hours, minutes).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleProceed = () => {
    if (!isChecked) {
      setPopupMessage("Please check the box to confirm you've read the instructions");
      setShowPopup(true);
      return;
    }

    if (!testSchedule) {
      setPopupMessage("Test schedule not available. Contact administrator.");
      setShowPopup(true);
      return;
    }

    const now = new Date();
    const start = new Date(`${testSchedule.date}T${testSchedule.startTime}`);
    const end = new Date(`${testSchedule.date}T${testSchedule.endTime}`);

    if (now < start) {
      setPopupMessage("Test has not started yet");
      setShowPopup(true);
    } else if (now > end) {
      setPopupMessage("Test has already ended");
      setShowPopup(true);
    } else {
      navigate("/exam");
    }
  };

  return (
    <div className="instructions-container">
      <main className="instructions-content">
        <h2>GENERAL INSTRUCTIONS</h2>

        {student && <h3>Welcome, {student.Name}!</h3>}

        <p className="instructions-note">Please read the instructions carefully before starting the exam.</p>

        <ol className="instructions-list">
          <li>Total duration of Quiz - 180 minutes.</li>
          <li>The clock will be set at the server and the countdown timer at the top will display the remaining time.</li>
          <li>Once the time is over, the exam will be auto-submitted.</li>
          <li>There are multiple-choice questions (MCQs). Each question has four options, and only one is correct.</li>
          <li>Each correct answer carries +4 marks, and each incorrect answer deducts 1 mark.</li>
          <li>Unattempted questions will not have any negative marking.</li>
          <li>Make sure your internet connection is stable. If you get disconnected, try reloading the page and logging in again.</li>
          <li>Do not refresh or close the tab once the quiz has started, as this may lead to automatic submission.</li>
          <li>Use only the navigation buttons provided on the screen. Avoid using the browser’s back or forward buttons.</li>
          <li>Any attempt to switch tabs or open another window may result in disqualification.</li>
          <li>Once you click the ‘Submit’ button, you will not be able to make any changes.</li>
          <li>Ensure that you are in a quiet place and free from distractions before starting the quiz.</li>
          <li>In case of any issues, contact the administrator immediately.</li>
        </ol>

        <div className="checkbox-container">
          <input
            type="checkbox"
            id="instructions-checkbox"
            checked={isChecked}
            onChange={() => setIsChecked(!isChecked)}
          />
          <label htmlFor="instructions-checkbox">
            I have read and understood the instructions.
          </label>
        </div>

        <div className="proceed-button-container">
          <button className="proceed-button" onClick={handleProceed}>
            Proceed
          </button>
        </div>

        {testSchedule && (
          <div className="test-schedule">
            <h3>Test Schedule</h3>
            <p>Date: {new Date(testSchedule.date).toLocaleDateString()}</p>
            <p>Start Time: {formatTime(testSchedule.startTime)}</p>
            <p>End Time: {formatTime(testSchedule.endTime)}</p>
          </div>
        )}

        {/* Pop-up Modal */}
        {showPopup && (
          <div className="popup-overlay">
            <div className="popup">
              <p>{popupMessage}</p>
              <button onClick={() => setShowPopup(false)}>OK</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
