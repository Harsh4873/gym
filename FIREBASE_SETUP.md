# Firebase sync setup

Gym continues to work from local browser storage when Firebase is unavailable or not configured. Firebase adds authenticated cross-device synchronization; GitHub Pages remains the host.

## Firebase project

1. Create or select a Firebase project and register a Web app.
2. Create a Cloud Firestore database in Native mode.
3. Enable the Google provider in Firebase Authentication and choose a support email.
4. Add the GitHub Pages hostname (`harsh4873.github.io`, unless the Pages host changes) to Authentication's authorized domains.
5. Deploy `firestore.rules` to the same project. `firebase.json` intentionally configures Firestore only; it does not move hosting away from GitHub Pages.

With the Firebase CLI authenticated and pointed at the project, the rules-only deploy is:

```sh
firebase deploy --only firestore:rules
```

The rules allow only a provisioned verified-Google identity to resolve the private owner membership and access `users/{vaultId}`. The two approved identities share that vault; unprovisioned accounts fail closed. Never put a service-account key or Firebase Admin credential in this repository or in Vite variables.

## Local configuration

Copy `.env.example` to `.env.local` and fill in the six fields from the Firebase Web app configuration:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

Firebase Web configuration is embedded in the browser bundle and is not a secret — it is an app identifier, not a credential, and it must be readable in the shipped bundle for sign-in to work at all. Actions *variables* are therefore the right home for it; Actions *secrets* would be masked in logs while still ending up verbatim in the public bundle, buying nothing and making a misconfiguration harder to diagnose. Authentication and `firestore.rules` are the security boundary.

## GitHub Pages configuration

Create matching GitHub Actions variables in the repository or the `github-pages` environment. The Pages workflow maps them into the Vite build.

**A production build fails when any of the six values is missing.** Gym bakes its
Firebase configuration in at build time, so an incomplete build silently ships an
app that can never sync: the user signs in, sees no error, and gets no sync. The
build refuses to produce that bundle instead.

- A *partial* configuration always fails. It is never intentional.
- A *completely absent* configuration fails too, unless the build explicitly asks
  for a local-only bundle:

  ```sh
  GYM_ALLOW_LOCAL_ONLY_BUILD=1 npm run build
  ```

If a bundle somehow ships with a partial configuration anyway, the app reports it
in the sync panel and the status pill reads "Sync error" rather than quietly
claiming local-only mode was the intent.

No composite Firestore indexes are required. Optional hardening after sync is working includes App Check and Firebase budget/quota alerts.

## Cloud data layout

```text
users/{uid}/gym/core            program, preferences, migration metadata
users/{uid}/logs/{YYYY-MM-DD}   one workout log or deletion tombstone per date
```

Log documents contain both an ISO `updatedAt` and numeric `updatedAtMs`. Security rules reject an older arriving update, and tombstones prevent a cleared workout from being restored by a stale offline device.
