// the flight: pure keyframe geometry for one item's trip between tubes.
// Board.svelte measures the pixels and plays the animation; this module only
// decides the path, so tools/verify-flight.mjs can prove path invariants in
// node (starts at the old spot, ends seated upright, offsets ascend).
//
// inputs are in the LANDED item's coordinate space: the item finally rests at
// (0,0), started at (dx,dy), the arc must clear peakRel (a negative y above
// both tube mouths), and rimRel is the destination mouth's y (negative, the
// point a screwing nut arrives at before winding down).

const LAUNCH = 'cubic-bezier(.5,.05,.65,.4)' // accelerate up and out
const CRUISE = 'cubic-bezier(.35,.5,.45,1)'  // ease over the top of the arc

// a landed item must read upright: full turns land as-is, partial turns are a
// mid-flight wobble that returns to zero.
const settled = spin => (spin % 360 === 0 ? spin : 0)

export function flightKeyframes(verb, { dx, dy, peakRel, rimRel, spin }) {
  const start = `translate(${dx}px, ${dy}px)`
  const peak = (at = 0.5) => `translate(${dx * (1 - at)}px, ${peakRel}px)`
  const end = settled(spin)

  switch (verb) {
    case 'screw':
      // arrive above the shaft, then wind down it: rotation runs through the
      // whole descent at a steady rate, which is what sells the threading.
      return [
        { transform: `${start} rotate(0deg)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.55)} rotate(${spin * 0.25}deg)`, easing: CRUISE, offset: 0.34 },
        { transform: `translate(0px, ${rimRel}px) rotate(${spin * 0.45}deg)`, easing: 'linear', offset: 0.52 },
        { transform: `translate(0px, 0px) rotate(${end}deg)`, offset: 1 },
      ]
    case 'bounce':
      // gravity landing: squash at touch, spring back
      return [
        { transform: `${start} rotate(0deg) scale(1,1)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.5)} rotate(${spin * 0.6}deg) scale(1,1)`, easing: 'cubic-bezier(.4,0,.9,.6)', offset: 0.46 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1.12, .84)`, easing: 'cubic-bezier(.2,.8,.4,1)', offset: 0.78 },
        { transform: 'translate(0px, -3px) rotate(0deg) scale(.96, 1.05)', easing: 'ease-out', offset: 0.9 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1,1)`, offset: 1 },
      ]
    case 'slide':
      // beads: hop to above the stick, then run down it fast and clack home
      return [
        { transform: `${start} rotate(0deg)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.5)} rotate(${spin}deg)`, easing: CRUISE, offset: 0.42 },
        { transform: `translate(0px, ${rimRel}px) rotate(0deg)`, easing: 'cubic-bezier(.6,0,.9,.5)', offset: 0.6 },
        { transform: 'translate(0px, 0px) scale(1.06,.9)', easing: 'ease-out', offset: 0.92 },
        { transform: 'translate(0px, 0px) scale(1,1)', offset: 1 },
      ]
    case 'zip':
      // neon: a low fast streak, snap stop
      return [
        { transform: `${start} rotate(0deg)`, easing: 'cubic-bezier(.6,0,.3,1)', offset: 0 },
        { transform: `${peak(0.4)} rotate(${spin * 0.7}deg)`, easing: 'cubic-bezier(.2,.6,.2,1)', offset: 0.55 },
        { transform: `translate(0px, 0px) rotate(${end}deg)`, offset: 1 },
      ]
    case 'float':
      // kawaii: a high lazy arc, drift past the seat, settle back
      return [
        { transform: `${start} rotate(0deg)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.5)} rotate(${spin}deg)`, easing: CRUISE, offset: 0.5 },
        { transform: 'translate(0px, 4px) rotate(0deg) scale(1.05,.94)', easing: 'ease-out', offset: 0.82 },
        { transform: 'translate(0px, -2px) rotate(0deg)', easing: 'ease-in-out', offset: 0.92 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1,1)', offset: 1 },
      ]
    case 'breakpop':
      // Mine conversion: the source block shudders apart, disappears, then
      // respawns in the destination. The invisible one-frame position swap is
      // deliberate: this is a destroy/create verb, not a flying block.
      return [
        { transform: `${start} rotate(0deg) scale(1)`, opacity: 1, offset: 0 },
        { transform: `translate(${dx - 3}px, ${dy + 1}px) rotate(-4deg) scale(1.04)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${dx + 3}px, ${dy - 1}px) rotate(4deg) scale(.88)`, opacity: 0.85, offset: 0.34 },
        { transform: `${start} rotate(0deg) scale(.08)`, opacity: 0, offset: 0.45 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(.08)', opacity: 0, offset: 0.46 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1.14)', opacity: 1, easing: 'ease-out', offset: 0.76 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1, offset: 1 },
      ]
    case 'mine':
      // the block is MINED: three shudders under the pickaxe (actors.js swings
      // on the same beats), gone at .28, carried over unseen, set down at .82.
      // the invisible position swap is the carrier's job, not the block's.
      return [
        { transform: `${start} rotate(0deg) scale(1)`, opacity: 1, offset: 0 },
        { transform: `translate(${dx - 3}px, ${dy + 1}px) rotate(-3deg) scale(1.02)`, opacity: 1, offset: 0.08 },
        { transform: `translate(${dx + 3}px, ${dy - 1}px) rotate(3deg) scale(1)`, opacity: 1, offset: 0.16 },
        { transform: `translate(${dx - 2}px, ${dy + 1}px) rotate(-3deg) scale(.96)`, opacity: 1, offset: 0.23 },
        { transform: `${start} rotate(0deg) scale(.1)`, opacity: 0, offset: 0.28 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(.1)', opacity: 0, offset: 0.29 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(.1)', opacity: 0, offset: 0.82 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1.12)', opacity: 1, easing: 'ease-out', offset: 0.92 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1)', opacity: 1, offset: 1 },
      ]
    case 'flip':
      return [
        { transform: `${start} rotate(0deg)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.42)} rotate(${spin * 0.55}deg)`, easing: CRUISE, offset: 0.46 },
        { transform: `translate(0px, -4px) rotate(${spin}deg) scale(1.08,.92)`, easing: 'ease-out', offset: 0.82 },
        { transform: `translate(0px, 0px) rotate(${settled(spin)}deg) scale(1,1)`, offset: 1 },
      ]
    case 'roll': {
      const turns = spin % 360 === 0 ? spin * 2 : 720
      return [
        { transform: `${start} rotate(0deg)`, easing: 'ease-in', offset: 0 },
        { transform: `${peak(0.28)} rotate(${turns * 0.45}deg)`, easing: 'linear', offset: 0.44 },
        { transform: `translate(0px, 0px) rotate(${turns}deg) scale(1.08,.92)`, easing: 'ease-out', offset: 0.88 },
        { transform: `translate(0px, 0px) rotate(${turns}deg) scale(1,1)`, offset: 1 },
      ]
    }
    case 'fly':
      return [
        { transform: `${start} rotate(0deg) scale(.96)`, easing: 'ease-in', offset: 0 },
        { transform: `${peak(0.35)} rotate(-16deg) scale(1.04)`, easing: CRUISE, offset: 0.38 },
        { transform: `translate(${dx * 0.22}px, ${peakRel * 0.58}px) rotate(10deg) scale(1.03)`, easing: 'ease-out', offset: 0.68 },
        { transform: 'translate(0px, 0px) rotate(0deg) scale(1,1)', offset: 1 },
      ]
    case 'hover':
      return [
        { transform: `${start} rotate(0deg)`, easing: 'ease-in-out', offset: 0 },
        { transform: `${peak(0.32)} rotate(-5deg) translateY(-3px)`, easing: 'ease-in-out', offset: 0.34 },
        { transform: `translate(${dx * 0.28}px, ${peakRel * 0.72}px) rotate(5deg) translateY(3px)`, easing: 'ease-in-out', offset: 0.64 },
        { transform: 'translate(0px, -4px) rotate(0deg)', easing: 'ease-out', offset: 0.88 },
        { transform: 'translate(0px, 0px) rotate(0deg)', offset: 1 },
      ]
    case 'squish':
      // kawaii: crouch, spring, stretch through the hop, splat on landing and
      // wobble back to round. the squash lives in scale, the trip in translate.
      return [
        { transform: `${start} rotate(0deg) scale(1,1)`, easing: 'ease-in', offset: 0 },
        { transform: `${start} rotate(0deg) scale(1.22,.78)`, easing: 'cubic-bezier(.3,0,.5,1)', offset: 0.14 },
        { transform: `${peak(0.5)} rotate(${spin * 0.5}deg) scale(.86,1.16)`, easing: CRUISE, offset: 0.5 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1.28,.72)`, easing: 'ease-out', offset: 0.78 },
        { transform: `translate(0px, -3px) rotate(0deg) scale(.94,1.08)`, easing: 'ease-in-out', offset: 0.9 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1,1)`, offset: 1 },
      ]
    case 'tumble':
      // dice: thrown in a spinning arc, hit the felt, skip once, settle
      return [
        { transform: `${start} rotate(0deg) scale(1,1)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.5)} rotate(${spin * 0.45}deg) scale(1,1)`, easing: 'cubic-bezier(.4,0,.9,.6)', offset: 0.42 },
        { transform: `translate(0px, 0px) rotate(${spin * 0.8}deg) scale(1.1,.88)`, easing: 'ease-out', offset: 0.66 },
        { transform: `translate(0px, -7px) rotate(${spin * 0.92}deg) scale(.96,1.04)`, easing: 'ease-in', offset: 0.8 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1.05,.94)`, easing: 'ease-out', offset: 0.9 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1,1)`, offset: 1 },
      ]
    case 'zig':
      return [
        { transform: `${start} rotate(0deg)`, easing: 'linear', offset: 0 },
        { transform: `translate(${dx * 0.72}px, ${peakRel}px) rotate(-18deg)`, easing: 'linear', offset: 0.28 },
        { transform: `translate(${dx * 0.46}px, ${dy * 0.25}px) rotate(18deg)`, easing: 'linear', offset: 0.5 },
        { transform: `translate(${dx * 0.2}px, ${peakRel * 0.55}px) rotate(-18deg)`, easing: 'linear', offset: 0.72 },
        { transform: 'translate(0px, 0px) rotate(0deg)', offset: 1 },
      ]
    default:
      // 'drop': the plain arc with a soft touch
      return [
        { transform: `${start} rotate(0deg)`, easing: LAUNCH, offset: 0 },
        { transform: `${peak(0.5)} rotate(${spin * 0.5}deg)`, easing: CRUISE, offset: 0.48 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1.05,.93)`, easing: 'ease-out', offset: 0.86 },
        { transform: `translate(0px, 0px) rotate(${end}deg) scale(1,1)`, offset: 1 },
      ]
  }
}

// timing for the i-th item of a convoy. fill 'backwards' holds the item at its
// launch pose through the stagger delay, so a waiting item sits in the source
// tube instead of teleporting early.
export function flightOptions(motion, index) {
  return {
    duration: Math.max(1, motion.seconds * 1000),
    delay: index * (motion.stagger ?? 0) * 1000,
    // Segment keyframes own their easing. A second effect-level easing bends
    // the offsets themselves, so audio scheduled at a touchdown offset lands
    // visibly early or late.
    easing: 'linear',
    fill: 'backwards',
  }
}

// when each landing happens on the audio clock, so sounds.js can schedule the
// material's note per item without a js timer racing the compositor.
export function landingTimes(motion, count, verb = motion.land) {
  const beat = {
    screw: 0.52,
    breakpop: 0.76,
    mine: 0.82,
    flip: 0.82,
    roll: 0.88,
    fly: 1,
    hover: 0.88,
    zig: 1,
    squish: 0.78,
    tumble: 0.66,
    bounce: 0.78,
    slide: 0.92,
    zip: 1,
    float: 0.82,
    drop: 0.86,
  }[verb] ?? 0.86
  return Array.from({ length: count }, (_, i) => motion.seconds * beat + i * (motion.stagger ?? 0))
}
