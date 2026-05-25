# WildSalt AI Image Studio

A self-hosted AI image generation workbench with prompt template management, drag-and-drop categorization, and social post synthesis. Built with React + TypeScript + Express.

## Features

### Image Generation
- **Multi-model**: GPT-IMAGE and Gemini 3 Pro via APIMart API
- **Async polling**: submit → poll → auto-download to local `downloads/`
- **Configurable**: aspect ratio (1:1 ~ 16:9), resolution (1K ~ 4K)
- **Subject-first naming**: files named `{subject}_{timestamp}_{id}.png` for natural grouping

### Prompt Management
- **Template library**: create, edit, pin, delete templates with `{SUBJECT}` variable
- **Quick Templates**: pinned templates shown in right sidebar; drag to reorder
- **Realized preview**: live prompt preview as you type subject
- **Gemini enhancement**: refine subjects with Gemini 2.5 Flash
- **Import/export**: share template libraries via JSON

### Image Organization
- **Categories**: unlimited custom categories with live counts
- **Drag-to-categorize**: drag image cards onto sidebar categories; files move on disk
- **Batch categorize**: select mode → multi-select → move to category
- **Flag dubitous images**: mark questionable results with 🚩 "存疑" badge + amber border
- **Delete with cleanup**: removes both database record and disk file
- **Image repair**: auto re-downloads missing local files from remote URLs on page load

### Search & Navigation
- **Ctrl+K**: toggle search bar; filter by subject or prompt text in real-time
- **Ctrl+Enter**: trigger image generation from anywhere
- **Default uncategorized view**: hide already-categorized images by default

### Social Post Generation
- **DeepSeek-powered**: generate Xiaohongshu-style posts (title + body + tags)
- **Regeneration**: re-generate if unsatisfied
- **Copy to clipboard**: per-section copy buttons

### Data & Export
- **JSON persistence**: `images.json`, `templates.json`, `categories.json`, `stats.json`
- **Export**: one-click download of templates + categories as JSON
- **Session timer**: live session duration in footer
- **API health indicators**: real-time status dots for Gemini / APIMart / DeepSeek

### Metadata Stripping
- **`clean_metadata.py`**: standalone tool to strip EXIF / XMP / PNG text / C2PA / AI watermarks
- **Byte-level cleaning**: PNG chunk reconstruction + JPEG segment rebuilding
- **Incremental**: SHA-1 registry skips already-cleaned files
- **Watch mode**: auto-processes new images via filesystem monitoring

```
python clean_metadata.py                    # default: downloads/image/
python clean_metadata.py /path/to/dir       # specific directory
python clean_metadata.py --no-watch         # one-shot only
python clean_metadata.py --force            # re-clean all
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4 |
| Backend | Express.js, `tsx` runner |
| Build | Vite 6 |
| UI | Lucide React (icons), Motion (animations), DnD-Kit (drag & drop) |
| AI | APIMart (image gen), DeepSeek (posts), Gemini (prompt enhancement) |

## Quick Start

```bash
npm install
npm run dev         # → http://localhost:3000
```

Requires `.env` with:

```env
GEMINI_API_KEY=     # optional, for prompt enhancement
DEEPSEEK_API_KEY=   # optional, for social post generation
APIMART_API_KEY=    # required, for image generation
```

## Project Structure

```
├── server.ts             # Express backend (API proxy + file storage)
├── src/
│   ├── App.tsx           # state + handlers + DnD orchestration
│   ├── components/
│   │   ├── Header.tsx        # top bar with API indicators + theme toggle
│   │   ├── LeftSidebar.tsx   # category list with drag-drop
│   │   ├── RightSidebar.tsx  # subject input, template, quick templates, config
│   │   ├── ImageGrid.tsx     # search bar, batch toolbar, image card grid
│   │   ├── ImageCard.tsx     # individual card: image, metadata, flag, delete
│   │   ├── SortableCategory.tsx
│   │   ├── TemplateLibrary.tsx
│   │   ├── HistoryTab.tsx
│   │   └── ModelsTab.tsx
│   ├── types.ts          # TypeScript interfaces
│   └── index.css         # Tailwind + custom theme
├── clean_metadata.py     # standalone metadata stripper
├── downloads/            # saved images (gitignored)
└── *.json                # runtime data files (gitignored)
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Enter` | Generate image |
| `Ctrl+K` | Toggle search bar |
| `ESC` | Close search bar |

## Deployment (VPS)

### Production build

```bash
npm run build        # compile static assets to dist/
npm start            # serve on port 3000 (NODE_ENV=production)
```

### nginx reverse proxy (optional)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### pm2 process manager

```bash
npm install -g pm2
pm2 start npm --name "wildsalt" -- start
pm2 save
pm2 startup
```

### Notes

- `.env` keys are read server-side only — never exposed to the browser
- `downloads/` grows over time; mount a volume or symlink to external storage if needed
- `images.json` can reach hundreds of MB; backup regularly
- `clean_metadata.py` requires `pip install Pillow watchdog`

## Architecture Notes

- **Image drag-and-drop** uses native HTML5 Drag API — zero React overhead, GPU-composited ghost image, works identically to the original vanilla JS version
- **Category reorder** and **template sort** use @dnd-kit since they involve few items and benefit from React state integration
- Framer Motion `layout` prop is intentionally omitted from image cards to avoid FPS drops during grid rendering
