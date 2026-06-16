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

const APIMART_BASE_URL = "https://api.aiuxu.com";
const APIKEYFUN_BASE_URL = "https://api.apikey.fun";

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
      const filename = `${slug}_${Date.now()}_${id}.png`;
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
    const { prompt, model, size, resolution, image_urls } = req.body;

    // Map models to APIMart IDs
    // GPT-Image-2 -> gpt-image-2
    // Gemini-3-Pro -> gemini-3-pro-image-preview
    let apiModel = "gpt-image-2";
    let baseUrl = APIMART_BASE_URL;
    let apiKey = process.env.APIMART_API_KEY;
    if (model === "GPT-IMAGE-OFFICIAL") {
      apiModel = "gpt-image-2-official";
    } else if (model === "APIKEYFUN") {
      apiModel = "gpt-image-2";
      baseUrl = APIKEYFUN_BASE_URL;
      apiKey = process.env.APIKEYFUN_API_KEY;
    } else if (model.includes("Gemini")) {
      apiModel = "gemini-3-pro-image-preview";
    } else if (model.includes("Stable") || model.includes("XL")) {
      apiModel = "gpt-image-2";
    }

    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured for selected model" });
    }

    const SIZE_MAP: Record<string, Record<string, string>> = {
      "2k": { "1:1": "2048x2048", "3:2": "2048x1360", "2:3": "1360x2048", "4:3": "2048x1536", "3:4": "1536x2048", "5:4": "2560x2048", "4:5": "2048x2560", "16:9": "2048x1152", "9:16": "1152x2048", "2:1": "2688x1344", "1:2": "1344x2688" },
      "1k": { "1:1": "1024x1024", "3:2": "1536x1024", "2:3": "1024x1536", "4:3": "1024x768", "3:4": "768x1024", "5:4": "1280x1024", "4:5": "1024x1280", "16:9": "1536x864", "9:16": "864x1536", "2:1": "2048x1024", "1:2": "1024x2048" },
      "4k": { "1:1": "2880x2880", "3:2": "3520x2336", "2:3": "2336x3520", "4:3": "3312x2480", "3:4": "2480x3312", "5:4": "3216x2576", "4:5": "2576x3216", "16:9": "3840x2160", "9:16": "2160x3840", "2:1": "3840x1920", "1:2": "1920x3840" },
    };
    const actualSize = SIZE_MAP[resolution]?.[size] || size;

    // apikey.fun uses SSE streaming — handle synchronously
    if (model === "APIKEYFUN") {
      try {
        console.log("[apikeyfun] actualSize:", actualSize, "size:", size, "resolution:", resolution);
        const apiRes = await fetch(`${baseUrl}/v1/images/generations`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: apiModel,
            prompt,
            n: 1,
            size: actualSize,
          }),
        });
        if (!apiRes.ok) {
          const errText = await apiRes.text();
          return res.status(apiRes.status).json({ error: errText });
        }

        const json = await apiRes.json();
        const b64 = json?.data?.[0]?.b64_json;
        if (!b64) {
          return res.status(500).json({ error: "No b64_json in response" });
        }

        const slug = (prompt || "image").slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const filename = `${Date.now()}_${slug}.png`;
        const filepath = path.join(DOWNLOADS_DIR, filename);
        await fs.writeFile(filepath, Buffer.from(b64, "base64"));
        const localUrl = `/downloads/${filename}`;

        return res.json({ provider: "apikeyfun", localUrl, prompt, subject: prompt.slice(0, 40) });
      } catch (e: any) {
        console.error("apikeyfun error:", e);
        return res.status(500).json({ error: e.message || "Generation failed" });
      }
    }

    try {
      const response = await axios.post(`${baseUrl}/v1/images/generations`, {
        model: apiModel,
        prompt: prompt,
        size: actualSize,
        resolution: resolution,
        ...(image_urls?.length ? { image_urls } : {}),
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        }
      });

      res.json(response.data);
    } catch (error: any) {
      console.error("APIMart Generation Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to initiate generation" });
    }
  });

  // APIMart Task Query Proxy
  app.get("/api/query", async (req, res) => {
    const { task_id, model } = req.query;

    let baseUrl = APIMART_BASE_URL;
    let apiKey = process.env.APIMART_API_KEY;
    if (model === "APIKEYFUN") {
      baseUrl = APIKEYFUN_BASE_URL;
      apiKey = process.env.APIKEYFUN_API_KEY;
    } else if (model === "GPT-IMAGE-OFFICIAL") {
      apiKey = process.env.APIMART_API_KEY;
    }

    if (!apiKey) {
      return res.status(500).json({ error: "API key not configured" });
    }

    try {
      const response = await axios.get(`${baseUrl}/v1/tasks/${task_id}`, {
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
