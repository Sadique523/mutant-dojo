# Mutant Dojo — Midnight Rooftops

A TMNT-inspired local tournament fighter and a long-term graphics learning project. Build 002 replaces the box-geometry experiment with a Blender-to-Three.js asset pipeline, a midnight rooftop art direction, and a rendering-independent combat simulation.

## Character Lab

**Leo blue-flame special:** press **T** in the game (standard controller **L3**), or choose **Blue flame special** in `/motion.html`. Leo hops, holds the same kicking leg extended through two full spins, then retracts and lands. Three separate hit windows deal 8 damage each; blocking reduces each to chip damage. The editable action lives in `art/leonardo-blue-flame.blend`. The approved pose sheet and rebuild notes are in `public/references/leo-special/`. Flame is a runtime effect and is not included in GLB exports.

Our movement target is **Tekken 6–7**: grounded footwork, guarded stances, coordinated weight shifts, and eventually depth sidesteps with opponent-relative facing. TMNT: Tournament Fighters supplies the character identity and signature poses. See [DESIGN.md](DESIGN.md) for the persistent direction and refinement order. The current single-axis simulation and rigid-pivot animations are preliminary tools toward that target.

Open `/lab.html` or follow **Character Lab** from the dojo. Build 003 adds a dedicated character workbench using the same pose and combat code as the game.

- Select Leonardo or Raphael and orbit, zoom, or use front/side/back cameras.
- Preview idle, walk, jump, light/heavy strike, block, and hit reaction. Pause, scrub, step one frame, loop, and run at 0.1×–1× speed.
- Tune movement speed, jump impulse, gravity, breathing, stride, cadence, stance, guard, strike arc, and torso follow-through.
- Author startup/active/recovery timing in frames, reach, damage, hit stun, and knockback separately for light and heavy attacks.
- Test against an idle, blocking, or counterattacking dummy. Use A/D/W/F/G/S after clicking the viewport. Health regenerates after contact; rounds do not expire in training.
- Adjust head, upper body, and shell proportions, skin/mask tint, and skin roughness. Compare studio/rooftop views and different lighting. Inspect wireframe and animation pivots.
- Save tuning to browser storage; reload the dojo to use it. Export/import JSON presets to preserve and share experiments. Save Image exports the current viewport as PNG.

The proportions are group transforms, and animation currently drives rigid pivots. Sculpting and true skeletal animation remain Blender work. Contact guides visualize the simulation's distance/height checks. Saved lab settings affect both characters without changing the GLB source files.

An effective refinement cycle: select one attack, slow playback to 0.25×, adjust anticipation and follow-through, step through the active frames, test contact/blocking with the dummy, save the preset, then compare it in the dojo.

The first grounded movement pass adds a bent-elbow guard, soft knees, and forward/backward step previews. Procedural support feet counter root travel and swing feet use low clearance. These are deterministic blocking poses, with rigid hip adjustments rather than skeletal IK; authored Blender clips and visual refinement remain necessary. Attack, airborne, and reaction poses bypass the foot planting pass.

### Leo sprite studies

The supplied sprite screenshots are available under `public/references/leo` and displayed beside six Leo-only studies: ready stance, overhead guard/cut, raised-knee slash, high kick, sideways airborne, and grounded/recovery. **Hold Reference Frame** pauses at the main silhouette. Pose strength, elbow bend, knee bend, and torso lean adjustments are saved in tuning presets.

The Blender models now include shoulder/elbow and hip/knee/foot pivot hierarchies. They remain rigid articulated geometry, with no skinned deformation. `src/reference-motions.js` contains the provisional key poses and smooth interpolation; poses reset cleanly when switching actions. The supporting foot is planted for standing studies.

These studies reconstruct silhouettes from stills. Their timing and connecting poses are proposed blocking; the airborne and grounded frames are not assigned named attacks without a sequence identifying them. Reference studies run in the lab; the dojo and dummy contact test still use the existing light/heavy attacks. The target is a modern 3D Tournament Fighters: a consistent fighting axis, readable attacks, character-specific moves, blocking, reactions, and complete rounds.

## Build the artwork and run

### Keyframe studio

The lab inspector now has a keyframe editor for each character/action. Choose an action and **Create from current motion**. Pause/scrub to a frame, select a joint, edit rotation in degrees or position in metres, then **Add / Update Key**. Root motion and weapon grips are editable. Click a key marker to revisit it; **Delete Key** removes that frame, and **Undo Pose Edit** discards edits not yet keyed.

