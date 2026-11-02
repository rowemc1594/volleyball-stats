# Setting up Supabase (one time)

Everything here is done in the Supabase website. None of it needs a terminal.

## 1. Create the tables (paste one file)

1. Open your project, then **SQL Editor** in the left menu, then **New query**.
2. Open `supabase/schema.sql` from this repo, copy **all** of it, paste it into the editor.
3. Click **Run**. You should see "Success. No rows returned". It is safe to run again.

This creates four tables (players, matches, sets, events) and turns on **row-level security**:
a logged-in owner can only see and change their own rows, and a logged-out visitor gets nothing.

## 1b. Turn on sharing (paste a second file) - Phase 5

Do the same thing with `supabase/share.sql`: **SQL Editor -> New query**, paste the whole file,
**Run**. Run it **after** `schema.sql`. It is safe to run again.

It adds a share-links table that only you can see, and one locked-down function that logged-out
viewers use to read stats with a valid link. Revoking a link in the app stops it working at once.

## 2. Tell Supabase where the app lives

**Authentication → URL Configuration**

- **Site URL:** `https://rowemc1594.github.io/volleyball-stats/`
- **Redirect URLs:** add the same address.

## 3. Make the login email contain a code

The app signs you in by typing a short code from the email, not by tapping a link. (On an iPhone
a link opens in Safari, which is a different storage area from the installed app, so the app
would never see you as signed in. A code typed into the app avoids that.)

**Authentication → Email Templates.** Edit **both** the **Magic Link** and the **Confirm signup**
template (new accounts get the second one). Set the subject to `Your Side Out Stats code` and
replace the body with:

```html
<p>Your sign-in code for Side Out Stats is:</p>
<h2>{{ .Token }}</h2>
<p>It expires in an hour. If you did not ask for it, ignore this email.</p>
```

Do not keep the `{{ .ConfirmationURL }}` link in the body.

## 4. Give the website the two public values

The values live in GitHub, not in the code. In the repo: **Settings → Secrets and variables →
Actions → Variables tab → New repository variable**:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | your project URL, `https://<project-id>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the **publishable** key (`sb_publishable_…`) |

Then push any change (or open **Actions → Deploy to GitHub Pages → Run workflow**) so the site is
rebuilt with them.

Never use the **secret** key (`sb_secret_…`) or the old `service_role` key anywhere in this project.

## 5. Optional but recommended: lock sign-ups after you have signed in

Anyone who types an email can request a code, and would get an empty account of their own (they
can never see your rows). To stop even that, sign in once yourself, then go to **Authentication →
Sign In / Providers** and turn **off** "Allow new users to sign up".

## Good to know

- Supabase's built-in email sender allows only a few emails per hour. That is plenty here, because
  you stay signed in on the phone. If you hit the limit, wait an hour.
- Use the **same email** on every device. That is what links them to the same data.
- To test locally, put the two values in a file called `.env.local` in the project folder. It is
  ignored by git, so it is never committed.
