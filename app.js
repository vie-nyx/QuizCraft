require("dotenv").config();
const path = require("path");
const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const rateLimit = require("express-rate-limit");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3002;
const UPLOADS_DIR = "uploads";
const QUESTIONS_FILE = path.join(__dirname, "frontend", "public", "questions.json");
const RESULTS_FILE = path.join(__dirname,"frontend","public", "results.json");
const STUDENTS_FILE = path.join(__dirname, "students.json");
const SCHEDULE_FILE = path.join(__dirname, "schedule.json");
const questionTemplatePath = path.join(__dirname, "templates", "question_template.xlsx");
const studentTemplatePath = path.join(__dirname, "templates", "student_template.xlsx");
const STUDENT_IMAGES_DIR = path.join(__dirname, "uploads", "students");
const FRONTEND_URL = process.env.FRONTEND_URL || "http://yourfrontend.com";
// Middleware
app.use(express.json());
app.use(cors({ origin: ["http://localhost:3000", "http://yourfrontend.com"] })); // Update for production
app.use(express.static(path.join(__dirname, "frontend", "dist")));

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Multer setup with file validation
const upload = multer({
  dest: UPLOADS_DIR,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return cb(new Error("Only Excel files are allowed"), false);
    }
    cb(null, true);
  },
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname,"frontend","public","images"))
  },
  filename: function (req, file, cb) {
    const id = req.body.id;
    cb(null, `${id}${path.extname(file.originalname)}`)
  }
});
const upload_image = multer({ storage: storage });

/* ===========================
       Utility Functions
=========================== */
const readJSONFile = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error(`Error reading JSON file (${filePath}):`, error);
    return [];
  }
};

const writeJSONFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

const hasStudentSubmitted = (rollNumber) => {
  const results = readJSONFile(RESULTS_FILE);
  return results.some((result) => result.RollNumber === rollNumber);
};

/* ===========================
       Authentication
=========================== */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many login attempts. Please try again later.",
});

app.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const students = readJSONFile(STUDENTS_FILE);

  const student = students.find(
    (s) => s.Email === email && String(s["Roll Number"]) === password
  );

  if (student) return res.json({ success: true, student });
  res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Route for downloading Question Template
// Enhance template download routes with error checking
app.get("/download/question-template.xlsx", (req, res) => {
  if (!fs.existsSync(questionTemplatePath)) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.download(questionTemplatePath, (err) => {
    if (err) console.error("Download failed:", err);
  });
});

app.get("/download/student-template.xlsx", (req, res) => {
  if (!fs.existsSync(studentTemplatePath)) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.download(studentTemplatePath, (err) => {
    if (err) console.error("Download failed:", err);
  });
});
app.post('/image-upload', upload_image.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  res.json({ 
    message: 'File uploaded successfully',
    path: `/images/${req.file.filename}`
  });
});
// Route for downloading Student Template
app.get("/download/student-template.xlsx", (req, res) => {
  res.download(studentTemplatePath, "student_template.xlsx", (err) => {
    if (err) {
      console.error("Error downloading student template:", err);
      res.status(500).send("Error downloading the file");
    }
  });
});
// Correct the results download route
app.get("/download/results.xlsx", (req, res) => {
  const jsonFilePath = RESULTS_FILE; // Use the existing RESULTS_FILE path
  const excelFilePath = path.join(__dirname, "results.xlsx"); // Save in backend root

  // Check if JSON file exists
  if (!fs.existsSync(jsonFilePath)) {
    return res.status(404).json({ error: "Results file not found" });
  }

  // Read JSON data
  const jsonData = readJSONFile(jsonFilePath);

  // Convert to Excel
  const worksheet = xlsx.utils.json_to_sheet(jsonData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Results");
  xlsx.writeFile(workbook, excelFilePath);

  // Send file
  res.download(excelFilePath, "results.xlsx", (err) => {
    if (err) {
      console.error("Download error:", err);
      res.status(500).send("Error downloading results");
    }
    fs.unlinkSync(excelFilePath); // Cleanup after download
  });
});
/* ===========================
      Question Management
=========================== */
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    const formattedData = rawData.map((row, index) => ({
      id: index + 1,
      subject: row.subject,
      question: row.question,
      options: [row.option_1, row.option_2, row.option_3, row.option_4].filter(Boolean),
      marks: row.marks || 1,
      correctAnswer: row.answer,
    }));

    writeJSONFile(QUESTIONS_FILE, formattedData);
    io.emit("data-updated", { message: "Questions updated!" });

    fs.unlink(req.file.path, () => {});
    res.json({ message: "Questions uploaded successfully." });
  } catch (error) {
    res.status(500).json({ error: "Error processing file", details: error.message });
  }
});

app.get("/api/questions", (req, res) => {
  const questions = readJSONFile(QUESTIONS_FILE);
  if (!questions.length) return res.status(404).json({ error: "No questions available" });
  res.json(questions);
});

/* ===========================
        Exam Submission
=========================== */
app.post("/submit", (req, res) => {
  const { studentName, rollNumber, responses, suspicious } = req.body;
  if (!studentName || !rollNumber || !responses) return res.status(400).json({ error: "Missing details" });

  if (hasStudentSubmitted(rollNumber)) {
    return res.status(403).json({ message: "You have already submitted the exam" });
  }

  const questions = readJSONFile(QUESTIONS_FILE);
  let totalScore = 0;

  questions.forEach((q) => {
    if (responses[q.id] && responses[q.id].trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
      totalScore += q.marks || 1;
    }
  });

  let results = readJSONFile(RESULTS_FILE);
  results.push({ Student: studentName, RollNumber: rollNumber, Score: totalScore, isSuspicious: suspicious});
  writeJSONFile(RESULTS_FILE, results);

  io.emit("result-updated", { studentName, rollNumber, totalScore });
  res.json({ message: "Exam submitted successfully!", score: totalScore });
});

/* ===========================
      Student Management
=========================== */
app.post("/upload-students", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    writeJSONFile(STUDENTS_FILE, xlsx.utils.sheet_to_json(sheet));

    io.emit("students-updated", { message: "Student list updated!" });
    fs.unlink(req.file.path, () => {});
    res.json({ message: "Student list uploaded successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Error processing file", details: error.message });
  }
});

app.get("/api/students", (req, res) => {
  const students = readJSONFile(STUDENTS_FILE);
  if (!students.length) return res.status(404).json({ error: "No student data available" });
  res.json(students);
});

/* ===========================
        Test Scheduling
=========================== */
const readSchedule = () => (fs.existsSync(SCHEDULE_FILE) ? JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf-8")) : {});

const writeSchedule = (schedule) => {
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(schedule, null, 2));
};

app.post("/set-schedule", (req, res) => {
  const { testDate, startTime, endTime } = req.body;
  if (!testDate || !startTime || !endTime) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const newSchedule = { date: testDate, startTime, endTime };
  writeSchedule(newSchedule);
  io.emit("schedule-updated", newSchedule);

  res.json({ message: "Schedule updated successfully" });
});

app.get("/get-schedule", (req, res) => {
  res.json(readSchedule());
});

/* ===========================
        Socket.io Setup
=========================== */
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.emit("data-updated", { message: "Latest questions", data: readJSONFile(QUESTIONS_FILE) });
  socket.emit("students-updated", { message: "Latest student data", data: readJSONFile(STUDENTS_FILE) });
  socket.emit("schedule-updated", readSchedule());

  socket.on("disconnect", () => console.log("Client disconnected"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

/* ===========================
      Start Server
=========================== */
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));