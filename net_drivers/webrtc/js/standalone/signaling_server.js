const Connection = require('./connection.js')
const loggerFactory = require('../logger.js')

function SignalingServer(protocol_id) {
    this.protocol = protocol_id.toString()
    this.logger = loggerFactory.createLogger('StandaloneSignalingServer')
}

SignalingServer.prototype.start = function(port) {
	var fs = require('fs');
	var url = require('url');
	var path = require('path');
	port = process.env.PORT || port; // Some hosts (like Heroku) will need to override the port, and they do this with an environment variable
	
    return new Promise((resolve, reject) => {
        this.logger.info('Starting (protocol: %s)...', this.protocol)

        const server = require('http').createServer((request, response) => {
            this.logger.info('Received request for ' + request.url)
			
			var uri = url.parse(request.url).pathname;
			var filename = path.join(process.cwd(), uri);
			fs.exists(filename, function(exists)
			{
				if (!exists)
				{
					response.writeHead(404)
					response.end()
					return;
				}
				if (fs.statSync(filename).isDirectory()) filename += '/client.html';
				
				fs.readFile(filename, "binary", function(err, file)
				{
					if (err)
					{
						response.writeHead(500, {"Content-Type": "text/plain"});
						response.write(err + "\n");
						response.end();
						return;
					}
					response.writeHead(200);
					response.write(file, "binary");
					response.end();
				});
			});
        })

        const WebSocketServer = require('websocket').server

        this.wsServer = new WebSocketServer({
            httpServer: server,
            autoAcceptConnections: false
        })
		this.logger.info('WebSocketServer = ' + JSON.stringify(this.wsServer, undefined, 2))

        this.wsServer.on('request', (request) => {
            this.logger.info('New connection')

            try {
                this.onConnection(new Connection(request.accept(this.protocol, request.origin)))
            } catch (err) {
                this.logger.error('Connection rejected: %s', err)
            }

        })
		
		this.wsServer.on('upgradeError', (error) => {
			this.logger.error('Error: ' + error)
		})
		
		this.wsServer.on('connect', (connection) => {
			this.logger.info('Websocket connection accepted')
		})
		
		this.wsServer.on('close', (connection, closeReason, description) => {
			this.logger.info('Websocket closed ' + closeReason + ', ' + description)
		})

        server.listen(port, () => {
            this.logger.info('Started, listening on port %d...', port);

            resolve()
        })
		this.logger.info('Server = ' + JSON.stringify(server, undefined, 2))
    })
}

SignalingServer.prototype.stop = function() {
    if (this.wsServer) {
        this.wsServer.shutDown()
    } else {
        this.logger.error("Not started")
    }
}

module.exports = SignalingServer
