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
    easing: motion.ease ?? 'linear',
    fill: 'backwards',
  }
}

// when each landing happens on the audio clock, so sounds.js can schedule the
// material's note per item without a js timer racing the compositor.
export function landingTimes(motion, count) {
  const beat = { screw: 0.52, bounce: 0.78, slide: 0.92, zip: 1, float: 0.82, drop: 0.86 }[motion.land] ?? 0.86
  return Array.from({ length: count }, (_, i) => motion.seconds * beat + i * (motion.stagger ?? 0))
}
