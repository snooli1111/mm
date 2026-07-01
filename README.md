# Student Life Mindmap App

This is the editable folder-based source for the local student mindmap app.

## Folders

- `src/index.html`: app layout
- `src/styles.css`: app styles
- `src/app.js`: app behavior
- `tools/build-single-html.ps1`: builds a distributable single HTML file
- `dist/`: generated single HTML files for students

## Editing Workflow

1. Edit files in `src/`.
2. Open `src/index.html` in a browser for quick checks.
3. Build a single-file release into `dist/`.

Default build:

```powershell
.\tools\build-single-html.ps1
```

Versioned build:

```powershell
.\tools\build-single-html.ps1 -Version v0.1
```

The versioned command creates a file like:

```text
dist/생기부_마인드맵_앱_v0.1.html
```

The student project data is separate from the app. Students save their own work with the in-app `프로젝트 저장` button, which creates a `.json` project file.
