/******/ (function(modules) { // webpackBootstrap
/******/ 	function hotDisposeChunk(chunkId) {
/******/ 		delete installedChunks[chunkId];
/******/ 	}
/******/ 	var parentHotUpdateCallback = window["webpackHotUpdate"];
/******/ 	window["webpackHotUpdate"] = // eslint-disable-next-line no-unused-vars
/******/ 	function webpackHotUpdateCallback(chunkId, moreModules) {
/******/ 		hotAddUpdateChunk(chunkId, moreModules);
/******/ 		if (parentHotUpdateCallback) parentHotUpdateCallback(chunkId, moreModules);
/******/ 	} ;
/******/
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	function hotDownloadUpdateChunk(chunkId) {
/******/ 		var script = document.createElement("script");
/******/ 		script.charset = "utf-8";
/******/ 		script.src = __webpack_require__.p + "" + chunkId + "." + hotCurrentHash + ".hot-update.js";
/******/ 		if (null) script.crossOrigin = null;
/******/ 		document.head.appendChild(script);
/******/ 	}
/******/
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	function hotDownloadManifest(requestTimeout) {
/******/ 		requestTimeout = requestTimeout || 10000;
/******/ 		return new Promise(function(resolve, reject) {
/******/ 			if (typeof XMLHttpRequest === "undefined") {
/******/ 				return reject(new Error("No browser support"));
/******/ 			}
/******/ 			try {
/******/ 				var request = new XMLHttpRequest();
/******/ 				var requestPath = __webpack_require__.p + "" + hotCurrentHash + ".hot-update.json";
/******/ 				request.open("GET", requestPath, true);
/******/ 				request.timeout = requestTimeout;
/******/ 				request.send(null);
/******/ 			} catch (err) {
/******/ 				return reject(err);
/******/ 			}
/******/ 			request.onreadystatechange = function() {
/******/ 				if (request.readyState !== 4) return;
/******/ 				if (request.status === 0) {
/******/ 					// timeout
/******/ 					reject(
/******/ 						new Error("Manifest request to " + requestPath + " timed out.")
/******/ 					);
/******/ 				} else if (request.status === 404) {
/******/ 					// no update available
/******/ 					resolve();
/******/ 				} else if (request.status !== 200 && request.status !== 304) {
/******/ 					// other failure
/******/ 					reject(new Error("Manifest request to " + requestPath + " failed."));
/******/ 				} else {
/******/ 					// success
/******/ 					try {
/******/ 						var update = JSON.parse(request.responseText);
/******/ 					} catch (e) {
/******/ 						reject(e);
/******/ 						return;
/******/ 					}
/******/ 					resolve(update);
/******/ 				}
/******/ 			};
/******/ 		});
/******/ 	}
/******/
/******/ 	var hotApplyOnUpdate = true;
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	var hotCurrentHash = "e34538ad4c6b3609fb00";
/******/ 	var hotRequestTimeout = 10000;
/******/ 	var hotCurrentModuleData = {};
/******/ 	var hotCurrentChildModule;
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	var hotCurrentParents = [];
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	var hotCurrentParentsTemp = [];
/******/
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	function hotCreateRequire(moduleId) {
/******/ 		var me = installedModules[moduleId];
/******/ 		if (!me) return __webpack_require__;
/******/ 		var fn = function(request) {
/******/ 			if (me.hot.active) {
/******/ 				if (installedModules[request]) {
/******/ 					if (installedModules[request].parents.indexOf(moduleId) === -1) {
/******/ 						installedModules[request].parents.push(moduleId);
/******/ 					}
/******/ 				} else {
/******/ 					hotCurrentParents = [moduleId];
/******/ 					hotCurrentChildModule = request;
/******/ 				}
/******/ 				if (me.children.indexOf(request) === -1) {
/******/ 					me.children.push(request);
/******/ 				}
/******/ 			} else {
/******/ 				console.warn(
/******/ 					"[HMR] unexpected require(" +
/******/ 						request +
/******/ 						") from disposed module " +
/******/ 						moduleId
/******/ 				);
/******/ 				hotCurrentParents = [];
/******/ 			}
/******/ 			return __webpack_require__(request);
/******/ 		};
/******/ 		var ObjectFactory = function ObjectFactory(name) {
/******/ 			return {
/******/ 				configurable: true,
/******/ 				enumerable: true,
/******/ 				get: function() {
/******/ 					return __webpack_require__[name];
/******/ 				},
/******/ 				set: function(value) {
/******/ 					__webpack_require__[name] = value;
/******/ 				}
/******/ 			};
/******/ 		};
/******/ 		for (var name in __webpack_require__) {
/******/ 			if (
/******/ 				Object.prototype.hasOwnProperty.call(__webpack_require__, name) &&
/******/ 				name !== "e" &&
/******/ 				name !== "t"
/******/ 			) {
/******/ 				Object.defineProperty(fn, name, ObjectFactory(name));
/******/ 			}
/******/ 		}
/******/ 		fn.e = function(chunkId) {
/******/ 			if (hotStatus === "ready") hotSetStatus("prepare");
/******/ 			hotChunksLoading++;
/******/ 			return __webpack_require__.e(chunkId).then(finishChunkLoading, function(err) {
/******/ 				finishChunkLoading();
/******/ 				throw err;
/******/ 			});
/******/
/******/ 			function finishChunkLoading() {
/******/ 				hotChunksLoading--;
/******/ 				if (hotStatus === "prepare") {
/******/ 					if (!hotWaitingFilesMap[chunkId]) {
/******/ 						hotEnsureUpdateChunk(chunkId);
/******/ 					}
/******/ 					if (hotChunksLoading === 0 && hotWaitingFiles === 0) {
/******/ 						hotUpdateDownloaded();
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 		fn.t = function(value, mode) {
/******/ 			if (mode & 1) value = fn(value);
/******/ 			return __webpack_require__.t(value, mode & ~1);
/******/ 		};
/******/ 		return fn;
/******/ 	}
/******/
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	function hotCreateModule(moduleId) {
/******/ 		var hot = {
/******/ 			// private stuff
/******/ 			_acceptedDependencies: {},
/******/ 			_declinedDependencies: {},
/******/ 			_selfAccepted: false,
/******/ 			_selfDeclined: false,
/******/ 			_selfInvalidated: false,
/******/ 			_disposeHandlers: [],
/******/ 			_main: hotCurrentChildModule !== moduleId,
/******/
/******/ 			// Module API
/******/ 			active: true,
/******/ 			accept: function(dep, callback) {
/******/ 				if (dep === undefined) hot._selfAccepted = true;
/******/ 				else if (typeof dep === "function") hot._selfAccepted = dep;
/******/ 				else if (typeof dep === "object")
/******/ 					for (var i = 0; i < dep.length; i++)
/******/ 						hot._acceptedDependencies[dep[i]] = callback || function() {};
/******/ 				else hot._acceptedDependencies[dep] = callback || function() {};
/******/ 			},
/******/ 			decline: function(dep) {
/******/ 				if (dep === undefined) hot._selfDeclined = true;
/******/ 				else if (typeof dep === "object")
/******/ 					for (var i = 0; i < dep.length; i++)
/******/ 						hot._declinedDependencies[dep[i]] = true;
/******/ 				else hot._declinedDependencies[dep] = true;
/******/ 			},
/******/ 			dispose: function(callback) {
/******/ 				hot._disposeHandlers.push(callback);
/******/ 			},
/******/ 			addDisposeHandler: function(callback) {
/******/ 				hot._disposeHandlers.push(callback);
/******/ 			},
/******/ 			removeDisposeHandler: function(callback) {
/******/ 				var idx = hot._disposeHandlers.indexOf(callback);
/******/ 				if (idx >= 0) hot._disposeHandlers.splice(idx, 1);
/******/ 			},
/******/ 			invalidate: function() {
/******/ 				this._selfInvalidated = true;
/******/ 				switch (hotStatus) {
/******/ 					case "idle":
/******/ 						hotUpdate = {};
/******/ 						hotUpdate[moduleId] = modules[moduleId];
/******/ 						hotSetStatus("ready");
/******/ 						break;
/******/ 					case "ready":
/******/ 						hotApplyInvalidatedModule(moduleId);
/******/ 						break;
/******/ 					case "prepare":
/******/ 					case "check":
/******/ 					case "dispose":
/******/ 					case "apply":
/******/ 						(hotQueuedInvalidatedModules =
/******/ 							hotQueuedInvalidatedModules || []).push(moduleId);
/******/ 						break;
/******/ 					default:
/******/ 						// ignore requests in error states
/******/ 						break;
/******/ 				}
/******/ 			},
/******/
/******/ 			// Management API
/******/ 			check: hotCheck,
/******/ 			apply: hotApply,
/******/ 			status: function(l) {
/******/ 				if (!l) return hotStatus;
/******/ 				hotStatusHandlers.push(l);
/******/ 			},
/******/ 			addStatusHandler: function(l) {
/******/ 				hotStatusHandlers.push(l);
/******/ 			},
/******/ 			removeStatusHandler: function(l) {
/******/ 				var idx = hotStatusHandlers.indexOf(l);
/******/ 				if (idx >= 0) hotStatusHandlers.splice(idx, 1);
/******/ 			},
/******/
/******/ 			//inherit from previous dispose call
/******/ 			data: hotCurrentModuleData[moduleId]
/******/ 		};
/******/ 		hotCurrentChildModule = undefined;
/******/ 		return hot;
/******/ 	}
/******/
/******/ 	var hotStatusHandlers = [];
/******/ 	var hotStatus = "idle";
/******/
/******/ 	function hotSetStatus(newStatus) {
/******/ 		hotStatus = newStatus;
/******/ 		for (var i = 0; i < hotStatusHandlers.length; i++)
/******/ 			hotStatusHandlers[i].call(null, newStatus);
/******/ 	}
/******/
/******/ 	// while downloading
/******/ 	var hotWaitingFiles = 0;
/******/ 	var hotChunksLoading = 0;
/******/ 	var hotWaitingFilesMap = {};
/******/ 	var hotRequestedFilesMap = {};
/******/ 	var hotAvailableFilesMap = {};
/******/ 	var hotDeferred;
/******/
/******/ 	// The update info
/******/ 	var hotUpdate, hotUpdateNewHash, hotQueuedInvalidatedModules;
/******/
/******/ 	function toModuleId(id) {
/******/ 		var isNumber = +id + "" === id;
/******/ 		return isNumber ? +id : id;
/******/ 	}
/******/
/******/ 	function hotCheck(apply) {
/******/ 		if (hotStatus !== "idle") {
/******/ 			throw new Error("check() is only allowed in idle status");
/******/ 		}
/******/ 		hotApplyOnUpdate = apply;
/******/ 		hotSetStatus("check");
/******/ 		return hotDownloadManifest(hotRequestTimeout).then(function(update) {
/******/ 			if (!update) {
/******/ 				hotSetStatus(hotApplyInvalidatedModules() ? "ready" : "idle");
/******/ 				return null;
/******/ 			}
/******/ 			hotRequestedFilesMap = {};
/******/ 			hotWaitingFilesMap = {};
/******/ 			hotAvailableFilesMap = update.c;
/******/ 			hotUpdateNewHash = update.h;
/******/
/******/ 			hotSetStatus("prepare");
/******/ 			var promise = new Promise(function(resolve, reject) {
/******/ 				hotDeferred = {
/******/ 					resolve: resolve,
/******/ 					reject: reject
/******/ 				};
/******/ 			});
/******/ 			hotUpdate = {};
/******/ 			var chunkId = "background";
/******/ 			// eslint-disable-next-line no-lone-blocks
/******/ 			{
/******/ 				hotEnsureUpdateChunk(chunkId);
/******/ 			}
/******/ 			if (
/******/ 				hotStatus === "prepare" &&
/******/ 				hotChunksLoading === 0 &&
/******/ 				hotWaitingFiles === 0
/******/ 			) {
/******/ 				hotUpdateDownloaded();
/******/ 			}
/******/ 			return promise;
/******/ 		});
/******/ 	}
/******/
/******/ 	// eslint-disable-next-line no-unused-vars
/******/ 	function hotAddUpdateChunk(chunkId, moreModules) {
/******/ 		if (!hotAvailableFilesMap[chunkId] || !hotRequestedFilesMap[chunkId])
/******/ 			return;
/******/ 		hotRequestedFilesMap[chunkId] = false;
/******/ 		for (var moduleId in moreModules) {
/******/ 			if (Object.prototype.hasOwnProperty.call(moreModules, moduleId)) {
/******/ 				hotUpdate[moduleId] = moreModules[moduleId];
/******/ 			}
/******/ 		}
/******/ 		if (--hotWaitingFiles === 0 && hotChunksLoading === 0) {
/******/ 			hotUpdateDownloaded();
/******/ 		}
/******/ 	}
/******/
/******/ 	function hotEnsureUpdateChunk(chunkId) {
/******/ 		if (!hotAvailableFilesMap[chunkId]) {
/******/ 			hotWaitingFilesMap[chunkId] = true;
/******/ 		} else {
/******/ 			hotRequestedFilesMap[chunkId] = true;
/******/ 			hotWaitingFiles++;
/******/ 			hotDownloadUpdateChunk(chunkId);
/******/ 		}
/******/ 	}
/******/
/******/ 	function hotUpdateDownloaded() {
/******/ 		hotSetStatus("ready");
/******/ 		var deferred = hotDeferred;
/******/ 		hotDeferred = null;
/******/ 		if (!deferred) return;
/******/ 		if (hotApplyOnUpdate) {
/******/ 			// Wrap deferred object in Promise to mark it as a well-handled Promise to
/******/ 			// avoid triggering uncaught exception warning in Chrome.
/******/ 			// See https://bugs.chromium.org/p/chromium/issues/detail?id=465666
/******/ 			Promise.resolve()
/******/ 				.then(function() {
/******/ 					return hotApply(hotApplyOnUpdate);
/******/ 				})
/******/ 				.then(
/******/ 					function(result) {
/******/ 						deferred.resolve(result);
/******/ 					},
/******/ 					function(err) {
/******/ 						deferred.reject(err);
/******/ 					}
/******/ 				);
/******/ 		} else {
/******/ 			var outdatedModules = [];
/******/ 			for (var id in hotUpdate) {
/******/ 				if (Object.prototype.hasOwnProperty.call(hotUpdate, id)) {
/******/ 					outdatedModules.push(toModuleId(id));
/******/ 				}
/******/ 			}
/******/ 			deferred.resolve(outdatedModules);
/******/ 		}
/******/ 	}
/******/
/******/ 	function hotApply(options) {
/******/ 		if (hotStatus !== "ready")
/******/ 			throw new Error("apply() is only allowed in ready status");
/******/ 		options = options || {};
/******/ 		return hotApplyInternal(options);
/******/ 	}
/******/
/******/ 	function hotApplyInternal(options) {
/******/ 		hotApplyInvalidatedModules();
/******/
/******/ 		var cb;
/******/ 		var i;
/******/ 		var j;
/******/ 		var module;
/******/ 		var moduleId;
/******/
/******/ 		function getAffectedStuff(updateModuleId) {
/******/ 			var outdatedModules = [updateModuleId];
/******/ 			var outdatedDependencies = {};
/******/
/******/ 			var queue = outdatedModules.map(function(id) {
/******/ 				return {
/******/ 					chain: [id],
/******/ 					id: id
/******/ 				};
/******/ 			});
/******/ 			while (queue.length > 0) {
/******/ 				var queueItem = queue.pop();
/******/ 				var moduleId = queueItem.id;
/******/ 				var chain = queueItem.chain;
/******/ 				module = installedModules[moduleId];
/******/ 				if (
/******/ 					!module ||
/******/ 					(module.hot._selfAccepted && !module.hot._selfInvalidated)
/******/ 				)
/******/ 					continue;
/******/ 				if (module.hot._selfDeclined) {
/******/ 					return {
/******/ 						type: "self-declined",
/******/ 						chain: chain,
/******/ 						moduleId: moduleId
/******/ 					};
/******/ 				}
/******/ 				if (module.hot._main) {
/******/ 					return {
/******/ 						type: "unaccepted",
/******/ 						chain: chain,
/******/ 						moduleId: moduleId
/******/ 					};
/******/ 				}
/******/ 				for (var i = 0; i < module.parents.length; i++) {
/******/ 					var parentId = module.parents[i];
/******/ 					var parent = installedModules[parentId];
/******/ 					if (!parent) continue;
/******/ 					if (parent.hot._declinedDependencies[moduleId]) {
/******/ 						return {
/******/ 							type: "declined",
/******/ 							chain: chain.concat([parentId]),
/******/ 							moduleId: moduleId,
/******/ 							parentId: parentId
/******/ 						};
/******/ 					}
/******/ 					if (outdatedModules.indexOf(parentId) !== -1) continue;
/******/ 					if (parent.hot._acceptedDependencies[moduleId]) {
/******/ 						if (!outdatedDependencies[parentId])
/******/ 							outdatedDependencies[parentId] = [];
/******/ 						addAllToSet(outdatedDependencies[parentId], [moduleId]);
/******/ 						continue;
/******/ 					}
/******/ 					delete outdatedDependencies[parentId];
/******/ 					outdatedModules.push(parentId);
/******/ 					queue.push({
/******/ 						chain: chain.concat([parentId]),
/******/ 						id: parentId
/******/ 					});
/******/ 				}
/******/ 			}
/******/
/******/ 			return {
/******/ 				type: "accepted",
/******/ 				moduleId: updateModuleId,
/******/ 				outdatedModules: outdatedModules,
/******/ 				outdatedDependencies: outdatedDependencies
/******/ 			};
/******/ 		}
/******/
/******/ 		function addAllToSet(a, b) {
/******/ 			for (var i = 0; i < b.length; i++) {
/******/ 				var item = b[i];
/******/ 				if (a.indexOf(item) === -1) a.push(item);
/******/ 			}
/******/ 		}
/******/
/******/ 		// at begin all updates modules are outdated
/******/ 		// the "outdated" status can propagate to parents if they don't accept the children
/******/ 		var outdatedDependencies = {};
/******/ 		var outdatedModules = [];
/******/ 		var appliedUpdate = {};
/******/
/******/ 		var warnUnexpectedRequire = function warnUnexpectedRequire() {
/******/ 			console.warn(
/******/ 				"[HMR] unexpected require(" + result.moduleId + ") to disposed module"
/******/ 			);
/******/ 		};
/******/
/******/ 		for (var id in hotUpdate) {
/******/ 			if (Object.prototype.hasOwnProperty.call(hotUpdate, id)) {
/******/ 				moduleId = toModuleId(id);
/******/ 				/** @type {TODO} */
/******/ 				var result;
/******/ 				if (hotUpdate[id]) {
/******/ 					result = getAffectedStuff(moduleId);
/******/ 				} else {
/******/ 					result = {
/******/ 						type: "disposed",
/******/ 						moduleId: id
/******/ 					};
/******/ 				}
/******/ 				/** @type {Error|false} */
/******/ 				var abortError = false;
/******/ 				var doApply = false;
/******/ 				var doDispose = false;
/******/ 				var chainInfo = "";
/******/ 				if (result.chain) {
/******/ 					chainInfo = "\nUpdate propagation: " + result.chain.join(" -> ");
/******/ 				}
/******/ 				switch (result.type) {
/******/ 					case "self-declined":
/******/ 						if (options.onDeclined) options.onDeclined(result);
/******/ 						if (!options.ignoreDeclined)
/******/ 							abortError = new Error(
/******/ 								"Aborted because of self decline: " +
/******/ 									result.moduleId +
/******/ 									chainInfo
/******/ 							);
/******/ 						break;
/******/ 					case "declined":
/******/ 						if (options.onDeclined) options.onDeclined(result);
/******/ 						if (!options.ignoreDeclined)
/******/ 							abortError = new Error(
/******/ 								"Aborted because of declined dependency: " +
/******/ 									result.moduleId +
/******/ 									" in " +
/******/ 									result.parentId +
/******/ 									chainInfo
/******/ 							);
/******/ 						break;
/******/ 					case "unaccepted":
/******/ 						if (options.onUnaccepted) options.onUnaccepted(result);
/******/ 						if (!options.ignoreUnaccepted)
/******/ 							abortError = new Error(
/******/ 								"Aborted because " + moduleId + " is not accepted" + chainInfo
/******/ 							);
/******/ 						break;
/******/ 					case "accepted":
/******/ 						if (options.onAccepted) options.onAccepted(result);
/******/ 						doApply = true;
/******/ 						break;
/******/ 					case "disposed":
/******/ 						if (options.onDisposed) options.onDisposed(result);
/******/ 						doDispose = true;
/******/ 						break;
/******/ 					default:
/******/ 						throw new Error("Unexception type " + result.type);
/******/ 				}
/******/ 				if (abortError) {
/******/ 					hotSetStatus("abort");
/******/ 					return Promise.reject(abortError);
/******/ 				}
/******/ 				if (doApply) {
/******/ 					appliedUpdate[moduleId] = hotUpdate[moduleId];
/******/ 					addAllToSet(outdatedModules, result.outdatedModules);
/******/ 					for (moduleId in result.outdatedDependencies) {
/******/ 						if (
/******/ 							Object.prototype.hasOwnProperty.call(
/******/ 								result.outdatedDependencies,
/******/ 								moduleId
/******/ 							)
/******/ 						) {
/******/ 							if (!outdatedDependencies[moduleId])
/******/ 								outdatedDependencies[moduleId] = [];
/******/ 							addAllToSet(
/******/ 								outdatedDependencies[moduleId],
/******/ 								result.outdatedDependencies[moduleId]
/******/ 							);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 				if (doDispose) {
/******/ 					addAllToSet(outdatedModules, [result.moduleId]);
/******/ 					appliedUpdate[moduleId] = warnUnexpectedRequire;
/******/ 				}
/******/ 			}
/******/ 		}
/******/
/******/ 		// Store self accepted outdated modules to require them later by the module system
/******/ 		var outdatedSelfAcceptedModules = [];
/******/ 		for (i = 0; i < outdatedModules.length; i++) {
/******/ 			moduleId = outdatedModules[i];
/******/ 			if (
/******/ 				installedModules[moduleId] &&
/******/ 				installedModules[moduleId].hot._selfAccepted &&
/******/ 				// removed self-accepted modules should not be required
/******/ 				appliedUpdate[moduleId] !== warnUnexpectedRequire &&
/******/ 				// when called invalidate self-accepting is not possible
/******/ 				!installedModules[moduleId].hot._selfInvalidated
/******/ 			) {
/******/ 				outdatedSelfAcceptedModules.push({
/******/ 					module: moduleId,
/******/ 					parents: installedModules[moduleId].parents.slice(),
/******/ 					errorHandler: installedModules[moduleId].hot._selfAccepted
/******/ 				});
/******/ 			}
/******/ 		}
/******/
/******/ 		// Now in "dispose" phase
/******/ 		hotSetStatus("dispose");
/******/ 		Object.keys(hotAvailableFilesMap).forEach(function(chunkId) {
/******/ 			if (hotAvailableFilesMap[chunkId] === false) {
/******/ 				hotDisposeChunk(chunkId);
/******/ 			}
/******/ 		});
/******/
/******/ 		var idx;
/******/ 		var queue = outdatedModules.slice();
/******/ 		while (queue.length > 0) {
/******/ 			moduleId = queue.pop();
/******/ 			module = installedModules[moduleId];
/******/ 			if (!module) continue;
/******/
/******/ 			var data = {};
/******/
/******/ 			// Call dispose handlers
/******/ 			var disposeHandlers = module.hot._disposeHandlers;
/******/ 			for (j = 0; j < disposeHandlers.length; j++) {
/******/ 				cb = disposeHandlers[j];
/******/ 				cb(data);
/******/ 			}
/******/ 			hotCurrentModuleData[moduleId] = data;
/******/
/******/ 			// disable module (this disables requires from this module)
/******/ 			module.hot.active = false;
/******/
/******/ 			// remove module from cache
/******/ 			delete installedModules[moduleId];
/******/
/******/ 			// when disposing there is no need to call dispose handler
/******/ 			delete outdatedDependencies[moduleId];
/******/
/******/ 			// remove "parents" references from all children
/******/ 			for (j = 0; j < module.children.length; j++) {
/******/ 				var child = installedModules[module.children[j]];
/******/ 				if (!child) continue;
/******/ 				idx = child.parents.indexOf(moduleId);
/******/ 				if (idx >= 0) {
/******/ 					child.parents.splice(idx, 1);
/******/ 				}
/******/ 			}
/******/ 		}
/******/
/******/ 		// remove outdated dependency from module children
/******/ 		var dependency;
/******/ 		var moduleOutdatedDependencies;
/******/ 		for (moduleId in outdatedDependencies) {
/******/ 			if (
/******/ 				Object.prototype.hasOwnProperty.call(outdatedDependencies, moduleId)
/******/ 			) {
/******/ 				module = installedModules[moduleId];
/******/ 				if (module) {
/******/ 					moduleOutdatedDependencies = outdatedDependencies[moduleId];
/******/ 					for (j = 0; j < moduleOutdatedDependencies.length; j++) {
/******/ 						dependency = moduleOutdatedDependencies[j];
/******/ 						idx = module.children.indexOf(dependency);
/******/ 						if (idx >= 0) module.children.splice(idx, 1);
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		}
/******/
/******/ 		// Now in "apply" phase
/******/ 		hotSetStatus("apply");
/******/
/******/ 		if (hotUpdateNewHash !== undefined) {
/******/ 			hotCurrentHash = hotUpdateNewHash;
/******/ 			hotUpdateNewHash = undefined;
/******/ 		}
/******/ 		hotUpdate = undefined;
/******/
/******/ 		// insert new code
/******/ 		for (moduleId in appliedUpdate) {
/******/ 			if (Object.prototype.hasOwnProperty.call(appliedUpdate, moduleId)) {
/******/ 				modules[moduleId] = appliedUpdate[moduleId];
/******/ 			}
/******/ 		}
/******/
/******/ 		// call accept handlers
/******/ 		var error = null;
/******/ 		for (moduleId in outdatedDependencies) {
/******/ 			if (
/******/ 				Object.prototype.hasOwnProperty.call(outdatedDependencies, moduleId)
/******/ 			) {
/******/ 				module = installedModules[moduleId];
/******/ 				if (module) {
/******/ 					moduleOutdatedDependencies = outdatedDependencies[moduleId];
/******/ 					var callbacks = [];
/******/ 					for (i = 0; i < moduleOutdatedDependencies.length; i++) {
/******/ 						dependency = moduleOutdatedDependencies[i];
/******/ 						cb = module.hot._acceptedDependencies[dependency];
/******/ 						if (cb) {
/******/ 							if (callbacks.indexOf(cb) !== -1) continue;
/******/ 							callbacks.push(cb);
/******/ 						}
/******/ 					}
/******/ 					for (i = 0; i < callbacks.length; i++) {
/******/ 						cb = callbacks[i];
/******/ 						try {
/******/ 							cb(moduleOutdatedDependencies);
/******/ 						} catch (err) {
/******/ 							if (options.onErrored) {
/******/ 								options.onErrored({
/******/ 									type: "accept-errored",
/******/ 									moduleId: moduleId,
/******/ 									dependencyId: moduleOutdatedDependencies[i],
/******/ 									error: err
/******/ 								});
/******/ 							}
/******/ 							if (!options.ignoreErrored) {
/******/ 								if (!error) error = err;
/******/ 							}
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		}
/******/
/******/ 		// Load self accepted modules
/******/ 		for (i = 0; i < outdatedSelfAcceptedModules.length; i++) {
/******/ 			var item = outdatedSelfAcceptedModules[i];
/******/ 			moduleId = item.module;
/******/ 			hotCurrentParents = item.parents;
/******/ 			hotCurrentChildModule = moduleId;
/******/ 			try {
/******/ 				__webpack_require__(moduleId);
/******/ 			} catch (err) {
/******/ 				if (typeof item.errorHandler === "function") {
/******/ 					try {
/******/ 						item.errorHandler(err);
/******/ 					} catch (err2) {
/******/ 						if (options.onErrored) {
/******/ 							options.onErrored({
/******/ 								type: "self-accept-error-handler-errored",
/******/ 								moduleId: moduleId,
/******/ 								error: err2,
/******/ 								originalError: err
/******/ 							});
/******/ 						}
/******/ 						if (!options.ignoreErrored) {
/******/ 							if (!error) error = err2;
/******/ 						}
/******/ 						if (!error) error = err;
/******/ 					}
/******/ 				} else {
/******/ 					if (options.onErrored) {
/******/ 						options.onErrored({
/******/ 							type: "self-accept-errored",
/******/ 							moduleId: moduleId,
/******/ 							error: err
/******/ 						});
/******/ 					}
/******/ 					if (!options.ignoreErrored) {
/******/ 						if (!error) error = err;
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		}
/******/
/******/ 		// handle errors in accept handlers and self accepted module load
/******/ 		if (error) {
/******/ 			hotSetStatus("fail");
/******/ 			return Promise.reject(error);
/******/ 		}
/******/
/******/ 		if (hotQueuedInvalidatedModules) {
/******/ 			return hotApplyInternal(options).then(function(list) {
/******/ 				outdatedModules.forEach(function(moduleId) {
/******/ 					if (list.indexOf(moduleId) < 0) list.push(moduleId);
/******/ 				});
/******/ 				return list;
/******/ 			});
/******/ 		}
/******/
/******/ 		hotSetStatus("idle");
/******/ 		return new Promise(function(resolve) {
/******/ 			resolve(outdatedModules);
/******/ 		});
/******/ 	}
/******/
/******/ 	function hotApplyInvalidatedModules() {
/******/ 		if (hotQueuedInvalidatedModules) {
/******/ 			if (!hotUpdate) hotUpdate = {};
/******/ 			hotQueuedInvalidatedModules.forEach(hotApplyInvalidatedModule);
/******/ 			hotQueuedInvalidatedModules = undefined;
/******/ 			return true;
/******/ 		}
/******/ 	}
/******/
/******/ 	function hotApplyInvalidatedModule(moduleId) {
/******/ 		if (!Object.prototype.hasOwnProperty.call(hotUpdate, moduleId))
/******/ 			hotUpdate[moduleId] = modules[moduleId];
/******/ 	}
/******/
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {},
/******/ 			hot: hotCreateModule(moduleId),
/******/ 			parents: (hotCurrentParentsTemp = hotCurrentParents, hotCurrentParents = [], hotCurrentParentsTemp),
/******/ 			children: []
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, hotCreateRequire(moduleId));
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/";
/******/
/******/ 	// __webpack_hash__
/******/ 	__webpack_require__.h = function() { return hotCurrentHash; };
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return hotCreateRequire("./src/chrome/js/background.js")(__webpack_require__.s = "./src/chrome/js/background.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./node_modules/@babel/runtime/helpers/arrayLikeToArray.js":
/*!*****************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/arrayLikeToArray.js ***!
  \*****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _arrayLikeToArray(arr, len) {\n  if (len == null || len > arr.length) len = arr.length;\n\n  for (var i = 0, arr2 = new Array(len); i < len; i++) {\n    arr2[i] = arr[i];\n  }\n\n  return arr2;\n}\n\nmodule.exports = _arrayLikeToArray;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/arrayLikeToArray.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/arrayWithHoles.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/arrayWithHoles.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _arrayWithHoles(arr) {\n  if (Array.isArray(arr)) return arr;\n}\n\nmodule.exports = _arrayWithHoles;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/arrayWithHoles.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/asyncToGenerator.js":
/*!*****************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/asyncToGenerator.js ***!
  \*****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {\n  try {\n    var info = gen[key](arg);\n    var value = info.value;\n  } catch (error) {\n    reject(error);\n    return;\n  }\n\n  if (info.done) {\n    resolve(value);\n  } else {\n    Promise.resolve(value).then(_next, _throw);\n  }\n}\n\nfunction _asyncToGenerator(fn) {\n  return function () {\n    var self = this,\n        args = arguments;\n    return new Promise(function (resolve, reject) {\n      var gen = fn.apply(self, args);\n\n      function _next(value) {\n        asyncGeneratorStep(gen, resolve, reject, _next, _throw, \"next\", value);\n      }\n\n      function _throw(err) {\n        asyncGeneratorStep(gen, resolve, reject, _next, _throw, \"throw\", err);\n      }\n\n      _next(undefined);\n    });\n  };\n}\n\nmodule.exports = _asyncToGenerator;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/asyncToGenerator.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/classCallCheck.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/classCallCheck.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _classCallCheck(instance, Constructor) {\n  if (!(instance instanceof Constructor)) {\n    throw new TypeError(\"Cannot call a class as a function\");\n  }\n}\n\nmodule.exports = _classCallCheck;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/classCallCheck.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/createClass.js":
/*!************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/createClass.js ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _defineProperties(target, props) {\n  for (var i = 0; i < props.length; i++) {\n    var descriptor = props[i];\n    descriptor.enumerable = descriptor.enumerable || false;\n    descriptor.configurable = true;\n    if (\"value\" in descriptor) descriptor.writable = true;\n    Object.defineProperty(target, descriptor.key, descriptor);\n  }\n}\n\nfunction _createClass(Constructor, protoProps, staticProps) {\n  if (protoProps) _defineProperties(Constructor.prototype, protoProps);\n  if (staticProps) _defineProperties(Constructor, staticProps);\n  return Constructor;\n}\n\nmodule.exports = _createClass;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/createClass.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/defineProperty.js":
/*!***************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/defineProperty.js ***!
  \***************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _defineProperty(obj, key, value) {\n  if (key in obj) {\n    Object.defineProperty(obj, key, {\n      value: value,\n      enumerable: true,\n      configurable: true,\n      writable: true\n    });\n  } else {\n    obj[key] = value;\n  }\n\n  return obj;\n}\n\nmodule.exports = _defineProperty;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/defineProperty.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js":
/*!*********************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _iterableToArrayLimit(arr, i) {\n  if (typeof Symbol === \"undefined\" || !(Symbol.iterator in Object(arr))) return;\n  var _arr = [];\n  var _n = true;\n  var _d = false;\n  var _e = undefined;\n\n  try {\n    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {\n      _arr.push(_s.value);\n\n      if (i && _arr.length === i) break;\n    }\n  } catch (err) {\n    _d = true;\n    _e = err;\n  } finally {\n    try {\n      if (!_n && _i[\"return\"] != null) _i[\"return\"]();\n    } finally {\n      if (_d) throw _e;\n    }\n  }\n\n  return _arr;\n}\n\nmodule.exports = _iterableToArrayLimit;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/nonIterableRest.js":
/*!****************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/nonIterableRest.js ***!
  \****************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("function _nonIterableRest() {\n  throw new TypeError(\"Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.\");\n}\n\nmodule.exports = _nonIterableRest;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/nonIterableRest.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/slicedToArray.js":
/*!**************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/slicedToArray.js ***!
  \**************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("var arrayWithHoles = __webpack_require__(/*! ./arrayWithHoles */ \"./node_modules/@babel/runtime/helpers/arrayWithHoles.js\");\n\nvar iterableToArrayLimit = __webpack_require__(/*! ./iterableToArrayLimit */ \"./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js\");\n\nvar unsupportedIterableToArray = __webpack_require__(/*! ./unsupportedIterableToArray */ \"./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js\");\n\nvar nonIterableRest = __webpack_require__(/*! ./nonIterableRest */ \"./node_modules/@babel/runtime/helpers/nonIterableRest.js\");\n\nfunction _slicedToArray(arr, i) {\n  return arrayWithHoles(arr) || iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();\n}\n\nmodule.exports = _slicedToArray;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/slicedToArray.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js":
/*!***************************************************************************!*\
  !*** ./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js ***!
  \***************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("var arrayLikeToArray = __webpack_require__(/*! ./arrayLikeToArray */ \"./node_modules/@babel/runtime/helpers/arrayLikeToArray.js\");\n\nfunction _unsupportedIterableToArray(o, minLen) {\n  if (!o) return;\n  if (typeof o === \"string\") return arrayLikeToArray(o, minLen);\n  var n = Object.prototype.toString.call(o).slice(8, -1);\n  if (n === \"Object\" && o.constructor) n = o.constructor.name;\n  if (n === \"Map\" || n === \"Set\") return Array.from(o);\n  if (n === \"Arguments\" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);\n}\n\nmodule.exports = _unsupportedIterableToArray;\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js?");

/***/ }),

/***/ "./node_modules/@babel/runtime/regenerator/index.js":
/*!**********************************************************!*\
  !*** ./node_modules/@babel/runtime/regenerator/index.js ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("module.exports = __webpack_require__(/*! regenerator-runtime */ \"./node_modules/regenerator-runtime/runtime.js\");\n\n\n//# sourceURL=webpack:///./node_modules/@babel/runtime/regenerator/index.js?");

/***/ }),

/***/ "./node_modules/ip-range-check/index.js":
/*!**********************************************!*\
  !*** ./node_modules/ip-range-check/index.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("var ipaddr = __webpack_require__(/*! ipaddr.js */ \"./node_modules/ipaddr.js/lib/ipaddr.js\");\n\nmodule.exports = check_many_cidrs;\n\nfunction check_many_cidrs(addr, range) {\n    if (typeof (range) === \"string\") {\n        return check_single_cidr(addr, range)\n    }\n    else if (typeof (range) === \"object\") //list\n    {\n        var ip_is_in_range = false;\n        for (var i = 0; i < range.length; i++) {\n            if (check_single_cidr(addr, range[i])) {\n                ip_is_in_range = true;\n                break\n            }\n        }\n        return ip_is_in_range;\n    }\n}\n\nfunction check_single_cidr(addr, cidr) {\n    try {\n        var parsed_addr = ipaddr.process(addr);\n        if (cidr.indexOf('/') === -1) {\n            var parsed_cidr_as_ip = ipaddr.process(cidr);\n            if ((parsed_addr.kind() === \"ipv6\") && (parsed_cidr_as_ip.kind() === \"ipv6\")){\n                return (parsed_addr.toNormalizedString() === parsed_cidr_as_ip.toNormalizedString())\n            }\n            return (parsed_addr.toString() == parsed_cidr_as_ip.toString())\n        }\n        else {\n            var parsed_range = ipaddr.parseCIDR(cidr);\n            return parsed_addr.match(parsed_range)\n        }\n    }\n    catch (e) {\n        return false\n    }\n}\n\n\n//# sourceURL=webpack:///./node_modules/ip-range-check/index.js?");

/***/ }),

/***/ "./node_modules/ipaddr.js/lib/ipaddr.js":
/*!**********************************************!*\
  !*** ./node_modules/ipaddr.js/lib/ipaddr.js ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("/* WEBPACK VAR INJECTION */(function(module) {(function() {\n  var expandIPv6, ipaddr, ipv4Part, ipv4Regexes, ipv6Part, ipv6Regexes, matchCIDR, root, zoneIndex;\n\n  ipaddr = {};\n\n  root = this;\n\n  if (( true && module !== null) && module.exports) {\n    module.exports = ipaddr;\n  } else {\n    root['ipaddr'] = ipaddr;\n  }\n\n  matchCIDR = function(first, second, partSize, cidrBits) {\n    var part, shift;\n    if (first.length !== second.length) {\n      throw new Error(\"ipaddr: cannot match CIDR for objects with different lengths\");\n    }\n    part = 0;\n    while (cidrBits > 0) {\n      shift = partSize - cidrBits;\n      if (shift < 0) {\n        shift = 0;\n      }\n      if (first[part] >> shift !== second[part] >> shift) {\n        return false;\n      }\n      cidrBits -= partSize;\n      part += 1;\n    }\n    return true;\n  };\n\n  ipaddr.subnetMatch = function(address, rangeList, defaultName) {\n    var k, len, rangeName, rangeSubnets, subnet;\n    if (defaultName == null) {\n      defaultName = 'unicast';\n    }\n    for (rangeName in rangeList) {\n      rangeSubnets = rangeList[rangeName];\n      if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {\n        rangeSubnets = [rangeSubnets];\n      }\n      for (k = 0, len = rangeSubnets.length; k < len; k++) {\n        subnet = rangeSubnets[k];\n        if (address.kind() === subnet[0].kind()) {\n          if (address.match.apply(address, subnet)) {\n            return rangeName;\n          }\n        }\n      }\n    }\n    return defaultName;\n  };\n\n  ipaddr.IPv4 = (function() {\n    function IPv4(octets) {\n      var k, len, octet;\n      if (octets.length !== 4) {\n        throw new Error(\"ipaddr: ipv4 octet count should be 4\");\n      }\n      for (k = 0, len = octets.length; k < len; k++) {\n        octet = octets[k];\n        if (!((0 <= octet && octet <= 255))) {\n          throw new Error(\"ipaddr: ipv4 octet should fit in 8 bits\");\n        }\n      }\n      this.octets = octets;\n    }\n\n    IPv4.prototype.kind = function() {\n      return 'ipv4';\n    };\n\n    IPv4.prototype.toString = function() {\n      return this.octets.join(\".\");\n    };\n\n    IPv4.prototype.toNormalizedString = function() {\n      return this.toString();\n    };\n\n    IPv4.prototype.toByteArray = function() {\n      return this.octets.slice(0);\n    };\n\n    IPv4.prototype.match = function(other, cidrRange) {\n      var ref;\n      if (cidrRange === void 0) {\n        ref = other, other = ref[0], cidrRange = ref[1];\n      }\n      if (other.kind() !== 'ipv4') {\n        throw new Error(\"ipaddr: cannot match ipv4 address with non-ipv4 one\");\n      }\n      return matchCIDR(this.octets, other.octets, 8, cidrRange);\n    };\n\n    IPv4.prototype.SpecialRanges = {\n      unspecified: [[new IPv4([0, 0, 0, 0]), 8]],\n      broadcast: [[new IPv4([255, 255, 255, 255]), 32]],\n      multicast: [[new IPv4([224, 0, 0, 0]), 4]],\n      linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],\n      loopback: [[new IPv4([127, 0, 0, 0]), 8]],\n      carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],\n      \"private\": [[new IPv4([10, 0, 0, 0]), 8], [new IPv4([172, 16, 0, 0]), 12], [new IPv4([192, 168, 0, 0]), 16]],\n      reserved: [[new IPv4([192, 0, 0, 0]), 24], [new IPv4([192, 0, 2, 0]), 24], [new IPv4([192, 88, 99, 0]), 24], [new IPv4([198, 51, 100, 0]), 24], [new IPv4([203, 0, 113, 0]), 24], [new IPv4([240, 0, 0, 0]), 4]]\n    };\n\n    IPv4.prototype.range = function() {\n      return ipaddr.subnetMatch(this, this.SpecialRanges);\n    };\n\n    IPv4.prototype.toIPv4MappedAddress = function() {\n      return ipaddr.IPv6.parse(\"::ffff:\" + (this.toString()));\n    };\n\n    IPv4.prototype.prefixLengthFromSubnetMask = function() {\n      var cidr, i, k, octet, stop, zeros, zerotable;\n      zerotable = {\n        0: 8,\n        128: 7,\n        192: 6,\n        224: 5,\n        240: 4,\n        248: 3,\n        252: 2,\n        254: 1,\n        255: 0\n      };\n      cidr = 0;\n      stop = false;\n      for (i = k = 3; k >= 0; i = k += -1) {\n        octet = this.octets[i];\n        if (octet in zerotable) {\n          zeros = zerotable[octet];\n          if (stop && zeros !== 0) {\n            return null;\n          }\n          if (zeros !== 8) {\n            stop = true;\n          }\n          cidr += zeros;\n        } else {\n          return null;\n        }\n      }\n      return 32 - cidr;\n    };\n\n    return IPv4;\n\n  })();\n\n  ipv4Part = \"(0?\\\\d+|0x[a-f0-9]+)\";\n\n  ipv4Regexes = {\n    fourOctet: new RegExp(\"^\" + ipv4Part + \"\\\\.\" + ipv4Part + \"\\\\.\" + ipv4Part + \"\\\\.\" + ipv4Part + \"$\", 'i'),\n    longValue: new RegExp(\"^\" + ipv4Part + \"$\", 'i')\n  };\n\n  ipaddr.IPv4.parser = function(string) {\n    var match, parseIntAuto, part, shift, value;\n    parseIntAuto = function(string) {\n      if (string[0] === \"0\" && string[1] !== \"x\") {\n        return parseInt(string, 8);\n      } else {\n        return parseInt(string);\n      }\n    };\n    if (match = string.match(ipv4Regexes.fourOctet)) {\n      return (function() {\n        var k, len, ref, results;\n        ref = match.slice(1, 6);\n        results = [];\n        for (k = 0, len = ref.length; k < len; k++) {\n          part = ref[k];\n          results.push(parseIntAuto(part));\n        }\n        return results;\n      })();\n    } else if (match = string.match(ipv4Regexes.longValue)) {\n      value = parseIntAuto(match[1]);\n      if (value > 0xffffffff || value < 0) {\n        throw new Error(\"ipaddr: address outside defined range\");\n      }\n      return ((function() {\n        var k, results;\n        results = [];\n        for (shift = k = 0; k <= 24; shift = k += 8) {\n          results.push((value >> shift) & 0xff);\n        }\n        return results;\n      })()).reverse();\n    } else {\n      return null;\n    }\n  };\n\n  ipaddr.IPv6 = (function() {\n    function IPv6(parts, zoneId) {\n      var i, k, l, len, part, ref;\n      if (parts.length === 16) {\n        this.parts = [];\n        for (i = k = 0; k <= 14; i = k += 2) {\n          this.parts.push((parts[i] << 8) | parts[i + 1]);\n        }\n      } else if (parts.length === 8) {\n        this.parts = parts;\n      } else {\n        throw new Error(\"ipaddr: ipv6 part count should be 8 or 16\");\n      }\n      ref = this.parts;\n      for (l = 0, len = ref.length; l < len; l++) {\n        part = ref[l];\n        if (!((0 <= part && part <= 0xffff))) {\n          throw new Error(\"ipaddr: ipv6 part should fit in 16 bits\");\n        }\n      }\n      if (zoneId) {\n        this.zoneId = zoneId;\n      }\n    }\n\n    IPv6.prototype.kind = function() {\n      return 'ipv6';\n    };\n\n    IPv6.prototype.toString = function() {\n      return this.toNormalizedString().replace(/((^|:)(0(:|$))+)/, '::');\n    };\n\n    IPv6.prototype.toRFC5952String = function() {\n      var bestMatchIndex, bestMatchLength, match, regex, string;\n      regex = /((^|:)(0(:|$)){2,})/g;\n      string = this.toNormalizedString();\n      bestMatchIndex = 0;\n      bestMatchLength = -1;\n      while ((match = regex.exec(string))) {\n        if (match[0].length > bestMatchLength) {\n          bestMatchIndex = match.index;\n          bestMatchLength = match[0].length;\n        }\n      }\n      if (bestMatchLength < 0) {\n        return string;\n      }\n      return string.substring(0, bestMatchIndex) + '::' + string.substring(bestMatchIndex + bestMatchLength);\n    };\n\n    IPv6.prototype.toByteArray = function() {\n      var bytes, k, len, part, ref;\n      bytes = [];\n      ref = this.parts;\n      for (k = 0, len = ref.length; k < len; k++) {\n        part = ref[k];\n        bytes.push(part >> 8);\n        bytes.push(part & 0xff);\n      }\n      return bytes;\n    };\n\n    IPv6.prototype.toNormalizedString = function() {\n      var addr, part, suffix;\n      addr = ((function() {\n        var k, len, ref, results;\n        ref = this.parts;\n        results = [];\n        for (k = 0, len = ref.length; k < len; k++) {\n          part = ref[k];\n          results.push(part.toString(16));\n        }\n        return results;\n      }).call(this)).join(\":\");\n      suffix = '';\n      if (this.zoneId) {\n        suffix = '%' + this.zoneId;\n      }\n      return addr + suffix;\n    };\n\n    IPv6.prototype.toFixedLengthString = function() {\n      var addr, part, suffix;\n      addr = ((function() {\n        var k, len, ref, results;\n        ref = this.parts;\n        results = [];\n        for (k = 0, len = ref.length; k < len; k++) {\n          part = ref[k];\n          results.push(part.toString(16).padStart(4, '0'));\n        }\n        return results;\n      }).call(this)).join(\":\");\n      suffix = '';\n      if (this.zoneId) {\n        suffix = '%' + this.zoneId;\n      }\n      return addr + suffix;\n    };\n\n    IPv6.prototype.match = function(other, cidrRange) {\n      var ref;\n      if (cidrRange === void 0) {\n        ref = other, other = ref[0], cidrRange = ref[1];\n      }\n      if (other.kind() !== 'ipv6') {\n        throw new Error(\"ipaddr: cannot match ipv6 address with non-ipv6 one\");\n      }\n      return matchCIDR(this.parts, other.parts, 16, cidrRange);\n    };\n\n    IPv6.prototype.SpecialRanges = {\n      unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],\n      linkLocal: [new IPv6([0xfe80, 0, 0, 0, 0, 0, 0, 0]), 10],\n      multicast: [new IPv6([0xff00, 0, 0, 0, 0, 0, 0, 0]), 8],\n      loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],\n      uniqueLocal: [new IPv6([0xfc00, 0, 0, 0, 0, 0, 0, 0]), 7],\n      ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 0xffff, 0, 0]), 96],\n      rfc6145: [new IPv6([0, 0, 0, 0, 0xffff, 0, 0, 0]), 96],\n      rfc6052: [new IPv6([0x64, 0xff9b, 0, 0, 0, 0, 0, 0]), 96],\n      '6to4': [new IPv6([0x2002, 0, 0, 0, 0, 0, 0, 0]), 16],\n      teredo: [new IPv6([0x2001, 0, 0, 0, 0, 0, 0, 0]), 32],\n      reserved: [[new IPv6([0x2001, 0xdb8, 0, 0, 0, 0, 0, 0]), 32]]\n    };\n\n    IPv6.prototype.range = function() {\n      return ipaddr.subnetMatch(this, this.SpecialRanges);\n    };\n\n    IPv6.prototype.isIPv4MappedAddress = function() {\n      return this.range() === 'ipv4Mapped';\n    };\n\n    IPv6.prototype.toIPv4Address = function() {\n      var high, low, ref;\n      if (!this.isIPv4MappedAddress()) {\n        throw new Error(\"ipaddr: trying to convert a generic ipv6 address to ipv4\");\n      }\n      ref = this.parts.slice(-2), high = ref[0], low = ref[1];\n      return new ipaddr.IPv4([high >> 8, high & 0xff, low >> 8, low & 0xff]);\n    };\n\n    IPv6.prototype.prefixLengthFromSubnetMask = function() {\n      var cidr, i, k, part, stop, zeros, zerotable;\n      zerotable = {\n        0: 16,\n        32768: 15,\n        49152: 14,\n        57344: 13,\n        61440: 12,\n        63488: 11,\n        64512: 10,\n        65024: 9,\n        65280: 8,\n        65408: 7,\n        65472: 6,\n        65504: 5,\n        65520: 4,\n        65528: 3,\n        65532: 2,\n        65534: 1,\n        65535: 0\n      };\n      cidr = 0;\n      stop = false;\n      for (i = k = 7; k >= 0; i = k += -1) {\n        part = this.parts[i];\n        if (part in zerotable) {\n          zeros = zerotable[part];\n          if (stop && zeros !== 0) {\n            return null;\n          }\n          if (zeros !== 16) {\n            stop = true;\n          }\n          cidr += zeros;\n        } else {\n          return null;\n        }\n      }\n      return 128 - cidr;\n    };\n\n    return IPv6;\n\n  })();\n\n  ipv6Part = \"(?:[0-9a-f]+::?)+\";\n\n  zoneIndex = \"%[0-9a-z]{1,}\";\n\n  ipv6Regexes = {\n    zoneIndex: new RegExp(zoneIndex, 'i'),\n    \"native\": new RegExp(\"^(::)?(\" + ipv6Part + \")?([0-9a-f]+)?(::)?(\" + zoneIndex + \")?$\", 'i'),\n    transitional: new RegExp((\"^((?:\" + ipv6Part + \")|(?:::)(?:\" + ipv6Part + \")?)\") + (ipv4Part + \"\\\\.\" + ipv4Part + \"\\\\.\" + ipv4Part + \"\\\\.\" + ipv4Part) + (\"(\" + zoneIndex + \")?$\"), 'i')\n  };\n\n  expandIPv6 = function(string, parts) {\n    var colonCount, lastColon, part, replacement, replacementCount, zoneId;\n    if (string.indexOf('::') !== string.lastIndexOf('::')) {\n      return null;\n    }\n    zoneId = (string.match(ipv6Regexes['zoneIndex']) || [])[0];\n    if (zoneId) {\n      zoneId = zoneId.substring(1);\n      string = string.replace(/%.+$/, '');\n    }\n    colonCount = 0;\n    lastColon = -1;\n    while ((lastColon = string.indexOf(':', lastColon + 1)) >= 0) {\n      colonCount++;\n    }\n    if (string.substr(0, 2) === '::') {\n      colonCount--;\n    }\n    if (string.substr(-2, 2) === '::') {\n      colonCount--;\n    }\n    if (colonCount > parts) {\n      return null;\n    }\n    replacementCount = parts - colonCount;\n    replacement = ':';\n    while (replacementCount--) {\n      replacement += '0:';\n    }\n    string = string.replace('::', replacement);\n    if (string[0] === ':') {\n      string = string.slice(1);\n    }\n    if (string[string.length - 1] === ':') {\n      string = string.slice(0, -1);\n    }\n    parts = (function() {\n      var k, len, ref, results;\n      ref = string.split(\":\");\n      results = [];\n      for (k = 0, len = ref.length; k < len; k++) {\n        part = ref[k];\n        results.push(parseInt(part, 16));\n      }\n      return results;\n    })();\n    return {\n      parts: parts,\n      zoneId: zoneId\n    };\n  };\n\n  ipaddr.IPv6.parser = function(string) {\n    var addr, k, len, match, octet, octets, zoneId;\n    if (ipv6Regexes['native'].test(string)) {\n      return expandIPv6(string, 8);\n    } else if (match = string.match(ipv6Regexes['transitional'])) {\n      zoneId = match[6] || '';\n      addr = expandIPv6(match[1].slice(0, -1) + zoneId, 6);\n      if (addr.parts) {\n        octets = [parseInt(match[2]), parseInt(match[3]), parseInt(match[4]), parseInt(match[5])];\n        for (k = 0, len = octets.length; k < len; k++) {\n          octet = octets[k];\n          if (!((0 <= octet && octet <= 255))) {\n            return null;\n          }\n        }\n        addr.parts.push(octets[0] << 8 | octets[1]);\n        addr.parts.push(octets[2] << 8 | octets[3]);\n        return {\n          parts: addr.parts,\n          zoneId: addr.zoneId\n        };\n      }\n    }\n    return null;\n  };\n\n  ipaddr.IPv4.isIPv4 = ipaddr.IPv6.isIPv6 = function(string) {\n    return this.parser(string) !== null;\n  };\n\n  ipaddr.IPv4.isValid = function(string) {\n    var e;\n    try {\n      new this(this.parser(string));\n      return true;\n    } catch (error1) {\n      e = error1;\n      return false;\n    }\n  };\n\n  ipaddr.IPv4.isValidFourPartDecimal = function(string) {\n    if (ipaddr.IPv4.isValid(string) && string.match(/^(0|[1-9]\\d*)(\\.(0|[1-9]\\d*)){3}$/)) {\n      return true;\n    } else {\n      return false;\n    }\n  };\n\n  ipaddr.IPv6.isValid = function(string) {\n    var addr, e;\n    if (typeof string === \"string\" && string.indexOf(\":\") === -1) {\n      return false;\n    }\n    try {\n      addr = this.parser(string);\n      new this(addr.parts, addr.zoneId);\n      return true;\n    } catch (error1) {\n      e = error1;\n      return false;\n    }\n  };\n\n  ipaddr.IPv4.parse = function(string) {\n    var parts;\n    parts = this.parser(string);\n    if (parts === null) {\n      throw new Error(\"ipaddr: string is not formatted like ip address\");\n    }\n    return new this(parts);\n  };\n\n  ipaddr.IPv6.parse = function(string) {\n    var addr;\n    addr = this.parser(string);\n    if (addr.parts === null) {\n      throw new Error(\"ipaddr: string is not formatted like ip address\");\n    }\n    return new this(addr.parts, addr.zoneId);\n  };\n\n  ipaddr.IPv4.parseCIDR = function(string) {\n    var maskLength, match, parsed;\n    if (match = string.match(/^(.+)\\/(\\d+)$/)) {\n      maskLength = parseInt(match[2]);\n      if (maskLength >= 0 && maskLength <= 32) {\n        parsed = [this.parse(match[1]), maskLength];\n        Object.defineProperty(parsed, 'toString', {\n          value: function() {\n            return this.join('/');\n          }\n        });\n        return parsed;\n      }\n    }\n    throw new Error(\"ipaddr: string is not formatted like an IPv4 CIDR range\");\n  };\n\n  ipaddr.IPv4.subnetMaskFromPrefixLength = function(prefix) {\n    var filledOctetCount, j, octets;\n    prefix = parseInt(prefix);\n    if (prefix < 0 || prefix > 32) {\n      throw new Error('ipaddr: invalid IPv4 prefix length');\n    }\n    octets = [0, 0, 0, 0];\n    j = 0;\n    filledOctetCount = Math.floor(prefix / 8);\n    while (j < filledOctetCount) {\n      octets[j] = 255;\n      j++;\n    }\n    if (filledOctetCount < 4) {\n      octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - (prefix % 8);\n    }\n    return new this(octets);\n  };\n\n  ipaddr.IPv4.broadcastAddressFromCIDR = function(string) {\n    var cidr, error, i, ipInterfaceOctets, octets, subnetMaskOctets;\n    try {\n      cidr = this.parseCIDR(string);\n      ipInterfaceOctets = cidr[0].toByteArray();\n      subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();\n      octets = [];\n      i = 0;\n      while (i < 4) {\n        octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);\n        i++;\n      }\n      return new this(octets);\n    } catch (error1) {\n      error = error1;\n      throw new Error('ipaddr: the address does not have IPv4 CIDR format');\n    }\n  };\n\n  ipaddr.IPv4.networkAddressFromCIDR = function(string) {\n    var cidr, error, i, ipInterfaceOctets, octets, subnetMaskOctets;\n    try {\n      cidr = this.parseCIDR(string);\n      ipInterfaceOctets = cidr[0].toByteArray();\n      subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();\n      octets = [];\n      i = 0;\n      while (i < 4) {\n        octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));\n        i++;\n      }\n      return new this(octets);\n    } catch (error1) {\n      error = error1;\n      throw new Error('ipaddr: the address does not have IPv4 CIDR format');\n    }\n  };\n\n  ipaddr.IPv6.parseCIDR = function(string) {\n    var maskLength, match, parsed;\n    if (match = string.match(/^(.+)\\/(\\d+)$/)) {\n      maskLength = parseInt(match[2]);\n      if (maskLength >= 0 && maskLength <= 128) {\n        parsed = [this.parse(match[1]), maskLength];\n        Object.defineProperty(parsed, 'toString', {\n          value: function() {\n            return this.join('/');\n          }\n        });\n        return parsed;\n      }\n    }\n    throw new Error(\"ipaddr: string is not formatted like an IPv6 CIDR range\");\n  };\n\n  ipaddr.isValid = function(string) {\n    return ipaddr.IPv6.isValid(string) || ipaddr.IPv4.isValid(string);\n  };\n\n  ipaddr.parse = function(string) {\n    if (ipaddr.IPv6.isValid(string)) {\n      return ipaddr.IPv6.parse(string);\n    } else if (ipaddr.IPv4.isValid(string)) {\n      return ipaddr.IPv4.parse(string);\n    } else {\n      throw new Error(\"ipaddr: the address has neither IPv6 nor IPv4 format\");\n    }\n  };\n\n  ipaddr.parseCIDR = function(string) {\n    var e;\n    try {\n      return ipaddr.IPv6.parseCIDR(string);\n    } catch (error1) {\n      e = error1;\n      try {\n        return ipaddr.IPv4.parseCIDR(string);\n      } catch (error1) {\n        e = error1;\n        throw new Error(\"ipaddr: the address has neither IPv6 nor IPv4 CIDR format\");\n      }\n    }\n  };\n\n  ipaddr.fromByteArray = function(bytes) {\n    var length;\n    length = bytes.length;\n    if (length === 4) {\n      return new ipaddr.IPv4(bytes);\n    } else if (length === 16) {\n      return new ipaddr.IPv6(bytes);\n    } else {\n      throw new Error(\"ipaddr: the binary input is neither an IPv6 nor IPv4 address\");\n    }\n  };\n\n  ipaddr.process = function(string) {\n    var addr;\n    addr = this.parse(string);\n    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {\n      return addr.toIPv4Address();\n    } else {\n      return addr;\n    }\n  };\n\n}).call(this);\n\n/* WEBPACK VAR INJECTION */}.call(this, __webpack_require__(/*! ./../../webpack/buildin/module.js */ \"./node_modules/webpack/buildin/module.js\")(module)))\n\n//# sourceURL=webpack:///./node_modules/ipaddr.js/lib/ipaddr.js?");

/***/ }),

/***/ "./node_modules/regenerator-runtime/runtime.js":
/*!*****************************************************!*\
  !*** ./node_modules/regenerator-runtime/runtime.js ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

eval("/**\n * Copyright (c) 2014-present, Facebook, Inc.\n *\n * This source code is licensed under the MIT license found in the\n * LICENSE file in the root directory of this source tree.\n */\n\nvar runtime = (function (exports) {\n  \"use strict\";\n\n  var Op = Object.prototype;\n  var hasOwn = Op.hasOwnProperty;\n  var undefined; // More compressible than void 0.\n  var $Symbol = typeof Symbol === \"function\" ? Symbol : {};\n  var iteratorSymbol = $Symbol.iterator || \"@@iterator\";\n  var asyncIteratorSymbol = $Symbol.asyncIterator || \"@@asyncIterator\";\n  var toStringTagSymbol = $Symbol.toStringTag || \"@@toStringTag\";\n\n  function wrap(innerFn, outerFn, self, tryLocsList) {\n    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.\n    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;\n    var generator = Object.create(protoGenerator.prototype);\n    var context = new Context(tryLocsList || []);\n\n    // The ._invoke method unifies the implementations of the .next,\n    // .throw, and .return methods.\n    generator._invoke = makeInvokeMethod(innerFn, self, context);\n\n    return generator;\n  }\n  exports.wrap = wrap;\n\n  // Try/catch helper to minimize deoptimizations. Returns a completion\n  // record like context.tryEntries[i].completion. This interface could\n  // have been (and was previously) designed to take a closure to be\n  // invoked without arguments, but in all the cases we care about we\n  // already have an existing method we want to call, so there's no need\n  // to create a new function object. We can even get away with assuming\n  // the method takes exactly one argument, since that happens to be true\n  // in every case, so we don't have to touch the arguments object. The\n  // only additional allocation required is the completion record, which\n  // has a stable shape and so hopefully should be cheap to allocate.\n  function tryCatch(fn, obj, arg) {\n    try {\n      return { type: \"normal\", arg: fn.call(obj, arg) };\n    } catch (err) {\n      return { type: \"throw\", arg: err };\n    }\n  }\n\n  var GenStateSuspendedStart = \"suspendedStart\";\n  var GenStateSuspendedYield = \"suspendedYield\";\n  var GenStateExecuting = \"executing\";\n  var GenStateCompleted = \"completed\";\n\n  // Returning this object from the innerFn has the same effect as\n  // breaking out of the dispatch switch statement.\n  var ContinueSentinel = {};\n\n  // Dummy constructor functions that we use as the .constructor and\n  // .constructor.prototype properties for functions that return Generator\n  // objects. For full spec compliance, you may wish to configure your\n  // minifier not to mangle the names of these two functions.\n  function Generator() {}\n  function GeneratorFunction() {}\n  function GeneratorFunctionPrototype() {}\n\n  // This is a polyfill for %IteratorPrototype% for environments that\n  // don't natively support it.\n  var IteratorPrototype = {};\n  IteratorPrototype[iteratorSymbol] = function () {\n    return this;\n  };\n\n  var getProto = Object.getPrototypeOf;\n  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));\n  if (NativeIteratorPrototype &&\n      NativeIteratorPrototype !== Op &&\n      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {\n    // This environment has a native %IteratorPrototype%; use it instead\n    // of the polyfill.\n    IteratorPrototype = NativeIteratorPrototype;\n  }\n\n  function ensureDefaultToStringTag(object, defaultValue) {\n    // https://bugzilla.mozilla.org/show_bug.cgi?id=1644581#c6\n    return toStringTagSymbol in object\n      ? object[toStringTagSymbol]\n      : object[toStringTagSymbol] = defaultValue;\n  }\n\n  var Gp = GeneratorFunctionPrototype.prototype =\n    Generator.prototype = Object.create(IteratorPrototype);\n  GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;\n  GeneratorFunctionPrototype.constructor = GeneratorFunction;\n  GeneratorFunction.displayName = ensureDefaultToStringTag(\n    GeneratorFunctionPrototype,\n    \"GeneratorFunction\"\n  );\n\n  // Helper for defining the .next, .throw, and .return methods of the\n  // Iterator interface in terms of a single ._invoke method.\n  function defineIteratorMethods(prototype) {\n    [\"next\", \"throw\", \"return\"].forEach(function(method) {\n      prototype[method] = function(arg) {\n        return this._invoke(method, arg);\n      };\n    });\n  }\n\n  exports.isGeneratorFunction = function(genFun) {\n    var ctor = typeof genFun === \"function\" && genFun.constructor;\n    return ctor\n      ? ctor === GeneratorFunction ||\n        // For the native GeneratorFunction constructor, the best we can\n        // do is to check its .name property.\n        (ctor.displayName || ctor.name) === \"GeneratorFunction\"\n      : false;\n  };\n\n  exports.mark = function(genFun) {\n    if (Object.setPrototypeOf) {\n      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);\n    } else {\n      genFun.__proto__ = GeneratorFunctionPrototype;\n      ensureDefaultToStringTag(genFun, \"GeneratorFunction\");\n    }\n    genFun.prototype = Object.create(Gp);\n    return genFun;\n  };\n\n  // Within the body of any async function, `await x` is transformed to\n  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test\n  // `hasOwn.call(value, \"__await\")` to determine if the yielded value is\n  // meant to be awaited.\n  exports.awrap = function(arg) {\n    return { __await: arg };\n  };\n\n  function AsyncIterator(generator, PromiseImpl) {\n    function invoke(method, arg, resolve, reject) {\n      var record = tryCatch(generator[method], generator, arg);\n      if (record.type === \"throw\") {\n        reject(record.arg);\n      } else {\n        var result = record.arg;\n        var value = result.value;\n        if (value &&\n            typeof value === \"object\" &&\n            hasOwn.call(value, \"__await\")) {\n          return PromiseImpl.resolve(value.__await).then(function(value) {\n            invoke(\"next\", value, resolve, reject);\n          }, function(err) {\n            invoke(\"throw\", err, resolve, reject);\n          });\n        }\n\n        return PromiseImpl.resolve(value).then(function(unwrapped) {\n          // When a yielded Promise is resolved, its final value becomes\n          // the .value of the Promise<{value,done}> result for the\n          // current iteration.\n          result.value = unwrapped;\n          resolve(result);\n        }, function(error) {\n          // If a rejected Promise was yielded, throw the rejection back\n          // into the async generator function so it can be handled there.\n          return invoke(\"throw\", error, resolve, reject);\n        });\n      }\n    }\n\n    var previousPromise;\n\n    function enqueue(method, arg) {\n      function callInvokeWithMethodAndArg() {\n        return new PromiseImpl(function(resolve, reject) {\n          invoke(method, arg, resolve, reject);\n        });\n      }\n\n      return previousPromise =\n        // If enqueue has been called before, then we want to wait until\n        // all previous Promises have been resolved before calling invoke,\n        // so that results are always delivered in the correct order. If\n        // enqueue has not been called before, then it is important to\n        // call invoke immediately, without waiting on a callback to fire,\n        // so that the async generator function has the opportunity to do\n        // any necessary setup in a predictable way. This predictability\n        // is why the Promise constructor synchronously invokes its\n        // executor callback, and why async functions synchronously\n        // execute code before the first await. Since we implement simple\n        // async functions in terms of async generators, it is especially\n        // important to get this right, even though it requires care.\n        previousPromise ? previousPromise.then(\n          callInvokeWithMethodAndArg,\n          // Avoid propagating failures to Promises returned by later\n          // invocations of the iterator.\n          callInvokeWithMethodAndArg\n        ) : callInvokeWithMethodAndArg();\n    }\n\n    // Define the unified helper method that is used to implement .next,\n    // .throw, and .return (see defineIteratorMethods).\n    this._invoke = enqueue;\n  }\n\n  defineIteratorMethods(AsyncIterator.prototype);\n  AsyncIterator.prototype[asyncIteratorSymbol] = function () {\n    return this;\n  };\n  exports.AsyncIterator = AsyncIterator;\n\n  // Note that simple async functions are implemented on top of\n  // AsyncIterator objects; they just return a Promise for the value of\n  // the final result produced by the iterator.\n  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {\n    if (PromiseImpl === void 0) PromiseImpl = Promise;\n\n    var iter = new AsyncIterator(\n      wrap(innerFn, outerFn, self, tryLocsList),\n      PromiseImpl\n    );\n\n    return exports.isGeneratorFunction(outerFn)\n      ? iter // If outerFn is a generator, return the full iterator.\n      : iter.next().then(function(result) {\n          return result.done ? result.value : iter.next();\n        });\n  };\n\n  function makeInvokeMethod(innerFn, self, context) {\n    var state = GenStateSuspendedStart;\n\n    return function invoke(method, arg) {\n      if (state === GenStateExecuting) {\n        throw new Error(\"Generator is already running\");\n      }\n\n      if (state === GenStateCompleted) {\n        if (method === \"throw\") {\n          throw arg;\n        }\n\n        // Be forgiving, per 25.3.3.3.3 of the spec:\n        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume\n        return doneResult();\n      }\n\n      context.method = method;\n      context.arg = arg;\n\n      while (true) {\n        var delegate = context.delegate;\n        if (delegate) {\n          var delegateResult = maybeInvokeDelegate(delegate, context);\n          if (delegateResult) {\n            if (delegateResult === ContinueSentinel) continue;\n            return delegateResult;\n          }\n        }\n\n        if (context.method === \"next\") {\n          // Setting context._sent for legacy support of Babel's\n          // function.sent implementation.\n          context.sent = context._sent = context.arg;\n\n        } else if (context.method === \"throw\") {\n          if (state === GenStateSuspendedStart) {\n            state = GenStateCompleted;\n            throw context.arg;\n          }\n\n          context.dispatchException(context.arg);\n\n        } else if (context.method === \"return\") {\n          context.abrupt(\"return\", context.arg);\n        }\n\n        state = GenStateExecuting;\n\n        var record = tryCatch(innerFn, self, context);\n        if (record.type === \"normal\") {\n          // If an exception is thrown from innerFn, we leave state ===\n          // GenStateExecuting and loop back for another invocation.\n          state = context.done\n            ? GenStateCompleted\n            : GenStateSuspendedYield;\n\n          if (record.arg === ContinueSentinel) {\n            continue;\n          }\n\n          return {\n            value: record.arg,\n            done: context.done\n          };\n\n        } else if (record.type === \"throw\") {\n          state = GenStateCompleted;\n          // Dispatch the exception by looping back around to the\n          // context.dispatchException(context.arg) call above.\n          context.method = \"throw\";\n          context.arg = record.arg;\n        }\n      }\n    };\n  }\n\n  // Call delegate.iterator[context.method](context.arg) and handle the\n  // result, either by returning a { value, done } result from the\n  // delegate iterator, or by modifying context.method and context.arg,\n  // setting context.delegate to null, and returning the ContinueSentinel.\n  function maybeInvokeDelegate(delegate, context) {\n    var method = delegate.iterator[context.method];\n    if (method === undefined) {\n      // A .throw or .return when the delegate iterator has no .throw\n      // method always terminates the yield* loop.\n      context.delegate = null;\n\n      if (context.method === \"throw\") {\n        // Note: [\"return\"] must be used for ES3 parsing compatibility.\n        if (delegate.iterator[\"return\"]) {\n          // If the delegate iterator has a return method, give it a\n          // chance to clean up.\n          context.method = \"return\";\n          context.arg = undefined;\n          maybeInvokeDelegate(delegate, context);\n\n          if (context.method === \"throw\") {\n            // If maybeInvokeDelegate(context) changed context.method from\n            // \"return\" to \"throw\", let that override the TypeError below.\n            return ContinueSentinel;\n          }\n        }\n\n        context.method = \"throw\";\n        context.arg = new TypeError(\n          \"The iterator does not provide a 'throw' method\");\n      }\n\n      return ContinueSentinel;\n    }\n\n    var record = tryCatch(method, delegate.iterator, context.arg);\n\n    if (record.type === \"throw\") {\n      context.method = \"throw\";\n      context.arg = record.arg;\n      context.delegate = null;\n      return ContinueSentinel;\n    }\n\n    var info = record.arg;\n\n    if (! info) {\n      context.method = \"throw\";\n      context.arg = new TypeError(\"iterator result is not an object\");\n      context.delegate = null;\n      return ContinueSentinel;\n    }\n\n    if (info.done) {\n      // Assign the result of the finished delegate to the temporary\n      // variable specified by delegate.resultName (see delegateYield).\n      context[delegate.resultName] = info.value;\n\n      // Resume execution at the desired location (see delegateYield).\n      context.next = delegate.nextLoc;\n\n      // If context.method was \"throw\" but the delegate handled the\n      // exception, let the outer generator proceed normally. If\n      // context.method was \"next\", forget context.arg since it has been\n      // \"consumed\" by the delegate iterator. If context.method was\n      // \"return\", allow the original .return call to continue in the\n      // outer generator.\n      if (context.method !== \"return\") {\n        context.method = \"next\";\n        context.arg = undefined;\n      }\n\n    } else {\n      // Re-yield the result returned by the delegate method.\n      return info;\n    }\n\n    // The delegate iterator is finished, so forget it and continue with\n    // the outer generator.\n    context.delegate = null;\n    return ContinueSentinel;\n  }\n\n  // Define Generator.prototype.{next,throw,return} in terms of the\n  // unified ._invoke helper method.\n  defineIteratorMethods(Gp);\n\n  ensureDefaultToStringTag(Gp, \"Generator\");\n\n  // A Generator should always return itself as the iterator object when the\n  // @@iterator function is called on it. Some browsers' implementations of the\n  // iterator prototype chain incorrectly implement this, causing the Generator\n  // object to not be returned from this call. This ensures that doesn't happen.\n  // See https://github.com/facebook/regenerator/issues/274 for more details.\n  Gp[iteratorSymbol] = function() {\n    return this;\n  };\n\n  Gp.toString = function() {\n    return \"[object Generator]\";\n  };\n\n  function pushTryEntry(locs) {\n    var entry = { tryLoc: locs[0] };\n\n    if (1 in locs) {\n      entry.catchLoc = locs[1];\n    }\n\n    if (2 in locs) {\n      entry.finallyLoc = locs[2];\n      entry.afterLoc = locs[3];\n    }\n\n    this.tryEntries.push(entry);\n  }\n\n  function resetTryEntry(entry) {\n    var record = entry.completion || {};\n    record.type = \"normal\";\n    delete record.arg;\n    entry.completion = record;\n  }\n\n  function Context(tryLocsList) {\n    // The root entry object (effectively a try statement without a catch\n    // or a finally block) gives us a place to store values thrown from\n    // locations where there is no enclosing try statement.\n    this.tryEntries = [{ tryLoc: \"root\" }];\n    tryLocsList.forEach(pushTryEntry, this);\n    this.reset(true);\n  }\n\n  exports.keys = function(object) {\n    var keys = [];\n    for (var key in object) {\n      keys.push(key);\n    }\n    keys.reverse();\n\n    // Rather than returning an object with a next method, we keep\n    // things simple and return the next function itself.\n    return function next() {\n      while (keys.length) {\n        var key = keys.pop();\n        if (key in object) {\n          next.value = key;\n          next.done = false;\n          return next;\n        }\n      }\n\n      // To avoid creating an additional object, we just hang the .value\n      // and .done properties off the next function object itself. This\n      // also ensures that the minifier will not anonymize the function.\n      next.done = true;\n      return next;\n    };\n  };\n\n  function values(iterable) {\n    if (iterable) {\n      var iteratorMethod = iterable[iteratorSymbol];\n      if (iteratorMethod) {\n        return iteratorMethod.call(iterable);\n      }\n\n      if (typeof iterable.next === \"function\") {\n        return iterable;\n      }\n\n      if (!isNaN(iterable.length)) {\n        var i = -1, next = function next() {\n          while (++i < iterable.length) {\n            if (hasOwn.call(iterable, i)) {\n              next.value = iterable[i];\n              next.done = false;\n              return next;\n            }\n          }\n\n          next.value = undefined;\n          next.done = true;\n\n          return next;\n        };\n\n        return next.next = next;\n      }\n    }\n\n    // Return an iterator with no values.\n    return { next: doneResult };\n  }\n  exports.values = values;\n\n  function doneResult() {\n    return { value: undefined, done: true };\n  }\n\n  Context.prototype = {\n    constructor: Context,\n\n    reset: function(skipTempReset) {\n      this.prev = 0;\n      this.next = 0;\n      // Resetting context._sent for legacy support of Babel's\n      // function.sent implementation.\n      this.sent = this._sent = undefined;\n      this.done = false;\n      this.delegate = null;\n\n      this.method = \"next\";\n      this.arg = undefined;\n\n      this.tryEntries.forEach(resetTryEntry);\n\n      if (!skipTempReset) {\n        for (var name in this) {\n          // Not sure about the optimal order of these conditions:\n          if (name.charAt(0) === \"t\" &&\n              hasOwn.call(this, name) &&\n              !isNaN(+name.slice(1))) {\n            this[name] = undefined;\n          }\n        }\n      }\n    },\n\n    stop: function() {\n      this.done = true;\n\n      var rootEntry = this.tryEntries[0];\n      var rootRecord = rootEntry.completion;\n      if (rootRecord.type === \"throw\") {\n        throw rootRecord.arg;\n      }\n\n      return this.rval;\n    },\n\n    dispatchException: function(exception) {\n      if (this.done) {\n        throw exception;\n      }\n\n      var context = this;\n      function handle(loc, caught) {\n        record.type = \"throw\";\n        record.arg = exception;\n        context.next = loc;\n\n        if (caught) {\n          // If the dispatched exception was caught by a catch block,\n          // then let that catch block handle the exception normally.\n          context.method = \"next\";\n          context.arg = undefined;\n        }\n\n        return !! caught;\n      }\n\n      for (var i = this.tryEntries.length - 1; i >= 0; --i) {\n        var entry = this.tryEntries[i];\n        var record = entry.completion;\n\n        if (entry.tryLoc === \"root\") {\n          // Exception thrown outside of any try block that could handle\n          // it, so set the completion value of the entire function to\n          // throw the exception.\n          return handle(\"end\");\n        }\n\n        if (entry.tryLoc <= this.prev) {\n          var hasCatch = hasOwn.call(entry, \"catchLoc\");\n          var hasFinally = hasOwn.call(entry, \"finallyLoc\");\n\n          if (hasCatch && hasFinally) {\n            if (this.prev < entry.catchLoc) {\n              return handle(entry.catchLoc, true);\n            } else if (this.prev < entry.finallyLoc) {\n              return handle(entry.finallyLoc);\n            }\n\n          } else if (hasCatch) {\n            if (this.prev < entry.catchLoc) {\n              return handle(entry.catchLoc, true);\n            }\n\n          } else if (hasFinally) {\n            if (this.prev < entry.finallyLoc) {\n              return handle(entry.finallyLoc);\n            }\n\n          } else {\n            throw new Error(\"try statement without catch or finally\");\n          }\n        }\n      }\n    },\n\n    abrupt: function(type, arg) {\n      for (var i = this.tryEntries.length - 1; i >= 0; --i) {\n        var entry = this.tryEntries[i];\n        if (entry.tryLoc <= this.prev &&\n            hasOwn.call(entry, \"finallyLoc\") &&\n            this.prev < entry.finallyLoc) {\n          var finallyEntry = entry;\n          break;\n        }\n      }\n\n      if (finallyEntry &&\n          (type === \"break\" ||\n           type === \"continue\") &&\n          finallyEntry.tryLoc <= arg &&\n          arg <= finallyEntry.finallyLoc) {\n        // Ignore the finally entry if control is not jumping to a\n        // location outside the try/catch block.\n        finallyEntry = null;\n      }\n\n      var record = finallyEntry ? finallyEntry.completion : {};\n      record.type = type;\n      record.arg = arg;\n\n      if (finallyEntry) {\n        this.method = \"next\";\n        this.next = finallyEntry.finallyLoc;\n        return ContinueSentinel;\n      }\n\n      return this.complete(record);\n    },\n\n    complete: function(record, afterLoc) {\n      if (record.type === \"throw\") {\n        throw record.arg;\n      }\n\n      if (record.type === \"break\" ||\n          record.type === \"continue\") {\n        this.next = record.arg;\n      } else if (record.type === \"return\") {\n        this.rval = this.arg = record.arg;\n        this.method = \"return\";\n        this.next = \"end\";\n      } else if (record.type === \"normal\" && afterLoc) {\n        this.next = afterLoc;\n      }\n\n      return ContinueSentinel;\n    },\n\n    finish: function(finallyLoc) {\n      for (var i = this.tryEntries.length - 1; i >= 0; --i) {\n        var entry = this.tryEntries[i];\n        if (entry.finallyLoc === finallyLoc) {\n          this.complete(entry.completion, entry.afterLoc);\n          resetTryEntry(entry);\n          return ContinueSentinel;\n        }\n      }\n    },\n\n    \"catch\": function(tryLoc) {\n      for (var i = this.tryEntries.length - 1; i >= 0; --i) {\n        var entry = this.tryEntries[i];\n        if (entry.tryLoc === tryLoc) {\n          var record = entry.completion;\n          if (record.type === \"throw\") {\n            var thrown = record.arg;\n            resetTryEntry(entry);\n          }\n          return thrown;\n        }\n      }\n\n      // The context.catch method must only be called with a location\n      // argument that corresponds to a known catch block.\n      throw new Error(\"illegal catch attempt\");\n    },\n\n    delegateYield: function(iterable, resultName, nextLoc) {\n      this.delegate = {\n        iterator: values(iterable),\n        resultName: resultName,\n        nextLoc: nextLoc\n      };\n\n      if (this.method === \"next\") {\n        // Deliberately forget the last sent value so that we don't\n        // accidentally pass it on to the delegate.\n        this.arg = undefined;\n      }\n\n      return ContinueSentinel;\n    }\n  };\n\n  // Regardless of whether this script is executing as a CommonJS module\n  // or not, return the runtime object so that we can declare the variable\n  // regeneratorRuntime in the outer scope, which allows this module to be\n  // injected easily by `bin/regenerator --include-runtime script.js`.\n  return exports;\n\n}(\n  // If this script is executing as a CommonJS module, use module.exports\n  // as the regeneratorRuntime namespace. Otherwise create a new empty\n  // object. Either way, the resulting object will be used to initialize\n  // the regeneratorRuntime variable at the top of this file.\n   true ? module.exports : undefined\n));\n\ntry {\n  regeneratorRuntime = runtime;\n} catch (accidentalStrictMode) {\n  // This module should not be running in strict mode, so the above\n  // assignment should always work unless something is misconfigured. Just\n  // in case runtime.js accidentally runs in strict mode, we can escape\n  // strict mode using a global Function call. This could conceivably fail\n  // if a Content Security Policy forbids using Function, but in that case\n  // the proper solution is to fix the accidental strict mode problem. If\n  // you've misconfigured your bundler to force strict mode and applied a\n  // CSP to forbid Function, and you're not willing to fix either of those\n  // problems, please detail your unique predicament in a GitHub issue.\n  Function(\"r\", \"regeneratorRuntime = r\")(runtime);\n}\n\n\n//# sourceURL=webpack:///./node_modules/regenerator-runtime/runtime.js?");

/***/ }),

/***/ "./node_modules/webpack/buildin/module.js":
/*!***********************************!*\
  !*** (webpack)/buildin/module.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("module.exports = function(module) {\n\tif (!module.webpackPolyfill) {\n\t\tmodule.deprecate = function() {};\n\t\tmodule.paths = [];\n\t\t// module.parent = undefined by default\n\t\tif (!module.children) module.children = [];\n\t\tObject.defineProperty(module, \"loaded\", {\n\t\t\tenumerable: true,\n\t\t\tget: function() {\n\t\t\t\treturn module.l;\n\t\t\t}\n\t\t});\n\t\tObject.defineProperty(module, \"id\", {\n\t\t\tenumerable: true,\n\t\t\tget: function() {\n\t\t\t\treturn module.i;\n\t\t\t}\n\t\t});\n\t\tmodule.webpackPolyfill = 1;\n\t}\n\treturn module;\n};\n\n\n//# sourceURL=webpack:///(webpack)/buildin/module.js?");

/***/ }),

/***/ "./src/chrome/js/background.js":
/*!*************************************!*\
  !*** ./src/chrome/js/background.js ***!
  \*************************************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_helpers_slicedToArray__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/slicedToArray */ \"./node_modules/@babel/runtime/helpers/slicedToArray.js\");\n/* harmony import */ var _babel_runtime_helpers_slicedToArray__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_slicedToArray__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/regenerator */ \"./node_modules/@babel/runtime/regenerator/index.js\");\n/* harmony import */ var _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime/helpers/asyncToGenerator */ \"./node_modules/@babel/runtime/helpers/asyncToGenerator.js\");\n/* harmony import */ var _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./core */ \"./src/chrome/js/core/index.js\");\n\n\n\n\nvar REQUEST_FILTERS = {\n  urls: ['http://*/*', 'https://*/*'],\n  types: ['main_frame']\n};\nwindow.censortracker = {\n  proxies: _core__WEBPACK_IMPORTED_MODULE_3__[\"proxies\"],\n  registry: _core__WEBPACK_IMPORTED_MODULE_3__[\"registry\"],\n  sessions: _core__WEBPACK_IMPORTED_MODULE_3__[\"sessions\"],\n  settings: _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"],\n  shortcuts: _core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"],\n  errors: _core__WEBPACK_IMPORTED_MODULE_3__[\"errors\"],\n  asynchrome: _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"]\n};\n\nvar onBeforeRequest = function onBeforeRequest(_ref) {\n  var url = _ref.url;\n\n  if (_core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"].isSpecialPurposeIP(url)) {\n    console.warn('Ignoring special propose IP/Host...');\n    return null;\n  }\n\n  console.log('Redirecting request to HTTPS...');\n  return {\n    redirectUrl: _core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"].enforceHttps(url)\n  };\n};\n\nvar onBeforeRedirect = /*#__PURE__*/function () {\n  var _ref3 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee(_ref2) {\n    var requestId, url, _URL, hostname, redirectCountKey, count, _yield$asynchrome$sto, ignoredSites;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee$(_context) {\n      while (1) {\n        switch (_context.prev = _context.next) {\n          case 0:\n            requestId = _ref2.requestId, url = _ref2.url;\n            _URL = new URL(url), hostname = _URL.hostname;\n            redirectCountKey = 'redirectCount';\n            count = _core__WEBPACK_IMPORTED_MODULE_3__[\"sessions\"].getRequest(requestId, redirectCountKey, 0);\n\n            if (count) {\n              _core__WEBPACK_IMPORTED_MODULE_3__[\"sessions\"].putRequest(requestId, redirectCountKey, count + 1);\n            } else {\n              _core__WEBPACK_IMPORTED_MODULE_3__[\"sessions\"].putRequest(requestId, redirectCountKey, 1);\n            }\n\n            if (!_core__WEBPACK_IMPORTED_MODULE_3__[\"sessions\"].areMaxRedirectsReached(count)) {\n              _context.next = 22;\n              break;\n            }\n\n            if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n              chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n            }\n\n            _context.next = 9;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.get({\n              ignoredSites: []\n            });\n\n          case 9:\n            _yield$asynchrome$sto = _context.sent;\n            ignoredSites = _yield$asynchrome$sto.ignoredSites;\n\n            if (ignoredSites.includes(hostname)) {\n              _context.next = 22;\n              break;\n            }\n\n            _context.prev = 12;\n            ignoredSites.push(hostname);\n            _context.next = 16;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.set({\n              ignoredSites: ignoredSites\n            });\n\n          case 16:\n            console.warn(\"Reached max count of redirects: ignoring \\\"\".concat(hostname, \"\\\"...\"));\n            _context.next = 22;\n            break;\n\n          case 19:\n            _context.prev = 19;\n            _context.t0 = _context[\"catch\"](12);\n            console.error(_context.t0);\n\n          case 22:\n          case \"end\":\n            return _context.stop();\n        }\n      }\n    }, _callee, null, [[12, 19]]);\n  }));\n\n  return function onBeforeRedirect(_x) {\n    return _ref3.apply(this, arguments);\n  };\n}();\n\nvar onErrorOccurred = /*#__PURE__*/function () {\n  var _ref5 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee2(_ref4) {\n    var url, error, tabId, errorText, _URL2, hostname, encodedUrl, _yield$asynchrome$sto2, ignoredSites, enableExtension;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee2$(_context2) {\n      while (1) {\n        switch (_context2.prev = _context2.next) {\n          case 0:\n            url = _ref4.url, error = _ref4.error, tabId = _ref4.tabId;\n            errorText = error.replace('net::', '');\n            _URL2 = new URL(url), hostname = _URL2.hostname;\n            encodedUrl = window.btoa(url);\n            _context2.next = 6;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.get({\n              ignoredSites: [],\n              enableExtension: true\n            });\n\n          case 6:\n            _yield$asynchrome$sto2 = _context2.sent;\n            ignoredSites = _yield$asynchrome$sto2.ignoredSites;\n            enableExtension = _yield$asynchrome$sto2.enableExtension;\n\n            if (enableExtension) {\n              _context2.next = 11;\n              break;\n            }\n\n            return _context2.abrupt(\"return\");\n\n          case 11:\n            if (!_core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"].isSpecialPurposeIP(url)) {\n              _context2.next = 13;\n              break;\n            }\n\n            return _context2.abrupt(\"return\");\n\n          case 13:\n            if (_core__WEBPACK_IMPORTED_MODULE_3__[\"errors\"].isThereProxyConnectionError(errorText)) {\n              chrome.tabs.update(tabId, {\n                url: chrome.runtime.getURL('proxy_unavailable.html')\n              });\n            }\n\n            if (_core__WEBPACK_IMPORTED_MODULE_3__[\"errors\"].isThereConnectionError(errorText)) {\n              console.warn('Possible DPI lock detected: reporting domain...');\n              _core__WEBPACK_IMPORTED_MODULE_3__[\"registry\"].addBlockedByDPI(hostname);\n              _core__WEBPACK_IMPORTED_MODULE_3__[\"proxies\"].setProxy();\n              chrome.tabs.update(tabId, {\n                url: chrome.runtime.getURL(\"unavailable.html?\".concat(encodedUrl))\n              });\n            }\n\n            if (!(_core__WEBPACK_IMPORTED_MODULE_3__[\"errors\"].isThereCertificateError(errorText) || _core__WEBPACK_IMPORTED_MODULE_3__[\"errors\"].isThereAvailabilityError(errorText))) {\n              _context2.next = 23;\n              break;\n            }\n\n            if (ignoredSites.includes(hostname)) {\n              _context2.next = 21;\n              break;\n            }\n\n            ignoredSites.push(hostname);\n            _context2.next = 20;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.set({\n              ignoredSites: ignoredSites\n            });\n\n          case 20:\n            console.warn(\"Certificate validation issue: ignoring \".concat(hostname, \"...\"));\n\n          case 21:\n            if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n              chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n            }\n\n            chrome.tabs.update({\n              url: url.replace('https:', 'http:')\n            });\n\n          case 23:\n          case \"end\":\n            return _context2.stop();\n        }\n      }\n    }, _callee2);\n  }));\n\n  return function onErrorOccurred(_x2) {\n    return _ref5.apply(this, arguments);\n  };\n}();\n\nvar onCompleted = function onCompleted(_ref6) {\n  var requestId = _ref6.requestId;\n  _core__WEBPACK_IMPORTED_MODULE_3__[\"sessions\"].deleteRequest(requestId);\n\n  if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);\n  }\n};\n\nvar notificationOnButtonClicked = /*#__PURE__*/function () {\n  var _ref7 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee3(notificationId, buttonIndex) {\n    var _yield$asynchrome$tab, _yield$asynchrome$tab2, tab, urlObject, hostname, _yield$asynchrome$sto3, mutedForever;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee3$(_context3) {\n      while (1) {\n        switch (_context3.prev = _context3.next) {\n          case 0:\n            if (!(buttonIndex === 0)) {\n              _context3.next = 23;\n              break;\n            }\n\n            _context3.next = 3;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].tabs.query({\n              active: true,\n              lastFocusedWindow: true\n            });\n\n          case 3:\n            _yield$asynchrome$tab = _context3.sent;\n            _yield$asynchrome$tab2 = _babel_runtime_helpers_slicedToArray__WEBPACK_IMPORTED_MODULE_0___default()(_yield$asynchrome$tab, 1);\n            tab = _yield$asynchrome$tab2[0];\n            urlObject = new URL(tab.url);\n            hostname = urlObject.hostname;\n            _context3.next = 10;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.get({\n              mutedForever: []\n            });\n\n          case 10:\n            _yield$asynchrome$sto3 = _context3.sent;\n            mutedForever = _yield$asynchrome$sto3.mutedForever;\n\n            if (mutedForever.find(function (item) {\n              return item === hostname;\n            })) {\n              _context3.next = 23;\n              break;\n            }\n\n            mutedForever.push(hostname);\n            _context3.prev = 14;\n            _context3.next = 17;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.set({\n              mutedForever: mutedForever\n            });\n\n          case 17:\n            console.warn(\"We won't notify you about \".concat(hostname, \" anymore\"));\n            _context3.next = 23;\n            break;\n\n          case 20:\n            _context3.prev = 20;\n            _context3.t0 = _context3[\"catch\"](14);\n            console.error(_context3.t0);\n\n          case 23:\n          case \"end\":\n            return _context3.stop();\n        }\n      }\n    }, _callee3, null, [[14, 20]]);\n  }));\n\n  return function notificationOnButtonClicked(_x3, _x4) {\n    return _ref7.apply(this, arguments);\n  };\n}();\n\nvar updateTabState = /*#__PURE__*/function () {\n  var _ref8 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee4() {\n    var _yield$asynchrome$tab3, _yield$asynchrome$tab4, tab, _yield$asynchrome$sto4, enableExtension, ignoredSites, urlObject, currentHostname, _yield$registry$domai, domainFound, _yield$registry$distr, distributorUrl, cooperationRefused;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee4$(_context4) {\n      while (1) {\n        switch (_context4.prev = _context4.next) {\n          case 0:\n            _context4.next = 2;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].tabs.query({\n              active: true,\n              lastFocusedWindow: true\n            });\n\n          case 2:\n            _yield$asynchrome$tab3 = _context4.sent;\n            _yield$asynchrome$tab4 = _babel_runtime_helpers_slicedToArray__WEBPACK_IMPORTED_MODULE_0___default()(_yield$asynchrome$tab3, 1);\n            tab = _yield$asynchrome$tab4[0];\n\n            if (!(!tab || !_core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"].validURL(tab.url) || _core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"].isSpecialPurposeIP(tab.url))) {\n              _context4.next = 7;\n              break;\n            }\n\n            return _context4.abrupt(\"return\");\n\n          case 7:\n            _context4.next = 9;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.get({\n              enableExtension: true,\n              ignoredSites: []\n            });\n\n          case 9:\n            _yield$asynchrome$sto4 = _context4.sent;\n            enableExtension = _yield$asynchrome$sto4.enableExtension;\n            ignoredSites = _yield$asynchrome$sto4.ignoredSites;\n\n            if (enableExtension) {\n              _context4.next = 16;\n              break;\n            }\n\n            _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].setDisableIcon(tab.id);\n\n            if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n              chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n            }\n\n            return _context4.abrupt(\"return\");\n\n          case 16:\n            urlObject = new URL(tab.url);\n            currentHostname = _core__WEBPACK_IMPORTED_MODULE_3__[\"shortcuts\"].cleanHostname(urlObject.hostname);\n\n            if (!ignoredSites.includes(currentHostname)) {\n              _context4.next = 21;\n              break;\n            }\n\n            console.warn(\"Site \".concat(currentHostname, \" found in ignore\"));\n            return _context4.abrupt(\"return\");\n\n          case 21:\n            if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n              chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);\n            }\n\n            _context4.next = 24;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"registry\"].domainsContains(currentHostname);\n\n          case 24:\n            _yield$registry$domai = _context4.sent;\n            domainFound = _yield$registry$domai.domainFound;\n            _context4.next = 28;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"registry\"].distributorsContains(currentHostname);\n\n          case 28:\n            _yield$registry$distr = _context4.sent;\n            distributorUrl = _yield$registry$distr.url;\n            cooperationRefused = _yield$registry$distr.cooperationRefused;\n\n            if (!domainFound) {\n              _context4.next = 34;\n              break;\n            }\n\n            _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].setDangerIcon(tab.id);\n            return _context4.abrupt(\"return\");\n\n          case 34:\n            if (!distributorUrl) {\n              _context4.next = 39;\n              break;\n            }\n\n            _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].setDangerIcon(tab.id);\n\n            if (cooperationRefused) {\n              _context4.next = 39;\n              break;\n            }\n\n            _context4.next = 39;\n            return showCooperationAcceptedWarning(currentHostname);\n\n          case 39:\n          case \"end\":\n            return _context4.stop();\n        }\n      }\n    }, _callee4);\n  }));\n\n  return function updateTabState() {\n    return _ref8.apply(this, arguments);\n  };\n}();\n\nvar showCooperationAcceptedWarning = /*#__PURE__*/function () {\n  var _ref9 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee5(hostname) {\n    var _yield$asynchrome$sto5, notifiedHosts, mutedForever;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee5$(_context5) {\n      while (1) {\n        switch (_context5.prev = _context5.next) {\n          case 0:\n            if (hostname) {\n              _context5.next = 2;\n              break;\n            }\n\n            return _context5.abrupt(\"return\");\n\n          case 2:\n            _context5.next = 4;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.get({\n              notifiedHosts: [],\n              mutedForever: []\n            });\n\n          case 4:\n            _yield$asynchrome$sto5 = _context5.sent;\n            notifiedHosts = _yield$asynchrome$sto5.notifiedHosts;\n            mutedForever = _yield$asynchrome$sto5.mutedForever;\n\n            if (!mutedForever.includes(hostname)) {\n              _context5.next = 9;\n              break;\n            }\n\n            return _context5.abrupt(\"return\");\n\n          case 9:\n            if (notifiedHosts.includes(hostname)) {\n              _context5.next = 21;\n              break;\n            }\n\n            _context5.next = 12;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].notifications.create({\n              type: 'basic',\n              title: _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].getName(),\n              priority: 2,\n              message: \"\".concat(hostname, \" \\u043C\\u043E\\u0436\\u0435\\u0442 \\u043F\\u0435\\u0440\\u0435\\u0434\\u0430\\u0432\\u0430\\u0442\\u044C \\u0438\\u043D\\u0444\\u043E\\u0440\\u043C\\u0430\\u0446\\u0438\\u044E \\u0442\\u0440\\u0435\\u0442\\u044C\\u0438\\u043C \\u043B\\u0438\\u0446\\u0430\\u043C.\"),\n              buttons: [{\n                title: \"\\u2715 \\u041D\\u0435 \\u043F\\u043E\\u043A\\u0430\\u0437\\u044B\\u0432\\u0430\\u0442\\u044C \\u0434\\u043B\\u044F \\u044D\\u0442\\u043E\\u0433\\u043E \\u0441\\u0430\\u0439\\u0442\\u0430\"\n              }, {\n                title: \"\\u2192 \\u041F\\u043E\\u0434\\u0440\\u043E\\u0431\\u043D\\u0435\\u0435\"\n              }],\n              iconUrl: _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].getDangerIcon()\n            });\n\n          case 12:\n            _context5.prev = 12;\n            notifiedHosts.push(hostname);\n            _context5.next = 16;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.set({\n              notifiedHosts: notifiedHosts\n            });\n\n          case 16:\n            _context5.next = 21;\n            break;\n\n          case 18:\n            _context5.prev = 18;\n            _context5.t0 = _context5[\"catch\"](12);\n            console.error(_context5.t0);\n\n          case 21:\n          case \"end\":\n            return _context5.stop();\n        }\n      }\n    }, _callee5, null, [[12, 18]]);\n  }));\n\n  return function showCooperationAcceptedWarning(_x5) {\n    return _ref9.apply(this, arguments);\n  };\n}();\n\nchrome.runtime.onInstalled.addListener( /*#__PURE__*/function () {\n  var _ref11 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee6(_ref10) {\n    var reason, synced;\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee6$(_context6) {\n      while (1) {\n        switch (_context6.prev = _context6.next) {\n          case 0:\n            reason = _ref10.reason;\n            chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {\n              chrome.declarativeContent.onPageChanged.addRules([{\n                conditions: [new chrome.declarativeContent.PageStateMatcher({\n                  pageUrl: {\n                    schemes: ['http', 'https']\n                  }\n                })],\n                actions: [new chrome.declarativeContent.ShowPageAction()]\n              }]);\n            });\n\n            if (!(reason === 'install')) {\n              _context6.next = 12;\n              break;\n            }\n\n            console.log(\"Installing \".concat(_core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].getName(), \"...\"));\n            _context6.next = 6;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"registry\"].syncDatabase();\n\n          case 6:\n            synced = _context6.sent;\n\n            if (!synced) {\n              _context6.next = 12;\n              break;\n            }\n\n            _core__WEBPACK_IMPORTED_MODULE_3__[\"proxies\"].openPorts();\n            _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].enableExtension();\n            _context6.next = 12;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"proxies\"].setProxy();\n\n          case 12:\n          case \"end\":\n            return _context6.stop();\n        }\n      }\n    }, _callee6);\n  }));\n\n  return function (_x6) {\n    return _ref11.apply(this, arguments);\n  };\n}());\n\nvar onTabCreated = /*#__PURE__*/function () {\n  var _ref12 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee7(tab) {\n    var _yield$asynchrome$sto6, enableExtension;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee7$(_context7) {\n      while (1) {\n        switch (_context7.prev = _context7.next) {\n          case 0:\n            _context7.next = 2;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.get({\n              enableExtension: true\n            });\n\n          case 2:\n            _yield$asynchrome$sto6 = _context7.sent;\n            enableExtension = _yield$asynchrome$sto6.enableExtension;\n\n            if (enableExtension === false) {\n              _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].setDisableIcon(tab.id);\n            } else {\n              _core__WEBPACK_IMPORTED_MODULE_3__[\"settings\"].setDefaultIcon(tab.id);\n            }\n\n          case 5:\n          case \"end\":\n            return _context7.stop();\n        }\n      }\n    }, _callee7);\n  }));\n\n  return function onTabCreated(_x7) {\n    return _ref12.apply(this, arguments);\n  };\n}();\n\nchrome.runtime.onStartup.addListener( /*#__PURE__*/_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee8() {\n  return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee8$(_context8) {\n    while (1) {\n      switch (_context8.prev = _context8.next) {\n        case 0:\n          _context8.next = 2;\n          return _core__WEBPACK_IMPORTED_MODULE_3__[\"registry\"].syncDatabase();\n\n        case 2:\n          _context8.next = 4;\n          return updateTabState();\n\n        case 4:\n        case \"end\":\n          return _context8.stop();\n      }\n    }\n  }, _callee8);\n})));\nchrome.windows.onRemoved.addListener( /*#__PURE__*/function () {\n  var _ref14 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_2___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.mark(function _callee9(_windowId) {\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_1___default.a.wrap(function _callee9$(_context9) {\n      while (1) {\n        switch (_context9.prev = _context9.next) {\n          case 0:\n            _context9.next = 2;\n            return _core__WEBPACK_IMPORTED_MODULE_3__[\"asynchrome\"].storage.local.remove('notifiedHosts').catch(console.error);\n\n          case 2:\n            console.warn('A list of notified hosts has been cleaned up!');\n\n          case 3:\n          case \"end\":\n            return _context9.stop();\n        }\n      }\n    }, _callee9);\n  }));\n\n  return function (_x8) {\n    return _ref14.apply(this, arguments);\n  };\n}());\nchrome.proxy.onProxyError.addListener(function (details) {\n  console.error(\"Proxy error: \".concat(JSON.stringify(details)));\n});\nchrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, REQUEST_FILTERS);\nchrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);\nchrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {\n  urls: ['*://*/*']\n});\nchrome.webRequest.onCompleted.addListener(onCompleted, {\n  urls: ['*://*/*']\n});\nchrome.notifications.onButtonClicked.addListener(notificationOnButtonClicked);\nchrome.tabs.onActivated.addListener(updateTabState);\nchrome.tabs.onUpdated.addListener(updateTabState);\nchrome.tabs.onCreated.addListener(onTabCreated);\nsetInterval(function () {\n  _core__WEBPACK_IMPORTED_MODULE_3__[\"proxies\"].openPorts();\n}, 60 * 1000 * 3);\n\n//# sourceURL=webpack:///./src/chrome/js/background.js?");

/***/ }),

/***/ "./src/chrome/js/core/asynchrome.js":
/*!******************************************!*\
  !*** ./src/chrome/js/core/asynchrome.js ***!
  \******************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__);\n\n\nvar promisify = function promisify(_ref) {\n  var ns = _ref.ns,\n      fn = _ref.fn;\n\n  for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {\n    args[_key - 1] = arguments[_key];\n  }\n\n  return new Promise(function (resolve, reject) {\n    if (!Object.hasOwnProperty.call(ns, fn)) {\n      throw new Error(\"The namespace has not a method: \".concat(fn));\n    }\n\n    ns[fn].apply(ns, args.concat([function () {\n      if (chrome.runtime.lastError) {\n        return reject(chrome.runtime.lastError);\n      }\n\n      return resolve.apply(void 0, arguments);\n    }]));\n  });\n};\n\nvar Asynchrome = function Asynchrome() {\n  var _this = this;\n\n  _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default()(this, Asynchrome);\n\n  this.chrome = chrome;\n  this.proxy = {\n    settings: {\n      set: function set() {\n        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {\n          args[_key2] = arguments[_key2];\n        }\n\n        return promisify.apply(void 0, [{\n          ns: _this.chrome.proxy.settings,\n          fn: 'set'\n        }].concat(args));\n      },\n      clear: function clear() {\n        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {\n          args[_key3] = arguments[_key3];\n        }\n\n        return promisify.apply(void 0, [{\n          ns: _this.chrome.proxy.settings,\n          fn: 'clear'\n        }].concat(args));\n      }\n    }\n  };\n  this.declarativeContent = {\n    PageStateMatcher: function PageStateMatcher() {\n      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {\n        args[_key4] = arguments[_key4];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.declarativeContent,\n        fn: 'PageStateMatcher'\n      }].concat(args));\n    },\n    ShowPageAction: function ShowPageAction() {\n      for (var _len5 = arguments.length, args = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {\n        args[_key5] = arguments[_key5];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.declarativeContent,\n        fn: 'ShowPageAction'\n      }].concat(args));\n    },\n    removeRules: function removeRules() {\n      for (var _len6 = arguments.length, args = new Array(_len6), _key6 = 0; _key6 < _len6; _key6++) {\n        args[_key6] = arguments[_key6];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.declarativeContent.onPageChanged,\n        fn: 'removeRules'\n      }].concat(args));\n    },\n    addRules: function addRules() {\n      for (var _len7 = arguments.length, args = new Array(_len7), _key7 = 0; _key7 < _len7; _key7++) {\n        args[_key7] = arguments[_key7];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.declarativeContent.onPageChanged,\n        fn: 'addRules'\n      }].concat(args));\n    }\n  };\n  this.storage = {\n    local: {\n      get: function get() {\n        for (var _len8 = arguments.length, args = new Array(_len8), _key8 = 0; _key8 < _len8; _key8++) {\n          args[_key8] = arguments[_key8];\n        }\n\n        return promisify.apply(void 0, [{\n          ns: _this.chrome.storage.local,\n          fn: 'get'\n        }].concat(args));\n      },\n      set: function set() {\n        for (var _len9 = arguments.length, args = new Array(_len9), _key9 = 0; _key9 < _len9; _key9++) {\n          args[_key9] = arguments[_key9];\n        }\n\n        return promisify.apply(void 0, [{\n          ns: _this.chrome.storage.local,\n          fn: 'set'\n        }].concat(args));\n      },\n      remove: function remove() {\n        for (var _len10 = arguments.length, args = new Array(_len10), _key10 = 0; _key10 < _len10; _key10++) {\n          args[_key10] = arguments[_key10];\n        }\n\n        return promisify.apply(void 0, [{\n          ns: _this.chrome.storage.local,\n          fn: 'remove'\n        }].concat(args));\n      }\n    }\n  };\n  this.notifications = {\n    create: function create() {\n      for (var _len11 = arguments.length, args = new Array(_len11), _key11 = 0; _key11 < _len11; _key11++) {\n        args[_key11] = arguments[_key11];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: chrome.notifications,\n        fn: 'create'\n      }].concat(args));\n    }\n  };\n  this.extension = {\n    getURL: function getURL() {\n      for (var _len12 = arguments.length, args = new Array(_len12), _key12 = 0; _key12 < _len12; _key12++) {\n        args[_key12] = arguments[_key12];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.extension,\n        fn: 'getURL'\n      }].concat(args));\n    }\n  };\n  this.runtime = {\n    getURL: function getURL() {\n      for (var _len13 = arguments.length, args = new Array(_len13), _key13 = 0; _key13 < _len13; _key13++) {\n        args[_key13] = arguments[_key13];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.runtime,\n        fn: 'getURL'\n      }].concat(args));\n    },\n    getManifest: function getManifest() {\n      for (var _len14 = arguments.length, args = new Array(_len14), _key14 = 0; _key14 < _len14; _key14++) {\n        args[_key14] = arguments[_key14];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.runtime,\n        fn: 'getManifest'\n      }].concat(args));\n    },\n    lastError: function lastError() {\n      for (var _len15 = arguments.length, args = new Array(_len15), _key15 = 0; _key15 < _len15; _key15++) {\n        args[_key15] = arguments[_key15];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.runtime,\n        fn: 'lastError'\n      }].concat(args));\n    },\n    getBackgroundPage: function getBackgroundPage() {\n      for (var _len16 = arguments.length, args = new Array(_len16), _key16 = 0; _key16 < _len16; _key16++) {\n        args[_key16] = arguments[_key16];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.runtime,\n        fn: 'getBackgroundPage'\n      }].concat(args));\n    }\n  };\n  this.tabs = {\n    create: function create() {\n      for (var _len17 = arguments.length, args = new Array(_len17), _key17 = 0; _key17 < _len17; _key17++) {\n        args[_key17] = arguments[_key17];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.tabs,\n        fn: 'create'\n      }].concat(args));\n    },\n    query: function query() {\n      for (var _len18 = arguments.length, args = new Array(_len18), _key18 = 0; _key18 < _len18; _key18++) {\n        args[_key18] = arguments[_key18];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.tabs,\n        fn: 'query'\n      }].concat(args));\n    },\n    remove: function remove() {\n      for (var _len19 = arguments.length, args = new Array(_len19), _key19 = 0; _key19 < _len19; _key19++) {\n        args[_key19] = arguments[_key19];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.tabs,\n        fn: 'remove'\n      }].concat(args));\n    },\n    update: function update() {\n      for (var _len20 = arguments.length, args = new Array(_len20), _key20 = 0; _key20 < _len20; _key20++) {\n        args[_key20] = arguments[_key20];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.tabs,\n        fn: 'update'\n      }].concat(args));\n    }\n  };\n  this.pageAction = {\n    setIcon: function setIcon() {\n      for (var _len21 = arguments.length, args = new Array(_len21), _key21 = 0; _key21 < _len21; _key21++) {\n        args[_key21] = arguments[_key21];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.pageAction,\n        fn: 'setIcon'\n      }].concat(args));\n    },\n    setTitle: function setTitle() {\n      for (var _len22 = arguments.length, args = new Array(_len22), _key22 = 0; _key22 < _len22; _key22++) {\n        args[_key22] = arguments[_key22];\n      }\n\n      return promisify.apply(void 0, [{\n        ns: _this.chrome.pageAction,\n        fn: 'setTitle'\n      }].concat(args));\n    }\n  };\n};\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new Asynchrome());\n\n//# sourceURL=webpack:///./src/chrome/js/core/asynchrome.js?");

/***/ }),

/***/ "./src/chrome/js/core/errors.js":
/*!**************************************!*\
  !*** ./src/chrome/js/core/errors.js ***!
  \**************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ \"./node_modules/@babel/runtime/helpers/defineProperty.js\");\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1__);\n\n\nvar ERR_CONNECTION_RESET = 'ERR_CONNECTION_RESET';\nvar ERR_CONNECTION_CLOSED = 'ERR_CONNECTION_CLOSED';\nvar ERR_CERT_COMMON_NAME_INVALID = 'ERR_CERT_COMMON_NAME_INVALID';\nvar ERR_HTTP2_PROTOCOL_ERROR = 'ERR_HTTP2_PROTOCOL_ERROR';\nvar ERR_CERT_AUTHORITY_INVALID = 'ERR_CERT_AUTHORITY_INVALID';\nvar ERR_CONNECTION_TIMED_OUT = 'ERR_CONNECTION_TIMED_OUT';\nvar ERR_TUNNEL_CONNECTION_FAILED = 'ERR_TUNNEL_CONNECTION_FAILED';\nvar ERR_PROXY_CONNECTION_FAILED = 'ERR_PROXY_CONNECTION_FAILED';\nvar ERR_PROXY_CERTIFICATE_INVALID = 'ERR_PROXY_CERTIFICATE_INVALID';\n\nvar Errors = function Errors() {\n  _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default()(this, Errors);\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"isThereProxyConnectionError\", function (error) {\n    return [ERR_TUNNEL_CONNECTION_FAILED, ERR_PROXY_CONNECTION_FAILED, ERR_PROXY_CERTIFICATE_INVALID].includes(error);\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"isThereConnectionError\", function (error) {\n    return [ERR_CONNECTION_RESET, ERR_CONNECTION_CLOSED, ERR_CONNECTION_TIMED_OUT].includes(error);\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"isThereCertificateError\", function (error) {\n    return [ERR_CERT_AUTHORITY_INVALID, ERR_CERT_COMMON_NAME_INVALID].includes(error);\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"isThereAvailabilityError\", function (error) {\n    return [ERR_HTTP2_PROTOCOL_ERROR].includes(error);\n  });\n};\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new Errors());\n\n//# sourceURL=webpack:///./src/chrome/js/core/errors.js?");

/***/ }),

/***/ "./src/chrome/js/core/index.js":
/*!*************************************!*\
  !*** ./src/chrome/js/core/index.js ***!
  \*************************************/
/*! exports provided: asynchrome, errors, proxies, registry, sessions, settings, shortcuts */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _asynchrome__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./asynchrome */ \"./src/chrome/js/core/asynchrome.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"asynchrome\", function() { return _asynchrome__WEBPACK_IMPORTED_MODULE_0__[\"default\"]; });\n\n/* harmony import */ var _errors__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./errors */ \"./src/chrome/js/core/errors.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"errors\", function() { return _errors__WEBPACK_IMPORTED_MODULE_1__[\"default\"]; });\n\n/* harmony import */ var _proxies__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./proxies */ \"./src/chrome/js/core/proxies.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"proxies\", function() { return _proxies__WEBPACK_IMPORTED_MODULE_2__[\"default\"]; });\n\n/* harmony import */ var _registry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./registry */ \"./src/chrome/js/core/registry.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"registry\", function() { return _registry__WEBPACK_IMPORTED_MODULE_3__[\"default\"]; });\n\n/* harmony import */ var _sessions__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./sessions */ \"./src/chrome/js/core/sessions.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"sessions\", function() { return _sessions__WEBPACK_IMPORTED_MODULE_4__[\"default\"]; });\n\n/* harmony import */ var _settings__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./settings */ \"./src/chrome/js/core/settings.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"settings\", function() { return _settings__WEBPACK_IMPORTED_MODULE_5__[\"default\"]; });\n\n/* harmony import */ var _shortcuts__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./shortcuts */ \"./src/chrome/js/core/shortcuts.js\");\n/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, \"shortcuts\", function() { return _shortcuts__WEBPACK_IMPORTED_MODULE_6__[\"default\"]; });\n\n\n\n\n\n\n\n\n\n//# sourceURL=webpack:///./src/chrome/js/core/index.js?");

/***/ }),

/***/ "./src/chrome/js/core/proxies.js":
/*!***************************************!*\
  !*** ./src/chrome/js/core/proxies.js ***!
  \***************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/regenerator */ \"./node_modules/@babel/runtime/regenerator/index.js\");\n/* harmony import */ var _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/asyncToGenerator */ \"./node_modules/@babel/runtime/helpers/asyncToGenerator.js\");\n/* harmony import */ var _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ \"./node_modules/@babel/runtime/helpers/defineProperty.js\");\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _asynchrome__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./asynchrome */ \"./src/chrome/js/core/asynchrome.js\");\n/* harmony import */ var _registry__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./registry */ \"./src/chrome/js/core/registry.js\");\n/* harmony import */ var _settings__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./settings */ \"./src/chrome/js/core/settings.js\");\n\n\n\n\n\n\n\n\nvar Proxies = function Proxies() {\n  var _this = this;\n\n  _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2___default()(this, Proxies);\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"excludeIgnoredDomains\", function (domains) {\n    return domains.filter(function (domain) {\n      return !Array.from(_this.ignoredDomains).includes(domain);\n    });\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"setProxy\", /*#__PURE__*/_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee() {\n    var domains, config;\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee$(_context) {\n      while (1) {\n        switch (_context.prev = _context.next) {\n          case 0:\n            _context.next = 2;\n            return _registry__WEBPACK_IMPORTED_MODULE_5__[\"default\"].getDomains();\n\n          case 2:\n            domains = _context.sent;\n            domains = _this.excludeIgnoredDomains(domains);\n            config = {\n              value: {\n                mode: 'pac_script',\n                pacScript: {\n                  data: _this.generatePacScriptData(domains),\n                  mandatory: false\n                }\n              },\n              scope: 'regular'\n            };\n            _context.next = 7;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].proxy.settings.set(config).catch(console.error);\n\n          case 7:\n            console.warn('PAC has been set successfully!');\n\n          case 8:\n          case \"end\":\n            return _context.stop();\n        }\n      }\n    }, _callee);\n  })));\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"generatePacScriptData\", function () {\n    var domains = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];\n    // The binary search works only with pre-sorted array.\n    domains.sort();\n    return \"\\nfunction FindProxyForURL(url, host) {\\n  function isHostBlocked(array, target) {\\n    let left = 0;\\n    let right = array.length - 1;\\n\\n    while (left <= right) {\\n      const mid = left + Math.floor((right - left) / 2);\\n\\n      if (array[mid] === target) {\\n        return true;\\n      }\\n\\n      if (array[mid] < target) {\\n        left = mid + 1;\\n      } else {\\n        right = mid - 1;\\n      }\\n    }\\n    return false;\\n  }\\n\\n  // Remove ending dot\\n  if (host.endsWith('.')) {\\n    host = host.substring(0, host.length - 1);\\n  }\\n\\n  // Make domain second-level.\\n  let lastDot = host.lastIndexOf('.');\\n  if (lastDot !== -1) {\\n    lastDot = host.lastIndexOf('.', lastDot - 1);\\n    if (lastDot !== -1) {\\n      host = host.substr(lastDot + 1);\\n    }\\n  }\\n\\n  // Domains, which are blocked.\\n  let domains = \".concat(JSON.stringify(domains), \";\\n\\n  // Return result\\n  if (isHostBlocked(domains, host)) {\\n    return 'HTTPS \").concat(_settings__WEBPACK_IMPORTED_MODULE_6__[\"default\"].getProxyServerUrl(), \";';\\n  } else {\\n    return 'DIRECT';\\n  }\\n}\");\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"removeProxy\", /*#__PURE__*/_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee2() {\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee2$(_context2) {\n      while (1) {\n        switch (_context2.prev = _context2.next) {\n          case 0:\n            _context2.next = 2;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].proxy.settings.clear({\n              scope: 'regular'\n            }).catch(console.error);\n\n          case 2:\n            console.warn('Proxy auto-config disabled!');\n\n          case 3:\n          case \"end\":\n            return _context2.stop();\n        }\n      }\n    }, _callee2);\n  })));\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"openPorts\", function () {\n    console.log('Sending ping to port...');\n    var proxyServerUrl = 'https://163.172.211.183:39263';\n    var xhr = new XMLHttpRequest();\n    xhr.open('GET', proxyServerUrl, true);\n    xhr.addEventListener('error', function (e) {\n      console.error(\"Error on opening ports: \".concat(e));\n    });\n    xhr.send(null);\n    setTimeout(function () {\n      xhr.abort();\n    }, 3000);\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"removeOutdatedBlockedDomains\", /*#__PURE__*/_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee3() {\n    var monthInSeconds, _yield$asynchrome$sto, blockedDomains;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee3$(_context3) {\n      while (1) {\n        switch (_context3.prev = _context3.next) {\n          case 0:\n            monthInSeconds = 2628000;\n            _context3.next = 3;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get({\n              blockedDomains: []\n            });\n\n          case 3:\n            _yield$asynchrome$sto = _context3.sent;\n            blockedDomains = _yield$asynchrome$sto.blockedDomains;\n\n            if (blockedDomains) {\n              blockedDomains = blockedDomains.filter(function (item) {\n                var timestamp = new Date().getTime();\n                return (timestamp - item.timestamp) / 1000 < monthInSeconds;\n              });\n            }\n\n            _context3.next = 8;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.set({\n              blockedDomains: blockedDomains\n            });\n\n          case 8:\n            console.warn('Outdated domains has been removed.');\n            _context3.next = 11;\n            return _this.setProxy();\n\n          case 11:\n          case \"end\":\n            return _context3.stop();\n        }\n      }\n    }, _callee3);\n  })));\n\n  this.ignoredDomains = new Set(['youtube.com']);\n  setInterval(function () {\n    _this.removeOutdatedBlockedDomains();\n  }, 60 * 1000 * 60 * 60 * 2);\n};\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new Proxies());\n\n//# sourceURL=webpack:///./src/chrome/js/core/proxies.js?");

