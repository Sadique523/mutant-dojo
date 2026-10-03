# Fighting direction

## Leo blue-flame special

The approved pose sheet is `public/references/leo-special/blue-flame-spin-approved.png`. The move is a hop into a held extended right-leg kick, two complete body rotations with the same leg raised, then retraction and landing. Repeated hits come from rotations; do not alternate legs or re-chamber between hits. `art/build_blue_flame.py` authors the action in background Blender from the captured extension, folds the other leg, samples both rotations and blends into the existing guard. Editable asset: `art/leonardo-blue-flame.blend`; extracted runtime clip: `src/motions/blue-flame-spin.json`. Gameplay and workbench share this action. T / standard L3 triggers a separate special; existing E and R kicks remain. Three hit windows do 8 damage each, are blockable and interruptible, and never repeat from holding the input. Blue flame follows the shin and foot in Three.js, with a short trail; effects clear on recovery, interruption and round end. The small airborne clearance is deliberate, unlike the previously fixed floating grounded kicks. This is an initial authored version, not a finished AAA move.

The user's movement and combat reference is **Tekken 6–7**, interpreted through TMNT: Tournament Fighters characters and identity. This is a long-term modern 3D fighter with a side-on presentation. Preserve this direction in future animation, camera, rig, and simulation work.

## Movement target

- Grounded martial-arts movement: guarded idle, short forward/backward steps, deliberate weight transfers, acceleration, braking, and balanced recovery.
- Plant supporting feet; coordinate pelvis, torso, shoulders, elbows, knees, and ankles. Avoid sliding feet and independent limb swings.
- Use Tekken character footage as animation study material for stance, stepping, attack anticipation, contact, recovery, blocking, and reactions. Choose references per motion and adapt them to turtle anatomy, shells, and weapons rather than copying one character's entire style.
- Preserve each turtle's personality and signature silhouettes. Leo's supplied NES captures guide recognizable poses; they do not establish modern animation timing or transitions.
- Author full skeletal Blender animation clips with clear startup, contact, and recovery. The current rigid-pivot studies are blocking tools, not the final animation standard.

## Fighting space and camera

The fighting camera must stay straight-on at character height, with camera and target at the same Y coordinate. Avoid a downward pitch or elevated overview in normal gameplay; photo mode may orbit freely.

Tekken-style movement includes depth sidesteps and opponent-relative facing. Treat that as the intended direction for further development, with a readable side-on camera that follows the fighters' axis. A fixed-lane 2.5D system would be a deliberate simplification requiring a later design decision.

The current simulation still uses a single fighting axis and has no sidestep mechanic. Do not describe this target as implemented. Extending it requires depth coordinates, facing, camera tracking, collision, attack tracking, and directional contact checks together.

## Refinement order

### Approved library references

The user approved the Quaternius Standard sword attacks, crouch and roll on 2026-10-03. Prioritize `Sword_Attack`, `Sword_Attack_RM`, `Sword_Idle`, `Crouch_Idle_Loop`, `Crouch_Fwd_Loop`, `Roll` and `Roll_RM` as references when building and retargeting Leo's skeletal rig. Approval is of the movement reference, not its finished application to turtle anatomy. Preserve sword grip, shell clearance, crouch foot contact and roll ground contact during adaptation. Roll invulnerability and combat input are not decided or implemented.

`art/leonardo-skeletal.blend` and `public/models/leonardo-skeletal.glb` are a separate 53-bone binding prototype with 16 library clips. Existing geometry is fitted to the reference rest skeleton; torso skin weights blend between spine bones, while disconnected limb pieces and weapons use rigid bone weights. This establishes playback and export, not production topology or finished retargeting. Review sword overlap/grip, narrow hip stance, limb seams and shell ground contact before integration. The main game now uses skeletal Leo with state-driven clip blending. Both fighters now use skeletal assets in the main game. The old character lab remains on rigid assets. Leo roll is Q / standard pad B or Circle; rolling remains vulnerable and is interrupted by a hit.

1. Guarded idle and planted forward/backward footwork in the Character Lab.
2. Dash, backdash, sidestep, turning, crouch, and stand transitions.
3. One polished Leo attack with coordinated body mechanics and reliable hit/block reactions.
4. Expand the moveset only after movement and that attack feel convincing in continuous play.

Inspect reference footage before claiming fidelity. Still images establish silhouettes; animation timing must come from a sequence or remain explicitly provisional.

Skeletal gameplay idle and block now use generated `Combat_Idle` / `Combat_Guard` clips layered into the library playback system. Idle has a wider staggered stance, planted ankles, bent knees, raised hands and breathing from the source idle. Block raises forearms in front of the head and turns blades upright. Look up imported bone names with Three.js PropertyBinding.sanitizeNodeName: GLTFLoader strips dots, so raw Blender bone names silently failed in the first guard implementation.

The user's idle preference is the taller standing torso and planted lower body combined with the original workbench `Sword_Idle` shoulder, arm, wrist and finger motion. Preserve that combination; do not replace idle arms with the fixed forward guard pose. Both game and Leo workbench now share generated gameplay clips, and the workbench opens on `Combat_Idle` with quick previews for `Combat_Idle` and `Combat_Guard`. Original library clips remain available for comparison.

Leo's front kick and spinning back kick now use ACCAD / Ohio State motion capture (CC BY 3.0), replacing the generated kick studies. `tools/retarget-kicks.mjs` trims the source BVH performances and bakes anatomical-frame retargeting, grip preservation, travel removal and ground-height correction into `src/motions/accad-kicks.json`. Captured steps and pivots are preserved; a fixed supporting ankle is no longer imposed. Runtime and workbench share these clips, with captured impact windows mapped to combat active frames. E / RB is front kick; R / RT is spinning back kick. Both are grounded, blockable, interrupted by hits and enabled only for Leo. Editable assets: `art/leonardo-mocap-kicks.blend` and `public/motions/accad/leonardo-kicks.glb`. These are adapted research captures, not finished AAA animations; mesh deformation, weapon clearance and transitions still need visual polish.

Reference: Bandai Namco's Tekken 7 patch notes explicitly discuss sidestep movement and associated animation/hurtbox adjustments: https://en.bandainamcoent.eu/tekken/news/tekken-7-patch-notes-333

Raphael skeletal update: `art/raphael-skeletal.blend` and `public/models/raphael-skeletal.glb`, built with `npm run art -- --skeletal --raphael`. Shared taller idle and raised guard, jab/cross with sai, crouch, walk, jump, roll and death; Right Shift rolls for P2 (standard pad B/Circle). Preview Raphael in the motion workbench. On KO, the arena stays visible, a compact banner names the winning player and character, the loser completes Death01 and holds its final pose, and the winner returns to idle. Reset starts the next round.
