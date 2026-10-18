# SWE40006 Group G03: Presentation Script

Thursday 22 October 2026, 4:30 pm tutorial. 15 minutes of presentation plus 5 minutes of Q&A. Time warnings at 2 minutes and 1 minute remaining.

Deck: `Sem2_Presentation_G03.pptx` (draft 1). Speaker notes in the deck match this script.

## Timing plan

| Slide | Title | Speaker | Time | Running total |
|---|---|---|---|---|
| 1 | Title | Minh | 0:30 | 0:30 |
| 2 | Acknowledgement of Country | Minh | 0:10 | 0:40 |
| 3 | Overview | Minh | 1:00 | 1:40 |
| 4 | Project Background and Problem Statement | Minh | 1:30 | 3:10 |
| 5 | Project Scope and Objectives | Minh | 1:30 | 4:40 |
| 6 | Project Outcome/Deliverables | Tuan | 1:30 | 6:10 |
| 7 | Design Concepts & Trade-offs | Duc | 2:30 | 8:40 |
| 8 | Execution & Technical Challenges | Vinh | 2:00 | 10:40 |
| 9 | Deployment Demonstration | Tuan, Minh, Duc | 4:00 | 14:40 |
| 10 | Thank you | Minh | 0:20 | 15:00 |

Speaking time: Minh about 6:30, Tuan about 3:00, Duc about 3:00, Vinh about 2:00.

## Before the session (checklist)

- Tuan's laptop: logged in to GitHub, the demo pull request open in one tab, the Actions page in another. The PR changes one visible line of text on the home page.
- Minh's laptop (or the same laptop): the live Production site in a tab, the stats page bookmarked, one long URL ready to paste.
- Duc: Grafana logged in, the Production Overview dashboard open, time range set to "Last 15 minutes".
- Backup video on a USB stick and on the laptop. Repo URL on the last slide.
- Everyone: two questions ready for other groups (it is in the rubric).
- Agree who advances the slides. Suggest: the speaker says "next" and Minh clicks.

---

## Slide 1: Title (Minh, 0:30)

**On screen:** title slide with group, tutorial and names.

**Cue for Tuan:** the moment Minh starts talking, merge the demo pull request. Do not announce it. The pipeline needs about 5 minutes and must be finished before slide 9.

> Good afternoon everyone. We are Group 3. I'm Minh, and I built the application. With me are Tuan, who leads the team and built the CI/CD pipeline; Vinh, who owns testing and quality; and Duc, who owns the servers and the monitoring.
>
> Our project is a URL shortener. The app is small on purpose. The real product is the pipeline that delivers it, and that's what we'll show you today.

## Slide 2: Acknowledgement of Country (Minh, 0:10)

> Before we begin, we acknowledge the Wurundjeri People of the Kulin Nation, the Traditional Owners of the land on which we meet today, and pay our respects to Elders past and present.

(Or pause on the slide for a few seconds and move on.)

## Slide 3: Overview (Minh, 1:00)

**On screen:** four-environment strip, agenda, "who did what" cards.

> Our whole project fits in one sentence: a developer pushes to main, and tested code reaches Production after one click of approval.
>
> The strip across the top shows the four environments the unit asks for. GitHub is our code repository. GitHub Actions is the CI and build server. Staging is a small server on AWS EC2 where every merge is deployed and tested automatically. And Production is a separate EC2 server that only ever receives an image that has passed everything before it.
>
> On the left is what we'll cover. On the right is who built what, and each of us will present the part we built. Tuan will take you through the results, Duc through the architecture and the trade-offs, Vinh through the problems we hit, and then we'll do a live demo and take your questions.

## Slide 4: Project Background and Problem Statement (Minh, 1:30)

**On screen:** four problems on the left, the unit's four levels with ticks on the right.

