// includes
var app = require('express').createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas');

var Checkers = require('./lib/checkers').Checkers
  , liferay = require('./server/liferay');

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
	socket.emit('update', {
		result: true,
		board: checkers.getPieces()
	});
	socket.broadcast.emit('update', {
		result: true,
		board: checkers.getPieces()
	});
};

function handleLogin(request, response) {
	
	console.log("Handling Login!");

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
		if (error) {
			response.redirect(loginUrl);
			return;
		}

		console.log(username + " logged in!");

		response.sendfile(__dirname + '/index.html');
	});
}

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
app.get('/images/*', function(req, res) {
	res.sendfile(__dirname + req.originalUrl);
});
app.get('/style/*', function(req, res) {
	res.sendfile(__dirname + req.originalUrl);
});
app.get('/lib/*', function(req, res) {
	res.sendfile(__dirname + req.originalUrl);
});
app.get('/client/*', function(req, res) {
	res.sendfile(__dirname + req.originalUrl);
});


// initialize server
mongoose.connect('mongodb://localhost/lvg');
app.listen(portNumber);

// HACK: board
var piece = '<img src="white_draughts_man.png" width=68 height=68 alt="white" />';
var checkers = new Checkers(8, 8, [
	{x: 0, y: 0, player: piece},
	{x: 0, y: 2, player: piece},
	{x: 1, y: 1, player: piece},
	{x: 2, y: 0, player: piece},
	{x: 2, y: 2, player: piece},
	{x: 3, y: 1, player: piece},
	{x: 4, y: 0, player: piece},
	{x: 4, y: 2, player: piece},
	{x: 5, y: 1, player: piece},
	{x: 6, y: 0, player: piece},
	{x: 6, y: 2, player: piece},
	{x: 7, y: 1, player: piece}]);

// successful connection
function userConnected(socket) {

	// add connected user
	++connectedUsers;
	socket.emit('num_connected_users', connectedUsers);
	socket.emit('board_type', (connectedUsers % 2 === 0) ? 'guerilla' : 'soldier');
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
	socket.on('move', function(data) {
		console.log('move requested');
		var result = checkers.move(data.piece, data.position);
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

