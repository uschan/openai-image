import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_FILE = path.join(__dirname, "templates.json");
const IMAGES_FILE = path.join(__dirname, "images.json");
const CATEGORIES_FILE = path.join(__dirname, "categories.json");
const STATS_FILE = path.join(__dirname, "stats.json");
const DOWNLOADS_DIR = path.join(__dirname, "downloads");

const APIMART_BASE_URL = "https://api.apimart.ai";

// Helper function to read json safely
const readJson = async (file: string, defaultData: any) => {
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return defaultData;
  }
};

async function startServer() {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true }).catch(() => {});
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use('/downloads', express.static(DOWNLOADS_DIR));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      keys: {
        gemini: !!process.env.GEMINI_API_KEY,
        apimart: !!process.env.APIMART_API_KEY,
        deepseek: !!process.env.DEEPSEEK_API_KEY,
      }
    });
  });

  app.get("/api/data", async (req, res) => {
    try {
      const templates = await readJson(TEMPLATES_FILE, []);
      const images = await readJson(IMAGES_FILE, []);
      const categories = await readJson(CATEGORIES_FILE, [{id: 'all', name: 'All Syntheses', count: 0}]);
      const stats = await readJson(STATS_FILE, { totalAttempts: 0, successful: 0, failed: 0 });
      res.json({ templates, images, categories, stats });
    } catch (error) {
      console.error("Error reading data:", error);
      res.status(500).json({ error: "Failed to read data" });
    }
  });

  app.post("/api/save", async (req, res) => {
    try {
      const { templates, images, categories, stats } = req.body;
      if (templates) {
        await fs.writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
      }
      if (images) {
        await fs.writeFile(IMAGES_FILE, JSON.stringify(images, null, 2), "utf-8");
      }
      if (categories) {
        await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2), "utf-8");
      }
      if (stats) {
        await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving data:", error);
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  app.post("/api/save-image", async (req, res) => {
    const { id, url, subject } = req.body;
    try {
      const fetchRes = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${process.env.APIMART_API_KEY}`,
          "Accept": "*/*",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        }
      });
      if (!fetchRes.ok) throw new Error(`Failed to fetch image: ${fetchRes.status}`);
      
      const slug = (subject || "untitled").replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const filename = `${Date.now()}_${slug}_${id}.png`;
      const filepath = path.join(DOWNLOADS_DIR, filename);
      
      const buffer = await fetchRes.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(buffer));
      
      res.json({ localUrl: `/downloads/${filename}` });
    } catch(e) {
      console.error("save-image error", e);
      res.status(500).json({error: String(e)});
    }
  });

  app.post("/api/move-image", async (req, res) => {
    const { localUrl, categoryId } = req.body;
    if (!localUrl || !localUrl.startsWith('/downloads')) return res.json({ localUrl });
    
    try {
      const filename = path.basename(localUrl);
      const decodedCategory = categoryId === 'uncategorized' || categoryId === 'all' 
          ? '' 
          : categoryId.replace(/[^a-zA-Z0-9_\-]/g, '_');
          
      let targetDir = DOWNLOADS_DIR;
      if (decodedCategory) {
         targetDir = path.join(DOWNLOADS_DIR, decodedCategory);
         await fs.mkdir(targetDir, { recursive: true }).catch(() => {});
      }
      
      const targetPath = path.join(targetDir, filename);
      
      // old path might have existing category
      const relativePath = localUrl.replace(/^\/downloads\//, '');
      const oldPath = path.join(DOWNLOADS_DIR, relativePath);
      
      if (oldPath !== targetPath) {
          try {
              await fs.rename(oldPath, targetPath);
          } catch(e) {
              console.log("Rename failed", e);
          }
      }
      
      const newLocalUrl = decodedCategory ? `/downloads/${decodedCategory}/${filename}` : `/downloads/${filename}`;
      res.json({ localUrl: newLocalUrl });
    } catch(e) {
      console.error("move-image error", e);
      res.status(500).json({error: String(e)});
    }
  });

  app.post("/api/delete-image", async (req, res) => {
      const { localUrl } = req.body;
      if (localUrl && localUrl.startsWith('/downloads')) {
          try {
              const relativePath = localUrl.replace(/^\/downloads\//, '');
              const filepath = path.join(DOWNLOADS_DIR, relativePath);
              await fs.unlink(filepath);
          } catch (e) {
              console.log("Delete failed", e);
          }
      }
      res.json({ success: true });
  });

  // APIMart Image Generation Proxy
  app.post("/api/generate", async (req, res) => {
    const { prompt, model, size, resolution } = req.body;
    const apiKey = process.env.APIMART_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "APIMART_API_KEY is not configured" });
    }

    // Map models to APIMart IDs
    // GPT-Image-2 -> gpt-image-2
    // Gemini-3-Pro -> gemini-3-pro-image-preview
    let apiModel = "gpt-image-2";
    if (model.includes("Gemini")) {
      apiModel = "gemini-3-pro-image-preview";
    } else if (model.includes("Stable") || model.includes("XL")) {
      apiModel = "gpt-image-2"; // Fallback to GPT-Image-2 as a high quality default
    }

    try {
      const response = await axios.post(`${APIMART_BASE_URL}/v1/images/generations`, {
        model: apiModel,
        prompt: prompt,
        size: size, // "1:1", "4:3", etc.
        resolution: resolution // "1k", "2k", "4k"
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        }
      });

      // Returns task_id
      res.json(response.data);
    } catch (error: any) {
      console.error("APIMart Generation Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to initiate generation" });
    }
  });

  // APIMart Task Query Proxy
  app.get("/api/query", async (req, res) => {
    const { task_id } = req.query;
    const apiKey = process.env.APIMART_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "APIMART_API_KEY is not configured" });
    }

    try {
      const response = await axios.get(`${APIMART_BASE_URL}/v1/tasks/${task_id}`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("APIMart Query Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to query task" });
    }
  });

  // Gemini API post enhancement
  app.post("/api/enhance-prompt", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    try {
      const { subject } = req.body;
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [{
            parts: [{ text: `Rewrite this image subject/concept to be more descriptive and artistic. Keep it under 20 words. Original: ${subject}` }]
          }]
        },
        {
          headers: { "Content-Type": "application/json" }
        }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: "Failed to enhance prompt" });
    }
  });

  // DeepSeek API post generation
  app.post("/api/generate-post", async (req, res) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured" });
    }

    try {
      const { subject } = req.body;
      const response = await axios.post(
        "https://api.deepseek.com/chat/completions",
        {
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "You are an expert Xiaohongshu (Little Red Book) copywriter. Write a post based on the provided subject.\n\nYour tone and structure MUST deeply understand and adapt to the category of the subject:\n1. Field Guide / Encyclopedia (Animals, Plants, Insects, etc.): Use a concise, popular science tone mixed with fragmented, poetic personal reflections. Keep it slightly whimsical but informative.\n2. Recipes / Food: Use a slice-of-life, conversational monologue style heavily infused with personal emotion and vivid sensory details. Make it feel like talking to a friend.\n3. Artworks / General: Use an elegant, aesthetic, and curator-like tone.\n\nCRITICAL: You MUST include an engaging, open-ended question at the very end of the 'body' to act as a hook and strongly encourage the audience to leave comments and interact.\n\nOutput MUST be ONLY a valid JSON object containing { \"title\": \"string\", \"body\": \"string\", \"tags\": [\"tag1\", \"tag2\"] }. No markdown formatting or text outside the JSON."
            },
            {
              role: "user",
              content: `Here is the subject:\n${subject}\n\nPlease generate the post JSON.`
            }
          ],
          response_format: { type: "json_object" }
        },
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      const content = response.data.choices[0].message.content;
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("DeepSeek API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: "Failed to generate post from DeepSeek" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
