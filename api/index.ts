import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// The conversion logic has been moved to the frontend to comply with 
// security guidelines and avoid Vercel serverless timeout limits.
// Gemini is now called directly from the browser where its API key is managed.

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
