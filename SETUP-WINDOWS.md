# Run Direct Apply on your Windows computer

This guide assumes you have never done this before. Follow the steps in order.
Setup takes about 30 minutes once. After that, it is one double-click a day.

**Cost: $0.** Everything runs on your computer. The only outside service is
Cloudflare's AI, which ranks the jobs. Its free plan needs no credit card, so you
cannot be charged.

**What you will have:** a page in your web browser at `http://localhost:3000/inbox`
that lists jobs from company career sites, best match first. It works only on
this computer, and only while the app is running.

---

## Before you start: how to type a command

Most steps say "run this command". Here is how:

1. Press the **Windows key**, type `cmd`, and click **Command Prompt**.
   A black window opens.
2. Type or paste the command, then press **Enter**.
3. Wait until the blinking cursor comes back before typing the next one.

To paste into Command Prompt, **right-click** inside the window.

> Use **Command Prompt**, not PowerShell. PowerShell can block `npm` with an
> error saying "running scripts is disabled on this system".

---

## Step 1: Install Node.js

Node.js is the program that runs the app.

1. Go to <https://nodejs.org>.
2. Click the big **LTS** download button. It downloads a file ending in `.msi`.
3. Open that file. Click **Next** on every screen and accept the defaults.
   On the screen titled "Tools for Native Modules", leave the box **unchecked**.
4. Click **Install**, then **Finish**.

**Check it worked:** open a **new** Command Prompt and run:

```
node -v
```

You should see a version like `v22.12.0` or higher. If you see
`'node' is not recognized`, restart your computer and try again.

---

## Step 2: Install Git

Git downloads the app's code and, later, its updates.

1. Go to <https://git-scm.com/download/win>.
2. Click **Click here to download** (the 64-bit installer).
3. Open the file. Click **Next** on every screen and accept the defaults, then **Install**.

**Check it worked:** open a **new** Command Prompt and run:

```
git --version
```

You should see something like `git version 2.47.0.windows.1`.

---

## Step 3: Download the app

Run these two commands, one at a time:

```
cd %USERPROFILE%\Documents
```

```
git clone -b claude/stoic-ptolemy-sha9gm https://github.com/bobinthomas/applydirect.git
```

If a window asks you to sign in to GitHub, click **Sign in with your browser** and
approve it. You'll only need to do this once.

This creates a folder **Documents → applydirect**. Now move into it:

```
cd applydirect
```

> Every command in the rest of this guide must be run from inside this folder.
> If you open a new Command Prompt later, run
> `cd %USERPROFILE%\Documents\applydirect` first.

---

## Step 4: Install the app's parts

```
npm install
```

This takes 2–5 minutes. You will see a lot of text scroll by, including some
`warn` lines and "vulnerabilities". **That is normal.** Wait for the cursor to come back.

---

## Step 5: Create a free Cloudflare account and connect it

The AI that reads each job and judges how well it fits you runs at Cloudflare.

1. Go to <https://dash.cloudflare.com/sign-up>.
2. Enter your email and a password, then click **Sign up**.
3. Open the email from Cloudflare and click the link to verify your address.
   You do **not** need to add a website or a payment method. If it asks you
   to pick a plan or add a domain, you can skip or close that.

Now connect this computer to that account. In Command Prompt run:

```
npx wrangler login
```

- If it asks `Ok to proceed? (y)`, type `y` and press Enter.
- Your browser opens a Cloudflare page. Click **Allow**.
- Back in Command Prompt you should see **Successfully logged in**.

**Check it worked:**

```
npx wrangler whoami
```

It should show your email address.

---

## Step 6: Check your profile (optional)

The app ranks jobs against your résumé and preferences. A starting version is in
**Documents → applydirect → seed → profile.md**. You can open it in Notepad
(right-click → Open with → Notepad) and edit it before the next step.

You can also skip this step and edit everything later on the app's **Settings** page.
That is usually easier.

---

## Step 7: Set up the app's database (only once)

```
npm run setup:local
```

You should see two green ✅ ticks and `wrote seed/seed.generated.sql`.

> **Run this only once.** Running it again resets your profile, so any changes
> you made on the Settings page would be lost.

---

## Step 8: Start the app

1. Open File Explorer and go to **Documents → applydirect**.
2. Double-click **Start Direct Apply** (or **Start Direct Apply.cmd**).

What happens:

- A black window titled **"Direct Apply - keep this window open"** appears. That
  is the app itself. Leave it open while you use the app.
- A second window shows progress. After a few seconds your browser opens
  `http://localhost:3000/inbox`. It will be empty the first time.
- The progress window says **"Pulling new jobs..."**, then **"Ranking new jobs
  with AI..."**. The first time this can take 5–10 minutes.
- When it says **Done**, go back to the browser and press **F5** to refresh.
  Your ranked jobs appear.

If **Windows Firewall** asks whether to allow Node.js, you can click **Cancel**.
The app only talks to your own computer, so it works either way.

**The first run shows some failed boards.** The starting list of companies is a
set of guesses. A wrong guess fails, and after four failures the app stops trying
that company. That is expected.

---

## Every day after that

1. Double-click **Start Direct Apply**.
2. Wait for **Done** in the progress window.
3. Refresh the inbox.

In the inbox you can **save** a job, mark it **applied**, or **dismiss** it. The
AI learns from what you dismiss. Click a job to see the full description and why
it scored the way it did.

**When you are finished,** close both black windows. That stops the app.

> If the app window is still open from earlier, close it before double-clicking
> **Start Direct Apply** again. Otherwise you will end up with two copies running.

### The pages

| Address | What it's for |
| --- | --- |
| `localhost:3000/inbox` | Your ranked job list |
| `localhost:3000/settings` | Edit your résumé, target job titles, keywords, locations and dealbreakers. Saving re-ranks every job against the new profile on the next run. |
| `localhost:3000/sources` | Build Google searches that find more companies. You can ignore this at first. |

---

## If something goes wrong

**`'npm' is not recognized` or `'node' is not recognized`**
Close Command Prompt and open a new one. If it still fails, restart the computer.
If it still fails after that, repeat Step 1.

**"running scripts is disabled on this system"**
You are in PowerShell. Use Command Prompt instead (see "Before you start").

**The progress window says "Every board failed"**
Your internet connection is probably down. Check it and run Step 8 again. Note:
if every board fails four days in a row, the app stops trying them. To reset that,
run this from the applydirect folder:

```
npx wrangler d1 execute direct-apply --local --command "UPDATE companies SET active = 1, fail_count = 0"
```

**"0 reviewed by AI", or jobs say "scored without the judge"**
Your Cloudflare login has probably expired. Run `npx wrangler login` again
(Step 5). It could also be that the free AI allowance ran out for the day: about
10,000 units, which is plenty for the ~30 jobs a day this reviews. It resets
every day at midnight UTC.

**The inbox page shows an error**
Usually the same expired Cloudflare login. Run `npx wrangler login`, then close
both windows and double-click **Start Direct Apply** again. If you can't log in
right now, open Command Prompt in the applydirect folder and run
`npm run dev:offline` instead. Everything works except the AI ranking.

**"Problem: Nothing answered at http://localhost:3000"**
The app window did not start. Look in the window titled "Direct Apply - keep
this window open" for a red error message.

**Start completely fresh** (deletes all jobs and your Settings changes)
Delete the `.wrangler` folder inside applydirect, then run `npm run setup:local` again.

---

## Getting updates

When new changes are pushed to the code, run these in the applydirect folder:

```
git pull
npm install
npm run db:migrate:local
```

The last command adds any new database tables. Your jobs and settings stay as they are.