> First, the context. The unit asked every team to design and build a DevOps toolchain with four environment instances, and a web application to push through it, in four levels: infrastructure, monitoring, application deployment with tests, and full automation.
>
> The problem we're solving is the one every team faces when there is no pipeline.
>
> One: deploying by hand is slow and repetitive. Build, copy, restart on the server, and it's done slightly differently every time.
>
> Two: untested changes reach users. Nothing stops a broken commit, so bugs are found by users instead of by tests.
>
> Three: there is no visibility in Production. Nobody knows which version is running, how fast it responds, or when it starts failing.
>
> Four: there is no way back. When a release goes wrong, an outage lasts as long as the fix takes.
>
> Our pipeline answers each of those: automated builds and deployments, tests that gate every change, monitoring on Production, and versioned images so we can roll back.
>
> On the right you can see the four levels from the unit, and the ticks: we completed all four. The rest of the talk is how.

## Slide 5: Project Scope and Objectives (Vinh, 1:30)

**On screen:** the three containers, the environments table, the automation boundary, the four targets.

> The application is a URL shortener. You paste a long link and get a short one. Every click on the short link is recorded, and each link has a statistics page with clicks per day, top referrers and top browsers.
>
> It runs as three Docker containers: Nginx serving the Vue front end, a Node and Express API, and PostgreSQL. One Docker Compose file runs the same three containers on our laptops, on Staging and on Production. Only the environment file changes. Every image is tagged with the full commit SHA, never "latest", so we always know exactly what is running.
>
> The table lists the four environments. GitHub holds the code, with a branch per issue, pull request reviews and a protected main branch. GitHub Actions runs lint, the unit and integration tests, builds the images, scans them with Trivy, and pushes them to the GitHub Container Registry. Staging gets every merge, with a health smoke test and the Playwright end-to-end tests. Production gets the same image after one manual approval, and it is monitored.
>
> That approval is our automation boundary, and it's deliberate: everything up to Staging and the end-to-end tests is automatic, but a human says yes before Production.
>
> These are the targets we set in our Project Brief: 80 percent unit test coverage, under 5 minutes from push to Production, zero critical vulnerabilities in the images, and every merge deployed to Staging. Tuan will show you how we did against them.

## Slide 6: Project Outcome/Deliverables (Tuan, 1:30)

**On screen:** targets vs actual table on the left, the real run timeline on the right.

> Thanks Vinh. This table compares the targets from our brief with what we measured.
>
> Coverage: the target was 80 percent. We reached 98.7 percent, with 121 unit tests, 3 integration tests against a real PostgreSQL, and 4 Playwright end-to-end tests against Staging.
>
> Speed: the target was under 5 minutes from push to Production. On this run, Staging was live after 2 minutes 21 seconds, the end-to-end tests finished at 3 minutes 7, and Production was live at 4 minutes 56. That includes about one minute waiting for the approval click.
>
> Security: Trivy scans both images on every run, and a fixable critical vulnerability fails the build.
>
> Every merge deploys to Staging with a health smoke test. Monitoring is live on Production with six Grafana panels. The last row, rollback, is the piece still in progress: the previous image SHA is already kept on the server, and the one-command rollback workflow is being finished this week.
>
> The chart on the right is one real run on main, from the GitHub Actions timings. The three test jobs run in parallel, then the two images build in parallel, then Staging, then the end-to-end tests, the grey bar is the approval wait, and the red bar is the Production deploy. Next, Duc on the design.

## Slide 7: Design Concepts & Trade-offs (Duc, 2:30)

**On screen:** architecture diagram, design concepts, tool matrix.

