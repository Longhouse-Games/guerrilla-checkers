var app = require('express').createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app);

var Checkers = require('./checkers').Checkers
  , liferay = require('./liferay');

var portNumber = 3000;

var Schema = mongoose.Schema;
var ChatSchema = new Schema({
	time: {type: Date},
	user: {type: String},
	message: {type: String, trim: true}
});
var ChatModel = mongoose.model('Chat', ChatSchema);

mongoose.connect('mongodb://localhost/lvg');

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

app.listen(portNumber);

app.get('/white_draughts_man.png', function(req, res) {
	res.sendfile(__dirname + '/white_draughts_man.png');
});
app.get('/board.css', function(req, res) {
	res.sendfile(__dirname + '/board.css');
});
app.post('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

app.get('/debug', function (req, res) {
	res.sendfile(__dirname + '/debug.html');
});

var piece = '<img src="white_draughts_man.png" width=80 height=80 alt="white" />';
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

// refresh board
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

var connectedUsers = 0;

io.sockets.on('connection', function (socket) {

	++connectedUsers;
	socket.emit('num_connected_users', connectedUsers);
	socket.broadcast.emit('num_connected_users', connectedUsers);

	// welcome message
	socket.emit('message', {
		user: 'server',
		message: 'Welcome to Guerilla Checkers!' 
	});

	// handle user message
	socket.on('message', function(data) {

		console.log("User sent message", data);

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
			message: 'someone quit! well fuck them' 
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

		console.log('pushing history');
		console.log(err);
		console.log(messages);

		for(var i = messages.length-1; i >= 0; --i) {
			var message = messages[i];
			console.log(message);
			socket.emit('message', message);
		}

	});

});

console.log("Server Started at localhost:"+portNumber);

