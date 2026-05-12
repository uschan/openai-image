# 碎片视觉化 (AI Synthesizer Focus)

An advanced web application for AI image generation, prompt management, and social media post synthesis. Built with React, Vite, and an Express full-stack framework.

## Features

- **🎨 Multi-Model Image Generation**: Generate stunning images leveraging external APIs (Apimart AI).
- **📝 Prompt Workflows (Templates)**: Manage your prompt templates in a grid layout. Save, pin, and quickly utilize specific prompt structures.
- **✨ Prompt Enhancement**: Improve your image subjects automatically using **Google Gemini 2.5 Flash**.
- **📂 Category Management**: Group generated images into specified folders/categories.
- **📱 Post Content Generation**: Automatically generate social media posts (Title, Body, Tags) based on the image subject using **DeepSeek AI**. Includes regeneration options.
- **⬇️ Smart Download Logic**: Images are downloaded locally using the naming convention `{category_name}_{id}.jpg` preventing clutter and establishing easy organization.
- **📊 Detailed Statistics**: Tracks total image generation attempts, successful generations (consumed APIs), and failed attempts over time.
- **🗄️ Local State**: Automatically persists all data (images, categories, templates, and analytics stats) locally into JSON files using the integrated Express server.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, Lucide React (Icons), Motion (Animations), Dnd-Kit (Drag-and-Drop)
- **Backend**: Express.js, TypeScript (tsx)
- **AI Integrations**: 
  - Image Gen: Apimart API (Flux models natively supported)
  - Post Synthesis: DeepSeek API (`deepseek-chat`)
  - Prompt Enhancement: Google Gemini API (`gemini-2.5-flash`)

## Prerequisites

- Node.js (v18 or higher)
- API Keys for the respective AI services.

## Environment Setup

Create a `.env` file in the root directory and add the following keys:

```env
# Google Gemini API Key for prompt enhancement
GEMINI_API_KEY=your_gemini_api_key_here

# DeepSeek API Key for social media post content generation
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Apimart API Key for image generation
APIMART_API_KEY=your_apimart_api_key_here
```

## Installation & Running Locally

1. Clone the repository and navigate into the folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server (runs both Vite and Express):
   ```bash
   npm run dev
   ```
   The server runs on `http://localhost:3000`.

## Production Build

To build the application for a production environment:

1. Compile the static assets:
   ```bash
   npm run build
   ```
2. Start the production server:
   ```bash
   npm start
   ```

## Folder Structure & Persistence

- `/src`: Contains the React frontend logic and Tailwind styles.
- `/server.ts`: The Express backend handling API token proxies and JSON file storage.
- `*.json` (Data Files): When you use the app, it dynamically generates and updates `images.json`, `templates.json`, `categories.json`, and `stats.json` in the root backend directory to store your user data across sessions.

## Note on Local App Usage

When running locally, browser cross-origin download restrictions are mitigated via object URLs. Images downloaded through the UI will be named smartly and stored locally based on their assigned custom category name, or default to `download_<id>.jpg` if uncategorized.
