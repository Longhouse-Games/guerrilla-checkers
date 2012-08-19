var requirejs = require('requirejs'),
    logger    = require('./logger');

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

requirejs([
  'underscore',
  './lib/checkers',
  './lib/vote'],
  function(
    _,
    Checkers,
    Vote) {

var GUERRILLA_ROLE = 'guerrilla';
var COIN_ROLE = 'coin';
var SPECTATOR = 'spectator';

var Server = function(gameFactory, dbgame) {
  var me = this;
  me.dbgame = dbgame;
  me.gameFactory = gameFactory;
  me.game = gameFactory();
  me.arrPlayers = [];
  me.arrRoles = [GUERRILLA_ROLE, COIN_ROLE];
  me.votes = {};

  me.requestReset = function() {
    me.startVote(
      'reset',
      'Would you like reset the game',
      function() { me.resetGame(); });
  };
};

Server.prototype.getDBGame = function() {
  return this.dbgame;
}

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

Server.prototype.updateServerStatus = function() {
  var me = this;
  me.broadcast('num_connected_users', me.arrPlayers.length);
};

Server.prototype.refreshBoard = function(result, arrPlayers) {
  var me = this;
  var data = {
    result: result,
    remainingGuerrillaPieces: me.game.getRemainingGuerrillaPieces(),
    phase: me.game.getCurrentPhaseIndex(),
    board: me.game.getPieces(),
    placedGuerrilla: me.game.placedGuerrilla,
    gameState: me.game.asDTO()
  };

  console.log('saving new game state');
  this.dbgame.gameState = JSON.stringify(data.gameState);
  this.dbgame.save(function(err) { if (err) throw err; });

  console.log('update players: ', me.arrPlayers.length);
  _.each(arrPlayers || me.arrPlayers, function(player) {
    var socket = player.getSocket();
    if (_.isUndefined(socket) || _.isNull(socket)) { return; }
    socket.emit('update', data);
  });
  var winner = me.game.getWinner();
  if (winner) {
    me.broadcast('gameOver', {winner: winner});
    me.broadcast('message', {user: 'game', message: 'Game Over'});
    me.broadcast('message', {user: 'game', message: 'Winner: ' + winner});
    me.requestReset();
  }
};

Server.prototype.resetGame = function() {
  this.game = this.gameFactory();
  this.refreshBoard(true);
};

Server.prototype.endGame = function() {
  this.requestReset();
};

Server.prototype.addPlayer = function(socket, user) {
  if (!user) throw "AddPlayer called with 'null' for user."

  var me = this;

  var role = null;

  var coin_player_id = _.isUndefined(this.dbgame._coin_player_id) ? null : this.dbgame._coin_player_id;
  var guerrilla_player_id = _.isUndefined(this.dbgame._guerrilla_player_id) ? null : this.dbgame._guerrilla_player_id;

  logger.error("Checking roles for dbgame.");
  logger.error("COIN_ID: " + coin_player_id);
  logger.error("GUERRILLA_ID: " + guerrilla_player_id);
  logger.error("USER_ID: " + user._id);

  if (coin_player_id !== null && user._id.equals(coin_player_id)) {
    role = COIN_ROLE;
  } else if (guerrilla_player_id !== null && user._id.equals(guerrilla_player_id)) {
    role = GUERRILLA_ROLE;
  } else {
    // Player was not previously assigned a role (or was spectating)
    if (guerrilla_player_id === null) {

      role = GUERRILLA_ROLE;
      this.dbgame._guerrilla_player_id = user._id;
      this.dbgame.save(function(err) { if (err) throw err; });

    } else if (coin_player_id === null) {

      role = COIN_ROLE;
      this.dbgame._coin_player_id = user._id;
      this.dbgame.save(function(err) { if (err) throw err; });

    } else {
      role = SPECTATOR;
    }
  }

  var player = new Player(socket, this, user, role);
  this.arrPlayers.push(player);

  socket.on('disconnect', function(data) {
    console.log('disconnected player: ', player);
    me.arrPlayers = _.without(me.arrPlayers, player);
    me.updateServerStatus();
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
    me.requestReset();
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

  socket.on('takeRole', function(role) {
    me.takeRole(role, player); 
    me.refreshBoard(true, [player]);
  });

  me.broadcast('num_connected_users', me.arrPlayers.length);
  socket.emit('board_type', 'guerrilla');
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
  return this.dbgame.id;
};

Server.prototype.isAvailableRole = function(role) {
  var me = this;
  if (role === GUERRILLA_ROLE) {
    return _.isUndefined(me.dbgame._guerrilla_player_id) || me.dbgame._guerrilla_player_id === null;
  } else if (role === COIN_ROLE) {
    return _.isUndefined(me.dbgame._coin_player_id) || me.dbgame._coin_player_id === null;
  }
  throw "Invalid role: '" + role + "'";
};

Server.prototype.takeRole = function(role, player) {
  var me = this;
  logger.debug('role change requested ' + role + '->' + player.getRole());
  var roleChanged = false;

  var freeRole = function(role) {
    if (role === GUERRILLA_ROLE) {
      me.dbgame._guerrilla_player_id === null;
      me.dbgame.save(function(err) { if (err) throw err; });
    } else if (role === COIN_ROLE) {
      me.dbgame._coin_player_id === null;
      me.dbgame.save(function(err) { if (err) throw err; });
    }
  };

  if (me.isAvailableRole(role)) {
    logger.debug('desired role is available');
    freeRole(player.getRole());
    player.setRole(role);
    me.broadcast('roles', me.arrRoles);
    player.getSocket().emit('role', role);
    me.updateServerStatus();
  }
};

Server.prototype.getOpenRoles = function() {
  var roles = [];
  if (_.isUndefined(this.dbgame._coin_player_id) || this.dbgame._coin_player_id === null) {
    roles.push(COIN_ROLE);
  }
  if (_.isUndefined(this.dbgame._guerrilla_player_id) || this.dbgame._guerrilla_player_id === null) {
    roles.push(GUERRILLA_ROLE);
  }
  return roles;
};

var Player = function(_socket, server, user, role) {
  var me = this;
  me.server = server;
  me.role = role;
  me.socket = _socket;
  me.id = me.socket.handshake.sessionID;

  me.socket.emit('user_info', {
    name: user.name
  });

  // welcome message
  me.socket.emit('message', {
    user: 'server',
    message: 'Welcome to Guerrilla Checkers!'
  });

  // handle user message
  me.socket.on('message', function(data) {

    me.socket.broadcast.emit('message', data);
    me.socket.emit('message', data);

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

Player.prototype.setRole = function(role) {
  this.role = role;
};


module.exports.Player = Player;
module.exports.Server = Server;
}); // requirejs define

