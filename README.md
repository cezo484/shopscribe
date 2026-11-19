# ShopScribe

A maintenance log assistant for technicians. Type or paste a short raw work note and ShopScribe turns it into a structured work report: fault, action taken, parts used, test result, follow-up.

Example note:

```
pump 3 leaking at seal, replaced gasket, tested 2h, ok
```

Becomes:

```
Fault: Pump 3 leaking at seal
Action taken: Replaced gasket
Parts used: gasket
Test result: Tested 2h; ok
Follow-up: not recorded
```

Built for #BuildHybridAI 2026 on Devpost.

## How it works

Every report is written through one of three paths, in this order. The badge on each report says which path wrote it.

1. **On-device.** Chrome's Prompt API runs Gemini Nano in the browser. The note stays on the device and the report costs nothing. Needs Chrome on desktop, version 139 or newer, with the on-device model downloaded.
2. **Cloud.** When the on-device model is not available, the note goes to Firebase AI Logic, which calls a cloud Gemini model through the Gemini Developer API backend. Needs a Firebase project, covered below.
3. **Local.** When neither model path is available, a small rule-based formatter on the page structures the note. The demo always works, even with no setup at all.

If a path fails, the next one is tried automatically. The attempt log under the badge records what happened.

## Run it

Node.js 20 or newer. No dependencies, nothing to install.

```
git clone <repo>
cd shopscribe
node serve.js
```

Then open http://localhost:8080. The page works with no Firebase config: on a Chrome desktop with the on-device model ready, reports come from Gemini Nano; anywhere else, the local formatter covers the demo.

## Try the on-device path

1. Use Chrome on desktop, version 139 or newer. Check at chrome://settings/help.
2. Open chrome://flags/#prompt-api-for-gemini-nano-multimodal-input and set it to Enabled. Restart Chrome.
3. Open the app and click "Prepare on-device model" if the status row offers it. The model downloads once (a few gigabytes) and Chrome keeps it for later visits.
4. Write a note. The badge should read "On-device (Gemini Nano)".

If the browser or the hardware does not qualify, the status row says so and the cloud or local path takes over. Check the model state any time at chrome://on-device-internals.

## Add the cloud path

1. In the Firebase console, create a project (or open one you have).
2. Go to AI Services, then AI Logic, and click Get started. Choose the Gemini Developer API provider. The guided setup also turns on App Check for AI Logic.
3. Register a web app in Project settings and copy its config values.
4. Copy the example config and fill it in:

```
cp web/firebaseConfig.js.example web/firebaseConfig.js
```

5. Reload the page. The status row should show the cloud path as configured.

`web/firebaseConfig.js` is gitignored and never goes into the repo.

### App Check

The guided AI Logic setup enforces App Check. If the cloud path reports an App Check error, register a reCAPTCHA v3 site key for your domain in the console and put it in `appCheckSiteKey`. For localhost development, set `appCheckDebug: true`, reload, copy the debug token the browser console prints, and register it in the console under App Check, Apps, Manage debug tokens.

### Cloud model

The default cloud model is `gemini-2.5-flash-lite`, set in `firebaseConfig.js`. Model names change often; check the Firebase AI Logic supported models page and update the `model` field if the cloud path reports an unknown model. A wrong model name does not break the app: the report falls back to the local formatter.

## Scripted demo

Runs the local formatter on three sample notes and prints the path selection table. No browser and no network needed.

```
npm run demo
```

## Tests

```
npm test
```

33 tests, all offline. They cover the local formatter, the path selection order, the config checks, and the prompt and reply parsing the model paths share.

## Layout

```
src/
  format.js   rule-based formatter and plain-text report rendering
  path.js     path selection and fallback order
  config.js   Firebase config validation and defaults
  prompt.js   prompt building and model reply parsing
  samples.js  sample notes for the demo and the web page
  demo.js     scripted demo
test/         node:test suites
web/
  index.html
  app.js      browser wiring: detection, Firebase, fallback chain, UI
  styles.css
  firebaseConfig.js.example
serve.js      static server for the web page
```

## Limits

- The on-device model runs on Chrome desktop only. Other browsers and phones get the cloud or local path.
- The on-device model has a small context window. ShopScribe keeps notes short on purpose: one note is one job.
- The local formatter works from keywords. It handles the usual shop shorthand (leak, replaced, tested, needs) and misses phrasing outside that list. It is a fallback, not a replacement for the model paths.
- The Firebase AI Logic SDK is loaded from the Google CDN at page load, so the cloud path needs network access. The on-device and local paths work offline once the page is loaded.

## License

MIT. See LICENSE.