> This is the architecture, left to right.
>
> A developer pushes a branch and opens a pull request on GitHub. Main is protected and CODEOWNERS makes sure the right person reviews. GitHub Actions lints the code, runs the unit and integration tests, builds the two Docker images, scans them with Trivy, and pushes them to the GitHub Container Registry tagged with the commit SHA.
>
> That same image is deployed to Staging, where the smoke test and the Playwright end-to-end tests run. If they pass, the run waits for one approval, and the identical image goes to Production. Production also runs the monitoring stack: Prometheus scrapes the API's metrics endpoint plus node_exporter and cAdvisor, and Grafana shows CPU, memory, disk, network, request rate and p95 latency.
>
> Four design concepts drive this. Build once, promote the same image, so what we tested is what runs. Same Compose file and deploy script on both servers, so Staging is a true rehearsal for Production. Trunk-based development with a branch per issue and squash merges. And a health endpoint that gates every deployment.
>
> Now the trade-offs, in the table.
>
> CI: GitHub Actions over Jenkins and GitLab CI. There is no server to run or patch, the pipeline lives next to the code, and the free minutes cover a student project.
>
> Hosting: AWS EC2 over DigitalOcean and local VMs. We needed public IPs, security groups and the free tier, and I had set up EC2 before.
>
> Runtime: Docker Compose over Kubernetes. Three containers on one host do not justify a cluster; Kubernetes would be complexity without benefit.
>
> Monitoring: Prometheus and Grafana over CloudWatch and Datadog. Open source, runs beside the app on the same server, no vendor cost or lock-in.
>
> Tests: Vitest, Supertest and Playwright. One JavaScript stack end to end, and Playwright is fast and reliable in CI. Vinh will now cover what went wrong along the way.

## Slide 8: Execution & Technical Challenges (Vinh, 2:00)

**On screen:** four problem and fix cards.

> Four problems that only appeared when the pieces met, and how we handled them. Each one was caught by a review, a test or a log, which is the point of the pipeline.
>
> One: wrong metric labels on failed requests. Our metrics label every request with its route pattern. Tuan noticed in code review that requests which failed inside a mounted router were labelled wrongly, because Express resets the base URL when an error leaves the router. Minh reproduced it, added a one-line middleware that remembers the mount path, and wrote a unit test where the database query rejects. That test now guards it.
>
> Two: a Docker network created by hand breaks deploys. The monitoring stack had to join the app's network on Production before the app was deployed there. Creating the network manually would have made the first real deploy fail, because Compose checks the network labels. So Tuan ran the first Production deploy with the normal deploy script, and Prometheus joins the network as external.
>
> Three: the word "deploy" vanished from our CI logs. The SSH user is called deploy and it was stored as a secret. GitHub masks every secret value in logs, so every "deploy" in the logs, including step names, became three stars. We moved the user name to a variable. Only the host, the key and the host key stay secret.
>
> Four: the metrics endpoint must be scraped but never public. Nginx returns 404 for slash metrics, Prometheus scrapes the API directly on the Docker network, and Express uses case-sensitive routing so slash capital METRICS cannot slip past the exact Nginx match.
>
> Now the demo. Tuan.

## Slide 9: Deployment Demonstration (Tuan, Minh, Duc, 4:00)

**On screen:** the seven demo steps, then switch to the browser.

### Tuan (steps 1 to 3, about 1:30)

> When Minh started talking, about ten minutes ago, I merged a pull request that changes one line of visible text on the home page. Nothing else. Here is the run it triggered.

Switch to the Actions run page.

> The three test jobs, the two image builds with the Trivy scan, the Staging deploy and the end-to-end tests are all green. Here is the commit SHA; remember the first few characters. The run is now waiting on the Production approval. I'll approve it.

Click "Review deployments", tick production, approve.

> Production takes about a minute: the server pulls the image for this SHA, restarts the containers, and the health check must pass with that same SHA before the job turns green. While it runs, Minh will show the site.

### Minh (steps 4 and 5, about 1:30)

Switch to the live site.

> This is the live Production site. Let me refresh. The new text is there, and the footer shows the first seven characters of the same SHA Tuan just approved. Nothing was copied to the server by hand.
>
> Now the app itself. I'll paste a long URL, and get a short link. Open it: it redirects, and the click is recorded. Open it a couple more times. Now the stats page: total clicks, clicks per day, browsers and referrers. Every one of those clicks was also counted by the metrics endpoint, which Duc will show.