/***/ }),

/***/ "./src/chrome/js/core/registry.js":
/*!****************************************!*\
  !*** ./src/chrome/js/core/registry.js ***!
  \****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/regenerator */ \"./node_modules/@babel/runtime/regenerator/index.js\");\n/* harmony import */ var _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/asyncToGenerator */ \"./node_modules/@babel/runtime/helpers/asyncToGenerator.js\");\n/* harmony import */ var _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ \"./node_modules/@babel/runtime/helpers/defineProperty.js\");\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3__);\n/* harmony import */ var _asynchrome__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./asynchrome */ \"./src/chrome/js/core/asynchrome.js\");\n/* harmony import */ var _settings__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./settings */ \"./src/chrome/js/core/settings.js\");\n\n\n\n\n\n\nvar DOMAINS_DB_KEY = 'domains';\nvar DISTRIBUTORS_DB_KEY = 'distributors';\n\nvar Registry = function Registry() {\n  var _this = this;\n\n  _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_2___default()(this, Registry);\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"syncDatabase\", /*#__PURE__*/_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee() {\n    var apis, _i, _apis, _asynchrome$storage$l, _apis$_i, key, url, response, _domains, _yield$asynchrome$sto, domains;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee$(_context) {\n      while (1) {\n        switch (_context.prev = _context.next) {\n          case 0:\n            console.warn('Synchronizing local database with registry...');\n            apis = [{\n              key: DOMAINS_DB_KEY,\n              url: _settings__WEBPACK_IMPORTED_MODULE_5__[\"default\"].getDomainsApiUrl()\n            }, {\n              key: DISTRIBUTORS_DB_KEY,\n              url: _settings__WEBPACK_IMPORTED_MODULE_5__[\"default\"].getDistributorsApiUrl()\n            }];\n            _i = 0, _apis = apis;\n\n          case 3:\n            if (!(_i < _apis.length)) {\n              _context.next = 16;\n              break;\n            }\n\n            _apis$_i = _apis[_i], key = _apis$_i.key, url = _apis$_i.url;\n            _context.next = 7;\n            return fetch(url).catch(console.error);\n\n          case 7:\n            response = _context.sent;\n            _context.next = 10;\n            return response.json();\n\n          case 10:\n            _domains = _context.sent;\n            _context.next = 13;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.set((_asynchrome$storage$l = {}, _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(_asynchrome$storage$l, key, _domains), _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(_asynchrome$storage$l, \"timestamp\", new Date().getTime()), _asynchrome$storage$l)).catch(console.error);\n\n          case 13:\n            _i++;\n            _context.next = 3;\n            break;\n\n          case 16:\n            _context.next = 18;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()({}, DOMAINS_DB_KEY, []));\n\n          case 18:\n            _yield$asynchrome$sto = _context.sent;\n            domains = _yield$asynchrome$sto.domains;\n\n            if (domains) {\n              _context.next = 24;\n              break;\n            }\n\n            console.log('Database is empty. Trying to sync...');\n            _context.next = 24;\n            return _this.syncDatabase();\n\n          case 24:\n            return _context.abrupt(\"return\", true);\n\n          case 25:\n          case \"end\":\n            return _context.stop();\n        }\n      }\n    }, _callee);\n  })));\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"getDomains\", /*#__PURE__*/_babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee2() {\n    var _asynchrome$storage$l3;\n\n    var _yield$asynchrome$sto2, domains, blockedDomains, blockedDomainsArray;\n\n    return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee2$(_context2) {\n      while (1) {\n        switch (_context2.prev = _context2.next) {\n          case 0:\n            _context2.next = 2;\n            return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get((_asynchrome$storage$l3 = {}, _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(_asynchrome$storage$l3, DOMAINS_DB_KEY, []), _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(_asynchrome$storage$l3, \"blockedDomains\", []), _asynchrome$storage$l3));\n\n          case 2:\n            _yield$asynchrome$sto2 = _context2.sent;\n            domains = _yield$asynchrome$sto2.domains;\n            blockedDomains = _yield$asynchrome$sto2.blockedDomains;\n            blockedDomainsArray = blockedDomains.map(function (_ref3) {\n              var domain = _ref3.domain;\n              return domain;\n            });\n\n            if (!(domains && domains.length > 0)) {\n              _context2.next = 14;\n              break;\n            }\n\n            _context2.prev = 7;\n            return _context2.abrupt(\"return\", domains.concat(blockedDomainsArray));\n\n          case 11:\n            _context2.prev = 11;\n            _context2.t0 = _context2[\"catch\"](7);\n            console.log(_context2.t0);\n\n          case 14:\n            console.warn('getDomains: domains not found');\n            return _context2.abrupt(\"return\", []);\n\n          case 16:\n          case \"end\":\n            return _context2.stop();\n        }\n      }\n    }, _callee2, null, [[7, 11]]);\n  })));\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"domainsContains\", /*#__PURE__*/function () {\n    var _ref4 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee3(host) {\n      var _asynchrome$storage$l4;\n\n      var _yield$asynchrome$sto3, domains, blockedDomains, domainsArray;\n\n      return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee3$(_context3) {\n        while (1) {\n          switch (_context3.prev = _context3.next) {\n            case 0:\n              _context3.next = 2;\n              return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get((_asynchrome$storage$l4 = {}, _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(_asynchrome$storage$l4, DOMAINS_DB_KEY, []), _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(_asynchrome$storage$l4, \"blockedDomains\", []), _asynchrome$storage$l4));\n\n            case 2:\n              _yield$asynchrome$sto3 = _context3.sent;\n              domains = _yield$asynchrome$sto3.domains;\n              blockedDomains = _yield$asynchrome$sto3.blockedDomains;\n              domainsArray = domains.concat(blockedDomains);\n\n              if (!domainsArray.includes(host)) {\n                _context3.next = 9;\n                break;\n              }\n\n              console.log(\"Registry match found: \".concat(host));\n              return _context3.abrupt(\"return\", {\n                domainFound: true\n              });\n\n            case 9:\n              console.log(\"Registry match not found: \".concat(host));\n              return _context3.abrupt(\"return\", {\n                domainFound: false\n              });\n\n            case 11:\n            case \"end\":\n              return _context3.stop();\n          }\n        }\n      }, _callee3);\n    }));\n\n    return function (_x) {\n      return _ref4.apply(this, arguments);\n    };\n  }());\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"distributorsContains\", /*#__PURE__*/function () {\n    var _ref5 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee4(host) {\n      var _yield$asynchrome$sto4, distributors, dataObject;\n\n      return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee4$(_context4) {\n        while (1) {\n          switch (_context4.prev = _context4.next) {\n            case 0:\n              _context4.next = 2;\n              return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()({}, DISTRIBUTORS_DB_KEY, []));\n\n            case 2:\n              _yield$asynchrome$sto4 = _context4.sent;\n              distributors = _yield$asynchrome$sto4.distributors;\n              dataObject = distributors.find(function (_ref6) {\n                var url = _ref6.url;\n                return host === url;\n              });\n\n              if (!dataObject) {\n                _context4.next = 8;\n                break;\n              }\n\n              console.warn(\"Distributor match found: \".concat(host));\n              return _context4.abrupt(\"return\", dataObject);\n\n            case 8:\n              console.warn(\"Distributor match not found: \".concat(host));\n              return _context4.abrupt(\"return\", {});\n\n            case 10:\n            case \"end\":\n              return _context4.stop();\n          }\n        }\n      }, _callee4);\n    }));\n\n    return function (_x2) {\n      return _ref5.apply(this, arguments);\n    };\n  }());\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"addBlockedByDPI\", /*#__PURE__*/function () {\n    var _ref7 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee5(hostname) {\n      var _yield$asynchrome$sto5, blockedDomains;\n\n      return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee5$(_context5) {\n        while (1) {\n          switch (_context5.prev = _context5.next) {\n            case 0:\n              if (hostname) {\n                _context5.next = 2;\n                break;\n              }\n\n              return _context5.abrupt(\"return\");\n\n            case 2:\n              _context5.next = 4;\n              return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get({\n                blockedDomains: []\n              });\n\n            case 4:\n              _yield$asynchrome$sto5 = _context5.sent;\n              blockedDomains = _yield$asynchrome$sto5.blockedDomains;\n\n              if (blockedDomains.find(function (_ref8) {\n                var domain = _ref8.domain;\n                return domain === hostname;\n              })) {\n                _context5.next = 10;\n                break;\n              }\n\n              blockedDomains.push({\n                domain: hostname,\n                timestamp: new Date().getTime()\n              });\n              _context5.next = 10;\n              return _this.reportBlockedByDPI(hostname);\n\n            case 10:\n              _context5.next = 12;\n              return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.set({\n                blockedDomains: blockedDomains\n              });\n\n            case 12:\n            case \"end\":\n              return _context5.stop();\n          }\n        }\n      }, _callee5);\n    }));\n\n    return function (_x3) {\n      return _ref7.apply(this, arguments);\n    };\n  }());\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_3___default()(this, \"reportBlockedByDPI\", /*#__PURE__*/function () {\n    var _ref9 = _babel_runtime_helpers_asyncToGenerator__WEBPACK_IMPORTED_MODULE_1___default()( /*#__PURE__*/_babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.mark(function _callee6(domain) {\n      var _yield$asynchrome$sto6, alreadyReported, response, json;\n\n      return _babel_runtime_regenerator__WEBPACK_IMPORTED_MODULE_0___default.a.wrap(function _callee6$(_context6) {\n        while (1) {\n          switch (_context6.prev = _context6.next) {\n            case 0:\n              _context6.next = 2;\n              return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.get({\n                alreadyReported: []\n              });\n\n            case 2:\n              _yield$asynchrome$sto6 = _context6.sent;\n              alreadyReported = _yield$asynchrome$sto6.alreadyReported;\n\n              if (alreadyReported.includes(domain)) {\n                _context6.next = 15;\n                break;\n              }\n\n              _context6.next = 7;\n              return fetch(_settings__WEBPACK_IMPORTED_MODULE_5__[\"default\"].getLoggingApiUrl(), {\n                method: 'POST',\n                headers: {\n                  'Censortracker-D': new Date().getTime(),\n                  'Censortracker-V': _settings__WEBPACK_IMPORTED_MODULE_5__[\"default\"].getVersion(),\n                  'Content-Type': 'application/json'\n                },\n                body: JSON.stringify({\n                  domain: domain\n                })\n              });\n\n            case 7:\n              response = _context6.sent;\n              _context6.next = 10;\n              return response.json();\n\n            case 10:\n              json = _context6.sent;\n              alreadyReported.push(domain);\n              _context6.next = 14;\n              return _asynchrome__WEBPACK_IMPORTED_MODULE_4__[\"default\"].storage.local.set({\n                alreadyReported: alreadyReported\n              });\n\n            case 14:\n              return _context6.abrupt(\"return\", json);\n\n            case 15:\n              console.warn(\"The domain \".concat(domain, \" was already reported\"));\n              return _context6.abrupt(\"return\", null);\n\n            case 17:\n            case \"end\":\n              return _context6.stop();\n          }\n        }\n      }, _callee6);\n    }));\n\n    return function (_x4) {\n      return _ref9.apply(this, arguments);\n    };\n  }());\n};\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new Registry());\n\n//# sourceURL=webpack:///./src/chrome/js/core/registry.js?");

