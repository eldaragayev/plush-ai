Here’s the A→Z **dev requirements** for a 2-screen, **Expo + React Native** app that runs **fully on-device** using existing native libs (no custom Swift).

# Project: Plush AI (Expo/RN, on-device v1)

## Tech baseline

* **React Native + Expo Dev Client** (EAS Build).
* **TypeScript**.
* **@shopify/react-native-skia** for canvas, previews, offscreen export.
* **react-native-vision-camera** for capture + frame processors (optional live preview).
* **ML Kit via RN plugins** for **Face Landmarks**, **Pose**, **Selfie/Subject Segmentation** (either VisionCamera plugins or `react-native-google-ml-kit` for static images).
* **react-native-opencv3** for inpainting (blemish/object removal).
* **expo-image-picker**, **expo-media-library**, **expo-file-system**, **expo-sharing**.

### Expo config

* Use **Expo Dev Client**. Don’t use Expo Go.
* `app.json`:

  * iOS `deploymentTarget: "15.0"`.
  * Permissions: `NSCameraUsageDescription`, `NSPhotoLibrary( Add )UsageDescription`.
  * Add plugins for: `react-native-vision-camera`, chosen ML Kit wrappers, and any required build-properties.

---

## Screens

### Screen 1 — **Home**

**Purpose:** Start an edit, revisit past edits.

**UI**

* Header: app name.
* **Primary CTA tile**: “Create” → ActionSheet: *Camera* / *Photo Library*.
* **History** grid (latest 50): thumbnail, date.
* Empty states for both panes.

**Behaviour**

* Import: HEIC/JPG/PNG up to 24MP, preserve EXIF orientation.
* Selecting a history item opens **Editor** with its op-stack reloaded.
* Long-press history item → “Delete from device”.

**Acceptance**

* Smooth scroll ≥55 fps.
* Import any supported image without crash.
* History persists across relaunch.

---

### Screen 2 — **Editor**

**Purpose:** Non-destructive body/face edits with fast preview and full-res export.

**UI**

* Header: Back, **Save** (disabled while exporting), “…” menu (Export PNG with alpha when bg removed).
* **Canvas** (Skia): image fit; pinch-zoom; pan; double-tap reset; press-and-hold **Before/After**.
* **Tool tray** (scrollable, bottom):

  * **Body**, **Face**, **Hips**, **Waist**, **Magnifier**, **Remover**, **Background** (+ “Basics” sub-menu: crop/rotate/flip, colour).
* **Context panel** above tray: sliders/switches for current tool.
* **Controls**: **Undo**, **Redo**, **Reset Tool**, **Freeze/Protect** mask toggle (for liquify).

**Acceptance**

* Preview latency from slider/brush to visual ≤50ms on iPhone 12 (downscaled preview).
* Full-res export (12MP, \~6 ops) ≤4s on iPhone 12.
* Undo/Redo across all tools; op-stack reload reproduces pixel-identical results.

---

## Features (what to implement)

### Detection & masks (run once per image)

* **Face landmarks** (eyes, nose, lips, jaw).
* **Full-body pose** (shoulders, hips, knees…).
* **Selfie/Subject segmentation** → **person matte** (grayscale alpha).
* Cache results (coords, confidences, matte URI) in session state.
* **Multi-person**: if >1 subject, show tap-to-select boxes; store chosen subject ID.
* **Low confidence**: show toast “Area not found—use manual brush instead.”

### Warps & filters

1. **Liquify brush (push/pull)**

   * Skia canvas paints into a **displacement map** (vector field).
   * Shader applies displacement to image; **Freeze mask** multiplies to zero in protected areas.
   * Params: Brush size, Strength, Softness; Erase mode for mask.

2. **Magnifier**

   * **Bloat** (grow) / **Pucker** (shrink) radial warp (runtime shader).
   * Params: centre (touch), radius, scale.

