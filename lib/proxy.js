
const HTTP_PROXY = require("http-proxy");



exports.proxyPortTo = function(listenPort, targetHost, targetPort, callback) {
	var server = HTTP_PROXY.createServer(targetPort, targetHost);
	server.listen(listenPort);
	return callback(null, server);
}
