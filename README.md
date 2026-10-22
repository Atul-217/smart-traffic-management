# Smart Traffic Management System

A static educational project demonstrating a four-way traffic simulation and integration with the five CAPP units. It uses HTML5, CSS3, vanilla JavaScript, and browser `localStorage`; no backend, database, build step, or API is required.

> **Safety notice:** all vehicle counts, water levels, signal decisions, and emergency events are simulated. This project is not a traffic control system and must not be used for real-world safety decisions. Water readings require actual physical sensors or a verified data source in a real deployment.

## Files

```text
smart-traffic-management/
├── index.html
├── style.css
├── script.js
└── README.md
```

## Run from VS Code

1. Open **File → Open Folder...** and select this project folder.
2. Open `index.html`.
3. Either open it in your browser directly, or install/use the VS Code **Live Server** extension and select **Go Live**. No compilation is needed.
4. The app stores settings and a limited event history in the current browser's `localStorage`. Use the Reset controls to reset the simulation values.

If you have Python installed, an optional local web server can be started in the VS Code terminal:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`. Python is only an optional static-file server; it is not part of the application.

## Feature test checklist

1. **Overview:** check that the vehicle total, active phase, timer, and alert count change as the simulation runs.
2. **Density:** change each road slider and verify the count, density category, meter, dashboard total, and decision table update. Use **Generate random traffic**.
3. **Signals:** test Start, Pause, Resume, and Reset. Observe the green → yellow → all-red → next green sequence. Confirm that only one approach can show green.
4. **Automatic/manual:** select Manual and request a road. Set a water level above the critical threshold first and confirm a request for that unsafe road is denied.
5. **Timing and ALU:** change minimum/maximum timings; test addition, subtraction, comparison, green-duration calculation, ambulance logic, and water-alert logic.
6. **Parallel lab:** run the monitoring cycle and compare sequential and concurrent illustrative timings. The page explicitly notes that this does not prove CPU-level parallel execution.
7. **Waterlogging:** move a road to the warning threshold, then critical threshold. Confirm warning/critical status, alerts, safety recommendation, and that critical roads are not scheduled green. Test rising water and reset.
8. **Emergency:** request ambulance priority on a safe road. Confirm it waits for safe transition phases. Try a critical/unsafe road to verify it is not granted green. End the emergency and confirm normal scheduling resumes.
9. **Route safety and alerts:** verify unsafe roads are never suggested as alternatives. Clear resolved alerts after resetting water.
10. **Persistence:** change settings, refresh the page, and verify the settings/event history remain in this browser.
11. **Responsive layout:** narrow the browser to mobile width and check navigation, controls, cards, and intersection remain usable.

## CAPP integration

1. **Unit 1 — Introduction to CAPP:** the architecture flow shows simulated inputs → processing → decisions → signal control → dashboard output.
2. **Unit 2 — ALU:** actual JavaScript calculations perform arithmetic, comparisons, density ordering, phase duration, and logical emergency/water checks.
3. **Unit 3 — Control Unit:** the phase controller coordinates automatic/manual requests, timing, pause/resume/reset, and safe yellow/all-red transitions.
4. **Unit 4 — Parallel Architecture:** four independent asynchronous sensor tasks are compared with a sequential run. This illustrates concurrency, not guaranteed CPU-parallel work.
5. **Unit 5 — Parallel System:** sensor readings, ALU decisions, signal control, water status, and emergency handling cooperate through shared state and update the same interface.

## Git setup on Windows

The `git` command must be installed before it can be used in PowerShell. Download **Git for Windows** from <https://git-scm.com/download/win>, install it using the default options, then close and reopen PowerShell/VS Code. Check the installation:

```powershell
git --version
```

From this project directory, initialize `main` as the shared starting point, then create `dev` and `uat`:

```powershell
cd D:\Self\Projects\smart-traffic-management
git init -b main
git add index.html style.css script.js README.md
git commit -m "Build smart traffic simulation"
git switch -c dev
git switch -c uat
```

Create a **private** empty repository on GitHub using your own account, then use its repository URL below:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/smart-traffic-management.git
git push -u origin main
git push -u origin dev
git push -u origin uat
```

GitHub will prompt for browser authentication or a configured credential manager. Do not paste passwords or access tokens into source files or chat.

For subsequent work, commit to `dev`, merge/push `dev` into `uat` for testing, then merge/push `uat` into `main` for production:

```powershell
git switch dev
# edit and test files
git add .
git commit -m "Describe the change"
git push origin dev

git switch uat
git merge dev
git push origin uat

git switch main
git merge uat
git push origin main
```

## Netlify deployment

1. Sign in to Netlify and choose **Add new site → Import an existing project**.
2. Connect GitHub and grant access to the private project repository.
3. Set the production branch to `main`. Leave the build command empty and set the publish directory to `.` (the repository root).
4. In the site's **Branch deploys** settings, enable branch deploys and set the branch to `uat` if you want a separate staging deploy. Netlify account/site features may affect branch-deploy availability.
5. Save and deploy. Later pushes to `main` publish production; pushes to `uat` create/update its branch deploy.

For a manual static deploy instead, drag the project folder into Netlify Drop. To update it later, upload the folder again. No secret values or environment variables are used.
