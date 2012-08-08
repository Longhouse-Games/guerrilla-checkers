

define(['underscore', '../lib/checkers'], function( _, Checkers ) {
// var refreshBoard = function(socket, checkers, result) {
// 	var data = {
// 		result: true,
// 		remainingGuerrillaPieces: checkers.getRemainingGuerrillaPieces(),
// 		phase: checkers.getCurrentPhaseIndex(),
// 		board: checkers.getPieces(),
// 		placedGuerrilla: checkers.placedGuerrilla,
// 	};
// 	socket.emit('update', data);
// 	socket.broadcast.emit('update', data);
// };

var Server = function(game) {
	var me = this;
	me.game = game;
	me.players = [];
};


Server.prototype.refreshBoard = function(result, players) {
	var data = {
		result: result,
		remainingGuerrillaPieces: this.game.getRemainingGuerrillaPieces(),
		phase: this.game.getCurrentPhaseIndex(),
		board: this.game.getPieces(),
		placedGuerrilla: this.game.placedGuerrilla
	};
	console.log('update players: ', this.players.length);
	_.each(players || this.players, function(player) {
		var socket = player.getSocket();
		if (_.isUndefined(socket) || _.isNull(socket)) { return; }
		socket.emit('update', data);
	});
};

Server.prototype.addPlayer = function(socket, role) {
	var player = new Player(socket, this);
	this.players.push(player);
	socket.on('disconnect', function(data) {
		this.players = _.without(this.players, player);
	});
	return player;
};


Server.prototype.getGame= function() {
	return this.game;
};



var Player = function(_socket, server) {
	var me = this;
	me.server = server;
	me.socket = _socket;
	me.id = me.socket.handshake.sessionID;

	var chooseRole = function(magic_number) {
		switch(magic_number) {
			case 1:
				return 'guerrilla';
			case 2:
				return 'coin';
			default:
				return 'spectator';
		}
	};

	

	// welcome message
	me.socket.emit('message', {
		user: 'server',
		message: 'Welcome to Guerilla Checkers!' 
	});

	// handle user message
	me.socket.on('message', function(data) {

		me.socket.broadcast.emit('message', data);
		me.socket.emit('message', data);

		//liferay.sendMessage({ type: 'message', data: data });
		saveMessageToMongo(data);
	});

	// disconnect message
	

	// checkers protocol
	me.socket.on('moveCOIN', function(data) {
		console.log(data);
		console.log('### COIN move requested. Piece at ('+data.piece.x+','+data.piece.y+") to ("+data.position.x+","+data.position.y+")");
		var result = me.server.getGame().moveSoldierPiece(data.piece, data.position);
		me.server.refreshBoard(result);
	});

	me.socket.on('placeGuerrilla', function(data) {
		console.log("### Guerrilla move requested.");
		console.log(data);
		var result = me.server.getGame().placeGuerrillaPiece(data.position);
		me.server.refreshBoard(result);
	});

	// notify other users
	me.socket.broadcast.emit('user_connect', {
		user: me.socket.handshake.address.address
	});

	// refresh board
	me.server.refreshBoard(true, [me]);

	// send recent messages
	//fetchRecentMessages(function(err,messages) {

	//	for(var i = messages.length-1; i >= 0; --i) {
	//		var message = messages[i];
	//		console.log(message);
	//		me.socket.emit('message', message);
	//	}

	//});
};

Player.prototype.getId = function() {
	return this.id;
};

Player.prototype.getSocket = function() {
	return this.socket;
};

return {
	Player: Player,
	Server: Server
};
}); // requirejs define

