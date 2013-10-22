
const PATH = require("path");
const FS = require("fs-extra");
const ASSERT = require("assert");
const PROXY = require("..");
const HTTP = require("http");
const REQUEST = require("request");

//const MODE = "test";
const MODE = "write";

const DEBUG = false;

describe('proxy', function() {

	it("can proxy requests", function(done) {
		var contentServer = HTTP.createServer(function (req, res) {
			res.end("OK");
		});
		return contentServer.listen(8020, function() {
			return PROXY.proxyPortTo(8082, "127.0.0.1", 8020, function(err, server) {
				if (err) return done(err);
				return REQUEST("http://127.0.0.1:8082/", function(err, res, body) {
					if (err) return next(err);
					ASSERT.equal(res.statusCode, 200);
					ASSERT.equal(body, "OK");
					return server.close(function() {
						return contentServer.close(done);
					});
				});
			});
		});
	});

});
