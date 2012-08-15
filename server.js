
var express = require('express')
  , app = express.createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas')
  , cookie = require('cookie');

// requirejs
var requirejs = require('requirejs');
requirejs.config({
	nodeRequire: require,
	paths: {
		underscore: "./vendor/underscore"
	},
	shim: {
		underscore: {
			exports: '_'
		}
	}
});

var liferay = require('./server/liferay');
	
requirejs(['underscore', './lib/checkers', './server/server.js'], function(_, Checkers, Server) {

// global variables
var portNumber = 3000;
var connectedUsers = 0;


// global types
var Schema = mongoose.Schema;
var ChatSchema = new Schema({
	time: {type: Date},
	user: {type: String},
	message: {type: String, trim: true}
});
var ChatModel = mongoose.model('Chat', ChatSchema);

// helper functions 
var fetchRecentMessages = function(callback) {
	var chatModel = mongoose.model('Chat');
	chatModel
	  .find()
	  .sort('time', -1) // descending
	  .limit(5)
	  .exec(callback);
};

var saveMessageToMongo = function(data) {
	new ChatModel({time: new Date(), user: data.user, message: data.message}).save();
};



function handleLogin(request, response) {
	
	console.log("Handling Login!");

	// DEBUG DEBUG DEBUG
	response.sendfile(__dirname + '/index.html');
	return;
	// DEBUG DEBUG DEBUG

	var serviceTicket = request.query.ticket;
	var hasServiceTicket = typeof serviceTicket !== 'undefined';

	var hostname = 'http://' + request.headers.host;
	var loginUrl = 'https://test.littlevikinggames.com/login?service=' + encodeURIComponent(hostname);

	var casInstance = new cas({
		base_url: 'https://test.littlevikinggames.com',
		service: hostname
	});

	// initial visit
	if (!hasServiceTicket) {
		console.log("Redirecting to CAS Login");
		response.redirect(loginUrl);
		return;
	} 

	console.log("Got service ticket!");

	// validate service ticket
	casInstance.validate(serviceTicket, function(error, status, username) {
		if (error || !status) {
			response.redirect(loginUrl);
			return;
		}
		console.log(username + " logged in!");
		response.sendfile(__dirname + '/index.html');
	});
}

app.configure(function() {
	app.use(express.cookieParser());
	app.use(express.session({secret: 'secret', key: 'express.sid'}));
});
// routing
app.get('/white_draughts_man.png', function(req, res) {
	res.sendfile(__dirname + '/white_draughts_man.png');
});
app.get('/board.css', function(req, res) {
	res.sendfile(__dirname + '/board.css');
});
app.post('/', function (req, res) {
	handleLogin(req, res);
});
app.get('/', function (req, res) {
	handleLogin(req, res);
});
app.get('/debug', function (req, res) {
	res.sendfile(__dirname + '/debug.html');
});
serve_dir = function(req, res) {
	res.sendfile(__dirname + req.originalUrl);
}
app.get('/images/*', serve_dir);
app.get('/style/*', serve_dir);
app.get('/lib/*', serve_dir);
app.get('/client/*', serve_dir);
app.get('/scripts/*', serve_dir);

// TODO Refactor: base it more smartly on player ID and previous sessions
// (so they can resume a game they've been disconnected from)
function chooseRole(magic_number) {
	switch(magic_number % 2) {
		case 0:
			return 'guerrilla';
		case 1:
			return 'coin';
		default:
			return 'spectator';
	}
};

// initialize server
mongoose.connect('mongodb://localhost/lvg');
app.listen(portNumber);

// successful connection

io.set('authorization', function (data, accept) {
	// check if there's a cookie header
	if (data.headers.cookie) {
		// if there is, parse the cookie
		data.cookie = cookie.parse(data.headers.cookie);
		// note that you will need to use the same key to grad the
		// session id, as you specified in the Express setup.
		data.sessionID = data.cookie['express.sid'];
	} else {
	 // if there isn't, turn down the connection with a message
	 // and leave the function.
	 return accept('No cookie transmitted.', false);
	}
	// accept the incoming connection
	accept(null, true);
});

var arrPlayers = [];
var arrGames = [];

io.sockets.on('connection', function (socket) {
	console.log('connection from: ', socket.handshake.sessionID);
	var gameId = Math.floor(connectedUsers / 2);
	console.log('joining game id: ', gameId);
	var server = {};
	if (gameId <= arrGames.length - 1) {
		console.log('gameid ', gameId, ' already exists.');
		server = arrGames[gameId];
	} else {
		console.log('created game ', gameId);
		var game = new Checkers.GameState();
		server = new Server.Server(new Checkers.GameState(), gameId);
		arrGames.push(server);
	}


	//var role = chooseRole(connectedUsers);
	//socket.emit('board_type', role);
	var player = server.addPlayer(socket);
	if (!_.isUndefined(player) && !_.isNull(player))
	{
		arrPlayers.push(player);
	}

	console.log('joined server: ', server);
	console.log('active games: ', arrGames.length);
	console.log('connected users: ', connectedUsers);

	socket.on('disconnect', function() {
		//--connectedUsers;
		socket.emit('num_connected_users', connectedUsers);
		socket.broadcast.emit('num_connected_users', connectedUsers);

		socket.broadcast.emit('message', {
			user: 'server',
			message: 'someone quit!'
		});
		socket.broadcast.emit('user_disconnect', { 
			user: socket.handshake.address.address 
		});
	});
});

console.log("Server Started at localhost:"+portNumber);

}); // requirejs Checkers