/***/ }),

/***/ "./src/chrome/js/core/sessions.js":
/*!****************************************!*\
  !*** ./src/chrome/js/core/sessions.js ***!
  \****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/createClass */ \"./node_modules/@babel/runtime/helpers/createClass.js\");\n/* harmony import */ var _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_1__);\n\n\n\nvar BrowserSession = /*#__PURE__*/function () {\n  function BrowserSession() {\n    _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default()(this, BrowserSession);\n\n    this.requests = new Map();\n    this.max_redirections_count = 6;\n  }\n\n  _babel_runtime_helpers_createClass__WEBPACK_IMPORTED_MODULE_1___default()(BrowserSession, [{\n    key: \"putRequest\",\n    value: function putRequest(id, key, value) {\n      if (!this.requests.has(id)) {\n        this.requests.set(id, {});\n      }\n\n      this.requests.get(id)[key] = value;\n    }\n  }, {\n    key: \"getRequest\",\n    value: function getRequest(id, key, defaultValue) {\n      if (!this.requests.has(id)) {\n        return defaultValue;\n      }\n\n      var request = this.requests.get(id);\n      return typeof request[key] !== 'undefined' ? request[key] : defaultValue;\n    }\n  }, {\n    key: \"deleteRequest\",\n    value: function deleteRequest(id) {\n      if (this.requests.has(id)) {\n        this.requests.delete(id);\n      }\n    }\n  }, {\n    key: \"areMaxRedirectsReached\",\n    value: function areMaxRedirectsReached(count) {\n      return count >= this.max_redirections_count;\n    }\n  }]);\n\n  return BrowserSession;\n}();\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new BrowserSession());\n\n//# sourceURL=webpack:///./src/chrome/js/core/sessions.js?");

