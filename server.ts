import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import axios from "axios";
import https from "https";
import { createServer as createHttpServer } from "http";
import sharp from "sharp";
import { AtlasDatabase, safeFolderName, safeStorageKey, type ImageRecord } from "./server/database.ts";
import { EnvConfig, PROVIDER_ENV_KEYS, isProviderName, type ProviderName } from "./server/env-config.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
const THUMBNAILS_DIR = path.join(__dirname, "cache", "thumbnails");

const localUrlFor = (relativePath: string) => `/downloads/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;

const providerApiKey = (provider: ProviderName) => process.env[PROVIDER_ENV_KEYS[provider]];

const apiError = (error: unknown) => error instanceof Error ? error.message : String(error);

const categoryErrorStatus = (error: unknown) => {
  const message = apiError(error);
  if (/not found/i.test(message)) return 404;
  if (/UNIQUE constraint failed/i.test(message)) return 409;
  if (/cannot be deleted|still contains|Move or delete/i.test(message)) return 409;
  return 400;
};

const moveFilename = (row: Record<string, unknown>, sourcePath: string) => {
  const current = path.basename(sourcePath);
  if (/^[\x20-\x7e]+$/.test(current)) return current;
  const parsed = path.parse(current);
  const extension = /^\.[a-z0-9]{1,8}$/i.test(parsed.ext) ? parsed.ext.toLowerCase() : '.png';
  const timestamp = Number(row.timestamp) || Date.now();
  return `${timestamp}_${safeStorageKey(String(row.id || 'image'), 'image')}${extension}`;
};

const samePath = (left: string, right: string) => path.resolve(left).toLocaleLowerCase() === path.resolve(right).toLocaleLowerCase();

async function availableTargetPath(targetDir: string, preferredName: string, imageId: string, sourcePath: string) {
  const parsed = path.parse(preferredName);
  let candidate = path.join(targetDir, preferredName);
  if (samePath(candidate, sourcePath)) return candidate;
  let attempt = 0;
  while (await fs.access(candidate).then(() => true).catch(() => false)) {
    const suffix = attempt === 0 ? safeStorageKey(imageId, 'image').slice(-8) : `${safeStorageKey(imageId, 'image').slice(-6)}-${attempt}`;
    candidate = path.join(targetDir, `${parsed.name}_${suffix}${parsed.ext}`);
    attempt += 1;
  }
  return candidate;
}

const resolveDownloadPath = (localUrl: string) => {
  if (!localUrl?.startsWith('/downloads/')) throw new Error('Invalid download path');
  const relative = decodeURIComponent(localUrl.slice('/downloads/'.length));
  const resolved = path.resolve(DOWNLOADS_DIR, relative);
  const root = path.resolve(DOWNLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error('Download path escapes media directory');
  return resolved;
};

const recoverPendingFileOperations = async (database: AtlasDatabase) => {
  for (const operation of database.getPendingFileOperations()) {
    const sourcePath = String(operation.source_path);
    const targetPath = String(operation.target_path);
    const sourceExists = await fs.access(sourcePath).then(() => true).catch(() => false);
    const targetExists = await fs.access(targetPath).then(() => true).catch(() => false);
    if (sourceExists || !targetExists) continue;
    try {
      const targetRelative = path.relative(DOWNLOADS_DIR, targetPath);
      if (operation.image_id) {
        database.completeFileOperation(String(operation.id), String(operation.image_id), localUrlFor(targetRelative));
      } else {
        const sourceRelative = path.relative(DOWNLOADS_DIR, sourcePath);
        database.rewriteSubjectFolder(String(operation.subject_id), sourceRelative, targetRelative, String(operation.id));
      }
      console.log(`[recovery] completed file operation ${operation.id}`);
    } catch (error) {
      console.error(`[recovery] failed file operation ${operation.id}:`, error);
    }
  }
};

async function startServer() {
  await fs.mkdir(DOWNLOADS_DIR, { recursive: true }).catch(() => {});
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true }).catch(() => {});
  const database = new AtlasDatabase(__dirname);
  const envConfig = new EnvConfig(__dirname);
  await recoverPendingFileOperations(database);
  const app = express();
  const httpServer = createHttpServer(app);
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use('/downloads', express.static(DOWNLOADS_DIR));

  app.get('/api/thumbnails/:id', async (req, res) => {
    try {
      const image = database.getImageById(req.params.id);
      if (!image?.localUrl) return res.status(404).end();
      const sourcePath = resolveDownloadPath(image.localUrl);
      const sourceStat = await fs.stat(sourcePath);
      const thumbnailPath = path.join(THUMBNAILS_DIR, `${safeFolderName(req.params.id, 'image')}.webp`);
      const thumbnailStat = await fs.stat(thumbnailPath).catch(() => null);
      if (!thumbnailStat || thumbnailStat.mtimeMs < sourceStat.mtimeMs) {
        await sharp(sourcePath)
          .rotate()
          .resize({ width: 480, height: 640, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 78, effort: 4 })
          .toFile(thumbnailPath);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(thumbnailPath);
    } catch (error) {
      console.error('Thumbnail error:', error);
      res.status(404).end();
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      keys: {
        gemini: envConfig.isConfigured('gemini'),
        apimart: envConfig.isConfigured('apimart'),
        apikeyfun: envConfig.isConfigured('apikeyfun'),
        deepseek: envConfig.isConfigured('deepseek'),
      }
    });
  });

  app.get("/api/bootstrap", (req, res) => {
    try { res.json(database.getBootstrap()); }
    catch (error) { console.error('Bootstrap error:', error); res.status(500).json({ error: 'Failed to load workspace' }); }
  });

  app.post('/api/categories', (req, res) => {
    try {
      const category = database.createCategory(req.body || {});
      res.status(201).json({ category });
    } catch (error) {
      res.status(categoryErrorStatus(error)).json({ error: apiError(error) });
    }
  });

  app.patch('/api/categories/:id', (req, res) => {
    try {
      const category = database.updateCategory(req.params.id, req.body || {});
      res.json({ category });
    } catch (error) {
      res.status(categoryErrorStatus(error)).json({ error: apiError(error) });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      if (!database.deleteCategory(req.params.id)) return res.status(404).json({ error: 'Category not found' });
      res.json({ success: true });
    } catch (error) {
      res.status(categoryErrorStatus(error)).json({ error: apiError(error) });
    }
  });

  app.put('/api/categories/order', (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
      if (!ids.length) return res.status(400).json({ error: 'Category order is required' });
      database.reorderCategories(ids);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: apiError(error) });
    }
  });

  app.get('/api/settings/providers', (req, res) => {
    const providers = database.listProviderBaseUrls().map(config => ({
      ...config,
      keyConfigured: isProviderName(config.provider) ? envConfig.isConfigured(config.provider) : false,
    }));
    res.json({ providers });
  });

  app.put('/api/settings/providers/:provider', (req, res) => {
    try {
      if (!isProviderName(req.params.provider)) return res.status(404).json({ error: 'Provider not found' });
      const provider = req.params.provider;
      const baseUrl = req.body?.baseUrl === undefined
        ? database.getProviderBaseUrl(provider)
        : database.updateProviderBaseUrl(provider, String(req.body.baseUrl));
      if (req.body?.apiKey !== undefined) envConfig.setProviderKey(provider, String(req.body.apiKey));
      res.json({ provider, baseUrl, keyConfigured: envConfig.isConfigured(provider) });
    } catch (error) {
      res.status(400).json({ error: apiError(error) });
    }
  });

  app.delete('/api/settings/providers/:provider/key', (req, res) => {
    try {
      if (!isProviderName(req.params.provider)) return res.status(404).json({ error: 'Provider not found' });
      envConfig.setProviderKey(req.params.provider, null);
      res.json({ provider: req.params.provider, keyConfigured: false });
    } catch (error) {
      res.status(400).json({ error: apiError(error) });
    }
  });

  app.get("/api/data", (req, res) => {
    try { res.json({ ...database.getBootstrap(), images: [] }); }
    catch (error) { console.error('Legacy data endpoint error:', error); res.status(500).json({ error: 'Failed to load workspace' }); }
  });

  app.get("/api/images", (req, res) => {
    try {
      res.json(database.listImages({
        categoryId: typeof req.query.category === 'string' ? req.query.category : undefined,
        query: typeof req.query.q === 'string' ? req.query.q : undefined,
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
        limit: Number(req.query.limit) || 60,
        groupBySubject: req.query.group !== 'false',
      }));
    } catch (error) {
      console.error('Image query error:', error);
      res.status(500).json({ error: 'Failed to query images' });
    }
  });

  app.get("/api/subjects/:subject/images", (req, res) => {
    try { res.json({ images: database.getSubjectImages(req.params.subject) }); }
    catch (error) { console.error('Subject query error:', error); res.status(500).json({ error: 'Failed to query subject' }); }
  });

  app.post("/api/images/upsert", (req, res) => {
    try { res.json({ image: database.upsertImage(req.body as ImageRecord) }); }
    catch (error) { console.error('Image upsert error:', error); res.status(500).json({ error: 'Failed to save image record' }); }
  });

  app.patch("/api/images/:id", (req, res) => {
    try {
      const image = database.updateImage(req.params.id, req.body);
      if (!image) return res.status(404).json({ error: 'Image not found' });
      res.json({ image });
    } catch (error) { console.error('Image update error:', error); res.status(500).json({ error: 'Failed to update image' }); }
  });

  app.post("/api/save", async (req, res) => {
    try {
      const { templates, stats } = req.body;
      database.saveSettings({ templates, stats });
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving data:", error);
      res.status(500).json({ error: "Failed to save data" });
    }
  });

  app.post("/api/save-image", async (req, res) => {
    const { id, url, subject } = req.body;

    const downloadImage = async (retries = 3): Promise<Buffer> => {
      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const fetchRes = await axios.get(url, {
            responseType: "arraybuffer",
            headers: {
              "Authorization": `Bearer ${process.env.APIMART_API_KEY}`,
              "Accept": "*/*",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 15000,
          });
          if (fetchRes.status < 200 || fetchRes.status >= 300) {
            throw new Error(`HTTP ${fetchRes.status}`);
          }
          return fetchRes.data;
        } catch (e: any) {
          const msg = e.code || e.message;
          console.log(`[save-image] attempt ${attempt + 1}/${retries} failed for ${id}: ${msg}`);
          if (attempt === retries - 1) throw e;
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      throw new Error("unreachable");
    };

    try {
      const data = await downloadImage();

      const storage = database.getSubjectStorage(subject || 'Untitled');
      await fs.mkdir(storage.absolutePath, { recursive: true });
      const filename = `${Date.now()}_${safeFolderName(String(id || 'image'), 'image')}.png`;
      const relativePath = path.join(storage.relativePath, filename);
      const filepath = path.join(DOWNLOADS_DIR, relativePath);

      await fs.writeFile(filepath, data);

      res.json({ localUrl: localUrlFor(relativePath), categoryId: storage.categoryId });
    } catch(e) {
      console.error("save-image error", e);
      res.status(500).json({error: String(e)});
    }
  });

  app.post("/api/move-image", async (req, res) => {
    const { imageId, localUrl, categoryId } = req.body;
    try {
      if (!categoryId || categoryId === 'all') return res.status(400).json({ error: 'A destination category is required' });
      const bundle = database.getSubjectForImage(imageId, localUrl);
      if (!bundle?.subject) return res.status(404).json({ error: 'Image record not found' });

      const subjectId = String(bundle.subject.id);
      const categoryFolder = database.getCategoryFolder(categoryId);
      const targetRelativeDir = categoryFolder;
      const targetDir = path.join(DOWNLOADS_DIR, targetRelativeDir);
      const oldFolderPath = bundle.subject.folder_path ? String(bundle.subject.folder_path) : '';

      await fs.mkdir(targetDir, { recursive: true });
      for (const row of bundle.images) {
        const rowLocalUrl = row.local_url ? String(row.local_url) : '';
        if (!rowLocalUrl.startsWith('/downloads/')) continue;
        const sourcePath = resolveDownloadPath(rowLocalUrl);
        if (path.dirname(sourcePath) === targetDir) continue;
        try {
          await fs.access(sourcePath);
        } catch {
          continue;
        }
        const filename = moveFilename(row, sourcePath);
        const targetPath = await availableTargetPath(targetDir, filename, String(row.id), sourcePath);
        if (samePath(sourcePath, targetPath)) continue;
        const operationId = database.recordFileOperation({ imageId: String(row.id), subjectId, sourcePath, targetPath });
        let moved = false;
        try {
          await fs.rename(sourcePath, targetPath);
          moved = true;
          database.completeFileOperation(operationId, String(row.id), localUrlFor(path.relative(DOWNLOADS_DIR, targetPath)));
        } catch (error) {
          if (!moved) database.failFileOperation(operationId, String(error));
          throw error;
        }
      }

      const oldFolderParts = oldFolderPath.split(/[\\/]+/).filter(Boolean);
      if (oldFolderParts.length > 1 && oldFolderPath !== targetRelativeDir) {
        const oldDirectory = path.resolve(DOWNLOADS_DIR, oldFolderPath);
        const downloadsRoot = path.resolve(DOWNLOADS_DIR);
        if (oldDirectory.startsWith(`${downloadsRoot}${path.sep}`)) {
          await fs.rmdir(oldDirectory).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error;
          });
        }
      }

      database.finishSubjectMove(subjectId, categoryId, targetRelativeDir);
      const movedImage = imageId ? database.getImageById(imageId) : database.getSubjectImages(String(bundle.subject.name))[0];
      res.json({ localUrl: movedImage?.localUrl, categoryId, subject: String(bundle.subject.name), movedAsSubject: true });
    } catch(e) {
      console.error("move-image error", e);
      res.status(500).json({error: String(e)});
    }
  });

  app.post("/api/delete-image", async (req, res) => {
      const { id, localUrl } = req.body;
      const image = id ? database.getImageById(id) : null;
      const effectiveLocalUrl = image?.localUrl || localUrl;
      if (effectiveLocalUrl) {
          try {
              const filepath = resolveDownloadPath(effectiveLocalUrl);
              await fs.unlink(filepath);
          } catch (e: any) {
              if (e?.code !== 'ENOENT') console.log("Delete failed", e);
          }
      }
      if (id) {
          try {
              database.deleteImage(id);
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
    let baseUrl = database.getProviderBaseUrl('apimart');
    let apiKey = providerApiKey('apimart');
    if (model === "GPT-IMAGE-OFFICIAL") {
      apiModel = "gpt-image-2-official";
    } else if (model === "APIKEYFUN") {
      apiModel = "gpt-image-2";
      baseUrl = database.getProviderBaseUrl('apikeyfun');
      apiKey = providerApiKey('apikeyfun');
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
      const apiRes = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
        },
          body: JSON.stringify({
            model: apiModel,
            prompt,
            n: 1,
            size,
            stream: true,
            response_format: "b64_json",
          }),
      });

      if (!apiRes.ok) {
        return res.status(apiRes.status).json({ error: await apiRes.text() });
      }

      const reader = apiRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const data = frame.split(/\r?\n/)
            .filter(line => line.startsWith("data:"))
            .map(line => line.slice(5).trim())
            .join("\n");

          if (!data || data === "[DONE]") continue;

          let event: any;
          try { event = JSON.parse(data); } catch { continue; }
          if (event.type === "image_generation.completed") {
            const b64 = event.b64_json || event.data?.[0]?.b64_json;
            const subject = String(req.body.subject || prompt.slice(0, 80) || 'Untitled');
            const storage = database.getSubjectStorage(subject);
            await fs.mkdir(storage.absolutePath, { recursive: true });
            const filename = `${Date.now()}_${safeFolderName(String(req.body.imageId || 'image'), 'image')}.png`;
            const relativePath = path.join(storage.relativePath, filename);
            const filepath = path.join(DOWNLOADS_DIR, relativePath);
            await fs.writeFile(filepath, Buffer.from(b64, "base64"));
            return res.json({ provider: "apikeyfun", localUrl: localUrlFor(relativePath), prompt, subject, categoryId: storage.categoryId });
          }
        }
      }

      return res.status(500).json({ error: "Stream ended without completed event" });
    }

    try {
      console.log("[apimart] sending size:", actualSize, "resolution:", resolution);
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

    let baseUrl = database.getProviderBaseUrl('apimart');
    let apiKey = providerApiKey('apimart');
    if (model === "APIKEYFUN") {
      baseUrl = database.getProviderBaseUrl('apikeyfun');
      apiKey = providerApiKey('apikeyfun');
    } else if (model === "GPT-IMAGE-OFFICIAL") {
      apiKey = providerApiKey('apimart');
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
    const apiKey = providerApiKey('gemini');
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
    }

    try {
      const { subject } = req.body;
      const response = await axios.post(
        `${database.getProviderBaseUrl('gemini')}/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
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
    const apiKey = providerApiKey('deepseek');
    if (!apiKey) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured" });
    }

    try {
      const { subject } = req.body;
      const response = await axios.post(
        `${database.getProviderBaseUrl('deepseek')}/chat/completions`,
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
      server: { middlewareMode: true, hmr: { server: httpServer } },
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

  httpServer.listen(PORT, "127.0.0.1", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
