
const PATH = require("path");
const FS = require("fs-extra");
const ASSERT = require("assert");
const PROXY = require("..");
const HTTP = require("http");
const REQUEST = require("request");

//const MODE = "test";
const MODE = "write";

const DEBUG = false;

const PROXY_PORT = 8082;
const CONTENT_PORT = 8020;

describe('proxy', function() {

	it("can proxy requests", function(done) {
		var contentServer = HTTP.createServer(function (req, res) {
			ASSERT.equal(typeof req.headers["x-forwarded-for"], "string");
			res.end("OK");
		});
		return contentServer.listen(CONTENT_PORT, function() {
			return PROXY.proxyPortTo(PROXY_PORT, "127.0.0.1", CONTENT_PORT, function(err, proxy) {
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
			ASSERT.equal(typeof req.headers["x-forwarded-for"], "string");
			res.end("OK");
		});
		return contentServer.listen(CONTENT_PORT, function() {
			return PROXY.proxyPortTo(PROXY_PORT, "127.0.0.1", CONTENT_PORT, function(err, proxy) {
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
