define(['underscore', '../lib/checkers', '../lib/vote'], function( _, Checkers, Vote) {
// var refreshBoard = function(socket, checkers, result) {
//   var data = {
//     result: true,
//     remainingGuerrillaPieces: checkers.getRemainingGuerrillaPieces(),
//     phase: checkers.getCurrentPhaseIndex(),
//     board: checkers.getPieces(),
//     placedGuerrilla: checkers.placedGuerrilla,
//   };
//   socket.emit('update', data);
//   socket.broadcast.emit('update', data);
// };

var Server = function(gameFactory, id) {
  var me = this;
  me.id = id;
  me.gameFactory = gameFactory;
  me.game = gameFactory();
  me.arrPlayers = [];
  me.arrRoles = ['guerrilla', 'coin'];
  me.votes = {};
};


Server.prototype.startVote = function(name, question, onPass, getVoters) {
  var me = this;
  onPass = onPass || function() {};
  if (this.votes[name]) { return; } // vote already in progress
  getVoters = getVoters || function() { 
      return _.filter(me.arrPlayers, function(player) {
        var role = player.getRole();
        return role === 'guerrilla'
          || role === 'coin';
      });};
  console.log('getVoters: ', getVoters);
  var vote = new Vote('reset',
           "Would you like to reset the game?",
           getVoters,
           function() { onPass(); }, //onPass
           function() { delete me.votes[name]; }, //onCompleted
           function() {}); //onFail
  me.votes[vote.getName()] = vote;
  _.each(getVoters(), function(player){ me.requestVote(player, vote); });
};

Server.prototype.requestVote = function(player, vote) {
  player.getSocket().emit('getVote', {
    'name': vote.getName(),
    'question': vote.getQuestion()
  });
};

Server.prototype.refreshBoard = function(result, arrPlayers) {
  var data = {
    result: result,
    remainingGuerrillaPieces: this.game.getRemainingGuerrillaPieces(),
    phase: this.game.getCurrentPhaseIndex(),
    board: this.game.getPieces(),
    placedGuerrilla: this.game.placedGuerrilla,
    gameState: this.game.asDTO()
  };
  console.log('update players: ', this.arrPlayers.length);
  _.each(arrPlayers || this.arrPlayers, function(player) {
    var socket = player.getSocket();
    if (_.isUndefined(socket) || _.isNull(socket)) { return; }
    socket.emit('update', data);
  });
};

Server.prototype.resetGame = function() {
  this.game = this.gameFactory();
  this.refreshBoard(true);
};


Server.prototype.addPlayer = function(socket) {
  var role = _.first(this.arrRoles);
  var player = new Player(socket, this, role);
  this.arrPlayers.push(player);
  var arrRoles = this.arrRoles;
  var me = this;

  socket.on('disconnect', function(data) {
    console.log('disconnected player: ', player);
    me.arrPlayers = _.without(me.arrPlayers, player);
    me.arrRoles.push(player.getRole());
    me.broadcast('num_connected_users', me.arrPlayers.length);
    var votesToDelete = [];
    console.log('active votes: ', me.votes);
    _.each(me.votes, function(vote) {
      if (vote.getVoters().length === 0) {
        votesToDelete.push(vote.getName());
      }
      else {
        vote.determineResult();
      }
    });
    _.each(votesToDelete, function(name) {
      console.log('removing dead vote: ', name);
      delete me.votes[name];
    });
  });

  socket.on('requestReset', function(data) {
    console.log('reseting game');
    me.startVote(
      'reset',
      'Would you like reset the game',
      function() { me.resetGame(); });
  });

  socket.on('vote', function(ballot) {
    if (ballot) {
      console.log(player.getSocket().id, ' voted ', ballot.choice, ' for ', ballot.name);
      var vote = me.votes[ballot.name];
      if (vote) {
        vote.addVote(ballot.choice, player);
      }
    }
  });

  this.arrRoles = _.without(this.arrRoles, role);
  this.broadcast('num_connected_users', this.arrPlayers.length);
  socket.emit('board_type', ['guerrilla', 'soldier'][this.id % 2]);
  return player;
};

Server.prototype.getPlayerCount = function() {
  return this.arrPlayers.length;
};

Server.prototype.broadcast = function(message, data, source) {
  var players = this.arrPlayers;
  if (source) {
    players = _.reject(this.arrPlayers, function(player) {
      player === source;
    });
  }
  _.each(players, function(player) {
    player.getSocket().emit(message, data);
  });
};

Server.prototype.getGame = function() {
  return this.game;
};

Server.prototype.getId = function() {
  return this.id;
};

Server.prototype.getOpenRoles = function() {
  return this.arrRoles.slice(0); // fake immutability
};

var Player = function(_socket, server, role) {
  var me = this;
  me.server = server;
  me.role = role;
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
    message: 'Welcome to Guerrilla Checkers!' 
  });

  // handle user message
  me.socket.on('message', function(data) {

    me.socket.broadcast.emit('message', data);
    me.socket.emit('message', data);

    //liferay.sendMessage({ type: 'message', data: data });
    //saveMessageToMongo(data);
  });

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
  me.socket.emit('role', role);
  me.server.refreshBoard(true, [me]);

  // send recent messages
  //fetchRecentMessages(function(err,messages) {

  //  for(var i = messages.length-1; i >= 0; --i) {
  //    var message = messages[i];
  //    console.log(message);
  //    me.socket.emit('message', message);
  //  }

  //});
};

Player.prototype.getId = function() {
  return this.id;
};

Player.prototype.getSocket = function() {
  return this.socket;
};

Player.prototype.getRole = function() {
  return this.role;
};

return {
  Player: Player,
  Server: Server
};
}); // requirejs define