Choose outgoing **Smooth**, **Linear**, or **Hold** interpolation before adding/updating a key. Euler rotation channels allow spins. Changing clip length rescales keys. Endpoint poses hold, so key matching start/end poses for seamless loops.

Click a body part in the viewport to select its nearest joint and pause playback. Drag colored rotation rings (**R**) or movement arrows (**T**) to pose it. **K / Add Key** stores the frame, and **Save Clips** persists it. Click the sword to edit its grip; **Whole Body** or Shift-click selects root motion. **Snap** enables 15-degree rotation / 5-centimetre movement increments. **Pose Off** restores camera-only interaction; background drags still orbit, and right-drag pans. The sidebar's numeric fields remain synchronized for precision. Selection clears in training or when switching characters. This remains rigid joint posing, with no IK or skinned deformation.

### Motion presets and low-poly practice characters

The lab's **Motion presets** browser contains 22 editable starting motions: guarded idle, boxer bounce, forward/backward walk, dash/backdash, straight punch/thrust, double jab, heavy cross, uppercut, front/roundhouse/low kicks, high block, crouch, crouch block, jump/tuck, hit recoil, overhead cut, spinning slash, shell feint/counter, and Leo's six-frame reference kick.

**Leo — six-frame kick** appears under **Leo references**. Its six supplied images map to chamber (10F), extension (17F), high kick (23F), impact (27F), retraction (38F), and guard (52F) in a proposed 60-frame sequence. Click an image to hold that pose. A blue arc follows the kicking foot during frames 23–31. Apply to **Heavy**, refine the poses, and save animations to use it with G in the dojo. Timing is provisional; applying still uses the heavy attack's combat timing and contact rules. This does not add a separately bound kick attack.

The reference kick plants the right supporting foot. The keyframe studio's **Support foot** selector switches between Free / Plant left / Plant right per keyed pose. Foot planting corrects root height to keep the selected sole at ground level; it is not a full IK solver. The kick's unchanged support-leg transforms also preserve its horizontal anchor.

Choose **My Turtle**, **Low-poly Scout**, or **Low-poly Brute** and click a preset to preview it. Scout and Brute are original Blender-built mannequins sharing the turtle pivot hierarchy. Choose an action slot and **Apply to My Character** to copy the keys into your turtle's animation library. **Undo Apply** restores the last overwritten slot. Preview-only presets do not alter saved animations. After applying, use direct viewport posing and the keyframe studio to refine them, then Save Animations and reload the dojo.

These are procedural blocking presets rather than captured Tekken animations. Applying a dash, double jab, or special to an existing action slot changes visuals only: movement speed, number of contacts, and special-input rules still come from the simulation. Scout/Brute source files are `art/practice-scout.blend` / `art/practice-brute.blend`; `art/build_practice_characters.py` rebuilds their GLBs using background Blender.

**Save Animations** stores both libraries separately from tuning presets. Reload the dojo to use enabled clips; training uses them immediately. **Export Clips / Import Clips** provides validated JSON backups. Disable **Use authored clip** or remove a clip to restore procedural movement. Key draft edits before saving. Attack clips map their timeline onto the existing combat duration; damage, hit windows and collision remain controlled by attack tuning.

These clips target the current pivot hierarchy. A later skinned Blender rig will require retargeting or new exported skeletal animations.

Install Blender from its official website. The art runner detects standard Windows installations, Blender on PATH, or a portable installation in `tools/`. For a different location, set `BLENDER_PATH` to the full path of `blender.exe`.

```powershell
npm install
$env:BLENDER_PATH = 'C:\path\to\blender.exe'
npm run art
npm run dev
```

`npm run art` runs a separate background Blender process with factory settings. It does not alter an open Blender session. It creates:

- `art/midnight-dojo.blend` and `public/models/midnight-dojo.glb`
- `art/leonardo.blend` and `public/models/leonardo.glb`
- `art/raphael.blend` and `public/models/raphael.glb`

The GLBs embed surface textures and materials. Static environment geometry is merged by material to reduce draw calls. Fighter parts retain named transform pivots for initial animation. The `.blend` files are editable source assets. Rebuilding overwrites those generated files, so save manual modeling refinements under a different filename.

`npm run art -- --fighters` rebuilds only the character assets. `npm run art:preview` renders the exported assets together for visual QA. Meshes sharing a material and the same animation pivot are merged to reduce character draw calls. The discovered Microsoft Store installation path is cached in the ignored `tools/blender-path.txt` file on this machine.

