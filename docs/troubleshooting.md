# Troubleshooting

### Error codes

| Code | Meaning |
|------|---------|
| ERR-LCH-001 | Node.js is not installed — download from [nodejs.org](https://nodejs.org) |
| ERR-LCH-002 | Could not start the local server — try closing other apps using port 5179 |
| ERR-LIB-001 | Failed to read a PDF file |
| ERR-LIB-002 | Folder picker not supported — use "Add PDF" instead, or switch to Chrome/Edge |
| ERR-LIB-003 | Failed to download PDF from URL |
| ERR-LIB-004 | Save location picker is not supported in this browser |
| ERR-LKP-001 | PDF lookup search failed |
| ERR-LKP-002 | No PDFs found for that search |
| ERR-LKP-003 | Failed to load PDF preview |
| ERR-PDF-001 | Failed to load or parse a PDF |
| ERR-PDF-002 | Failed to render a page |
| ERR-DB-001 | Failed to save data locally |

### Log file

Server logs are written to **`logs/app.log`** in the project folder.

### Debug panel

In the app, triple-click the footer credit, or press **Ctrl+Shift+D**, to open the debug log panel.

### Folder import not working

The folder picker requires Chrome or Edge. On Safari or Firefox, use **Add PDF** to select files individually.

---
