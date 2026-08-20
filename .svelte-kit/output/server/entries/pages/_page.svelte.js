import { I as snapshot, a as derived, i as attr_style, l as stringify, m as escape_html, o as ensure_array_like, p as attr, r as attr_class, u as html } from "../../chunks/index-server.js";
//#region src/lib/engine/seed.js
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function dailySeed(date = /* @__PURE__ */ new Date()) {
	const y = date.getFullYear();
	const m = date.getMonth() + 1;
	const d = date.getDate();
	return y * 1e4 + m * 100 + d;
}
function shuffle(random, items) {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}
//#endregion
//#region src/lib/engine/solver.js
function isComplete(tube, capacity) {
	if (tube.length !== capacity) return false;
	for (let i = 1; i < tube.length; i++) if (tube[i] !== tube[0]) return false;
	return true;
}
function isWin(tubes, capacity) {
	return tubes.every((t) => t.length === 0 || isComplete(t, capacity));
}
function topRun(tube) {
	const top = tube[tube.length - 1];
	let n = 1;
	for (let i = tube.length - 2; i >= 0 && tube[i] === top; i--) n++;
	return n;
}
function keyOf(tubes) {
	return tubes.map((t) => t.join(",")).sort().join("|");
}
function legalMoves(tubes, capacity) {
	const moves = [];
	for (let from = 0; from < tubes.length; from++) {
		const src = tubes[from];
		if (src.length === 0 || isComplete(src, capacity)) continue;
		const top = src[src.length - 1];
		const run = topRun(src);
		const uniform = run === src.length;
		let emptySeen = false;
		for (let to = 0; to < tubes.length; to++) {
			if (to === from) continue;
			const dst = tubes[to];
			const space = capacity - dst.length;
			if (space === 0) continue;
			if (dst.length === 0) {
				if (uniform || emptySeen) continue;
				emptySeen = true;
				moves.push({
					from,
					to,
					count: Math.min(run, space)
				});
			} else if (dst[dst.length - 1] === top) moves.push({
				from,
				to,
				count: Math.min(run, space)
			});
		}
	}
	return moves;
}
function applyMove(tubes, move) {
	const next = tubes.map((t) => t.slice());
	const moved = next[move.from].splice(next[move.from].length - move.count, move.count);
	next[move.to].push(...moved);
	return next;
}
function ordered(tubes, capacity) {
	const moves = legalMoves(tubes, capacity);
	for (const m of moves) {
		const src = tubes[m.from];
		const dst = tubes[m.to];
		let score = 0;
		if (dst.length > 0) {
			score += 40;
			const uniformDst = dst.every((v) => v === dst[0]);
			if (uniformDst && dst.length + m.count === capacity) score += 100;
			if (uniformDst) score += 20;
		}
		if (m.count === topRun(src)) score += 15;
		if (m.count === src.length) score += 25;
		m.score = score;
	}
	moves.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to);
	return moves;
}
function optimal(tubes, capacity, { maxNodes = 4e5 } = {}) {
	const colours = /* @__PURE__ */ new Set();
	let runs = 0;
	for (const t of tubes) for (let i = 0; i < t.length; i++) {
		colours.add(t[i]);
		if (i === 0 || t[i] !== t[i - 1]) runs++;
	}
	const floor = (state) => {
		let r = 0;
		for (const t of state) for (let i = 0; i < t.length; i++) if (i === 0 || t[i] !== t[i - 1]) r++;
		return r - colours.size;
	};
	let nodes = 0;
	let aborted = false;
	let seen = /* @__PURE__ */ new Map();
	function search(state, g, bound) {
		const f = g + floor(state);
		if (f > bound) return f;
		if (isWin(state, capacity)) return true;
		if (++nodes > maxNodes) {
			aborted = true;
			return Infinity;
		}
		const key = keyOf(state);
		const known = seen.get(key);
		if (known != null && known <= g) return Infinity;
		seen.set(key, g);
		let next = Infinity;
		for (const move of legalMoves(state, capacity)) {
			const result = search(applyMove(state, move), g + 1, bound);
			if (result === true) return true;
			if (result < next) next = result;
			if (aborted) return Infinity;
		}
		return next;
	}
	let bound = floor(tubes);
	for (;;) {
		seen = /* @__PURE__ */ new Map();
		const result = search(tubes, 0, bound);
		if (result === true) return {
			length: bound,
			aborted: false
		};
		if (aborted || result === Infinity) return {
			length: null,
			aborted: true
		};
		bound = result;
	}
}
function solve(tubes, capacity, { maxNodes = 2e5, maxDepth = 300 } = {}) {
	const visited = /* @__PURE__ */ new Set();
	const path = [];
	let nodes = 0;
	let aborted = false;
	function search(state, depth) {
		if (isWin(state, capacity)) return true;
		if (depth >= maxDepth) return false;
		if (++nodes > maxNodes) {
			aborted = true;
			return false;
		}
		const key = keyOf(state);
		if (visited.has(key)) return false;
		visited.add(key);
		for (const move of ordered(state, capacity)) {
			path.push(move);
			if (search(applyMove(state, move), depth + 1)) return true;
			path.pop();
			if (aborted) return false;
		}
		return false;
	}
	const solved = search(tubes, 0);
	return {
		solved,
		moves: solved ? path.slice() : null,
		nodes,
		aborted
	};
}
var SOLVE_BUDGET = { maxNodes: 12e4 };
var MAX_SALT = 64;
function paramsFor(n) {
	if (n <= 2) return {
		colors: 2,
		capacity: 3,
		empties: 2,
		hidden: false
	};
	if (n <= 4) return {
		colors: 3,
		capacity: 3,
		empties: 2,
		hidden: false
	};
	if (n <= 6) return {
		colors: 3,
		capacity: 4,
		empties: 2,
		hidden: false
	};
	if (n <= 10) return {
		colors: 4,
		capacity: 4,
		empties: 2,
		hidden: false
	};
	if (n <= 20) return {
		colors: 5,
		capacity: 4,
		empties: 2,
		hidden: false
	};
	const step = Math.floor((n - 21) / 30);
	let colors = Math.min(12, 6 + step);
	if (colors === 12) colors = 10 + n % 3;
	const capacity = n >= 120 && n % 7 === 0 ? 5 : 4;
	const hidden = n >= 61 && n % 4 === 0;
	return {
		colors,
		capacity,
		empties: 2,
		hidden
	};
}
function levelSeed(n, salt) {
	return (Math.imul(n, 2654435761) ^ Math.imul(salt + 1, 40503) ^ 2654435769) >>> 0;
}
function deal(params, seed) {
	const random = rng(seed);
	const items = [];
	for (let c = 0; c < params.colors; c++) for (let k = 0; k < params.capacity; k++) items.push(c);
	const mixed = shuffle(random, items);
	const tubes = [];
	for (let t = 0; t < params.colors; t++) tubes.push(mixed.slice(t * params.capacity, (t + 1) * params.capacity));
	for (let e = 0; e < params.empties; e++) tubes.push([]);
	return tubes;
}
function acceptable(tubes, params) {
	return !tubes.some((t) => t.length > 0 && isComplete(t, params.capacity));
}
function findBoard(params, seedFor) {
	for (let salt = 0; salt < MAX_SALT; salt++) {
		const tubes = deal(params, seedFor(salt));
		if (!acceptable(tubes, params)) continue;
		const result = solve(tubes, params.capacity, SOLVE_BUDGET);
		if (result.solved) return {
			tubes,
			salt,
			solution: result.moves
		};
	}
	throw new Error("no solvable board found");
}
function levelBoard(n) {
	const params = paramsFor(n);
	return {
		kind: "level",
		n,
		params,
		...findBoard(params, (salt) => levelSeed(n, salt))
	};
}
function seedBoard(seed) {
	const random = rng(seed);
	const params = {
		colors: 6 + Math.floor(random() * 4),
		capacity: 4,
		empties: 2,
		hidden: false
	};
	return {
		kind: "seed",
		seed,
		params,
		...findBoard(params, (salt) => (Math.imul(seed, 2246822519) ^ Math.imul(salt + 1, 3266489917)) >>> 0)
	};
}
//#endregion
//#region src/lib/engine/art/shapes.js
var INK$6 = "#3D3230";
function face$6(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK$6}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK$6}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK$6}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S$6 = `stroke="${INK$6}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
var shapes_default = {
	key: "shapes",
	title: "Shape Town",
	tint: "#FFEED2",
	items: [
		{
			key: "sun",
			color: "#FFC53D",
			svg: `<g ${S$6}>` + [
				0,
				45,
				90,
				135,
				180,
				225,
				270,
				315
			].map((a) => {
				const r = a * Math.PI / 180;
				const x1 = 32 + Math.cos(r) * 21, y1 = 32 + Math.sin(r) * 21;
				const x2 = 32 + Math.cos(r) * 27, y2 = 32 + Math.sin(r) * 27;
				return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
			}).join("") + `<circle cx="32" cy="32" r="16" fill="#FFC53D"/></g>` + face$6(32, 32)
		},
		{
			key: "square",
			color: "#3E63DD",
			svg: `<rect x="12" y="12" width="40" height="40" rx="9" fill="#3E63DD" ${S$6}/>` + face$6(32, 32)
		},
		{
			key: "triangle",
			color: "#46A758",
			svg: `<path d="M32 9 L56 52 L8 52 Z" fill="#46A758" ${S$6}/>` + face$6(32, 38)
		},
		{
			key: "star",
			color: "#E93D82",
			svg: `<path d="M32 6 L39.6 23.4 L58 25.4 L44 38.4 L48.4 57 L32 47.2 L15.6 57 L20 38.4 L6 25.4 L24.4 23.4 Z" fill="#E93D82" ${S$6}/>` + face$6(32, 34, .9)
		},
		{
			key: "heart",
			color: "#E5484D",
			svg: `<path d="M32 55 C8 39 10 18 24 18 C29.5 18 32 23 32 23 C32 23 34.5 18 40 18 C54 18 56 39 32 55 Z" fill="#E5484D" ${S$6}/>` + face$6(32, 32, .95)
		},
		{
			key: "moon",
			color: "#8E4EC6",
			svg: `<path d="M40 8 A26 26 0 1 0 56 42 A20 20 0 0 1 40 8 Z" fill="#8E4EC6" ${S$6}/>` + face$6(30, 36, .9)
		},
		{
			key: "cloud",
			color: "#9BB0C1",
			svg: `<path d="M18 46 A9 9 0 0 1 16 28 A12 12 0 0 1 39 22 A10 10 0 0 1 48 46 Z" fill="#9BB0C1" ${S$6}/>` + face$6(32, 36, .85)
		},
		{
			key: "drop",
			color: "#12A594",
			svg: `<path d="M32 6 C44 24 51 33 51 41 A19 19 0 0 1 13 41 C13 33 20 24 32 6 Z" fill="#12A594" ${S$6}/>` + face$6(32, 40, .95)
		},
		{
			key: "diamond",
			color: "#00A2C7",
			svg: `<path d="M20 12 L44 12 L56 27 L32 56 L8 27 Z" fill="#00A2C7" ${S$6}/><path d="M8 27 L56 27 M20 12 L26 27 L32 56 M44 12 L38 27 L32 56" stroke="${INK$6}" stroke-width="2" fill="none" opacity=".45"/>` + face$6(32, 21, .7)
		},
		{
			key: "lightning",
			color: "#F76B15",
			svg: `<path d="M36 5 L14 36 L28 36 L24 59 L50 26 L34 26 Z" fill="#F76B15" ${S$6}/>` + face$6(31, 25, .72)
		},
		{
			key: "flower",
			color: "#99D52A",
			svg: `<g fill="#99D52A" ${S$6}>` + [
				0,
				60,
				120,
				180,
				240,
				300
			].map((a) => {
				const r = a * Math.PI / 180;
				const x = 32 + Math.cos(r) * 15, y = 32 + Math.sin(r) * 15;
				return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10"/>`;
			}).join("") + `</g><circle cx="32" cy="32" r="12" fill="#FFF6E5" ${S$6}/>` + face$6(32, 32, .8)
		},
		{
			key: "donut",
			color: "#AD7F58",
			svg: `<circle cx="32" cy="32" r="24" fill="#AD7F58" ${S$6}/><circle cx="32" cy="32" r="8" fill="#FFF6E5" ${S$6}/><circle cx="20" cy="24" r="1.8" fill="#FFF6E5"/><circle cx="44" cy="22" r="1.8" fill="#FFF6E5"/><circle cx="46" cy="40" r="1.8" fill="#FFF6E5"/><circle cx="18" cy="40" r="1.8" fill="#FFF6E5"/>` + face$6(32, 47, .62)
		}
	]
};
//#endregion
//#region src/lib/engine/art/fruits.js
var INK$5 = "#3D3230";
var LEAF = "#46A758";
var CREAM = "#FFF6E5";
function face$5(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK$5}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK$5}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK$5}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S$5 = `stroke="${INK$5}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
var fruits_default = {
	key: "fruits",
	title: "Fruit Farm",
	tint: "#FFF1DC",
	items: [
		{
			key: "apple",
			color: "#E5484D",
			svg: `<path d="M32 16 C32 11 33 8 36 6" fill="none" ${S$5}/><path d="M36 12 C38 5 46 4 49 8 C47 14 40 16 36 12 Z" fill="${LEAF}" ${S$5}/><path d="M32 19 C27 12 16 12 12 21 C7 31 12 46 21 53 C26 57 30 54 32 54 C34 54 38 57 43 53 C52 46 57 31 52 21 C48 12 37 12 32 19 Z" fill="#E5484D" ${S$5}/>` + face$5(32, 36)
		},
		{
			key: "banana",
			color: "#FFB627",
			svg: `<path d="M10 20 C10 36 20 52 38 53 C48 54 55 40 56 26 C56 21 51 21 50 25 C48 34 42 40 34 40 C26 40 17 32 15 22 C14 17 10 16 10 20 Z" fill="#FFB627" ${S$5}/>` + face$5(34, 47, .7)
		},
		{
			key: "grapes",
			color: "#8E4EC6",
			svg: `<path d="M32 26 C32 14 33 10 37 7" fill="none" ${S$5}/><g fill="#8E4EC6" ${S$5}><circle cx="24" cy="21" r="8"/><circle cx="40" cy="21" r="8"/><circle cx="15" cy="32" r="8"/><circle cx="49" cy="32" r="8"/><circle cx="24" cy="45" r="8"/><circle cx="40" cy="45" r="8"/><circle cx="32" cy="52" r="7"/><circle cx="32" cy="33" r="10"/></g>` + face$5(32, 33, .78)
		},
		{
			key: "orange",
			color: "#F76B15",
			svg: `<path d="M30 14 C26 6 16 6 14 12 C18 18 26 18 30 14 Z" fill="${LEAF}" ${S$5}/><path d="M34 14 C38 6 48 6 50 12 C46 18 38 18 34 14 Z" fill="${LEAF}" ${S$5}/><circle cx="32" cy="36" r="20" fill="#F76B15" ${S$5}/><circle cx="24" cy="27" r="2.5" fill="${CREAM}" opacity=".7"/>` + face$5(32, 37)
		},
		{
			key: "strawberry",
			color: "#E93D82",
			svg: `<path d="M32 57 C18 50 11 38 12 27 C13 20 21 16 32 16 C43 16 51 20 52 27 C53 38 46 50 32 57 Z" fill="#E93D82" ${S$5}/><path d="M20 18 L26 8 L32 15 L38 8 L44 18 Z" fill="${LEAF}" ${S$5}/><g fill="${CREAM}"><circle cx="21" cy="28" r="1.6"/><circle cx="43" cy="28" r="1.6"/><circle cx="17" cy="37" r="1.6"/><circle cx="47" cy="37" r="1.6"/><circle cx="25" cy="48" r="1.6"/><circle cx="39" cy="48" r="1.6"/></g>` + face$5(32, 35, .95)
		},
		{
			key: "pear",
			color: "#99D52A",
			svg: `<path d="M32 10 C32 8 33 6 35 5" fill="none" ${S$5}/><path d="M35 9 C39 4 45 5 46 9 C43 13 37 13 35 9 Z" fill="${LEAF}" ${S$5}/><path d="M32 10 C36 10 38 15 39 21 C40 27 46 31 48 39 C50 49 42 56 32 56 C22 56 14 49 16 39 C18 31 24 27 25 21 C26 15 28 10 32 10 Z" fill="#99D52A" ${S$5}/>` + face$5(32, 42)
		},
		{
			key: "watermelon",
			color: "#FF6E7F",
			svg: `<path d="M7 20 A25 25 0 0 0 57 20 Z" fill="${LEAF}" ${S$5}/><path d="M11 20 A21 21 0 0 0 53 20 Z" fill="${CREAM}"/><path d="M14 20 A18 18 0 0 0 50 20 Z" fill="#FF6E7F" ${S$5}/><g fill="${INK$5}"><circle cx="21" cy="26" r="1.7"/><circle cx="43" cy="26" r="1.7"/></g>` + face$5(32, 29, .8)
		},
		{
			key: "pineapple",
			color: "#D98E32",
			svg: `<path d="M22 24 L18 7 L28 17 L32 5 L36 17 L46 7 L42 24 Z" fill="${LEAF}" ${S$5}/><ellipse cx="32" cy="39" rx="15" ry="18" fill="#D98E32" ${S$5}/><path d="M21 31 L43 49 M43 31 L21 49" stroke="${INK$5}" stroke-width="2" fill="none" opacity=".22"/>` + face$5(32, 38, .9)
		},
		{
			key: "cherries",
			color: "#9E2B2B",
			svg: `<path d="M20 34 C21 21 26 13 33 9 M44 36 C42 23 38 14 33 9" fill="none" ${S$5}/><path d="M33 10 C36 4 44 4 46 9 C42 14 36 14 33 10 Z" fill="${LEAF}" ${S$5}/><circle cx="44" cy="45" r="10.5" fill="#9E2B2B" ${S$5}/><circle cx="20" cy="42" r="10.5" fill="#9E2B2B" ${S$5}/><circle cx="48" cy="41" r="2" fill="${CREAM}" opacity=".6"/>` + face$5(20, 42, .62)
		},
		{
			key: "lemon",
			color: "#F2E749",
			svg: `<path d="M6 32 C6 27 10 24 15 22 C21 18 27 17 32 17 C37 17 43 18 49 22 C54 24 58 27 58 32 C58 37 54 40 49 42 C43 46 37 47 32 47 C27 47 21 46 15 42 C10 40 6 37 6 32 Z" fill="#F2E749" ${S$5}/><ellipse cx="19" cy="26" rx="3" ry="2" fill="${CREAM}" opacity=".7"/>` + face$5(32, 32, .85)
		},
		{
			key: "blueberries",
			color: "#3E63DD",
			svg: `<circle cx="20" cy="24" r="11" fill="#3E63DD" ${S$5}/><circle cx="44" cy="24" r="11" fill="#3E63DD" ${S$5}/><g stroke="${INK$5}" stroke-width="2" fill="none" opacity=".45"><circle cx="20" cy="21" r="2.6"/><circle cx="44" cy="21" r="2.6"/></g><circle cx="32" cy="42" r="14" fill="#3E63DD" ${S$5}/>` + face$5(32, 42, .9)
		},
		{
			key: "peach",
			color: "#FFAB76",
			svg: `<path d="M36 13 C40 5 50 6 51 11 C48 17 39 18 36 13 Z" fill="${LEAF}" ${S$5}/><path d="M32 16 C36 9 48 10 52 21 C56 34 48 51 32 55 C16 51 8 34 12 21 C16 10 28 9 32 16 Z" fill="#FFAB76" ${S$5}/><path d="M32 16 C29 20 28 24 28 28" stroke="${INK$5}" stroke-width="2" fill="none" opacity=".35"/>` + face$5(32, 37)
		}
	]
};
//#endregion
//#region src/lib/engine/art/ocean.js
var INK$4 = "#3D3230";
function face$4(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK$4}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK$4}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK$4}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S$4 = `stroke="${INK$4}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
var ocean_default = {
	key: "ocean",
	title: "Rock Pool",
	tint: "#FBEFDC",
	items: [
		{
			key: "fish",
			color: "#F76B15",
			svg: `<g fill="#F76B15" ${S$4}><path d="M44 32 L58 21 L58 43 Z"/><ellipse cx="27" cy="32" rx="20" ry="14"/><path d="M30 33 Q38 35 36 43 Q29 41 29 36 Z"/></g>` + face$4(21, 31, .9)
		},
		{
			key: "crab",
			color: "#E5484D",
			svg: `<g fill="#E5484D" ${S$4}><line x1="20" y1="31" x2="13" y2="24"/><line x1="44" y1="31" x2="51" y2="24"/><circle cx="12" cy="19" r="6.5"/><circle cx="52" cy="19" r="6.5"/><line x1="19" y1="44" x2="9" y2="50"/><line x1="45" y1="44" x2="55" y2="50"/><line x1="22" y1="48" x2="15" y2="56"/><line x1="42" y1="48" x2="49" y2="56"/><circle cx="32" cy="38" r="15.5"/></g>` + face$4(32, 37)
		},
		{
			key: "starfish",
			color: "#FFC53D",
			svg: `<path d="M32 6 L39.1 23.3 L57.7 24.7 L43.4 36.7 L47.9 54.8 L32 45 L16.1 54.8 L20.6 36.7 L6.3 24.7 L24.9 23.3 Z" fill="#FFC53D" ${S$4}/><circle cx="32" cy="15" r="1.7" fill="#FFF6E5"/><circle cx="14" cy="27" r="1.7" fill="#FFF6E5"/><circle cx="50" cy="27" r="1.7" fill="#FFF6E5"/>` + face$4(32, 32, .85)
		},
		{
			key: "octopus",
			color: "#8E4EC6",
			svg: `<g fill="#8E4EC6" ${S$4}><path fill="none" d="M18 45 Q16 53 9 56"/><path fill="none" d="M27 45 Q26 55 20 58"/><path fill="none" d="M37 45 Q38 55 44 58"/><path fill="none" d="M46 45 Q48 53 55 56"/><path d="M12 31 A20 20 0 0 1 52 31 L52 40 Q52 45 47 45 L17 45 Q12 45 12 40 Z"/></g>` + face$4(32, 30)
		},
		{
			key: "whale",
			color: "#3E63DD",
			svg: `<g fill="#3E63DD" ${S$4}><path fill="none" d="M23 17 Q21 10 16 9 M25 17 Q27 10 32 9"/><path d="M6 36 Q6 19 27 19 Q45 19 48 31 Q51 25 58 24 Q57 31 52 34 Q57 37 58 44 Q51 43 48 37 Q44 51 26 51 Q6 51 6 36 Z"/></g>` + face$4(22, 34, .95)
		},
		{
			key: "turtle",
			color: "#46A758",
			svg: `<g fill="#46A758" ${S$4}><circle cx="50" cy="25" r="8"/><path d="M10 43 L5.5 46.5 L11 49 Z"/><ellipse cx="20" cy="49" rx="5" ry="4"/><ellipse cx="39" cy="49" rx="5" ry="4"/><path d="M9 40 a21 17 0 0 1 42 0 v1 q0 5 -5 5 H14 q-5 0 -5 -5 Z"/><path d="M14 34 h32 M24 25 v20 M37 25 v20" stroke-width="2" fill="none" opacity=".4"/></g>` + face$4(50, 25, .6)
		},
		{
			key: "seahorse",
			color: "#E93D82",
			svg: `<g fill="#E93D82" ${S$4}><path d="M40 25 Q47 29 44 36 Q38 34 39 29 Z"/><path d="M12 11 Q22 4 31 7 Q41 10 41 20 Q41 31 35 38 Q30 43 30 47 Q30 52 35 53 Q30 57 25 53 Q20 49 24 42 Q17 40 16 31 Q16 27 20 25 Q17 21 18 17 L8 19 Q6 15 12 11 Z"/></g>` + face$4(28, 16, .7)
		},
		{
			key: "jellyfish",
			color: "#7ED4C2",
			svg: `<g fill="#7ED4C2" ${S$4}><path fill="none" d="M20 37 Q16 43 20 48 Q23 52 20 55"/><path fill="none" d="M32 38 Q28 44 32 49 Q35 53 32 57"/><path fill="none" d="M44 37 Q40 43 44 48 Q47 52 44 55"/><path d="M10 33 A22 22 0 0 1 54 33 V35 A5.5 4 0 0 1 43 35 A5.5 4 0 0 1 32 35 A5.5 4 0 0 1 21 35 A5.5 4 0 0 1 10 35 Z"/></g>` + face$4(32, 26, .95)
		},
		{
			key: "seashell",
			color: "#F7CE9B",
			svg: `<g fill="#F7CE9B" ${S$4}><path d="M32 56 L13 34 A11 11 0 0 1 24 22 A9 8 0 0 1 40 22 A11 11 0 0 1 51 34 Z"/><path d="M27 44 L20 30 M32 46 V24 M37 44 L44 30" stroke-width="2" fill="none" opacity=".4"/></g>` + face$4(32, 38, .8)
		},
		{
			key: "pufferfish",
			color: "#BDEE63",
			svg: (() => {
				const pt = (rad, ang) => `${(32 + Math.cos(ang) * rad).toFixed(1)} ${(32 + Math.sin(ang) * rad).toFixed(1)}`;
				return `<g fill="#BDEE63" ${S$4}>` + [
					22,
					67,
					112,
					157,
					202,
					247,
					292,
					337
				].map((a) => {
					const r = a * Math.PI / 180;
					return `<path d="M ${pt(27, r)} L ${pt(16, r - .24)} L ${pt(16, r + .24)} Z"/>`;
				}).join("") + `<circle cx="32" cy="32" r="16.5"/></g>` + face$4(32, 32, .95);
			})()
		},
		{
			key: "dolphin",
			color: "#9BB0C1",
			svg: `<g fill="#9BB0C1" ${S$4}><path d="M7 36 Q5 32 9 30 Q11 22 20 18 Q26 15 32 16 Q31 10 38 8 Q39 14 36 17 Q46 19 50 27 Q53 23 58 23 Q57 30 53 32 Q56 35 58 41 Q52 41 49 37 Q44 44 32 44 Q16 44 10 38 Q7 38 7 36 Z"/><path d="M26 35 Q33 37 31 44 Q24 43 23 38 Z"/></g>` + face$4(18, 28, .75)
		},
		{
			key: "snail",
			color: "#AD7F58",
			svg: `<g fill="#F2C288" ${S$4}><line x1="48" y1="36" x2="46" y2="28"/><line x1="53" y1="38" x2="55" y2="29"/><circle cx="46" cy="26.5" r="2.4"/><circle cx="55.5" cy="27.5" r="2.4"/><path d="M42 32 Q56 32 56 45 v1 q0 4 -4 4 H10 q-4 0 -4 -4 q0 -8 11 -8 h20 Z"/><circle cx="24" cy="28" r="17" fill="#AD7F58"/><path d="M24 28 a6.5 6.5 0 0 1 6.5 6.5 a10 10 0 0 1 -15 6" fill="none" stroke-width="2" opacity=".45"/></g>` + face$4(49, 42, .62)
		}
	]
};
//#endregion
//#region src/lib/engine/art/bugs.js
var INK$3 = "#3D3230";
function face$3(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK$3}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK$3}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK$3}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S$3 = `stroke="${INK$3}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
var bugs_default = {
	key: "bugs",
	title: "Bug Garden",
	tint: "#EFF7DE",
	items: [
		{
			key: "ladybug",
			color: "#E5484D",
			svg: `<g ${S$3}><path d="M27 14 L21 8 M37 14 L43 8" fill="none"/><circle cx="32" cy="35" r="22" fill="#E5484D"/></g><g fill="${INK$3}"><circle cx="21" cy="8" r="2.2"/><circle cx="43" cy="8" r="2.2"/><circle cx="15" cy="30" r="2.6"/><circle cx="49" cy="30" r="2.6"/><circle cx="20" cy="47" r="2.6"/><circle cx="44" cy="47" r="2.6"/><circle cx="32" cy="53" r="2.6"/></g>` + face$3(32, 31)
		},
		{
			key: "bee",
			color: "#FFC53D",
			svg: `<g ${S$3}><ellipse cx="23" cy="20" rx="8.5" ry="6.5" fill="#FFF6E5"/><ellipse cx="41" cy="20" rx="8.5" ry="6.5" fill="#FFF6E5"/><ellipse cx="32" cy="38" rx="17" ry="13" fill="#FFC53D"/><path d="M22.5 29 L22.5 47 M41.5 29 L41.5 47" fill="none"/></g>` + face$3(32, 37, .85)
		},
		{
			key: "butterfly",
			color: "#E93D82",
			svg: `<g ${S$3}><path d="M30 20 L25 9 M34 20 L39 9" fill="none"/><g fill="#E93D82"><circle cx="19" cy="23" r="12.5"/><circle cx="45" cy="23" r="12.5"/><circle cx="21" cy="44" r="9.5"/><circle cx="43" cy="44" r="9.5"/></g><ellipse cx="32" cy="36" rx="6.5" ry="16" fill="#FFF6E5"/></g><circle cx="25" cy="9" r="2" fill="${INK$3}"/><circle cx="39" cy="9" r="2" fill="${INK$3}"/><circle cx="17" cy="22" r="3.5" fill="#FFF6E5"/><circle cx="47" cy="22" r="3.5" fill="#FFF6E5"/>` + face$3(32, 30, .6)
		},
		{
			key: "caterpillar",
			color: "#99D52A",
			svg: `<g ${S$3}><path d="M13 26 L8 15 M20 25 L24 13" fill="none"/><g fill="#99D52A"><circle cx="49" cy="42" r="8"/><circle cx="40" cy="44" r="8"/><circle cx="31" cy="44" r="8"/><circle cx="23" cy="41" r="8"/><circle cx="16" cy="35" r="10.5"/></g></g><circle cx="8" cy="15" r="2" fill="${INK$3}"/><circle cx="24" cy="13" r="2" fill="${INK$3}"/>` + face$3(16, 36, .62)
		},
		{
			key: "snail",
			color: "#AD7F58",
			svg: `<g ${S$3}><path d="M12 31 L8 22 M19 30 L23 20" fill="none"/><g fill="#FFF6E5"><rect x="11" y="44" width="44" height="10" rx="5"/><circle cx="15" cy="40" r="9.5"/></g><circle cx="40" cy="29" r="16" fill="#AD7F58"/><circle cx="40" cy="29" r="8" fill="none"/></g><circle cx="8" cy="22" r="2" fill="${INK$3}"/><circle cx="23" cy="20" r="2" fill="${INK$3}"/>` + face$3(15, 41, .6)
		},
		{
			key: "ant",
			color: "#9C5A26",
			svg: `<g ${S$3}><path d="M28 41 L23 53 M33 43 L33 54 M38 41 L43 53 M13 26 L8 16 M22 25 L27 15" fill="none"/><g fill="#9C5A26"><circle cx="48" cy="34" r="10"/><circle cx="33" cy="37" r="7"/><circle cx="17" cy="34" r="10.5"/></g></g>` + face$3(17, 34, .62)
		},
		{
			key: "dragonfly",
			color: "#3E63DD",
			svg: `<g ${S$3}><g fill="#FFF6E5"><ellipse cx="18" cy="30" rx="11" ry="4.5"/><ellipse cx="46" cy="30" rx="11" ry="4.5"/><ellipse cx="20" cy="40" rx="9" ry="4"/><ellipse cx="44" cy="40" rx="9" ry="4"/></g><rect x="29" y="22" width="6" height="32" rx="3" fill="#3E63DD"/><path d="M29 40 L35 40 M29 46 L35 46" stroke-width="2" opacity=".45" fill="none"/><circle cx="32" cy="15" r="9.5" fill="#3E63DD"/></g>` + face$3(32, 15, .62)
		},
		{
			key: "beetle",
			color: "#8E4EC6",
			svg: `<g ${S$3}><path d="M18 28 L10 23 M16 38 L7 38 M18 47 L10 52 M46 28 L54 23 M48 38 L57 38 M46 47 L54 52 M26 18 L21 8 M38 18 L43 8" fill="none"/><ellipse cx="32" cy="37" rx="16" ry="20" fill="#8E4EC6"/><path d="M32 42 L32 55" fill="none"/></g>` + face$3(32, 30, .85)
		},
		{
			key: "spider",
			color: "#12A594",
			svg: `<g ${S$3}><g fill="none"><path d="M20 21 Q9 16 7 25"/><path d="M17 26 Q6 27 6 37"/><path d="M18 32 Q8 37 10 46"/><path d="M21 37 Q13 45 16 52"/><path d="M44 21 Q55 16 57 25"/><path d="M47 26 Q58 27 58 37"/><path d="M46 32 Q56 37 54 46"/><path d="M43 37 Q51 45 48 52"/></g><circle cx="32" cy="29" r="15.5" fill="#12A594"/></g>` + face$3(32, 29, .95)
		},
		{
			key: "grasshopper",
			color: "#46A758",
			svg: `<g ${S$3}><path d="M38 45 L50 26 L55 49 M24 48 L21 55 M31 49 L30 55 M12 26 L6 13 M18 25 L15 11" fill="none"/><ellipse cx="34" cy="40" rx="17" ry="9.5" fill="#46A758"/><circle cx="15" cy="33" r="9" fill="#46A758"/></g>` + face$3(15, 34, .6)
		},
		{
			key: "firefly",
			color: "#F76B15",
			svg: `<g ${S$3}><circle cx="32" cy="44" r="11.5" fill="#FFE38C"/><ellipse cx="18" cy="28" rx="5.5" ry="10" fill="#FFF6E5" transform="rotate(-20 18 28)"/><ellipse cx="46" cy="28" rx="5.5" ry="10" fill="#FFF6E5" transform="rotate(20 46 28)"/><path d="M27 15 L22 6 M37 15 L42 6" fill="none"/><ellipse cx="32" cy="25" rx="10.5" ry="12" fill="#F76B15"/></g>` + face$3(32, 25, .72)
		},
		{
			key: "rolypoly",
			color: "#9BB0C1",
			svg: `<g ${S$3} fill="none"><path d="M13 34 L6 26 M17 28 L13 19"/><path d="M17 45 L16 54 M25 45 L25 55 M33 45 L33 55 M41 45 L41 55 M49 45 L48 54"/><path d="M8 46 A24 24 0 0 1 56 46 Z" fill="#9BB0C1"/><path d="M41 26 L41 46 M49 31.5 L49 46"/></g>` + face$3(22, 37, .78)
		}
	]
};
//#endregion
//#region src/lib/engine/art/gems.js
var INK$2 = "#3D3230";
function face$2(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK$2}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK$2}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK$2}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S$2 = `stroke="${INK$2}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
var gems_default = {
	key: "gems",
	title: "Gem Cave",
	tint: "#F9E8EF",
	items: [
		{
			key: "ruby",
			color: "#E5484D",
			svg: `<circle cx="32" cy="32" r="24" fill="#E5484D" ${S$2}/><path d="M16 25 A18 18 0 0 1 24 16" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` + face$2(32, 33)
		},
		{
			key: "emerald",
			color: "#30A46C",
			svg: `<path d="M18 8 L46 8 L56 18 L56 46 L46 56 L18 56 L8 46 L8 18 Z" fill="#30A46C" ${S$2}/><rect x="16" y="16" width="32" height="32" fill="none" stroke="${INK$2}" stroke-width="2" opacity=".35"/>` + face$2(32, 32)
		},
		{
			key: "sapphire",
			color: "#3E63DD",
			svg: `<path d="M32 6 C43 22 50 31 50 40 A18 18 0 0 1 14 40 C14 31 21 22 32 6 Z" fill="#3E63DD" ${S$2}/><path d="M20 41 A12 12 0 0 0 25 50" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` + face$2(32, 39, .95)
		},
		{
			key: "amethyst",
			color: "#8E4EC6",
			svg: `<path d="M32 6 L54 19 L54 45 L32 58 L10 45 L10 19 Z" fill="#8E4EC6" ${S$2}/><path d="M15 22 L15 42" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>` + face$2(32, 33)
		},
		{
			key: "topaz",
			color: "#FFB224",
			svg: `<ellipse cx="32" cy="32" rx="16" ry="26" fill="#FFB224" ${S$2}/><path d="M22 22 A16 20 0 0 1 27 13" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` + face$2(32, 33, .95)
		},
		{
			key: "diamond",
			color: "#8FD8EA",
			svg: `<path d="M18 12 L46 12 L57 26 L32 56 L7 26 Z" fill="#8FD8EA" ${S$2}/><path d="M7 26 L57 26 M18 12 L25 26 L32 56 M46 12 L39 26 L32 56" stroke="${INK$2}" stroke-width="2" fill="none" opacity=".4"/>` + face$2(32, 20, .7)
		},
		{
			key: "pearl",
			color: "#E08A6E",
			svg: `<path d="M8 33 A24 21 0 0 0 56 33 Z" fill="#E08A6E" ${S$2}/><path d="M32 53 L18 36 M32 53 L32 34 M32 53 L46 36" stroke="${INK$2}" stroke-width="2" fill="none" opacity=".35"/><circle cx="32" cy="26" r="13" fill="#FFF6E5" ${S$2}/>` + face$2(32, 26, .8)
		},
		{
			key: "citrine",
			color: "#FFDD33",
			svg: `<path d="M32 8 L57 51 L7 51 Z" fill="#FFDD33" ${S$2}/><path d="M27 20 L21 31" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` + face$2(32, 38, .95)
		},
		{
			key: "heart",
			color: "#E93D82",
			svg: `<path d="M32 57 L9 31 L9 21 L18 12 L28 12 L32 18 L36 12 L46 12 L55 21 L55 31 Z" fill="#E93D82" ${S$2}/><path d="M13 22 L20 15" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` + face$2(32, 31, .95)
		},
		{
			key: "star",
			color: "#12A594",
			svg: `<path d="M32 6 L39 25 L58 32 L39 39 L32 58 L25 39 L6 32 L25 25 Z" fill="#12A594" ${S$2}/>` + face$2(32, 32, .8)
		},
		{
			key: "cluster",
			color: "#B98AE0",
			svg: `<g fill="#B98AE0" ${S$2}><path d="M13 56 L13 36 L20 24 L27 36 L27 56 Z"/><path d="M41 56 L41 38 L48 28 L55 38 L55 56 Z"/><path d="M25 56 L25 24 L33 8 L41 24 L41 56 Z"/></g>` + face$2(33, 38, .85)
		},
		{
			key: "geode",
			color: "#A18072",
			svg: `<path d="M6 52 A26 30 0 0 1 58 52 Z" fill="#A18072" ${S$2}/><path d="M14 52 A18 21 0 0 1 50 52 Z" fill="#FFF6E5" ${S$2}/><path d="M22 52 A10 12 0 0 1 42 52 Z" fill="#8E4EC6" ${S$2}/>` + face$2(32, 45, .8)
		}
	]
};
//#endregion
//#region src/lib/engine/art/workshop.js
var INK$1 = "#3D3230";
function face$1(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK$1}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK$1}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK$1}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S$1 = `stroke="${INK$1}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
var workshop_default = {
	key: "workshop",
	title: "The Workshop",
	tint: "#F5EAD9",
	items: [
		{
			key: "bolt",
			color: "#6E82A0",
			svg: `<g ${S$1}><rect x="24" y="21" width="16" height="35" rx="3" fill="#6E82A0"/><path d="M13 8 L51 8 L48 21 L16 21 Z" fill="#6E82A0"/><line x1="26" y1="41" x2="38" y2="38"/><line x1="26" y1="49" x2="38" y2="46"/></g>` + face$1(32, 14.5, .75)
		},
		{
			key: "nut",
			color: "#C9A227",
			svg: `<polygon points="16,8 48,8 58,32 48,56 16,56 6,32" fill="#C9A227" ${S$1}/><circle cx="32" cy="19" r="5" fill="#FFF6E5" ${S$1}/>` + face$1(32, 38)
		},
		{
			key: "screw",
			color: "#9BB0C1",
			svg: `<g ${S$1}><path d="M24 22 L40 22 L32 57 Z" fill="#9BB0C1"/><path d="M18 22 A14 14 0 0 1 46 22 Z" fill="#9BB0C1"/><line x1="28" y1="10.5" x2="36" y2="10.5"/><line x1="26.5" y1="31" x2="37.5" y2="29"/><line x1="28" y1="39" x2="36" y2="37"/><line x1="30" y1="47" x2="34" y2="45"/></g>` + face$1(32, 16, .7)
		},
		{
			key: "gear",
			color: "#F76B15",
			svg: `<g fill="#F76B15" ${S$1}>` + [
				0,
				45,
				90,
				135,
				180,
				225,
				270,
				315
			].map((a) => {
				const t = a * Math.PI / 180;
				const c = Math.cos(t), s = Math.sin(t);
				const p = (r, w) => `${Math.round(32 + c * r - s * w)},${Math.round(32 + s * r + c * w)}`;
				const q = (r, w) => `${Math.round(32 + c * r + s * w)},${Math.round(32 + s * r - c * w)}`;
				return `<polygon points="${p(17, 6)} ${p(26, 4)} ${q(26, 4)} ${q(17, 6)}"/>`;
			}).join("") + `<circle cx="32" cy="32" r="20" fill="#F76B15"/></g>` + face$1(32, 32)
		},
		{
			key: "spring",
			color: "#12A594",
			svg: `<g fill="#12A594" ${S$1}><ellipse cx="32" cy="46" rx="17" ry="8.5"/><ellipse cx="32" cy="32" rx="17" ry="8.5"/><ellipse cx="32" cy="18" rx="17" ry="8.5"/></g>` + face$1(32, 33.5, .62)
		},
		{
			key: "wrench",
			color: "#3E63DD",
			svg: `<rect x="27" y="24" width="10" height="34" rx="4.5" fill="#3E63DD" ${S$1}/><path d="M24 6 L32 16 L40 6 A13.6 13.6 0 1 1 24 6 Z" fill="#3E63DD" ${S$1}/>` + face$1(32, 23, .62)
		},
		{
			key: "hammer",
			color: "#5C6B7A",
			svg: `<rect x="22" y="24" width="9" height="32" rx="4" fill="#D9A066" ${S$1}/><polygon points="12,8 40,8 54,16.5 40,25 12,25" fill="#5C6B7A" ${S$1}/>` + face$1(26, 16.5, .7)
		},
		{
			key: "brush",
			color: "#E93D82",
			svg: `<g ${S$1}><rect x="28" y="5" width="8" height="20" rx="3" fill="#C98E5A"/><rect x="25" y="24" width="14" height="9" rx="2" fill="#9BB0C1"/><path d="M25 33 C19 39 18 46 19 52 Q25 57 32 57 Q39 57 45 52 C46 46 45 39 39 33 Z" fill="#E93D82"/></g>` + face$1(32, 45, .72)
		},
		{
			key: "ruler",
			color: "#AD7F58",
			svg: `<rect x="20" y="6" width="24" height="52" rx="3" fill="#AD7F58" ${S$1}/><g stroke="${INK$1}" stroke-width="2" stroke-linecap="round"><line x1="20" y1="13" x2="28" y2="13"/><line x1="20" y1="22" x2="24" y2="22"/><line x1="20" y1="31" x2="28" y2="31"/><line x1="20" y1="40" x2="24" y2="40"/><line x1="20" y1="49" x2="28" y2="49"/></g>` + face$1(35, 32, .72)
		},
		{
			key: "magnet",
			color: "#E5484D",
			svg: `<path d="M14 56 V30 A18 18 0 0 1 50 30 V56 H38 V32 A6 6 0 0 0 26 32 V56 Z" fill="#E5484D" ${S$1}/><rect x="14" y="47" width="12" height="9" fill="#FFF6E5" ${S$1}/><rect x="38" y="47" width="12" height="9" fill="#FFF6E5" ${S$1}/>` + face$1(32, 19, .72)
		},
		{
			key: "bulb",
			color: "#FFC53D",
			svg: `<rect x="25" y="40" width="14" height="15" rx="3.5" fill="#C7CFD6" ${S$1}/><line x1="26" y1="46" x2="38" y2="46" stroke="${INK$1}" stroke-width="2"/><line x1="26" y1="50" x2="38" y2="50" stroke="${INK$1}" stroke-width="2"/><circle cx="32" cy="25" r="17" fill="#FFC53D" ${S$1}/><circle cx="25.5" cy="18.5" r="2.4" fill="#FFF6E5"/>` + face$1(32, 26)
		},
		{
			key: "paintcan",
			color: "#46A758",
			svg: `<path d="M16 18 A22 22 0 0 1 48 18" fill="none" ${S$1}/><rect x="14" y="20" width="36" height="36" rx="4" fill="#46A758" ${S$1}/><ellipse cx="32" cy="20" rx="19" ry="5.5" fill="#C7CFD6" ${S$1}/><ellipse cx="32" cy="20" rx="13" ry="3" fill="#46A758" stroke="${INK$1}" stroke-width="2"/>` + face$1(32, 40, .9)
		}
	]
};
//#endregion
//#region src/lib/engine/art/pets.js
var INK = "#3D3230";
function face(cx, cy, s = 1) {
	const ex = 5.5 * s;
	const ey = 1.5 * s;
	const er = 1.9 * s;
	const sw = 2.4 * s;
	const sr = 4.6 * s;
	return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK}"/><circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK}"/><path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`;
}
var S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
//#endregion
//#region src/lib/engine/art/index.js
var THEMES = [
	shapes_default,
	fruits_default,
	ocean_default,
	bugs_default,
	gems_default,
	workshop_default,
	{
		key: "pets",
		title: "Pet Party",
		tint: "#FFE9DA",
		items: [
			{
				key: "dog",
				color: "#A9743F",
				svg: `<g ${S}><ellipse cx="11" cy="32" rx="7" ry="14" fill="#7E5230"/><ellipse cx="53" cy="32" rx="7" ry="14" fill="#7E5230"/><circle cx="32" cy="34" r="20" fill="#A9743F"/></g><ellipse cx="32" cy="42" rx="9" ry="7" fill="#F2E1C6"/><circle cx="32" cy="36.5" r="2.2" fill="${INK}"/>` + face(32, 34)
			},
			{
				key: "cat",
				color: "#8B93A6",
				svg: `<g ${S} fill="#8B93A6"><path d="M15 27 L17 7 L31 15 Z"/><path d="M49 27 L47 7 L33 15 Z"/><circle cx="32" cy="36" r="19"/></g><g stroke="${INK}" stroke-width="2" stroke-linecap="round"><line x1="8" y1="33" x2="16" y2="34"/><line x1="8" y1="41" x2="16" y2="39"/><line x1="56" y1="33" x2="48" y2="34"/><line x1="56" y1="41" x2="48" y2="39"/></g>` + face(32, 36)
			},
			{
				key: "bunny",
				color: "#B08CE0",
				svg: `<g ${S} fill="#B08CE0"><ellipse cx="23" cy="17" rx="6" ry="12.5"/><ellipse cx="41" cy="17" rx="6" ry="12.5"/></g><ellipse cx="23" cy="18" rx="2.8" ry="8" fill="#E9C7E0"/><ellipse cx="41" cy="18" rx="2.8" ry="8" fill="#E9C7E0"/><circle cx="32" cy="40" r="17" fill="#B08CE0" ${S}/>` + face(32, 40)
			},
			{
				key: "hamster",
				color: "#EFD9A7",
				svg: `<g ${S} fill="#EFD9A7"><circle cx="19" cy="19" r="5"/><circle cx="45" cy="19" r="5"/><path d="M11 40 C11 24 20 17 32 17 C44 17 53 24 53 40 C53 52 44 57 32 57 C20 57 11 52 11 40 Z"/><circle cx="25" cy="53" r="3.5"/><circle cx="39" cy="53" r="3.5"/></g><circle cx="17" cy="41" r="5" fill="#E2BC72"/><circle cx="47" cy="41" r="5" fill="#E2BC72"/>` + face(32, 37)
			},
			{
				key: "parrot",
				color: "#43A047",
				svg: `<g ${S}><g fill="#E3572B"><circle cx="24" cy="11" r="4.5"/><circle cx="40" cy="11" r="4.5"/><path d="M25 51 L32 60 L39 51 Z"/></g><circle cx="32" cy="8.5" r="4.5" fill="#F4913B"/><ellipse cx="32" cy="34" rx="17" ry="21" fill="#43A047"/><g fill="#2E7D32"><path d="M17 31 C9 36 9 47 16 52 C20 47 20 36 17 31 Z"/><path d="M47 31 C55 36 55 47 48 52 C44 47 44 36 47 31 Z"/></g><path d="M29.5 32 L34.5 32 L32 36.5 Z" fill="#F7D14B" stroke-width="2"/></g>` + face(32, 35)
			},
			{
				key: "goldfish",
				color: "#F4913B",
				svg: `<g ${S} fill="#F4913B"><path d="M40 34 L57 22 C53 33 53 39 57 50 L40 38 Z"/><path d="M20 25 C22 15 32 15 35 25 Z"/><ellipse cx="26" cy="37" rx="17" ry="13"/></g><circle cx="14" cy="20" r="2.5" fill="none" stroke="${INK}" stroke-width="2"/>` + face(24, 37, .85)
			},
			{
				key: "mouse",
				color: "#C9D2DE",
				svg: `<g ${S} fill="#C9D2DE"><circle cx="17" cy="17" r="9.5"/><circle cx="47" cy="17" r="9.5"/><path d="M46 51 C56 50 58 42 51 39" fill="none"/></g><circle cx="17" cy="17" r="4.5" fill="#F2A0BC"/><circle cx="47" cy="17" r="4.5" fill="#F2A0BC"/><circle cx="32" cy="38" r="17" fill="#C9D2DE" ${S}/>` + face(32, 38)
			},
			{
				key: "hedgehog",
				color: "#6E4B33",
				svg: `<path d="M13 54 L6 44 L15 41 L10 29 L20 31 L19 17 L28 24 L32 9 L37 23 L45 15 L45 28 L54 24 L51 36 L59 39 L51 46 L55 54 Z" fill="#6E4B33" ${S}/><ellipse cx="32" cy="44" rx="13" ry="9.5" fill="#ECCB9C" ${S}/>` + face(32, 44, .8)
			},
			{
				key: "duck",
				color: "#F7D14B",
				svg: `<g ${S} fill="#F7D14B"><path d="M50 41 L59 30 L57 46 Z"/><ellipse cx="33" cy="46" rx="22" ry="12"/><ellipse cx="40" cy="46" rx="8" ry="5.5" fill="#E8B04B"/><circle cx="22" cy="25" r="13"/><ellipse cx="10.5" cy="28" rx="5.5" ry="3.5" fill="#F4913B" stroke-width="2.5"/></g>` + face(23, 25, .8)
			},
			{
				key: "pig",
				color: "#F2A0BC",
				svg: `<g ${S} fill="#F2A0BC"><path d="M13 29 C6 15 19 5 26 14 Z"/><path d="M51 29 C58 15 45 5 38 14 Z"/><ellipse cx="32" cy="37" rx="23" ry="17"/></g><ellipse cx="32" cy="37.5" rx="4" ry="3" fill="#DE7BA4" stroke="${INK}" stroke-width="2"/><circle cx="30.5" cy="37.5" r="1" fill="${INK}"/><circle cx="33.5" cy="37.5" r="1" fill="${INK}"/>` + face(32, 38, 1.15)
			},
			{
				key: "fox",
				color: "#E3572B",
				svg: `<g ${S} fill="#E3572B"><path d="M13 27 L14 5 L29 12 Z"/><path d="M51 27 L50 5 L35 12 Z"/><path d="M32 58 L8 33 C7 17 18 12 32 17 C46 12 57 17 56 33 Z"/></g><path d="M32 57 L15 34 C25 42 39 42 49 34 Z" fill="#F6E7D3"/><circle cx="32" cy="40.5" r="2" fill="${INK}"/>` + face(32, 34, .95)
			},
			{
				key: "owl",
				color: "#2A9D8F",
				svg: `<g ${S} fill="#2A9D8F"><path d="M15 21 L10 6 L26 11 Z"/><path d="M49 21 L54 6 L38 11 Z"/><ellipse cx="32" cy="36" rx="20" ry="22"/><path d="M16 33 C12 41 13 50 19 54 C22 48 21 39 16 33 Z"/><path d="M48 33 C52 41 51 50 45 54 C42 48 43 39 48 33 Z"/><g fill="#F6E7D3"><circle cx="26.5" cy="34.5" r="5"/><circle cx="37.5" cy="34.5" r="5"/></g><path d="M29.5 33 L34.5 33 L32 37.5 Z" fill="#F4913B" stroke-width="2"/></g>` + face(32, 36)
			}
		]
	}
];
function themeForWorld(world) {
	return THEMES[world % THEMES.length];
}
//#endregion
//#region src/lib/engine/pars.js
var PARS = [
	5,
	5,
	6,
	8,
	9,
	9,
	12,
	10,
	12,
	12,
	13,
	15,
	12,
	13,
	13,
	15,
	16,
	15,
	16,
	14,
	18,
	16,
	18,
	18,
	20,
	18,
	20,
	21,
	19,
	13,
	17,
	18,
	19,
	18,
	18,
	19,
	18,
	19,
	19,
	16,
	16,
	21,
	19,
	17,
	18,
	19,
	17,
	18,
	17,
	18,
	21,
	20,
	23,
	22,
	20,
	22,
	23,
	22,
	22,
	21,
	19,
	16,
	21,
	22,
	23,
	22,
	20,
	22,
	22,
	23,
	20,
	20,
	23,
	21,
	21,
	20,
	21,
	21,
	22,
	20,
	23,
	24,
	24,
	25,
	24,
	21,
	25,
	25,
	22,
	22,
	25,
	21,
	25,
	23,
	26,
	24,
	25,
	24,
	25,
	24,
	22,
	24,
	21,
	27,
	27,
	26,
	25,
	27,
	23,
	24,
	26,
	28,
	27,
	26,
	27,
	28,
	29,
	30,
	27,
	26,
	27,
	28,
	27,
	27,
	25,
	40,
	27,
	28,
	28,
	27,
	28,
	27,
	37,
	28,
	31,
	27,
	28,
	31,
	26,
	36,
	31,
	32,
	30,
	32,
	31,
	32,
	40,
	32,
	32,
	29,
	30,
	31,
	29,
	41,
	30,
	31,
	31,
	31,
	30,
	31,
	41,
	32,
	30,
	33,
	28,
	31,
	32,
	44,
	32,
	32,
	35,
	34,
	36,
	33,
	39,
	34,
	36,
	37,
	36,
	35,
	33,
	43,
	35,
	38,
	37,
	35,
	34,
	34,
	44,
	36,
	34,
	31,
	34,
	31,
	35,
	43,
	34,
	32,
	37,
	35,
	31,
	36,
	50,
	31,
	31,
	38,
	31,
	32,
	37,
	42,
	37,
	32,
	35,
	36,
	39,
	31,
	42,
	38,
	31,
	32,
	35,
	32,
	32,
	52,
	31,
	38,
	38,
	32,
	34,
	36,
	37,
	35,
	38,
	32,
	36,
	37,
	28,
	42,
	38,
	31,
	36,
	39,
	30,
	36,
	50,
	32,
	35,
	40,
	30,
	33,
	40,
	40,
	37,
	40,
	32,
	38,
	41,
	30,
	43,
	39,
	30,
	33,
	38,
	29,
	33,
	49,
	33,
	37,
	37,
	31,
	36,
	37,
	41,
	34,
	38,
	28,
	34,
	38,
	30,
	46,
	36,
	33,
	33,
	36,
	29,
	34,
	45,
	32,
	37,
	33,
	32,
	33,
	41,
	43,
	33,
	35,
	31,
	35,
	37,
	31,
	45,
	36,
	29,
	34,
	37,
	32,
	33,
	52,
	33,
	29,
	40,
	34,
	34,
	38,
	40,
	36,
	37,
	32,
	34,
	37,
	31,
	43,
	35,
	30,
	35,
	36,
	28,
	36,
	50,
	29,
	32,
	40,
	32,
	36,
	40,
	41,
	36,
	37,
	31,
	35,
	36,
	31,
	47,
	38,
	29,
	34,
	36,
	32,
	33,
	45,
	31,
	35,
	39,
	32,
	31,
	40,
	42,
	36,
	41,
	30,
	34,
	36,
	34,
	44,
	38,
	30,
	36,
	38,
	30,
	35,
	47,
	30,
	35,
	39,
	32,
	37,
	35,
	41,
	36,
	39,
	33,
	36,
	38,
	32,
	44,
	37,
	27,
	29,
	40,
	31,
	33,
	49,
	28,
	34,
	36,
	31,
	38,
	40,
	42,
	36,
	39,
	29,
	32,
	37,
	32,
	46,
	33,
	28,
	34,
	40,
	34,
	35,
	48,
	30,
	34,
	36,
	30,
	33,
	39,
	43,
	35,
	39,
	32,
	33,
	39,
	30,
	44,
	41,
	34,
	35,
	37,
	31,
	37,
	53,
	28,
	35,
	41,
	29,
	33,
	42,
	40,
	36,
	39,
	32,
	37,
	40,
	32,
	42,
	40,
	34,
	35,
	39,
	31,
	37,
	53,
	29,
	34,
	37,
	28,
	31,
	40,
	40,
	34,
	38,
	31,
	29,
	37,
	33,
	42,
	39,
	29,
	35,
	39,
	30,
	37,
	49,
	31,
	35,
	40,
	34,
	33,
	38,
	39,
	35,
	41,
	32,
	35,
	41,
	31,
	48,
	37,
	31,
	37,
	38,
	32,
	35,
	51,
	27,
	33,
	38,
	31,
	35,
	39,
	39,
	34,
	36,
	30,
	36,
	38,
	32,
	47,
	37,
	31,
	33,
	39,
	32,
	34,
	50,
	28,
	33,
	38,
	31,
	34,
	36,
	36,
	33,
	36,
	32,
	35,
	38,
	30,
	45,
	39,
	32,
	34,
	37,
	31,
	37,
	49,
	34,
	36,
	38,
	33,
	35,
	37,
	39,
	35,
	40,
	31,
	35,
	39,
	30,
	48,
	38,
	30,
	36,
	42,
	31,
	36,
	50,
	30,
	35,
	37,
	30,
	36,
	39,
	41,
	37,
	39,
	31,
	36,
	36,
	28,
	45,
	40,
	30,
	31,
	38,
	30,
	34,
	50,
	29,
	33,
	40,
	30,
	37,
	38,
	43,
	34,
	39,
	31,
	33,
	37,
	28,
	43,
	37,
	31,
	37,
	35,
	33
];
//#endregion
//#region src/lib/engine/stars.js
var STAR_SLACK = {
	three: 2,
	two: 6
};
function parFor(board) {
	if (board.kind === "level") return PARS[board.n - 1] ?? null;
	const result = optimal(board.tubes, board.params.capacity);
	return result.aborted ? null : result.length;
}
function starsFor(moves, par, fallbackGoal) {
	const goal = par ?? fallbackGoal;
	if (goal == null) return 1;
	if (moves <= goal + STAR_SLACK.three) return 3;
	if (moves <= goal + STAR_SLACK.two) return 2;
	return 1;
}
//#endregion
//#region src/lib/engine/skins.js
var SKINS = [
	{
		key: "tubes",
		title: "Tubes",
		motion: {
			rotate: 0,
			ease: "cubic-bezier(.3,1.2,.5,1)",
			seconds: .22
		},
		preview: "<rect x=\"22\" y=\"10\" width=\"20\" height=\"46\" rx=\"6\" fill=\"#fff\" stroke=\"#3D3230\" stroke-width=\"3\"/><circle cx=\"32\" cy=\"47\" r=\"6\" fill=\"#E5484D\"/><circle cx=\"32\" cy=\"34\" r=\"6\" fill=\"#4FA3D1\"/>"
	},
	{
		key: "bolts",
		title: "Nuts & Bolts",
		motion: {
			rotate: -720,
			ease: "cubic-bezier(.2,.9,.35,1.05)",
			seconds: .34
		},
		preview: "<rect x=\"29\" y=\"8\" width=\"6\" height=\"48\" fill=\"#B9AFA6\" stroke=\"#3D3230\" stroke-width=\"2.4\"/><path d=\"M22 44 L27 40 L37 40 L42 44 L42 52 L37 56 L27 56 L22 52 Z\" fill=\"#D8CFC6\" stroke=\"#3D3230\" stroke-width=\"2.6\"/><path d=\"M22 26 L27 22 L37 22 L42 26 L42 34 L37 38 L27 38 L22 34 Z\" fill=\"#D8CFC6\" stroke=\"#3D3230\" stroke-width=\"2.6\"/>"
	},
	{
		key: "beads",
		title: "Beads & Sticks",
		motion: {
			rotate: 0,
			ease: "cubic-bezier(.25,1.35,.45,1)",
			seconds: .26
		},
		preview: "<rect x=\"30\" y=\"6\" width=\"4\" height=\"50\" rx=\"2\" fill=\"#A98F71\" stroke=\"#3D3230\" stroke-width=\"2\"/><circle cx=\"32\" cy=\"47\" r=\"8\" fill=\"#79B84C\" stroke=\"#3D3230\" stroke-width=\"2.6\"/><circle cx=\"32\" cy=\"30\" r=\"8\" fill=\"#F0C33C\" stroke=\"#3D3230\" stroke-width=\"2.6\"/>"
	},
	{
		key: "blocks",
		title: "Block Stacks",
		motion: {
			rotate: 180,
			ease: "cubic-bezier(.34,1.45,.6,1)",
			seconds: .3
		},
		preview: "<rect x=\"20\" y=\"38\" width=\"24\" height=\"18\" fill=\"#79B84C\" stroke=\"#3D3230\" stroke-width=\"3\"/><rect x=\"20\" y=\"18\" width=\"24\" height=\"18\" fill=\"#B98A5A\" stroke=\"#3D3230\" stroke-width=\"3\"/>"
	},
	{
		key: "voxel",
		title: "Voxel Mine",
		motion: {
			rotate: 180,
			ease: "cubic-bezier(.3,1.3,.55,1)",
			seconds: .28
		},
		preview: "<rect x=\"18\" y=\"36\" width=\"28\" height=\"22\" fill=\"#8A6142\" stroke=\"#3D3230\" stroke-width=\"3\"/><rect x=\"18\" y=\"14\" width=\"28\" height=\"22\" fill=\"#8A6142\" stroke=\"#3D3230\" stroke-width=\"3\"/><rect x=\"18\" y=\"14\" width=\"28\" height=\"7\" fill=\"#6FA644\" stroke=\"#3D3230\" stroke-width=\"3\"/>"
	},
	{
		key: "dash",
		title: "Neon Dash",
		motion: {
			rotate: -360,
			ease: "cubic-bezier(.5,0,.2,1)",
			seconds: .26
		},
		preview: "<rect x=\"6\" y=\"6\" width=\"52\" height=\"52\" rx=\"6\" fill=\"#141A2E\"/><rect x=\"20\" y=\"34\" width=\"20\" height=\"20\" rx=\"3\" fill=\"#1B2340\" stroke=\"#3EF0D0\" stroke-width=\"3\"/><rect x=\"20\" y=\"11\" width=\"20\" height=\"20\" rx=\"3\" fill=\"#1B2340\" stroke=\"#FF4FD8\" stroke-width=\"3\"/>"
	},
	{
		key: "kawaii",
		title: "Kawaii Pop",
		motion: {
			rotate: 24,
			ease: "cubic-bezier(.3,1.75,.5,1)",
			seconds: .32
		},
		preview: "<rect x=\"18\" y=\"8\" width=\"28\" height=\"48\" rx=\"14\" fill=\"#FFE3EE\" stroke=\"#3D3230\" stroke-width=\"3\"/><circle cx=\"32\" cy=\"44\" r=\"9\" fill=\"#FFB7D2\" stroke=\"#3D3230\" stroke-width=\"2.6\"/><circle cx=\"32\" cy=\"23\" r=\"9\" fill=\"#BFE8FF\" stroke=\"#3D3230\" stroke-width=\"2.6\"/>"
	}
];
var KEY$1 = "sortit:skin";
function loadSkin() {
	try {
		const saved = localStorage.getItem(KEY$1);
		return SKINS.find((skin) => skin.key === saved) ?? SKINS[0];
	} catch {
		return SKINS[0];
	}
}
function saveSkin(skin) {
	try {
		localStorage.setItem(KEY$1, skin.key);
	} catch {}
}
//#endregion
//#region src/lib/ui/sounds.js
var KEY = "sortit:muted";
var ctx = null;
var muted = false;
try {
	muted = localStorage.getItem(KEY) === "1";
} catch {}
function ac() {
	if (typeof AudioContext === "undefined") return null;
	if (!ctx || ctx.state === "closed") ctx = new AudioContext();
	if (ctx.state !== "running") ctx.resume().catch(() => {});
	return ctx;
}
document.addEventListener("visibilitychange", () => {
	if (!document.hidden && ctx) ac();
});
addEventListener("pointerdown", () => {
	if (ctx) ac();
}, {
	passive: true,
	capture: true
});
function tone({ freq, glide = freq, type = "sine", at = 0, len = .12, vol = .16 }) {
	const audio = ac();
	if (!audio || muted) return;
	const t0 = audio.currentTime + at;
	const osc = audio.createOscillator();
	const gain = audio.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t0);
	osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), t0 + len);
	gain.gain.setValueAtTime(0, t0);
	gain.gain.linearRampToValueAtTime(vol, t0 + .012);
	gain.gain.exponentialRampToValueAtTime(1e-4, t0 + len);
	osc.connect(gain).connect(audio.destination);
	osc.start(t0);
	osc.stop(t0 + len + .05);
}
var sound = {
	pick() {
		tone({
			freq: 420,
			glide: 660,
			type: "triangle",
			len: .09,
			vol: .12
		});
	},
	drop() {
		tone({
			freq: 340,
			glide: 150,
			type: "sine",
			len: .14
		});
	},
	no() {
		tone({
			freq: 140,
			glide: 110,
			type: "square",
			len: .12,
			vol: .06
		});
	},
	reveal() {
		tone({
			freq: 700,
			glide: 900,
			type: "triangle",
			len: .08,
			vol: .09
		});
		tone({
			freq: 1050,
			glide: 1250,
			type: "triangle",
			at: .07,
			len: .1,
			vol: .09
		});
	},
	tube() {
		tone({
			freq: 523,
			type: "triangle",
			len: .1
		});
		tone({
			freq: 784,
			type: "triangle",
			at: .09,
			len: .16
		});
	},
	win() {
		[
			523,
			659,
			784,
			1047
		].forEach((freq, i) => tone({
			freq,
			type: "triangle",
			at: i * .12,
			len: .22,
			vol: .18
		}));
		tone({
			freq: 1319,
			type: "triangle",
			at: .48,
			len: .4,
			vol: .16
		});
	},
	get muted() {
		return muted;
	},
	toggle() {
		muted = !muted;
		try {
			localStorage.setItem(KEY, muted ? "1" : "0");
		} catch {}
		return muted;
	}
};
//#endregion
//#region src/lib/ui/confetti.js
function confetti(colors) {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const W = innerWidth;
	const H = innerHeight;
	const dpr = Math.min(devicePixelRatio || 1, 2);
	const canvas = document.createElement("canvas");
	canvas.className = "confetti";
	canvas.width = W * dpr;
	canvas.height = H * dpr;
	canvas.style.width = `${W}px`;
	canvas.style.height = `${H}px`;
	document.body.append(canvas);
	const g = canvas.getContext("2d");
	g.scale(dpr, dpr);
	const pieces = Array.from({ length: 130 }, () => ({
		x: Math.random() * W,
		y: -20 - Math.random() * H * .3,
		w: 6 + Math.random() * 6,
		h: 8 + Math.random() * 8,
		vy: 190 + Math.random() * 170,
		vx: -40 + Math.random() * 80,
		rot: Math.random() * Math.PI,
		vr: -4 + Math.random() * 8,
		color: colors[Math.floor(Math.random() * colors.length)]
	}));
	let last = performance.now();
	const done = last + 2600;
	function frame(now) {
		const dt = Math.min((now - last) / 1e3, .05);
		last = now;
		g.clearRect(0, 0, W, H);
		for (const p of pieces) {
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.vr * dt;
			g.save();
			g.translate(p.x, p.y);
			g.rotate(p.rot);
			g.fillStyle = p.color;
			g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
			g.restore();
		}
		if (now < done) requestAnimationFrame(frame);
		else canvas.remove();
	}
	requestAnimationFrame(frame);
}
//#endregion
//#region src/lib/ui/store.svelte.js
var HINT_BUDGET = { maxNodes: 6e4 };
var PROGRESS_KEY = "sortit:progress";
function loadProgress() {
	try {
		const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? "{}");
		const current = Number.isInteger(raw?.current) ? Math.min(Math.max(raw.current, 1), 600) : 1;
		const done = {};
		if (raw?.done && typeof raw.done === "object" && !Array.isArray(raw.done)) for (const [k, v] of Object.entries(raw.done)) {
			const n = Number(k);
			if (Number.isInteger(n) && n >= 1 && n <= 600 && Number.isFinite(v)) done[n] = v;
		}
		const stars = {};
		if (raw?.stars && typeof raw.stars === "object" && !Array.isArray(raw.stars)) for (const [k, v] of Object.entries(raw.stars)) {
			const n = Number(k);
			if (Number.isInteger(n) && n >= 1 && n <= 600 && Number.isInteger(v)) stars[n] = Math.min(Math.max(v, 1), 3);
		}
		for (const [k, best] of Object.entries(done)) {
			const n = Number(k);
			if (stars[n] == null) stars[n] = starsFor(best, PARS_AT(n), null);
		}
		return {
			current,
			done,
			stars
		};
	} catch {
		return {
			current: 1,
			done: {},
			stars: {}
		};
	}
}
function PARS_AT(n) {
	return PARS[n - 1] ?? null;
}
function saveProgress(p) {
	try {
		localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
	} catch {}
}
function createStore() {
	let screen = "menu";
	let board = null;
	let theme = null;
	let skin = loadSkin();
	let progress = loadProgress();
	let world = 0;
	let tubes = [];
	let capacity = 4;
	let selected = null;
	let moves = 0;
	let over = false;
	let stuck = false;
	let won = null;
	let clockText = "0:00";
	let history = [];
	let seen = /* @__PURE__ */ new Set();
	let uidNext = 0;
	let clockStart = null;
	let clockStopped = null;
	let dialog = null;
	const colorsOf = (t) => t.map((i) => i.c);
	const numeric = () => tubes.map(colorsOf);
	function tick() {
		if (clockStart == null || clockStopped != null || screen !== "game") return;
		const s = Math.floor((Date.now() - clockStart) / 1e3);
		clockText = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
	}
	if (typeof window !== "undefined") setInterval(tick, 500);
	function revealTops(changed) {
		let revealed = false;
		for (const t of tubes) {
			const top = t[t.length - 1];
			if (top && top.hid) {
				top.hid = false;
				revealed = true;
			}
			if (t.length && isComplete(colorsOf(t), capacity)) {
				for (const it of t) if (it.hid) {
					it.hid = false;
					revealed = true;
				}
			}
		}
		for (const t of tubes) for (const it of t) if (!it.hid) seen.add(it.uid);
		if (revealed && changed) sound.reveal();
	}
	function visibleRun(index) {
		const tube = tubes[index];
		const top = tube[tube.length - 1];
		let n = 0;
		for (let i = tube.length - 1; i >= 0; i--) {
			if (tube[i].hid || tube[i].c !== top.c) break;
			n++;
		}
		return Math.max(1, n);
	}
	function playerMove(from, to) {
		const src = tubes[from], dst = tubes[to];
		if (!src.length || from === to) return null;
		const space = capacity - dst.length;
		if (space === 0) return null;
		if (dst.length && dst[dst.length - 1].c !== src[src.length - 1].c) return null;
		return {
			from,
			to,
			count: Math.min(visibleRun(from), space)
		};
	}
	function anyPlayerMove() {
		for (let from = 0; from < tubes.length; from++) {
			if (!tubes[from].length || isComplete(colorsOf(tubes[from]), capacity)) continue;
			for (let to = 0; to < tubes.length; to++) if (from !== to && playerMove(from, to)) return true;
		}
		return false;
	}
	function finishWin() {
		over = true;
		clockStopped = Date.now();
		tick();
		const stars = starsFor(moves, board.par, board.solution.length);
		let detail = `sorted in ${moves} moves, ${clockText}!`;
		let canNext = false;
		if (board.kind === "level") {
			const best = progress.done[board.n];
			if (best == null || moves < best) {
				progress.done = {
					...progress.done,
					[board.n]: moves
				};
				if (best != null) detail = `sorted in ${moves} moves, ${clockText}, your best yet!`;
			} else detail = `sorted in ${moves} moves, ${clockText}. your best is ${best}.`;
			if (stars > (progress.stars[board.n] ?? 0)) progress.stars = {
				...progress.stars,
				[board.n]: stars
			};
			if (board.n === progress.current && progress.current < 600) progress.current += 1;
			saveProgress(snapshot(progress));
			canNext = board.n < 600;
		}
		const score = board.par != null ? moves <= board.par ? `PERFECT! ${board.par} is the best possible.` : `3 stars at ${board.par + STAR_SLACK.three} or fewer. best possible: ${board.par}.` : "";
		won = {
			stars,
			detail,
			score,
			perfect: board.par != null && moves <= board.par,
			canNext
		};
		sound.win();
		confetti(theme.items.map((i) => i.color));
	}
	function tap(index) {
		if (over) return;
		const tube = tubes[index];
		if (selected === null) {
			if (!tube.length || isComplete(colorsOf(tube), capacity)) return;
			selected = index;
			sound.pick();
			return;
		}
		if (selected === index) {
			selected = null;
			return;
		}
		const move = playerMove(selected, index);
		if (!move) {
			if (tube.length && !isComplete(colorsOf(tube), capacity)) {
				selected = index;
				sound.pick();
			} else sound.no();
			return;
		}
		history.push({
			tubes: tubes.map((t) => t.map((i) => ({ ...i }))),
			moves
		});
		const next = tubes.map((t) => t.slice());
		next[move.to] = next[move.to].concat(next[move.from].splice(next[move.from].length - move.count, move.count));
		tubes = next;
		selected = null;
		moves += 1;
		revealTops(true);
		sound.drop();
		if (isComplete(colorsOf(tubes[move.to]), capacity) && !isWin(numeric(), capacity)) sound.tube();
		if (isWin(numeric(), capacity)) {
			finishWin();
			return;
		}
		stuck = !anyPlayerMove();
	}
	function themeForBoard(b) {
		if (b.kind === "level") return themeForWorld(Math.floor((b.n - 1) / 20));
		return THEMES[b.seed % THEMES.length];
	}
	function play(b) {
		board = b;
		board.par = null;
		theme = themeForBoard(b);
		capacity = b.params.capacity;
		uidNext = 0;
		tubes = b.tubes.map((t) => t.map((c, slot) => ({
			uid: uidNext++,
			c,
			hid: b.params.hidden && slot < t.length - 1
		})));
		history = [];
		selected = null;
		moves = 0;
		over = false;
		stuck = false;
		won = null;
		seen = /* @__PURE__ */ new Set();
		clockStart = Date.now();
		clockStopped = null;
		clockText = "0:00";
		revealTops(false);
		screen = "game";
		setTimeout(() => {
			if (board === b) board.par = parFor(b);
		}, 0);
	}
	return {
		get screen() {
			return screen;
		},
		get board() {
			return board;
		},
		get theme() {
			return theme;
		},
		get skin() {
			return skin;
		},
		get progress() {
			return progress;
		},
		get world() {
			return world;
		},
		get tubes() {
			return tubes;
		},
		get capacity() {
			return capacity;
		},
		get selected() {
			return selected;
		},
		get moves() {
			return moves;
		},
		get stuck() {
			return stuck;
		},
		get won() {
			return won;
		},
		get clock() {
			return clockText;
		},
		get dialog() {
			return dialog;
		},
		get skins() {
			return SKINS;
		},
		get boardLabel() {
			if (!board) return "";
			if (board.kind === "level") return `level ${board.n}`;
			return board.seed === dailySeed() ? "today's puzzle" : `puzzle ${board.seed}`;
		},
		tap,
		visibleRun,
		isTubeDone: (t) => isComplete(colorsOf(t), capacity) && !t.some((i) => i.hid),
		goMenu() {
			screen = "menu";
		},
		openLevels() {
			world = Math.floor((progress.current - 1) / 20);
			screen = "levels";
		},
		setWorld(w) {
			world = Math.max(0, Math.min(29, w));
		},
		startLevel(n) {
			play(levelBoard(n));
		},
		startDaily() {
			play(seedBoard(dailySeed()));
		},
		startSeed(seed) {
			play(seedBoard(seed));
		},
		replay() {
			board.kind === "level" ? play(levelBoard(board.n)) : play(seedBoard(board.seed));
		},
		nextLevel() {
			play(levelBoard(Math.min(board.n + 1, 600)));
		},
		undo() {
			const last = history.pop();
			if (!last) return;
			for (const t of last.tubes) for (const it of t) if (seen.has(it.uid)) it.hid = false;
			tubes = last.tubes;
			selected = null;
			over = false;
			moves = last.moves;
			won = null;
			stuck = false;
		},
		hint() {
			if (over) return true;
			const r = solve(numeric(), capacity, HINT_BUDGET);
			if (!r.solved || !r.moves.length) return false;
			return r.moves[0];
		},
		setSkin(next) {
			skin = next;
			saveSkin(next);
		},
		openDialog(d) {
			dialog = d;
		},
		closeDialog() {
			dialog = null;
		},
		mergeExternalProgress() {
			const incoming = loadProgress();
			incoming.current = Math.max(incoming.current, progress.current);
			for (const [n, best] of Object.entries(progress.done)) if (incoming.done[n] == null || best < incoming.done[n]) incoming.done[n] = best;
			for (const [n, earned] of Object.entries(progress.stars)) if ((incoming.stars[n] ?? 0) < earned) incoming.stars[n] = earned;
			progress = incoming;
			saveProgress(incoming);
		}
	};
}
//#endregion
//#region src/lib/ui/Board.svelte
function Board($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		let { store } = $$props;
		let side = 44;
		let tubeH = 200;
		let rowCount = 1;
		const rows = derived(() => {
			const count = store.tubes.length;
			const base = Math.floor(count / rowCount);
			const extra = count % rowCount;
			const out = Array.from({ length: rowCount }, () => []);
			let t = 0;
			for (let r = 0; r < rowCount; r++) {
				const size = base + (r < extra ? 1 : 0);
				for (let i = 0; i < size; i++) out[r].push(t++);
			}
			return out;
		});
		const HID_ART = "<circle cx=\"32\" cy=\"32\" r=\"22\" fill=\"#C9BCB2\" stroke=\"#3D3230\" stroke-width=\"3\"/><path d=\"M26 28 Q26 21 32 21 Q38 21 38 27 Q38 32 32 33 L32 36\" stroke=\"#3D3230\" stroke-width=\"3.6\" fill=\"none\" stroke-linecap=\"round\"/><circle cx=\"32\" cy=\"43\" r=\"2.4\" fill=\"#3D3230\"/>";
		const artFor = (item) => item.hid ? HID_ART : store.theme.items[item.c].svg;
		const isLifted = (index, item) => {
			if (store.selected !== index) return false;
			const tube = store.tubes[index];
			const run = store.visibleRun(index);
			return tube.indexOf(item) >= tube.length - run;
		};
		(store.skin.motion?.seconds ?? .22) * 1e3;
		$$renderer.push(`<div id="board"${attr("data-skin", store.skin.key)} aria-label="sorting board"${attr_style("", {
			"--side": `${stringify(side)}px`,
			"--tube-h": `${stringify(tubeH)}px`,
			background: store.theme?.tint
		})}><!--[-->`);
		const each_array = ensure_array_like(rows());
		for (let $$index_2 = 0, $$length = each_array.length; $$index_2 < $$length; $$index_2++) {
			let row = each_array[$$index_2];
			$$renderer.push(`<div class="row"><!--[-->`);
			const each_array_1 = ensure_array_like(row);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let index = each_array_1[$$index_1];
				$$renderer.push(`<button${attr_class("tube", void 0, {
					"sel": store.selected === index,
					"done": store.isTubeDone(store.tubes[index])
				})}${attr("aria-label", `tube ${stringify(index + 1)}`)}><!--[-->`);
				const each_array_2 = ensure_array_like(store.tubes[index]);
				for (let $$index = 0, $$length = each_array_2.length; $$index < $$length; $$index++) {
					let item = each_array_2[$$index];
					$$renderer.push(`<span${attr_class("item", void 0, {
						"hid": item.hid,
						"lift": isLifted(index, item)
					})}><svg viewBox="0 0 64 64" aria-hidden="true">${html(artFor(item))}</svg></span>`);
				}
				$$renderer.push(`<!--]--></button>`);
			}
			$$renderer.push(`<!--]--></div>`);
		}
		$$renderer.push(`<!--]--></div>`);
	});
}
//#endregion
//#region src/routes/+page.svelte
function _page($$renderer, $$props) {
	$$renderer.component(($$renderer) => {
		const store = createStore();
		const version = "0.1.2";
		let muted = sound.muted;
		let friendLabel = "PLAY WITH A FRIEND";
		let winShareLabel = "SEND THIS PUZZLE TO A FRIEND";
		const worldTheme = derived(() => themeForWorld(store.world));
		const worldStart = derived(() => store.world * 20);
		if (store.screen === "menu") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<main class="screen" id="menu"><h1>Sort It</h1> <p class="tagline">sort everything into tidy tubes</p> <button class="big">PLAY</button> <button class="big secondary">TODAY'S PUZZLE</button> <button class="big secondary">PICK A LEVEL</button> <button class="big secondary">${escape_html(friendLabel)}</button> <button class="big secondary">HOW TO PLAY</button> <button class="big secondary">LOOKS</button> <button${attr_class("big secondary", void 0, { "muted": muted })}>♪ SOUND</button> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <button class="big secondary">ABOUT</button> <p class="ethos">no ads · no timers · nothing to buy · no cookies</p> <p class="version">v${escape_html(version)}</p></main>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (store.screen === "levels") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<main class="screen" id="levels"><header class="bar"><button class="chip" aria-label="back to menu">←</button> <span class="chip flat">world ${escape_html(store.world + 1)} · ${escape_html(worldTheme().title)}</span></header> <div class="world-nav"><button class="chip"${attr("disabled", store.world === 0, true)}>« PREV</button> <span class="chip flat">${escape_html(store.world + 1)} / ${escape_html(30)}</span> <button class="chip"${attr("disabled", store.world === 29, true)}>NEXT »</button></div> <div id="world-grid" aria-label="levels in this world"><!--[-->`);
			const each_array = ensure_array_like(Array(20));
			for (let i = 0, $$length = each_array.length; i < $$length; i++) {
				each_array[i];
				const n = worldStart() + i + 1;
				const best = store.progress.done[n];
				const earned = store.progress.stars[n];
				$$renderer.push(`<button${attr_class("lvl", void 0, {
					"done": best != null,
					"now": n === store.progress.current
				})}${attr("disabled", n > store.progress.current && best == null, true)}${attr("aria-label", best != null ? `level ${n}, best ${best} moves, ${earned ?? 1} of 3 stars` : `level ${n}`)}><span>${escape_html(n)}</span> `);
				if (best != null) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<span class="sub">${escape_html(earned ? "★".repeat(earned) : `✓ ${best}`)}</span>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--></button>`);
			}
			$$renderer.push(`<!--]--></div> <p class="small center">${escape_html(Object.keys(store.progress.done).length ? `you've sorted ${Object.keys(store.progress.done).length} of 600 levels` : "sort a level to leave your mark!")}</p></main>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (store.screen === "game") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<main class="screen" id="game"><header class="bar"><span class="chip flat" id="board-label">${escape_html(store.boardLabel)}</span> <span class="chip flat mono" aria-label="time elapsed">${escape_html(store.clock)}</span> <span class="chip flat mono" aria-live="polite">${escape_html(store.moves)} ${escape_html(store.moves === 1 ? "move" : "moves")}</span></header> `);
			Board($$renderer, { store });
			$$renderer.push(`<!----> <nav id="game-nav" aria-label="Game controls"><button aria-label="Back to menu"><span aria-hidden="true">☰</span><b>MENU</b></button> <button><span aria-hidden="true">✨</span><b>HINT</b></button> <button><span aria-hidden="true">↶</span><b>UNDO</b></button> <button><span aria-hidden="true">↻</span><b>RESET</b></button></nav> `);
			if (store.stuck && !store.won) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="stuck"><p>no moves left!</p> <button class="chip">UNDO</button> <button class="chip">START OVER</button></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> `);
			if (store.won) {
				$$renderer.push("<!--[0-->");
				$$renderer.push(`<div class="won" role="status"><p class="won-title">SORTED!</p> <p${attr_class("won-stars", void 0, { "perfect": store.won.perfect })}${attr("aria-label", `${stringify(store.won.stars)} of 3 stars earned`)}>${escape_html("★".repeat(store.won.stars))}${escape_html("☆".repeat(3 - store.won.stars))}</p> <p class="won-detail">${escape_html(store.won.detail)}</p> `);
				if (store.won.score) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<p class="won-score">${escape_html(store.won.score)}</p>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> `);
				if (store.won.canNext) {
					$$renderer.push("<!--[0-->");
					$$renderer.push(`<button class="big">NEXT LEVEL</button>`);
				} else $$renderer.push("<!--[-1-->");
				$$renderer.push(`<!--]--> <button class="big secondary">PLAY AGAIN</button> <button class="big secondary">${escape_html(winShareLabel)}</button></div>`);
			} else $$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--></main>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (store.dialog === "howto") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<dialog open=""><h2>How to play</h2> <ol><li>Tap a tube to pick up what's on top.</li> <li>Tap another tube to drop it there.</li> <li>Drops only land on a <b>matching</b> friend, or in an empty tube.</li> <li>Fill a whole tube with one kind to finish it.</li> <li>Sort every tube to win!</li></ol> <p class="small">Stuck? <b>UNDO</b> takes moves back as many times as you like, and <b>HINT</b> shows a good move. Some pieces hide as a <b>?</b>, move the piece on top to peek! Take as long as you want.</p> <button class="big">GOT IT</button></dialog>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (store.dialog === "looks") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<dialog open=""><h2>Pick a look</h2> <div class="looks-grid"><!--[-->`);
			const each_array_1 = ensure_array_like(store.skins);
			for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
				let candidate = each_array_1[$$index_1];
				$$renderer.push(`<button class="look"${attr("aria-pressed", candidate.key === store.skin.key)}><svg viewBox="0 0 64 64" aria-hidden="true">${html(candidate.preview)}</svg> <span>${escape_html(candidate.title)}</span></button>`);
			}
			$$renderer.push(`<!--]--></div> <p class="small">Same puzzles, different costume. Changing it never touches your game.</p> <button class="big">DONE</button></dialog>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (store.dialog === "about") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<dialog open=""><h2>About Sort It</h2> <p class="about-body">tap a tube to pick up a piece, tap another to drop it, and sort every colour into its own tube. a fresh puzzle every day, hundreds of levels, and one to send a friend.</p> <p class="about-ethos">no ads, no lives, no timers, nothing to buy, no accounts, no cookies, nothing sold or shared. that is the whole point.</p> <p class="maker-mark">made with <svg aria-hidden="true" class="mark-heart" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg><span class="sr">love</span> by <a href="https://royashbrook.com" target="_blank" rel="noreferrer">roy</a> + <a href="https://royashbrook.com/agents" target="_blank" rel="noreferrer">ai</a> <span aria-hidden="true" class="mark-dot">·</span> <a href="https://github.com/sponsors/royashbrook" target="_blank" rel="noreferrer" class="mark-sponsor">sponsor me</a></p> <button class="big secondary check-updates">`);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`check for updates`);
			$$renderer.push(`<!--]--></button> `);
			$$renderer.push("<!--[-1-->");
			$$renderer.push(`<!--]--> <button class="big">BACK</button></dialog>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]--> `);
		if (store.dialog === "ios-install") {
			$$renderer.push("<!--[0-->");
			$$renderer.push(`<dialog open=""><h2>Add to home screen</h2> <ol><li>Tap the <b>share</b> button at the bottom of Safari.</li> <li>Scroll down and tap <b>Add to Home Screen</b>.</li> <li>Tap <b>Add</b>. It opens like a real app, and works with no internet.</li></ol> <button class="big">GOT IT</button></dialog>`);
		} else $$renderer.push("<!--[-1-->");
		$$renderer.push(`<!--]-->`);
	});
}
//#endregion
export { _page as default };

//# sourceMappingURL=_page.svelte.js.map