Until the GLBs exist, the game shows an asset-build message and disables fighting. The initial prototype is preserved in `src/prototype-001.js` as a learning reference.

## Controls

### Music and controllers

Both pages have a **Music** toggle and volume slider. The original eight-bar **Midnight Circuit** loop uses synthesized bass, chords, lead, and drums at 112 BPM; no external recording is required. Click Music to enable it. Volume persists locally, and playback stops while the page is hidden. Browser audio activation follows the [Web Audio gesture requirement](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

Connect a controller, focus the page, and press a button to expose it to the browser. Controllers are read through the [Gamepad API](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API). Standard Xbox/PlayStation and raw layouts are detected; raw devices initially use the default layout and can be remapped. The first two detected pads occupy P1 and P2; a remaining connected P2 keeps its slot when P1 disconnects.

Open **Controllers** on either page to see device names, browser mapping, pressed button indices, and live axes. Choose P1/P2, click an action, release buttons and center the stick, then press or move the desired control. Button and axis bindings persist per device in browser storage. Restore default layout removes the custom mapping. Combat input is disabled while this dialog is open. Browser access errors are shown rather than hidden.

- Left stick or D-pad: left/right movement, up jump, down crouch. Stick deadzone is 25%.
- A / Cross: jump. X / Square: punch. Y / Triangle: heavy attack.
- LB / L1 or LT / L2: hold block.
- Start / Options: enter the dojo, pause/resume, or reset a completed round. In the lab, enter training, then pause/resume it.

The lab uses P1's controller against the dummy. Keyboard and pad controls can be combined; losing page focus suppresses pad input. Physical controller response and audio playback require checking in a browser with the actual device.

- Leonardo: A/D move, W jump, F punch, G heavy attack, S block, C crouch.
- Raphael: left/right move, up jump, slash punch, period heavy attack, down block, comma crouch.

Light attacks use a straight-punch pose with elbow extension, torso rotation, and a guarded off hand. The held weapon remains visible, with its blade aligned horizontally toward the opponent at extension. Block uses bent forearms in front of the upper body and remains held through block stun. Crouch lowers the hips and bends the knees, slows movement, and prevents jumping while held. It currently does not evade high attacks or introduce low attacks; attacking returns to the standing moveset.
- Escape pauses. Reset starts a new round. Photo mode pauses combat and enables orbiting, zooming, and panning with the mouse.
- The dojo currently uses unlimited round time, shown as ∞. Knockouts still end a round; reset preserves unlimited time. The lab already has no time limit.
- Wireframe reveals imported geometry. Performance quality disables bloom, shadows, and rain and lowers pixel density.

## Art direction and quality target

The stage combines brick masonry, a roller shutter beneath a jade neon dojo sign, a timber water tower, rooftop machinery, hanging bulbs, warm lanterns, wet stone slabs, and a layered city skyline. Lighting separates warm faces and chest surfaces from cool moonlight and jade rim light. Rain and restrained bloom support that lighting.

The fighters have rounded muscular forms, segmented shells and plastrons, expressive eyes and brows, cloth masks with tails, protective pads, linen wraps, hands and toes, and modeled katanas or sai.

These generated meshes establish silhouettes, layout, materials, and import conventions. They are **not production-quality character sculpts or final animation rigs**. Reaching the intended AA/AAA visual standard needs iterative sculpting, retopology, authored UVs, high-to-low normal baking, controlled texture painting, skeletal rigs, and polished animation. A visual target is only met after reviewing rendered frames and motion together.

The next quality gate is one close-up-ready fighter and one convincing arena camera shot. Improve face anatomy, shell construction, fabric folds, weapon proportions, and the combat stance before adding more characters or stages. Follow that with a complete idle/walk/jump/attack/block/hit/knockout animation set and responsive combat feedback.

## Learning through the project

1. **Scene and projection:** canvas versus renderer, perspective camera composition, object and group transforms.
2. **Blender to glTF:** Z-up/Y-up conversion, units, object pivots, UVs, embedded images, material export, draw calls.
3. **Lighting and surfaces:** PBR roughness and metalness, image-based lighting, shadows, linear color and tone mapping.
4. **Game loop:** fixed simulation steps, state transitions, startup/active/recovery windows, contacts, blocking, simultaneous hits, and hitstop.
5. **Animation:** replace object-pivot poses with a skinned rig and authored animation clips; blend with AnimationMixer.
6. **Canvas and shaders:** paint texture atlases with Canvas 2D, understand vertex/fragment work, add deliberate comic shading.
7. **WebGPU:** compare the same scene through WebGPURenderer, then learn node materials, TSL, and compute-driven particles.

The current runtime uses WebGLRenderer, GLTFLoader, PMREM lighting, EffectComposer, UnrealBloomPass, and OutputPass. Combat lives in `src/simulation.js` and advances at 60 Hz. Attacks currently use range and height checks rather than skeletal hitboxes. Current poses animate rigid groups; there is no finished skeletal animation, AI, controller input, audio, or online play.

## Validation

`npm run build` builds the browser app. `npm test` checks combat startup, range, input edges, block chip damage, simultaneous strikes, knockout/reset, arena limits, and jumping. `node tools/check-assets.mjs` checks GLB structure, embedded textures, animation pivots, dimensions, and ground alignment. `art/render_preview.py` composes the exports for an offline Blender render at `art/midnight-preview.png`; this is a Blender reference render, not a browser screenshot. Browser rendering needs its own visual verification.

Official references: [Blender downloads](https://www.blender.org/download/), [Three.js post-processing](https://threejs.org/manual/pages/post-processing.html), [Three.js fundamentals](https://threejs.org/manual/pages/fundamentals.html), [WebGPU renderer](https://threejs.org/manual/pages/webgpurenderer).

## Skeletal motion workbench

Open `/motion.html` (RIG & MOTION in the lab header). Load a skinned FBX/GLB character, then add animation-only files exported for the same skeleton. Select external glTF binary/texture files together with the model. Preview clips, scrub, slow playback, show bones, and toggle horizontal root translation. Export the character with original animation clips as GLB. Files are processed locally; nothing is uploaded.

This workbench validates track names, not rest-pose compatibility. It does not retarget arbitrary skeletons, apply motions to the current rigid Leo, or create production-quality animations. Use Blender to build a skinned Leo and retarget library clips before combat integration. The workbench includes the bundled Quaternius Universal Animation Library Standard mannequin: 53 joints and 46 clips, including walk, jab, cross, sword attack, crouch, jump and hit reactions. The assets are CC0; license and download provenance are in public/motions/quaternius. A separate skeletal Leo binding study now opens by default, with 53 bones and 16 selected clips. The approved sword, crouch and roll references animate his existing geometry. This is a prototype: torso weights blend across the spine, but disconnected limbs still use rigid bone weights. Sword placement, narrow foot spacing, joint seams and shell clearance need refinement. The main game now uses this skeletal Leo; Raphael now also uses a separate skeletal asset; the old keyframe lab still uses rigid assets. Leo uses F for the library jab, G for sword attack, C for crouch, and Q (standard pad B/Circle) for roll. Simulation drives roll movement and cancels it on a hit; it has no invulnerability. Mixer blends state changes and aligns attack playback to startup/active/recovery. Old rigid keyframe clips and proportion tuning do not apply to skeletal Leo. Switch back to the mannequin with LOAD QUATERNIUS.

Sources: `art/leonardo-skeletal.blend`, `art/build_skeletal_leo.py`; export: `public/models/leonardo-skeletal.glb`. Rebuild with `npm run art -- --skeletal`, render pose reviews with `npm run art -- --skeletal --preview`. Offline review images are `art/skeletal-Sword_Idle.png`, `art/skeletal-Sword_Attack.png`, `art/skeletal-Crouch_Idle_Loop.png`, and `art/skeletal-Roll.png`.

Raphael skeletal update: `art/raphael-skeletal.blend` and `public/models/raphael-skeletal.glb`, built with `npm run art -- --skeletal --raphael`. Shared taller idle and raised guard, jab/cross with sai, crouch, walk, jump, roll and death; Right Shift rolls for P2 (standard pad B/Circle). Preview Raphael in the motion workbench. On KO, the arena stays visible, a compact banner names the winning player and character, the loser completes Death01 and holds its final pose, and the winner returns to idle. Reset starts the next round.

Leo extra attacks: E / standard RB or R1 is front kick, R / standard RT or R2 is spinning back kick. These now use adapted ACCAD / Ohio State motion capture, licensed CC BY 3.0, replacing the generated poses. Preview them with PREVIEW RIGGED LEO in `/motion.html`; gameplay uses the same clips with impact timing mapped to active frames. Kicks are grounded, blockable, one hit per press, and enabled only for Leo. Front kick is 12 damage; spinning kick is 21 damage. Open `art/leonardo-mocap-kicks.blend` to refine the baked actions in Blender. Credits and rebuild instructions: `public/motions/accad/CREDITS.md`. Retargeted captures still require artistic polish; they are not finished AAA assets.
