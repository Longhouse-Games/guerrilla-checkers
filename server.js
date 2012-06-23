var app = require('express').createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app);

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

var logMessage = function(data) {
	var chatModel = mongoose.model('Chat');
	new ChatModel({time: new Date(), user: data.user, message: data.message}).save();
};

app.listen(80);

app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
	
	// connection messages
	socket.emit('message', {
		user: 'server',
		message: 'MOTD: some bullshit' 
	});
	socket.broadcast.emit('message', {
		user: 'server',
		message: 'new user connected' 
	});

	// handle user message
	socket.on('message', function(data) {
		console.log(data);
		socket.broadcast.emit('message', data);
		socket.emit('message', data);
		logMessage(data);
	});

	// disconnect message
	socket.on('disconnect', function() {
		socket.broadcast.emit('message', {
			user: 'server',
			message: 'someone quit! well fuck them' 
		});
	});

	// get recent messages on connect
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

