
const URL = require("url");
const HTTP = require("http");
const HTTPS = require("https");
const HTTP_PROXY = require("http-proxy");


exports.proxyPortTo = function(listenPort, targetHostname, targetPort, callback) {
	var proxy = new ProxyServer();
	proxy.setTarget(targetHostname, targetPort);
	return proxy.listen(listenPort, callback);
}

exports.proxyVia = function(proxyHostname, proxyPort) {
	var agent = new ProxyAgent();
	agent.setProxy(proxyHostname, proxyPort);
	return agent;
}



var ProxyServer = exports.ProxyServer = function() {
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
ProxyServer.prototype.listen = function(port, callback) {
	this._listenPort = port;
	this._server = HTTP_PROXY.createServer(this._targetPort, this._targetHostname);
	this._server.listen(this._listenPort);
	this._agent = new ProxyAgent();
	this._agent.setProxy("127.0.0.1", this._listenPort);
	return callback(null, this);
}
ProxyServer.prototype.close = function(callback) {
	return this._server.close(callback);
}
ProxyServer.prototype.useForRequest = function(req) {
	return this._agent.addToRequest(req);
}



var ProxyAgent = exports.ProxyAgent = function() {
	this._proxyHostname = null;
	this._proxyPort = null;
}
ProxyAgent.prototype.setProxy = function(hostname, port) {
	this._proxyHostname = hostname;
	this._proxyPort = port;
}
// `req` must conform to first argument of `request` (https://github.com/mikeal/request)
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
	req.proxy = {
		protocol: (req.uri.port == 443) ? "https:" : "http:",
		hostname: this._proxyHostname,
		port: this._proxyPort
	};
	return req;
}