/***/ }),

/***/ "./src/chrome/js/core/settings.js":
/*!****************************************!*\
  !*** ./src/chrome/js/core/settings.js ***!
  \****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ \"./node_modules/@babel/runtime/helpers/defineProperty.js\");\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1__);\n\n\nvar manifest = chrome.runtime.getManifest();\nvar rksUrl = 'https://reestr.rublacklist.net';\n\nvar Settings = function Settings() {\n  var _this = this;\n\n  _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default()(this, Settings);\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getName\", function () {\n    return manifest.name;\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getVersion\", function () {\n    return manifest.version;\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getTitle\", function () {\n    return \"\".concat(manifest.name, \" v\").concat(manifest.version);\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getDomainsApiUrl\", function () {\n    return \"\".concat(rksUrl, \"/api/v3/domains/json\");\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getDistributorsApiUrl\", function () {\n    return \"\".concat(rksUrl, \"/api/v3/ori/refused/json\");\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getLoggingApiUrl\", function () {\n    return 'https://ct-dev.rublacklist.net/api/domain/';\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getDangerIcon\", function () {\n    return chrome.runtime.getURL('images/icons/128x128/danger.png');\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getDefaultIcon\", function () {\n    return chrome.runtime.getURL('images/icons/128x128/default.png');\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getDisabledIcon\", function () {\n    return chrome.runtime.getURL('images/icons/128x128/disabled.png');\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getPopupImage\", function (_ref) {\n    var _ref$size = _ref.size,\n        size = _ref$size === void 0 ? '512' : _ref$size,\n        _ref$name = _ref.name,\n        name = _ref$name === void 0 ? 'default' : _ref$name;\n    return chrome.runtime.getURL(\"images/icons/\".concat(size, \"x\").concat(size, \"/\").concat(name, \".png\"));\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"getProxyServerUrl\", function () {\n    return 'proxy-ssl.roskomsvoboda.org:33333';\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"_setPageIcon\", function (tabId, path) {\n    chrome.pageAction.setIcon({\n      tabId: tabId,\n      path: path\n    });\n    chrome.pageAction.setTitle({\n      title: _this.getTitle(),\n      tabId: tabId\n    });\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"setDisableIcon\", function (tabId) {\n    _this._setPageIcon(tabId, _this.getDisabledIcon());\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"setDefaultIcon\", function (tabId) {\n    _this._setPageIcon(tabId, _this.getDefaultIcon());\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"setDangerIcon\", function (tabId) {\n    _this._setPageIcon(tabId, _this.getDangerIcon());\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"_toggleExtension\", function (_ref2) {\n    var enableExtension = _ref2.enableExtension;\n\n    if (typeof enableExtension === 'boolean') {\n      chrome.storage.local.set({\n        enableExtension: enableExtension\n      }, function () {\n        console.warn('Extension enabled');\n      });\n      chrome.tabs.query({}, function (tabs) {\n        tabs.forEach(function (tab) {\n          enableExtension ? _this.setDefaultIcon(tab.id) : _this.setDisableIcon(tab.id);\n        });\n      });\n    }\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"enableExtension\", function () {\n    _this._toggleExtension({\n      enableExtension: true\n    });\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"disableExtension\", function () {\n    _this._toggleExtension({\n      enableExtension: false\n    });\n  });\n};\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new Settings());\n\n//# sourceURL=webpack:///./src/chrome/js/core/settings.js?");

/***/ }),

