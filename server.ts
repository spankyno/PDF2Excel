import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Configure Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());

// Gemini AI Setup
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

app.post("/api/convert", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pdfBuffer = req.file.buffer;
    const base64Pdf = pdfBuffer.toString("base64");

    // We'll use Gemini to extract tables. 
    // To satisfy the "multiple techniques" requirement, we'll ask Gemini for 3 different extraction styles.
    const model = "gemini-3-flash-preview";
    
    const prompt = `
      Extract all tables from the provided PDF. 
      Return the data as a JSON object with three keys:
      1. "best_effort": The most accurate representation of the tables, merging headers and rows correctly.
      2. "raw_data": A more literal extraction, keeping all cells even if they seem like noise.
      3. "structured_view": A highly structured version optimized for data analysis (e.g., ensuring consistent columns).

      Each key should contain an array of tables. Each table should be an array of arrays (rows).
      Example format:
      {
        "best_effort": [ [["Col1", "Col2"], ["Val1", "Val2"]] ],
        "raw_data": [...],
        "structured_view": [...]
      }
    `;

    const result = await genAI.models.generateContent({
      model: model,
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            best_effort: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            },
            raw_data: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            },
            structured_view: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              }
            }
          },
          required: ["best_effort", "raw_data", "structured_view"]
        }
      }
    });

    const extraction = JSON.parse(result.text || "{}");

    // Create Excel workbook
    const wb = XLSX.utils.book_new();

    const addSheet = (data: string[][][], sheetName: string) => {
      if (!data || data.length === 0) return;
      // Combine multiple tables into one sheet with spacing
      const combinedRows: any[] = [];
      data.forEach((table, index) => {
        if (index > 0) combinedRows.push([]); // Add empty row between tables
        table.forEach(row => combinedRows.push(row));
      });
      const ws = XLSX.utils.aoa_to_sheet(combinedRows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet(extraction.best_effort, "Mejor Resultado");
    addSheet(extraction.structured_view, "Vista Estructurada");
    addSheet(extraction.raw_data, "Datos Brutos");

    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=converted_tables.xlsx");
    res.send(excelBuffer);

  } catch (error: any) {
    console.error("Conversion error:", error);
    res.status(500).json({ error: error.message || "Failed to convert PDF" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
