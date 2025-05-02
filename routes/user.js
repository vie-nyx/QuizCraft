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

router.post('/',(req,res)=>{
    console.log("hi");
  const {email,password}=req.body;
  const students = readJSONFile(STUDENTS_FILE);
  console.log(students);
  const student = students.find(
    (s) => s.Email === email && String(s["Roll Number"]) === password
  );
  console.log(student);
  if (student) {
    const token = createTokenForUser(student);
    res.cookie("token", token).json({ success: true, student, token });

  }else
  res.status(401).json({ success: false, message: "Invalid credentials" });
})

module.exports = router;