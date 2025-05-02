import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./upload.css";
import ImageUploader from "./ImageUpload";
import { BASE_URL } from "../config";

const socket = io(`${BASE_URL}`);


export const UploadExcel = () => {
  const [file, setFile] = useState(null);
  const [studentFile, setStudentFile] = useState(null);
  const [message, setMessage] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [testDate, setTestDate] = useState(
    localStorage.getItem("testDate") || ""
  );
  const [startTime, setStartTime] = useState(
    localStorage.getItem("startTime") || ""
  );
  const [endTime, setEndTime] = useState(localStorage.getItem("endTime") || "");
  const [scheduleMessage, setScheduleMessage] = useState("");
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [isTestOver, setIsTestOver] = useState(false);
  const navigate = useNavigate();
  // Handle file selection
  const handleFileChange = (event, setFileFunction) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFileFunction(selectedFile);
    }
  };
  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    navigate("/admin");
  };
  // Validate file type
  const validateFile = (file, allowedExtensions) => {
    const fileExtension = file.name.split(".").pop().toLowerCase();
    return allowedExtensions.includes(`.${fileExtension}`);
  };

  // Generic function for uploading files
  const handleUpload = async (file, endpoint, setFeedback, setLoading) => {
    if (!file) {
      setFeedback("Please select a file first.");
      return;
    }

    if (!validateFile(file, [".xlsx", ".csv"])) {
      setFeedback("Invalid file type. Please upload .xlsx or .csv files.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const response = await fetch(`${BASE_URL}/${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      setFeedback(data.message || "Upload successful!");
    } catch (error) {
      console.error("Upload failed:", error);
      setFeedback("Upload failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Validate schedule
  const validateSchedule = () => {
    if (!testDate || !startTime || !endTime) {
      return "Please fill in all schedule fields.";
    }
    if (
      new Date(`${testDate}T${endTime}`) <= new Date(`${testDate}T${startTime}`)
    ) {
      return "End time must be after start time.";
    }
    return null;
  };

  // Set test schedule
  const handleSetSchedule = async () => {
    const validationError = validateSchedule();
    if (validationError) {
      setScheduleMessage(validationError);
      return;
    }

    try {
      const response = await fetch(`${BASE_URL}/set-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testDate, startTime, endTime }),
      });
      const data = await response.json();
      setScheduleMessage(data.message || "Schedule set successfully!");

      // Save to localStorage to persist after reload
      localStorage.setItem("testDate", testDate);
      localStorage.setItem("startTime", startTime);
      localStorage.setItem("endTime", endTime);

      socket.emit("schedule-updated");
    } catch (error) {
      console.error("Schedule setting failed:", error);
      setScheduleMessage("Failed to set schedule. Please try again.");
    }
  };

  // Check if the test has ended
  useEffect(() => {
    const checkTestStatus = () => {
      if (testDate && endTime) {
        const endDateTime = new Date(`${testDate}T${endTime}:00`);
        const now = new Date();

        console.log("Checking test status...");
        console.log("Current Time:", now.toISOString());
        console.log("End Time:", endDateTime.toISOString());

        if (now >= endDateTime) {
          console.log("Test is over");
          setIsTestOver(true);
        } else {
          console.log("Test is not over yet");
          setIsTestOver(false);
        }
      }
    };

    checkTestStatus();
    const interval = setInterval(checkTestStatus, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [testDate, endTime]);

  // Download template files
  const handleDownload = async (filename) => {
    try {
      const response = await fetch(
        `${BASE_URL}/download/${filename}`
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download template. Please try again.");
    }
  };

  return (
    <div className="upload-container">
      <h1>ADMIN PORTAL</h1>
      <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      {/* Upload Questions */}
      <section className="upload-section">
        <h2>Upload Questions File</h2>
        <input
          type="file"
          onChange={(e) => handleFileChange(e, setFile)}
          disabled={loadingQuestions}
        />
        <button
          onClick={() =>
            handleUpload(file, "upload", setMessage, setLoadingQuestions)
          }
          disabled={loadingQuestions}
        >
          {loadingQuestions ? "Uploading..." : "Upload Questions"}
        </button>
        <p className="feedback-message">{message}</p>
        < ImageUploader/>
      </section>

      {/* Upload Student List */}
      <section className="upload-section">
        <h2>Upload Student List</h2>
        <input
          type="file"
          onChange={(e) => handleFileChange(e, setStudentFile)}
          disabled={loadingStudents}
        />
        <button
          onClick={() =>
            handleUpload(
              studentFile,
              "upload-students",
              setStudentMessage,
              setLoadingStudents
            )
          }
          disabled={loadingStudents}
        >
          {loadingStudents ? "Uploading..." : "Upload Students"}
        </button>
        <p className="feedback-message">{studentMessage}</p>
      </section>

      {/* Set Test Schedule */}
      <section className="upload-card">
        <h2>Test Schedule</h2>
        <div className="schedule-grid">
          <div className="input-group">
            <label>Test Date:</label>
            <input
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Start Time:</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>End Time:</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
        <button className="schedule-button" onClick={handleSetSchedule}>
          🗓 Set Schedule
        </button>
        <p className="feedback-message">{scheduleMessage}</p>
      </section>
      {/* Download Templates */}
      <section className="download-section">
        <h2>Download Templates</h2>
        <button onClick={() => handleDownload("question-template.xlsx")}>
          Download Question Template
        </button>
        <button onClick={() => handleDownload("student-template.xlsx")}>
          Download Student Template
        </button>
      </section>
      {/* Download Results */}
      <section className="download-section">
        <h2>Download Test Results</h2>
        <button
          onClick={() => handleDownload("results.xlsx")}
          disabled={!isTestOver}
        >
          {isTestOver ? "Download Results" : "Test Not Completed Yet"}
        </button>
        {!isTestOver && (
          <p className="feedback-message">
            You can download results only after the test is over.
          </p>
        )}
      </section>
    </div>
  );
};