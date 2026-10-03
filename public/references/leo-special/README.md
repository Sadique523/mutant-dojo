# Approved blue-flame spin reference

`blue-flame-spin-approved.png` was generated with the built-in image tool and
approved by the user on 2026-10-04. It is a pose reference, not an exact capture
of the original Tournament Fighters animation.

Final direction: coil, hop and kick; hold that same leg fully extended while
the whole character rotates; blue flame wraps the raised shin and foot;
retract only after the spins, then land in guard. Repeated hits come from
rotations, not alternating kicks.

Blender action: `art/leonardo-blue-flame.blend`, Combat_BlueFlameSpin.
The revised action lasts 0.75 seconds: 12-frame startup, two nine-frame
rotations, and 15-frame recovery. Turn acceleration and torso/arm follow-through
are adapted from the approved existing Combat_SpinKick; the raised leg remains
held throughout both turns.
The held leg now matches the approved single-spin kick's contact elevation and
knee extension; it no longer inherits the lower front-kick angle.
Rebuild with background Blender using `art/build_blue_flame.py -- <project>`
then `node tools/extract-blue-flame.mjs`.

The action adapts the ACCAD front-kick extension into a new authored special.
See `/motions/accad/CREDITS.md` for source attribution. Blue fire is rendered
in Three.js and is not embedded in the Blender animation or GLB export.
