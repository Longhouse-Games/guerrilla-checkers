define([
  'underscore',
  'lib/checkers'],
  function(_, GuerrillaCheckers) {

  var metadata = GuerrillaCheckers.metadata;
  var GUERRILLA_ROLE = metadata.roles[0].slug;
  var COIN_ROLE = metadata.roles[1].slug;

  var Bridge = function(raven, dbData) {
    var sockets = {};
    var guerrilla_checkers;

    sockets[GUERRILLA_ROLE] = null;
    sockets[COIN_ROLE] = null;

    if (dbData && dbData.game_state) {
      guerrilla_checkers = GuerrillaCheckers.create(dbData.game_state);
    } else {
      guerrilla_checkers = GuerrillaCheckers.create();
    }

    function addPlayer(socket, user, role) {
      var opponent_role;

      if (!socket || !user || !role) {
        throw "Error! Invalid socket, user or role.";
      }

      opponent_role = role === GUERRILLA_ROLE ? COIN_ROLE : GUERRILLA_ROLE;
      sockets[role] = socket;

      updatePlayer(role, null);

      handleMessage('placeGuerrilla', function(data) {
        return guerrilla_checkers.placeGuerrillaPiece(data.position);
      });

      handleMessage('moveCOIN', function(data) {
        return guerrilla_checkers.moveSoldierPiece(data.piece, data.position);
      });

      // TODO forfeit should be handled entirely by Raven
      handleMessage('forfeit', function(data) {
        guerrilla_checkers.forfeit(role);
        raven.forfeit(role);
        raven.broadcast('message', {user: 'game', message: user.gaming_id + " has forfeited the game."});
      });

      function updatePlayer(role, data) {
        if (sockets[role]) {
          var payload = {
            result: data,
            gameState: guerrilla_checkers.asDTO()
          };
          sockets[role].emit('update', payload);
        }
      }

      function broadcastUpdate(result) {
        updatePlayer(GUERRILLA_ROLE, result);
        updatePlayer(COIN_ROLE, result);
      }

      function save() {
        raven.save({ game_state: guerrilla_checkers.asDTO() });
      }

      function checkForWinner() {
        var winner = guerrilla_checkers.getWinner();
        if (winner) {
          raven.broadcast('gameOver', {winner: winner});
          raven.broadcast('message', {user: 'game', message: 'Game Over'});
          var role = _.find(metadata.roles, function(role){ return role.slug === winner });
          raven.broadcast('message', {user: 'game', message: 'Winner: ' + role.name});
          if (!guerrilla_checkers.winner) { //the game was forfeit, don't notify again TODO this is ugly
            raven.gameover(guerrilla_checkers.getWinner(), guerrilla_checkers.getScores());
          }
        }
      }

      function handleError(callback, data) {
        try {
          return callback(data);
        } catch (e) {
          socket.emit('error', e);
          console.log("Error: ", e);
          console.log(e.stack);
        }
      }

      function handleMessage(message, callback) {
        socket.on(message, function(data) {
          console.log("["+user.gaming_id+"] " + message +": " + data);

          var result = handleError(callback, data);
          checkForWinner();
          save();
          broadcastUpdate(result);
        });
      }
    }

    return {
      addPlayer: addPlayer,
      getPlayerCount: function() { return 0; }
    };
  };

  Bridge.initialPlayerState = function() {
    var state = {};
    state[GUERRILLA_ROLE] = "ATTN";
    state[COIN_ROLE] = "PEND";
    return state;
  };
  Bridge.metadata = metadata;
  return Bridge;

});
