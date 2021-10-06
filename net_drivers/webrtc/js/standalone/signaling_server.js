const Connection = require('./connection.js')
const loggerFactory = require('../logger.js')

function SignalingServer(protocol_id, options) {
    this.protocol = protocol_id.toString()
    this.logger = loggerFactory.createLogger('StandaloneSignalingServer')
    this.options = options
}

SignalingServer.prototype.start = function(port) {
	var fs = require('fs');
	var url = require('url');
	var path = require('path');
	port = process.env.PORT || port; // Some hosts (like Heroku) will need to override the port, and they do this with an environment variable
	
    return new Promise((resolve, reject) => {
        this.logger.info('Starting (protocol: %s)...', this.protocol)

            this.logger.info('Received request for ' + request.url)
			
			var uri = url.parse(request.url).pathname;
			var filename = path.join(process.cwd(), uri);
			var zippedVersion = filename + ".gz";
			var useZipped = false;
			try
			{
				if(fs.statSync(zippedVersion).isFile())
				{
					useZipped = true;
					filename = zippedVersion;
				}
			}
			catch(e)
			{
				
			}
			this.logger.info('Zipped file ' + zippedVersion + ' found = ' + useZipped);
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
					if (useZipped)
					{
						response.writeHead(200, {"Content-Encoding": "gzip"});
					}
					else
					{
						response.writeHead(200);
					}
					response.write(file, "binary");
					response.end();
				});
			});
        })

        var server
        if (this.options['https']) {
            const fs = require('fs')

            server = createHttpsServer(this, fs.readFileSync(this.options['key']), fs.readFileSync(this.options['cert']))
        } else {
            server = createHttpServer()
        }

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

SignalingServer.prototype.isSecure = function() {
    return this.options['https']
}

function createHttpServer() {
    return require('http').createServer((request, response) => {
        this.logger.info('Received request for ' + request.url)

        response.writeHead(404)
        response.end()
    })
}

function createHttpsServer(signalingServer, key, cert) {
    return require('https').createServer({ key: key, cert: cert }, (request, response) => {
        signalingServer.logger.info('Received request for ' + request.url)

        response.writeHead(404)
        response.end()
    })
}

module.exports = SignalingServer
