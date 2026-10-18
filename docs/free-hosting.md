# Free extension server

The website stays on GitHub Pages. Keiyoushi extensions run on Suwayomi, connected through the website's Settings.

## Render free service

[Deploy the prepared free service](https://render.com/deploy?repo=https://github.com/GavinCouch/teramanga).

1. Sign in to Render and open the deployment link. Connect the GitHub repository if asked.
2. Confirm that `teramanga-extensions` uses the **Free** instance type. This blueprint does not create a paid disk or database. Do not select an upgrade if you want to spend nothing.
3. Wait for the service to deploy. Copy its `https://…onrender.com` address.
4. In Render's service environment settings, reveal the generated `AUTH_PASSWORD`. Keep it private.
5. In [Teramanga](https://gavincouch.github.io/teramanga/), open **Settings → Connect server**. Enter the service URL, username `reader`, and the password from Render. Enter credentials in the website, not in chat.
6. Open **Repositories → Add repository**, paste `https://github.com/keiyoushi`, and add it. The website resolves this to the current protobuf index. If Keiyoushi already appears in the list, skip this step.
7. Open the **Extensions** tab and install a source. **Browse** lists its available languages and sources.

The password is held in sessionStorage for this browser tab's session. Backups exclude it. Closing the session requires signing in again.

### Free-service limits

Render's free service sleeps when idle. The first connection after sleep can take time; retry if it times out. Its filesystem is temporary: a restart or deployment can remove installed extensions and the server's cache.

Teramanga keeps repository URLs, installed package names, library metadata, and reading progress in the browser. If server data resets, click **Restore extensions**. Saved titles are matched by source ID and original manga URL; chapter IDs use source chapter URLs so progress can survive changed database IDs. A source that stops returning the title cannot be restored automatically. Export browser backups in Settings.

The free configuration disables Chromium and limits the JVM to fit a 512 MB service. Sources requiring interactive browser verification may not work. No host can guarantee that every source remains available. Downloaded images and server-side state are not permanently retained on the free plan.

The actual native MangaDex extension was tested under a 512 MB container limit with reduced CPU: repository discovery, APK installation, search, 134-chapter listing, and authenticated chapter image delivery succeeded. This is local validation of the deployment configuration, not a claim that a Render account has already been deployed.

## Your own computer

This has no hosting bill and keeps server files on your own disk, but the computer must remain on while you use it.

Install Docker and run from the checkout:

```bash
read -r -s -p 'Choose a server password: ' TERAMANGA_SERVER_PASSWORD
export TERAMANGA_SERVER_PASSWORD
docker compose up -d --build
```

The server listens at `http://127.0.0.1:4567` with username `reader`. Its database and extensions use a named Docker volume. Run the frontend locally with `npm ci` and `npm run dev`, then connect that local frontend to the server. Access from another device requires your own secure HTTPS routing or private network; no public tunnel is provisioned by this repository.

The current free Docker configuration also disables Chromium. A computer with more memory can enable it by setting `KCEF_ENABLED=true` and increasing the JVM/container memory allowance.

## Why other advertised free options were not selected

Hugging Face's current [Spaces documentation](https://github.com/huggingface/hub-docs/blob/main/docs/hub/spaces-overview.md) says that creating new Docker/compute Spaces requires a paid plan, even though CPU Basic has no hourly charge. It is not a no-cost option for a new free account under those rules.

GitHub Pages serves static files and cannot execute Android APK extensions. GitHub Actions is used to build and publish the frontend, not as a permanent server.