3. **Twirl** (optional v1 if quick)

   * Radial rotation shader; angle + radius.

4. **Auto Waist / Hips / Body**

   * Use **Pose** to generate ROIs:

     * **Waist**: *Waist Top* (ribcage), *Waist Mid* (line between hips), *Belly* (below).
     * **Hips**: symmetric widen/narrow or L/R balance.
     * **Body (global slim)**: non-uniform horizontal scale within **person matte**.
   * For each ROI, apply parametric contraction/expansion via displacement field with **sigmoid falloff**.
   * Clamp extremes to avoid artifacts.

5. **Face**

   * Sliders: **Eye size/spacing**, **Nose width**, **Lip volume**, **Jaw slim**, **Chin length**, **Face slim**.
   * Each uses landmarks → polygon ROI → local warp.
   * **Skin smooth**: high-freq separation (Skia shader) with **Detail protect**.

6. **Remover**

   * **Tap-heal** (small circles) and **lasso** (polygon).
   * Crop ROI to minimal bounding box, send to **OpenCV inpaint (Telea)**, composite back.
   * Limit per-stroke area ≤ 1/8 of image.

7. **Background**

   * **Remove**: use person matte → alpha PNG; optionally **dilate/erode** then feather 8–16px.
   * **Blur**: Gaussian blur **background only** (subject preserved).
   * **Replace**: solid colour or user photo; add soft drop shadow under subject (adjustable opacity/offset).

8. **Basics**

   * Crop (free/ratios), Rotate 90°, Flip H/V.
   * Colour: Exposure, Saturation, Temperature/Tint.

---

## Data & state

### Op-stack (non-destructive)

* Keep all edits as JSON; preview uses this stack; export replays it full-res.

```ts
type Op =
  | { type:'liquify'; strokes: Stroke[]; freezeMaskUri?: string }
  | { type:'magnifier'; center:Pt; radius:number; scale:number }
  | { type:'twirl'; center:Pt; radius:number; angle:number }
  | { type:'bodyParam'; key:'waistTop'|'waistMid'|'belly'|'hips'|'bodySlim'; value:number }
  | { type:'faceParam'; key:'eyeSize'|'eyeSpacing'|'noseWidth'|'lipVolume'|'jawSlim'|'chinLength'|'faceSlim'|'skinSmooth'; value:number }
  | { type:'inpaint'; polygon: Pt[] }
  | { type:'background'; mode:'remove'|'blur'|'replace'; amount?:number; replaceUri?:string }
  | { type:'transform'; kind:'crop'|'rotate'|'flipH'|'flipV'; params?:any }
  | { type:'color'; exposure?:number; saturation?:number; temperature?:number; tint?:number };

type EditSession = {
  id: string;
  sourceUri: string;
  w: number; h: number;
  detections?: { landmarks?: any; pose?: any; matteUri?: string; subjectIndex?: number; confidences?: any };
  ops: Op[];
  previewUri?: string;
  createdAt: number; updatedAt: number;
};
```

### Storage

* Persist session JSON via **expo-file-system**.
* Generate preview thumbnails (JPEG) on save + after heavy ops.
* Originals are read-only; never mutate.

---

## Pipelines

### Load → Detect

1. Load image (fix EXIF orientation).
2. Run **ML Kit** on the **static image**:

   * Face, Pose, Segmentation → store coords + matte (as file).
3. Build ROIs (waist/hips/face parts) from detections; cache for tool menus.

### Preview (interactive)

* Downscale to \~2–3MP texture for the canvas.
* Apply ops in order using **Skia** (runtime shaders, displacement maps).
* Keep UI thread ≥55 fps (JSI path; no heavy work on JS bridge).

### Export (full-res)

* Recreate pipeline offscreen at original resolution in **Skia**.
* For **inpaint**: apply on cropped ROIs then composite.
* Write JPEG (quality 0.9) or PNG (when alpha required) to file.
* Save to Photos via **expo-media-library**; keep op-stack JSON + preview in app storage.

