// routes/progressRoutes.js
const express = require("express");
const router = express.Router();
const fs = require("fs").promises;
const path = require("path");
const { Mutex } = require('async-mutex');
const mutex = new Mutex();
const PROGRESS_FILE = "progress.json";

// Helper function to ensure progress file exists
const ensureProgressFile = async () => {
  const filePath = path.resolve(__dirname, PROGRESS_FILE);
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, JSON.stringify({}), "utf-8");
  }
};

// Then modify the endpoints like this:
router.post("/save-progress", express.json(), async (req, res) => {
  await ensureProgressFile();
  const { studentId, progress } = req.body;

  if (!studentId || !progress) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const release = await mutex.acquire();
  try {
    const filePath = path.resolve(__dirname, PROGRESS_FILE);
    const progressData = JSON.parse(await fs.readFile(filePath, "utf-8"));
    
    progressData[studentId] = {
      ...progress,
      lastSaved: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(progressData, null, 2), "utf-8");
    res.json({ success: true, message: "Progress saved successfully" });
  } catch (error) {
    console.error("Error saving progress:", error);
    res.status(500).json({ error: "Failed to save progress" });
  } finally {
    release();
  }
});
  
  // Add cleanup endpoint
  router.delete("/clear-progress/:studentId", async (req, res) => {
    await ensureProgressFile();
    const release = await mutex.acquire();
    
    try {
      const filePath = path.resolve(__dirname, PROGRESS_FILE);
      const progressData = JSON.parse(await fs.readFile(filePath, "utf-8"));
      
      delete progressData[req.params.studentId];
      
      await fs.writeFile(filePath, JSON.stringify(progressData, null, 2), "utf-8");
      res.json({ success: true, message: "Progress cleared" });
    } catch (error) {
      console.error("Error clearing progress:", error);
      res.status(500).json({ error: "Failed to clear progress" });
    } finally {
      release();
    }
  });

// Get progress endpoint
router.get("/get-progress/:studentId", async (req, res) => {
  await ensureProgressFile();

  try {
    const filePath = path.resolve(__dirname, PROGRESS_FILE);
    const progressData = JSON.parse(await fs.readFile(filePath, "utf-8"));
    const studentProgress = progressData[req.params.studentId] || null;
    
    res.json({ success: true, progress: studentProgress });
  } catch (error) {
    console.error("Error retrieving progress:", error);
    res.status(500).json({ error: "Failed to retrieve progress" });
  }
});

module.exports = router;