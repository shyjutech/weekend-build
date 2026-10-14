# shyju.tech site — setup notes

Static site: `index.html` + `app.js` + `assets/` + `resources/` (free PDFs). No build step.

## 1. Waitlist form — Google Form "WeekendBuild waitlist" (CONFIGURED)

Emails go straight into a Google Form (and its linked Google Sheet). No other provider.
Until the three values below are filled in, the form validates the email and then says
**"Sign-ups aren't open yet, so your email was not saved."** It never stores emails in the browser.

### Create the form (5 minutes)
1. Go to https://forms.google.com → Blank form. Title it e.g. "WeekendBuild waitlist".
2. Add question 1: **Email** — Short answer — Required.
3. Add question 2: **List** — Short answer — not required. (The site fills it with `planner-waitlist`,
   so future starter-kit signups can use `starter-kit` and stay separate.)
4. Settings (⚙):
   - **Responses → Collect email addresses: "Do not collect"**
   - **Responses → "Restrict to users in … / Requires sign in": OFF**
   - Leave "Limit to 1 response" OFF.
   (If the form requires sign-in or collects verified emails, website submissions are silently rejected.)
5. Responses tab → **Link to Sheets** (optional, easier to read and export).

### Copy the three values into `app.js`
1. Click ⋮ (top right) → **Get pre-filled link**. Type `test@example.com` in Email and `test` in List → **Get link** → Copy.
   The link looks like:
   `https://docs.google.com/forms/d/e/1FAIpQL.../viewform?usp=pp_url&entry.1111111111=test@example.com&entry.2222222222=test`
2. In `app.js` set:
   ```js
   googleForm: {
     action: "https://docs.google.com/forms/d/e/1FAIpQL.../formResponse", // same link, viewform → formResponse, no "?..."
     emailField: "entry.1111111111", // the number before =test@example.com
     listField: "entry.2222222222",  // the number before =test
   },
   ```
   These values are public by design (anyone can see a public form); they are not secrets.

### Test once after setup (important)
Google Forms doesn't let a website read its response, so the site can confirm the email was
**sent** (and shows an error if the visitor is offline) but can't detect a wrong field ID or a
form that requires sign-in. After deploying:
1. Submit your own email from your phone on the live site.
2. Check the form's Responses tab / Sheet: the email and `planner-waitlist` should appear within a few seconds.
3. If nothing appears, re-check the `entry.` numbers and the settings in step 4.

What gets submitted: `Email = <visitor email>`, `List = planner-waitlist`, and — when the visitor
completed the planner preview — `Answers = <their 3 answers>` (e.g. `I need an idea. | A mobile app. | 2–3 hours.`).
There are two signup forms: one right after the preview results, and the "Notify me" pop-up. Both send the same fields. A hidden honeypot field
stops simple spam bots (they get a fake success and nothing is sent).

## 2. Analytics — NOT CONFIGURED YET

The page had no analytics before this change. `app.js` contains a `track()`
helper that sends custom events to whichever analytics script is present:
Vercel Web Analytics (`window.va`), Google Analytics (`window.gtag`) or
Plausible (`window.plausible`). With none installed it does nothing.

Events:

| event                         | when                                   | data                       |
|-------------------------------|----------------------------------------|----------------------------|
| `planner_preview_opened`      | the 3-question preview opens           | —                          |
| `planner_questions_completed` | the 3rd answer is submitted            | stage, platform, time      |
| `planner_results_viewed`      | the example results are shown          | stage, platform, time      |
| `notify_clicked`              | a "Notify me" button is clicked        | section id                 |
| `waitlist_submitted`          | the signup was sent to the Google Form | from: results / dialog     |

Email addresses are never sent to analytics.

To use Vercel Web Analytics: enable it in the Vercel project, then add before
`</body>` in `index.html`:
```html
<script>window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };</script>
<script defer src="/_vercel/insights/script.js"></script>
```
Check Vercel's current docs/plan for custom-event support before relying on it.

## 3. Paid guide (hidden this release)

The guide/purchase section is kept in `index.html` with the `hidden` attribute.
To bring it back: remove `hidden` and `aria-hidden` from `<section id="guide">`,
and set `CONFIG.buyUrl` and `CONFIG.price` in `app.js`.
