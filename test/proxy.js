
const PATH = require("path");
const FS = require("fs-extra");
const ASSERT = require("assert");
const PROXY = require("..");
const HTTP = require("http");
const REQUEST = require("request");
const URL = require("url");
const SPAWN = require("child_process").spawn;


//const MODE = "test";
const MODE = "write";

const DEBUG = false;

const PROXY_PORT = 8082;
const CONTENT_PORT = 8020;

describe('proxy', function() {

	this.timeout(5 * 1000);

	describe('proxyPortTo', function() {

		it("can open port and proxy requests", function(done) {
			var contentServer = HTTP.createServer(function (req, res) {
				try {
					ASSERT.equal(URL.parse(req.url).path, "/");
					ASSERT.equal(typeof req.headers["x-forwarded-for"], "string");
					res.end("OK");
				} catch(err) {
					console.error(err.stack);
					return done(err);
				}
			});
			return contentServer.listen(CONTENT_PORT, function() {
				return PROXY.proxyPortTo(PROXY_PORT, "127.0.0.1", CONTENT_PORT, {
					enableForwardHeaders: true
				}, function(err, proxy) {
					if (err) return done(err);
					return REQUEST("http://127.0.0.1:" + PROXY_PORT + "/", function(err, res, body) {
						if (err) return done(err);
						ASSERT.equal(res.statusCode, 200);
						ASSERT.equal(body, "OK");
						return proxy.close(function() {
							return contentServer.close(done);
						});
					});
				});
			});
		});

		it("can add proxy to `request`", function(done) {
			var contentServer = HTTP.createServer(function (req, res) {
				try {
					ASSERT.equal(URL.parse(req.url).path, "/");
					ASSERT.equal(typeof req.headers["x-forwarded-for"], "string");
					res.end("OK");
				} catch(err) {
					console.error(err.stack);
					return done(err);
				}
			});
			return contentServer.listen(CONTENT_PORT, function() {
				return PROXY.proxyPortTo(PROXY_PORT, "127.0.0.1", CONTENT_PORT, {
					enableForwardHeaders: true
				}, function(err, proxy) {
					if (err) return done(err);
					return REQUEST(proxy.useForRequest("http://127.0.0.1:" + CONTENT_PORT + "/"), function(err, res, body) {
						if (err) return done(err);
						ASSERT.equal(res.statusCode, 200);
						ASSERT.equal(body, "OK");
						return proxy.close(function() {
							return contentServer.close(done);
						});
					});
				});
			});
		});

		it("can request via proxy", function(done) {
			var contentServer = HTTP.createServer(function (req, res) {
				try {
					ASSERT.equal(URL.parse(req.url).path, "/");
					ASSERT.equal(typeof req.headers["x-forwarded-for"], "string");
					res.end("OK");
				} catch(err) {
					console.error(err.stack);
					return done(err);
				}
			});
			return contentServer.listen(CONTENT_PORT, function() {
				return PROXY.proxyPortTo(PROXY_PORT, "127.0.0.1", CONTENT_PORT, {
					enableForwardHeaders: true
				}, function(err, proxy) {
					if (err) return done(err);
					return proxy.request("http://127.0.0.1:" + CONTENT_PORT + "/", function(err, res, body) {
						if (err) return done(err);
						ASSERT.equal(res.statusCode, 200);
						ASSERT.equal(body, "OK");
						return proxy.close(function() {
							return contentServer.close(done);
						});
					});
				});
			});
		});

		it("can start proxy on random port", function(done) {
			var contentServer = HTTP.createServer(function (req, res) {
				try {
					ASSERT.equal(URL.parse(req.url).path, "/");
					ASSERT.equal(typeof req.headers["x-forwarded-for"], "string");
					res.end("OK");
				} catch(err) {
					console.error(err.stack);
					return done(err);
				}
			});
			return contentServer.listen(CONTENT_PORT, function() {
				return PROXY.proxyPortTo(0, "127.0.0.1", CONTENT_PORT, {
					enableForwardHeaders: true
				}, function(err, proxy) {
					if (err) return done(err);				
					return REQUEST(proxy.useForRequest("http://127.0.0.1:" + CONTENT_PORT + "/"), function(err, res, body) {
						if (err) return done(err);
						ASSERT.equal(res.statusCode, 200);
						ASSERT.equal(body, "OK");
						return proxy.close(function() {
							return contentServer.close(done);
						});
					});
				});
			});
		});

	});

	describe('newProxy', function() {

		it("can proxy HTTP requests", function(done) {
			return PROXY.newProxy({
				enableForwardHeaders: true
			}, function(err, proxy) {
				if (err) return done(err);
				return REQUEST(proxy.useForRequest("http://www.microsoft.com/robots.txt"), function(err, res, body) {
					if (err) return done(err);
					ASSERT.equal(res.statusCode, 200);
					ASSERT.equal(/# Robots\.txt file for/.test(body), true);
					return proxy.close(done);
				});
			});
		});

		// TODO: Fix.
		/*
		it("can proxy HTTPS requests", function(done) {
			return PROXY.newProxy({
				enableForwardHeaders: true
			}, function(err, proxy) {
				if (err) return done(err);
				return REQUEST(proxy.useForRequest("https://www.microsoft.com/robots.txt"), function(err, res, body) {
					if (err) return done(err);
					ASSERT.equal(res.statusCode, 200);

//console.log("body", body);

					ASSERT.equal(/# Robots\.txt file for/.test(body), true);
					return proxy.close(done);
				});
			});
		});
		*/

		it("can proxy sub-commands via `HTTP_PROXY` ENV var", function(done) {
			return PROXY.newProxy({
					enableForwardHeaders: true
				}, function(err, proxy) {
				if (err) return done(err);
				var proc = SPAWN("curl", [
					"-s",
					"http://www.microsoft.com/robots.txt"
				], {
					env: proxy.useForEnv(process.env)
				});
				var ok = false;
				proc.stdout.on('data', function (data) {
					//console.log('stdout: ' + data);
					if (/# Robots\.txt file for/.test(data)) {
						ok = true;
					}
				});
				proc.stderr.on('data', function (data) {
					//console.log('stderr: ' + data);
				});
				proc.on('close', function (code) {
					if (code) return done(new Error("Did not exit clean!"));
					if (!ok) ASSERT.fail("Not not get expected response");
					return proxy.close(done);
				});
			});
		});

		// TODO: Fix.
		/*
		it("can proxy sub-commands via `HTTP_PROXY` ENV var", function(done) {
			return PROXY.newProxy({
					enableForwardHeaders: true
				}, function(err, proxy) {
				if (err) return done(err);
				var proc = SPAWN("curl", [
					"-s",
					"-v",
					"https://www.microsoft.com/robots.txt"
				], {
					env: proxy.useForEnv(process.env)
				});
				var ok = false;
				proc.stdout.on('data', function (data) {
					console.log('stdout: ' + data);
					if (/# Robots\.txt file for/.test(data)) {
						ok = true;
					}
				});
				proc.stderr.on('data', function (data) {
					console.log('stderr: ' + data);
				});
				proc.on('close', function (code) {
					if (code) return done(new Error("Did not exit clean!"));
					if (!ok) ASSERT.fail("Not not get expected response");
					return proxy.close(done);
				});
			});
		});
		*/

	});

});
