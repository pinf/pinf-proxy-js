
const PATH = require("path");
const FS = require("fs");
const URL = require("url");
const HTTP = require("http");
const HTTPS = require("https");
const HTTP_PROXY = require("http-proxy");
const EMPTY_PORT = require("empty-port");
const REQUEST = require("request");
const TLS = require("tls");
const NET = require("net");


exports.proxyPortTo = function(listenPort, targetHostname, targetPort, options, callback) {
	if (typeof options === "function" && typeof callback === "undefined") {
		callback = options;
		options = null;
	}
	var proxy = new ProxyServer();
	proxy.setTarget(targetHostname, targetPort);
	return proxy.listen(listenPort, options, callback);
}

exports.newProxy = function(options, callback) {
	var proxy = new DualProtocolProxyServer();
	return proxy.listen(options, callback);
}

exports.proxyVia = function(proxyHostname, proxyPort) {
	var agent = new ProxyAgent();
	agent.setProxy(proxyHostname, proxyPort);
	return agent;
}


var DualProtocolProxyServer = exports.DualProtocolProxyServer = function() {
	this._httpProxy = new ProxyServer();
	this._httpsProxy = new ProxyServer(true);
}
DualProtocolProxyServer.prototype.listen = function(options, callback) {
	var self = this;
	return self._httpProxy.listen(0, options, function(err) {
		if (err) return callback(err);
		var opts = {};
		for (var name in options) {
			opts[name] = options[name];
		}
		opts.https = {
			key: FS.readFileSync(PATH.join(__dirname, "../config/proxy-ssl-private-key"), "utf8"),
			cert: FS.readFileSync(PATH.join(__dirname, "../config/proxy-ssl.crt"), "utf8")
		};
		return self._httpsProxy.listen(0, opts, function(err) {
			if (err) return callback(err);
			return callback(null, self);
		});
	});
}
DualProtocolProxyServer.prototype.close = function(callback) {
	var self = this;
	return self._httpProxy.close(function() {
		return self._httpsProxy.close(callback);
	});
}
DualProtocolProxyServer.prototype.useForRequest = function(req) {
	if (typeof req === "string") {
		req = {
			uri: URL.parse(req)
		};
	}
	if (req.uri.protocol === "https:") {
		return this._httpsProxy.useForRequest(req);
	} else {
		return this._httpProxy.useForRequest(req);
	}
}
DualProtocolProxyServer.prototype.useForEnv = function(env) {
	return this._httpsProxy.useForEnv(this._httpProxy.useForEnv(env));
}





