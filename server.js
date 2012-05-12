var app = require('express').createServer()
  , io = require('socket.io').listen(app);

app.listen(80);

app.get('/', function (req, res) {
	res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
	socket.emit('message', {
		user: 'server',
		message: 'MOTD: some bullshit' 
	});
	socket.broadcast.emit('message', {
		user: 'server',
		message: 'new user connected' 
	});
	socket.on('message', function(data) {
		console.log(data);
		socket.broadcast.emit('message', data);
		socket.emit('message', data);
	});
	socket.on('disconnect', function() {
		socket.broadcast.emit('message', {
			user: 'server',
			message: 'someone quit! well fuck them' 
		});
	});
});

