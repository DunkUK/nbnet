const Connection = require('./connection.js')
const loggerFactory = require('../logger.js')

function SignalingServer(protocol_id, options) {
    this.protocol = protocol_id.toString()
    this.logger = loggerFactory.createLogger('StandaloneSignalingServer')
    this.options = options
}

SignalingServer.prototype.start = function(port) {
    return new Promise((resolve, reject) => {
        this.logger.info('Starting (protocol: %s)...', this.protocol)

        var server

        if (this.options['https']) {
            const fs = require('fs')

            server = createHttpsServer(this, fs.readFileSync(this.options['key']), fs.readFileSync(this.options['cert']))
        } else {
            server = createHttpServer(this)
        }

        const WebSocketServer = require('websocket').server

        this.wsServer = new WebSocketServer({
            httpServer: server,
            autoAcceptConnections: false
        })

        this.wsServer.on('request', (request) => {
            this.logger.info('New connection')

            try {
                this.onConnection(new Connection(request.accept(this.protocol, request.origin)))
            } catch (err) {
                this.logger.error('Connection rejected: %s', err)
            }
        })

        server.listen(port, () => {
            this.logger.info('Started, listening on port %d...', port);

            resolve()
        })
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

function createHttpServer(signalingServer) {
    var fs = require('fs');
    var url = require('url');
    var path = require('path');
        
    return require('http').createServer((request, response) => {
        signalingServer.logger.info('Received request for ' + request.url)
        
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
        signalingServer.logger.info('Zipped file ' + zippedVersion + ' found = ' + useZipped);
        fs.exists(filename, function(exists)
        {
            if (!exists)
            {
                response.writeHead(404)
                response.end()
                return;
            }
            if (fs.statSync(filename).isDirectory()) filename += '/index.html';
            
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
}

function createHttpsServer(signalingServer, key, cert) {
    return require('https').createServer({ key: key, cert: cert }, (request, response) => {
        signalingServer.logger.info('Received request for ' + request.url)

        response.writeHead(404)
        response.end()
    })
}

module.exports = SignalingServer