var ProxyServer = exports.ProxyServer = function(secure) {
	this._secure = secure || false;
	this._targetHostname = null;
	this._targetPort = null;
	this._listenPort = null;
	this._server = null;
	this._agent = null;
}
ProxyServer.prototype.setTarget = function(hostname, port) {
	this._targetHostname = hostname;
	this._targetPort = port;
}
ProxyServer.prototype.listen = function(port, options, callback) {
	var self = this;
	if (typeof options === "function" && typeof callback === "undefined") {
		callback = options;
		options = null;
	}
	options = options || {};
	self._listenPort = port;
	function ensurePort(callback) {
		if (self._listenPort > 0) {
			return callback(null);
		}
		return EMPTY_PORT({
			startPort: 3000,
			maxPort: 4000
		}, function(err, port) {
			if (err) return callback(err);
			self._listenPort = port;
			return callback(null);
		});
	}
	return ensurePort(function(err) {
		if (err) return callback(err);
		if (self._targetHostname) {
			self._server = HTTP_PROXY.createServer(self._targetPort, self._targetHostname, {
				enable: {
					// enables `X-Forwarded-For` header
					xforward: (options.enableForwardHeaders === true) ? true : false
				},
				https: options.https || null
			}, function (req, res, proxy) {

// TODO: Tie into cache.

				return proxy.proxyRequest(req, res);
			});
		} else {

			if (options.https) {

				// NOTE: A SSL proxy cannot inspect traffic passing through it!
				// @see http://tools.ietf.org/html/draft-luotonen-ssl-tunneling-03

				// TODO: Get this working when making HTTPS requests using `request` and `curl`.
				//		 `request` wants to connect via TLS while `curl` want to connect via NET.

				self._server = NET.createServer({
					key: options.https.key,
					cert: options.https.cert,
					rejectUnauthorized: false
				}, function(requestingStream) {

					requestingStream.end();
/*
					var targetStream = null;

					requestingStream.on("data", function(chunk) {
//console.log(" >> CHUNK >> ", chunk.toString());

						if (targetStream) {

							targetStream.write(chunk);

						} else {
							// Expecting:
							//   CONNECT www.test.com:443 HTTP/1.1
							//   Host: www.test.com:443
							//   Connection: close
							var headers = {};
							chunk.toString().replace(/\r/g, "").split("\n").forEach(function(line) {
								var m = line.match(/^([^:]+):\s*(.*)$/);
								if (m) {
									headers[m[1]] = m[2];
								}
							});

							if (!headers["Host"]) {
								return requestingStream.end();
							}
							var hostnamePort = headers["Host"].split(":");
							if (hostnamePort[1] != 443) {
								return requestingStream.end();
							}

							targetStream = require("net").connect({
								host: hostnamePort[0],
								port: 443
							}, function() {
								requestingStream.write("HTTP/1.0 200 Connection established\n\n");
							});

							targetStream.on("error", function(err) {
								console.error(err.stack);
								requestingStream.close();
							});
							targetStream.on("close", function() {
								requestingStream.close();
							});
							targetStream.on("data", function(chunk) {
//console.log(" << CHUNK << ", chunk.toString());								
								requestingStream.write(chunk);
							});
							requestingStream.once("close", function() {
								targetStream.close();							
							});
						}
					});
*/
				});

			} else {

				self._server = HTTP_PROXY.createServer({
					enable: {
						// enables `X-Forwarded-For` header
						xforward: (options.enableForwardHeaders === true) ? true : false
					},
					https: options.https || null
				}, function (req, res, proxy) {
					var parsedUrl = URL.parse(req.url);
					if (!parsedUrl.hostname) {
						res.writeHead(404);
						return res.end();
					}

// TODO: Tie into cache.

					return proxy.proxyRequest(req, res, {
						host: parsedUrl.hostname,
						port: parsedUrl.port || 80
					});
				});
			}
		}
		self._server.listen(self._listenPort, "127.0.0.1");
		self._agent = new ProxyAgent(options.https);
		self._agent.setProxy("127.0.0.1", self._listenPort);
		return callback(null, self);
	});
}
ProxyServer.prototype.getPort = function() {
	return this._listenPort;
}
ProxyServer.prototype.close = function(callback) {
	return this._server.close(callback);
}
ProxyServer.prototype.useForRequest = function(req) {
	return this._agent.addToRequest(req);
}
ProxyServer.prototype.useForEnv = function(env) {
	return this._agent.addToEnv(env);
}
ProxyServer.prototype.request = function(req, callback) {
	return REQUEST(this.useForRequest(req), callback);
}


var ProxyAgent = exports.ProxyAgent = function(secure) {
	this._proxyHostname = null;
	this._proxyPort = null;
	this._secure = secure || false;
}
ProxyAgent.prototype.setProxy = function(hostname, port) {
	this._proxyHostname = hostname;
	this._proxyPort = port;
}
// `req` must conform to first argument of `request` (https://github.com/mikeal/request).
ProxyAgent.prototype.addToRequest = function(req, options) {
	options = options || {};
	options.maxSockets = options.maxSockets || 10;
	if (typeof req === "string") {
		req = {
			uri: URL.parse(req)
		};
	}
	if (typeof req.proxy !== "undefined") {
		console.log("WARNING: `req.proxy` already set!", req, new Error().stack);
	}
	var secure = (req.uri.protocol === "https:");
	req.proxy = {
		protocol: secure ? "https:" : "http:",
		hostname: this._proxyHostname,
		port: this._proxyPort
	};
	if (secure) {
		req.key = this._secure.key;
		req.cert = this._secure.cert;
		req.rejectUnhauthorized = false;
		// HACK: https://github.com/mikeal/request/issues/418
		process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
	}
	return req;
}
// `env` are standard UNIX ENV variables.
ProxyAgent.prototype.addToEnv = function(env, options) {
	options = options || {};
	if (this._secure) {
//		env.HTTPS_PROXY = "https://" + this._proxyHostname + (this._proxyPort ? ":" + this._proxyPort : 443);
		// @see http://curl.haxx.se/mail/archive-2001-12/0034.html
//		env.https_proxy = env.HTTPS_PROXY;
	} else {
		env.HTTP_PROXY = "http://" + this._proxyHostname + (this._proxyPort ? ":" + this._proxyPort : "");
		// @see http://curl.haxx.se/mail/archive-2001-12/0034.html
		env.http_proxy = env.HTTP_PROXY;
	}
	return env;
}