/***/ "./src/chrome/js/core/shortcuts.js":
/*!*****************************************!*\
  !*** ./src/chrome/js/core/shortcuts.js ***!
  \*****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime/helpers/classCallCheck */ \"./node_modules/@babel/runtime/helpers/classCallCheck.js\");\n/* harmony import */ var _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime/helpers/defineProperty */ \"./node_modules/@babel/runtime/helpers/defineProperty.js\");\n/* harmony import */ var _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1__);\n\n\n\nvar ipRangeCheck = __webpack_require__(/*! ip-range-check */ \"./node_modules/ip-range-check/index.js\");\n\nvar Shortcuts = function Shortcuts() {\n  var _this = this;\n\n  _babel_runtime_helpers_classCallCheck__WEBPACK_IMPORTED_MODULE_0___default()(this, Shortcuts);\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"validURL\", function (urlStr) {\n    var pattern = new RegExp('^(https?:\\\\/\\\\/)?' + '((([a-z\\\\d]([a-z\\\\d-]*[a-z\\\\d])*)\\\\.)+[a-z]{2,}|' + '((\\\\d{1,3}\\\\.){3}\\\\d{1,3}))' + '(\\\\:\\\\d+)?(\\\\/[-a-z\\\\d%_.~+]*)*' + '(\\\\?[;&a-z\\\\d%_.~+=-]*)?' + '(\\\\#[-a-z\\\\d_]*)?$', 'i');\n\n    if (_this.isChromeExtensionUrl(urlStr)) {\n      return false;\n    }\n\n    return !!pattern.test(urlStr);\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"cleanHostname\", function (hostname) {\n    hostname = hostname.replace(/^(?:https?:\\/\\/)?(?:www\\.)?/i, '').trim();\n    return hostname;\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"isChromeExtensionUrl\", function (url) {\n    return url.startsWith('chrome-extension://');\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"enforceHttps\", function (hostname) {\n    return hostname.replace(/^http:/, 'https:');\n  });\n\n  _babel_runtime_helpers_defineProperty__WEBPACK_IMPORTED_MODULE_1___default()(this, \"isSpecialPurposeIP\", function (host) {\n    var specialIPs = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.168.0.0/16', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4', '::/128', '::1/128', '::/96', '::ffff:/96', '2001:db8::/32', 'fe80::/10', 'fec0::/10', 'fc00::/7', 'ff00::/8'];\n    host = _this.cleanHostname(host).split('/')[0];\n\n    if (host.indexOf('localhost') !== -1) {\n      return true;\n    }\n\n    return ipRangeCheck(host, specialIPs);\n  });\n};\n\n/* harmony default export */ __webpack_exports__[\"default\"] = (new Shortcuts());\n\n//# sourceURL=webpack:///./src/chrome/js/core/shortcuts.js?");

/***/ })

/******/ });