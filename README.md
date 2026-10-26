# Smart Traffic Management System

A static educational project demonstrating a four-way traffic simulation and integration with the five CAPP units. It uses HTML5, CSS3, vanilla JavaScript, and browser `localStorage`; no backend, database, build step, or API is required.

> **Safety notice:** all vehicle queues, arrival rates, water levels, signal decisions, and emergency events are simulated. This project is not a traffic control system and must not be used for real-world safety decisions. Water readings require actual physical sensors or a verified data source in a real deployment.

Traffic scenarios (balanced city flow, morning inbound peak, evening outbound peak, event release, and quiet night) demonstrate plausible demand patterns using editable simulated values. Vehicles arrive at each approach according to its selected scenario, and green phases serve vehicles from the active queue. These simplified scenarios are not live readings or validated traffic forecasts.

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
2. **Density and scenarios:** load each named traffic scenario and verify all four approach queues and arrival rates update. While running, confirm arrivals increase queues, green phases serve vehicles, queue counters change, and the served count increments. Change individual queues and use **Generate random traffic** as well.
3. **Signals and fairness:** test Start, Pause, Resume, and Reset. Observe the green → yellow → all-red → next green sequence. Confirm only one approach can show green, and that North, South, East, and West all get a turn under balanced or peak traffic rather than one busy road starving the others.
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

## GitHub repository and authentication

The private GitHub repository is [Atul-217/smart-traffic-management](https://github.com/Atul-217/smart-traffic-management). Its `main`, `dev`, and `uat` branches are pushed and track their matching remote branches.

Git for Windows is installed. If PowerShell reports that `git` is not recognized, close and reopen PowerShell or VS Code so Windows loads the updated user `PATH`, then verify:

```powershell
git --version
```

Git Credential Manager is configured to authenticate with GitHub. Run Git commands in a newly opened PowerShell terminal; complete the GitHub browser authorization when prompted. **Do not enter your GitHub account password as an HTTPS Git password or share credentials in chat.** If a credential prompt explicitly requests a password, use a GitHub personal access token in that local prompt, not the account password.

The repository remote is already configured:

```powershell
cd D:\Self\Projects\smart-traffic-management
git remote -v
git branch -vv
```

For subsequent work, commit to `dev`, merge/push `dev` into `uat` for testing, then merge/push `uat` into `main` for production. The initial project commit is already present on all three branches:

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
