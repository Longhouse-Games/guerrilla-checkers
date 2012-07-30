
var express = require('express')
  , app = express.createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas');

// requirejs
var requirejs = require('requirejs');
requirejs.config({
	nodeRequire: require
});

var liferay = require('./server/liferay');

requirejs(['./lib/checkers'], function(Checkers) {

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

var refreshBoard = function(socket, result) {
	data = {
		result: true,
		remainingGuerrillaPieces: checkers.getRemainingGuerrillaPieces(),
		phase: checkers.getCurrentPhaseIndex(),
		board: checkers.getPieces()
	};
	socket.emit('update', data);
	socket.broadcast.emit('update', data);
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
  switch(magic_number) {
    case 1:
      return 'guerrilla';
    case 2:
      return 'coin';
    default:
      return 'spectator';
  }
};

// initialize server
mongoose.connect('mongodb://localhost/lvg');
app.listen(portNumber);

var checkers = new Checkers.GameState;

// successful connection
function userConnected(socket) {

	// add connected user
	++connectedUsers;
	socket.emit('num_connected_users', connectedUsers);
	role = chooseRole(connectedUsers);
	socket.emit('role', role);
	socket.boardType = (connectedUsers % 2 === 0) ? 'guerilla' : 'soldier';
	socket.emit('board_type', socket.boardType);
	socket.broadcast.emit('num_connected_users', connectedUsers);

	// welcome message
	socket.emit('message', {
		user: 'server',
		message: 'Welcome to Guerilla Checkers!' 
	});

	// handle user message
	socket.on('message', function(data) {

		socket.broadcast.emit('message', data);
		socket.emit('message', data);

		liferay.sendMessage({ type: 'message', data: data });
		saveMessageToMongo(data);
	});

	// disconnect message
	socket.on('disconnect', function() {

		--connectedUsers;
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

	// checkers protocol
	socket.on('moveCOIN', function(data) {
		console.log(data);
		console.log('### COIN move requested. Piece at ('+data.piece.x+','+data.piece.y+") to ("+data.position.x+","+data.position.y+")");
		var result = checkers.moveSoldierPiece(data.piece, data.position);
		refreshBoard(socket, result);
	});

	socket.on('placeGuerrilla', function(data) {
		console.log("### Guerrilla move requested.");
		console.log(data);
		var result = checkers.placeGuerrillaPiece(data.position);
		refreshBoard(socket, result);
	});

	// notify other users
	socket.broadcast.emit('user_connect', {
		user: socket.handshake.address.address
	});

	// refresh board
	refreshBoard(socket, true);

	// send recent messages
	fetchRecentMessages(function(err,messages) {

		for(var i = messages.length-1; i >= 0; --i) {
			var message = messages[i];
			console.log(message);
			socket.emit('message', message);
		}

	});

}

io.sockets.on('connection', function (socket) {

	userConnected(socket);

});

console.log("Server Started at localhost:"+portNumber);

}); // requirejs Checkers

