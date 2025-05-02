const { Router } = require("express");
const multer = require("multer");
const { createTokenForUser } = require('../services/auth');
const path = require("path");
const router = Router();
const fs = require("fs");
const STUDENTS_FILE = "students.json";
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
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing JSON file (${filePath}):`, error);
  }
};
router.post('/',(req,res)=>{
    console.log("hi");
  const {email,password}=req.body;
  const students = readJSONFile(STUDENTS_FILE);
  console.log(students);
  const student = students.find(
    (s) => s.Email === email && String(s["Roll Number"]) === password
  );
  console.log(student);
  if (student && student["loginAttempts"] ==0) {
    student.loginAttempts++;
    writeJSONFile(STUDENTS_FILE, students);
    const token = createTokenForUser(student);
    res.cookie("token", token).json({ success: true, student, token });
  }else if(student && student["loginAttempts"] ==1){
    res.status(401).json({ success: false, message: "You cant't login more than once." });
  }
  else
  res.status(401).json({ success: false, message: "Invalid credentials" });
})

module.exports = router;