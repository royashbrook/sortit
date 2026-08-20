export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["icon-180.png","icon-192.png","icon-512.png","icon-maskable-512.png","icon.svg","manifest.json","service-worker.js"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml",".json":"application/json"},
	_: {
		client: {start:"_app/immutable/entry/start.CCH8fjfJ.js",app:"_app/immutable/entry/app.DXjLOZ_l.js",imports:["_app/immutable/entry/start.CCH8fjfJ.js","_app/immutable/chunks/DxDv-t_A.js","_app/immutable/chunks/IEK7nVcj.js","_app/immutable/entry/app.DXjLOZ_l.js","_app/immutable/chunks/IEK7nVcj.js","_app/immutable/chunks/xihTtKlq.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js'))
		],
		remotes: {
			
		},
		routes: [
			
		],
		prerendered_routes: new Set(["/"]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