---

## Tool behaviours (detail)

* **Freeze/Protect**: dedicated mask layer; liquify & body/face warps must multiply by `(1 - freezeMask)`.
* **Feathering**: every ROI/segmentation edge is feathered (8–16px) to avoid seams.
* **Mask fix-ups**: for person matte, run optional **dilate → erode** to plug pinholes; parameterise by image size.
* **Safety clamps** (examples):

  * Eye size ±15%, Jaw slim 0–25%, Body slim 0–12%, Waist ROIs ±12%.
* **Multi-person**: on subject change, recompute ROIs; don’t auto-transfer face ops between subjects.

---

## Performance targets

* First detection warm-up ≤400ms; subsequent runs ≤150ms.
* Peak memory ≤600MB when exporting a 12MP image with 8 ops.
* Slider interaction ≤50ms visual response.
* Export 12MP, 6 ops ≤4s; 12 ops ≤8s on iPhone 12.

---

## Errors & edge cases

* No face/pose: show toast and enable manual tools.
* Very low-light/noisy photos: allow manual subject override (toggle matte on/off).
* Large edits: warn “This may take longer” when export ETA >8s (use progress).
* Inpaint failure (ROI too big): suggest splitting into smaller selections.

---

## Accessibility & polish

* VoiceOver labels for tools; sliders announce numeric value.
* Hit targets ≥44×44pt.
* Haptics on tool switch and export complete.
* Press-and-hold **Before/After**; double-tap canvas reset.

---

## QA checklist

* Import HEIC/JPG/PNG; portrait/landscape; 24MP.
* Multi-person subject selection works.
* Undo/Redo across all tools; history survives app restart.
* Reopen session → reapply op-stack → matches previous export pixel-for-pixel.
* Background remove → PNG alpha is correct on save/share.
* No background warping when person matte exists.
* Performance within targets on iPhone 12/13/14.

---

## Tasks & order (engineer-ready)

**M0 – Project setup (1d)**

* Expo TS app, Dev Client, EAS config.
* Install libs (Skia, VisionCamera, ML Kit wrappers, OpenCV, media libs).

**M1 – Home & persistence (2d)**

* Image import/capture, EXIF fix.
* Session model + file storage.
* History grid + open/delete.

**M2 – Detection layer (3d)**

* Static-image Face, Pose, Segmentation.
* Subject picker (multi-person).
* Cache detections; confidence thresholds.

**M3 – Canvas & shaders (3–4d)**

* Skia canvas, zoom/pan, before/after.
* Magnifier + Twirl shaders.
* Op-stack, Undo/Redo, Reset Tool.

**M4 – Liquify + Freeze (3–4d)**

* Displacement map painting; freeze mask.
* Brush UI (size/strength/softness/erase).

**M5 – Auto body sliders (3d)**

* Waist Top/Mid/Belly; Hips; Body slim (ROI-based warps).

**M6 – Face sliders + skin (3–4d)**

* Eye/Nose/Lip/Jaw/Chin/Face-slim warps.
* Skin smooth (detail protect).

**M7 – Remover & Background (3d)**

* Inpaint (tap/lasso) via OpenCV.
* Background remove/blur/replace; matte fix-ups.

**M8 – Export & polish (2–3d)**

* Offscreen full-res export; PNG alpha.
* Haptics, A11y, error states; performance tune.
* Final QA pass.

**Design deliverables (parallel)**

* Figma: both screens, tool icons, spacing, states; dark theme first.
* Asset pack: toolbar glyphs (1x/2x/3x), app icon & splash.

---

## “Done” criteria (go/no-go)

* All listed tools functional and non-destructive.
* Performance & memory targets met on iPhone 12+.
* Exports correct (JPEG, and PNG with alpha when bg removed).
* Sessions reload accurately; app stable through 50 sequential edits on a 12MP image.
