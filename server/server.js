define([], function() {
var refreshBoard = function(socket, checkers, result) {
	data = {
		result: true,
		remainingGuerrillaPieces: checkers.getRemainingGuerrillaPieces(),
		phase: checkers.getCurrentPhaseIndex(),
		board: checkers.getPieces(),
		placedGuerrilla: checkers.placedGuerrilla,
	};
	socket.emit('update', data);
	socket.broadcast.emit('update', data);
};
var Game = function(_socket) {
	var me = this;
};

var Player = function(_socket, game) {
	var me = this;
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
		var result = game.moveSoldierPiece(data.piece, data.position);
		refreshBoard(me.socket, game, result);
	});

	me.socket.on('placeGuerrilla', function(data) {
		console.log("### Guerrilla move requested.");
		console.log(data);
		var result = game.placeGuerrillaPiece(data.position);
		refreshBoard(me.socket, game, result);
	});

	// notify other users
	me.socket.broadcast.emit('user_connect', {
		user: me.socket.handshake.address.address
	});

	// refresh board
	refreshBoard(me.socket, game, true);

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

var Server  = function(_socket) {
	var me = this;
	
	me.socket = _socket;
	



}
return {
	Player: Player
};
}); // requirejs define

