# True Wild Coastal waiver: Supabase setup

This turns the waiver app into a real backend. Every signed waiver lands in one
central database, you get a dashboard that works across every device, and each
submission is emailed to you and to the guest with the PDF attached.

You can do this in two stages. Stage A (storage and dashboard) takes about
fifteen minutes and is useful on its own. Stage B (automatic email) adds Resend.

---

## Stage A: central storage and dashboard

**1. Create a project**
Go to supabase.com, create a free account, and create a new project. Pick a
region close to BC (for example, West US). Wait for it to finish provisioning.

**2. Create the table**
Open SQL Editor, click New query, paste the contents of `supabase-setup.sql`,
and click Run. This creates the `waivers` table and locks it down with row
level security so guests can submit but never read anyone else's waiver.

**3. Connect the app**
In Supabase, go to Settings > API. Copy two values into the `CONFIG` block near
the top of `truewild-waiver.html`:

    supabaseUrl     : "https://YOURPROJECT.supabase.co"
    supabaseAnonKey : "the anon public key"

The anon key is safe to publish in the browser. It is protected by the security
policies from step 2. Never put the `service_role` key in the HTML.

**4. Create your staff login**
Go to Authentication > Users > Add user. Enter your email and a password, and
tick Auto Confirm User. This is the login you will use on the Staff access
screen. Add one user per staff member.

**5. Publish and test**
Host `truewild-waiver.html` as you normally would (GitHub Pages works well).
Sign a test waiver. It should appear in Supabase under Table Editor > waivers,
and in the app's own dashboard once you use Staff access and sign in with the
account from step 4.

At this point storage and the dashboard are live. Email is Stage B.

---

## Stage B: automatic email with Resend

**6. Set up Resend**
Create an account at resend.com. Add the domain `truewildcoastal.com` and add
the DNS records it gives you at your domain host. Once the domain shows as
verified, create an API key. Verifying the domain is what lets you send from
`waivers@truewildcoastal.com` and email guests. Before it is verified, Resend
only lets you email your own address, which is still fine for testing.

**7. Install the Supabase CLI and link the project**

    npm install -g supabase
    supabase login
    supabase link --project-ref YOURPROJECT

**8. Add the function**
Create the folder structure and drop the function in place:

    supabase/functions/send-waiver-email/index.ts

Use the contents of `send-waiver-email.ts` for that file.

**9. Set the function secrets**

    supabase secrets set RESEND_API_KEY=your_resend_key
    supabase secrets set WAIVER_INBOX=waivers@truewildcoastal.com
    supabase secrets set "WAIVER_FROM=True Wild Coastal <waivers@truewildcoastal.com>"
    supabase secrets set HOOK_SECRET=pick_any_long_random_string

**10. Deploy the function**

    supabase functions deploy send-waiver-email --no-verify-jwt

**11. Fire it on every new waiver**
In Supabase, go to Database > Webhooks > Create a new hook.
- Table: `public.waivers`
- Events: Insert
- Type: Supabase Edge Function, choose `send-waiver-email`
- Add an HTTP header: `x-hook-secret` set to the same value you used for
  `HOOK_SECRET` above.

**12. Test end to end**
Sign a test waiver on the live site. Within a few seconds you should get the
`WAIVER YYMMDD Name` email with the PDF attached, and the test guest address
should receive its own copy.

---

## Good to know

- **Subject line:** operator emails arrive as `WAIVER 260701 Jane Smith`.
- **Newsletter consent** is unchecked by default, which keeps you onside with
  Canada's anti-spam law. Each waiver records the person's choice with a
  timestamp as your proof of consent.
- **Data:** the signature and PDF are stored with each row as text. That is fine
  for this volume. If you ever want the PDFs in a storage bucket instead, that is
  a small change.
- **Abuse:** guests can insert rows (that is how they submit). Volume is tiny for
  a tour operator. If you ever see spam, add a captcha such as Cloudflare
  Turnstile to the form.
- **Fallback:** if you leave the Supabase fields blank, the app still runs and
  falls back to on-device storage plus optional Web3Forms email, exactly as
  before.
