<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Local Finance Insights

A privacy-focused personal finance tracker that runs entirely in your browser. All your financial data is stored locally using IndexedDB - no server, no cloud, no account required.

## Features

- **100% Local Storage**: All data stays on your device using browser IndexedDB
- **No Backend Required**: Pure frontend application - just open and use
- **Import CSV/Bank Statements**: Upload your bank transactions for analysis
- **Smart Categorization**: Create rules to automatically categorize transactions
- **Export/Import**: Move your data between devices with JSON export/import
- **Privacy First**: Your financial data never leaves your browser

## Run Locally

**Prerequisites:** Node.js (>=18), npm

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure AI keys (local-only):
   - Copy `.env.example` to `.env.local`
   - Set `GEMINI_API_KEY` and/or `OPENAI_API_KEY`

3. Start the AI service + frontend dev server:
   ```bash
   npm run dev:all
   ```

   (Or run them separately: `npm run ai-service` and `npm run dev`)

4. Open your browser to the URL shown in the terminal (http://localhost:3000)

### Security Note (Important)

This project **does not expose AI API keys to the browser**. AI categorization runs via a **local backend service** (`server/ai-service.mjs`) and the Vite dev server proxies `/api/*` calls to it.

If you deploy the frontend as a static site, keep the AI service private (or deploy it server-side) and do not add any `VITE_*` API keys.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory and can be served by any static file server.

## Data Management

### Export Data
Click the export button in the app to download all your data (transactions, categories, rules) as a JSON file. This can be used to:
- Back up your data
- Transfer data to another device
- Share data between browsers

### Import Data
Use the import function to load a previously exported JSON file. This will replace all current data with the imported data.

### Clear Data
Use the reset function to clear all data from your browser. This action cannot be undone.

## Technology Stack

- React 19 with TypeScript
- Vite for development and building
- IndexedDB for persistent local storage
- Tailwind CSS for styling
- Recharts for data visualization