### Duc (step 6, about 0:30)

Switch to Grafana.

> This is Grafana on Production, last 15 minutes. The request rate panel shows the clicks Minh just made, split by route, and the p95 latency stays at a few milliseconds. The server panels show CPU, memory, disk and network for the same period.

### Tuan (step 7, about 0:30)

Switch back to the server or Actions.

> Finally, rollback. The server keeps the SHA that ran before. One command redeploys it, and the footer shows the old version again. The same health check protects the rollback.

If #13 is not merged by Thursday, replace with:

> The server keeps the SHA that ran before in a file next to the current one, so a rollback is the same deploy script with the previous SHA. The one-command workflow for it is being finished this week.

**If anything fails live:** Tuan says "we'll switch to the recording" and plays the backup video from the same step.

## Slide 10: Thank you (Minh, 0:20)

> That's our pipeline. The code, the workflow, the deploy scripts and the monitoring configuration are all in the repository on the screen. Thank you, and we're happy to take questions.

Minh chairs the Q&A: repeat each question briefly, then hand it to the right person. Pipeline and deployment to Tuan, tests to Vinh, servers and Grafana to Duc, the app to Minh. If someone gets stuck, Minh bridges.

---

## Likely questions and short answers

**Why a manual approval instead of fully automatic deployment?**
Tuan: Fully automatic is one setting away; the job already deploys the same SHA with no rebuild. We kept one approval because the unit asked for deferred or automatic deployment, and for a two-server setup a human check before Production costs a minute and prevents a bad release at 2 am.

**What happens if the health check fails on Production?**
Tuan: The deploy job fails and the run goes red. `deploy.sh` only updates the running version after the images pull successfully, and `docker compose up --wait` fails if a container is not healthy within 180 seconds. The previous SHA is kept in `image.env.previous` for rollback.

**Why is coverage 98 percent and not 100?**
Vinh: The remaining lines are startup code such as `server.js` calling `listen()` and process signal handlers, which are exercised by the integration and end-to-end tests rather than unit tests. The gate is 80 percent; new code must keep it above that or CI fails.

**How do you stop secrets leaking?**
Tuan: Secrets live in GitHub environments, not the repo; `.env` files are never committed and `.env.example` has placeholders; GitHub masks secret values in logs; the SSH key is removed from the runner after each deploy, even when a step fails.

**Why Docker Compose and not Kubernetes?**
Duc: Three containers on one host. Compose gives us the same file locally and on both servers. Kubernetes would add a control plane, more cost and more failure modes for no benefit at this scale.

**What does the monitoring cost in resources?**
Duc: Grafana about 48 MiB, Prometheus about 31 MiB, cAdvisor about 19 MiB, all under their limits, with 7 days of retention on a t3.small.

**How do you know Staging matches Production?**
Minh: Same Compose file, same deploy script, same SHA-tagged image, same `/health` smoke test. Only the environment file differs: database password, base URL and the IP hash salt.

**Why is `/metrics` blocked publicly?**
Minh: It exposes request counts and process details. Prometheus scrapes it directly on the Docker network, so the internet never needs to reach it.

**What would you change with more time?**
Any: Alerting rules with notifications (in progress), a load test to size the servers, blue-green or canary deploys, and HTTPS with a domain.

## Questions to ask other groups (two each)

- How does your pipeline decide what goes to Production: automatic, approval, or manual?
- What stops a broken commit from reaching your Production server?
- How do you know which version is running on your Production server right now?
- Which monitoring metric was the most useful during your demo, and why?
- What was the hardest problem you hit, and how did you find it?
- If a deploy fails halfway, what state is your server left in?
- Did you pin tool and image versions, and did anything break when a version changed?
- How long does your pipeline take from push to live, and which step is slowest?
