requirejs.config({
  baseUrl: 'client',
  paths: {
    lib: '../lib'
  }
});

require(["lib/checkers", 'helpers'], function(checkers, helpers) {

  if (Array.prototype.forEach === undefined) {
    Array.prototype.forEach = function(callback) {
      for (var idx = 0; idx < this.length; ++idx) {
        callback(this[idx]);
      }
    }
  }

  var socket = io.connect();
  var g_role = 'spectator';
  var g_gameState = null;

  function isSoldierPlayer() {
    return g_role === 'coin';
  }

  function isGuerrillaPlayer() {
    return g_role === 'guerrilla';
  }

  function isSpectator() {
    return g_role === 'spectator';
  }

  function setTransitionProperty($element, value) {
    $element.css('transition', value);
    $element.css('webkitTransition', value);
    $element.css('mozTransition', value);
    $element.css('oTransition', value);
  }

  function clearTransitionProperty($element) {
    $element.css('transition', '');
    $element.css('webkitTransition', '');
    $element.css('mozTransition', '');
    $element.css('oTransition', '');
  }

  function setOverlayText($overlay, text) {
    text = text || "";
    if ($overlay.text() == text) {
      return;
    }
    var oldBackground = $overlay[0].style.background;
    var timeout = 450;
    $overlay.text(text);
    setTransitionProperty($overlay, 'background ' + timeout + 'ms');
    $overlay.css('background', '#C90');
    setTimeout(function() {
      $overlay.css('background', oldBackground);
      setTimeout(function() {
        clearTransitionProperty
      }, timeout);
    }, timeout);
  }

  function updatePlayerTurnOverlay() {
    var $overlay = $('#turn_overlay').first();
    var yourTurn = "YOUR TURN";
    var opponentsTurn = "OPPONENT'S TURN";
    if (isSpectator()) {
      setOverlayText($overlay, g_gameState.getCurrentPhase() + "'S TURN");
      return;
    }
    if (isSoldierPlayer()) {
      setOverlayText($overlay, g_gameState.isSoldierTurn() ? yourTurn : opponentsTurn);
      return;
    }
    if (isGuerrillaPlayer()) {
      setOverlayText($overlay, g_gameState.isGuerrillaTurn() ? yourTurn : opponentsTurn);
      return;
    }
  }


  function printMessage(user, message) {
    var messageDiv = document.createElement('div');
    messageDiv.innerHTML = '<span style="padding-right: 15px; color: red;">' + user +
      '</span>' + message;
    document.getElementById('chatlog').appendChild(messageDiv);
    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
  };

  // reset game handler
  var $reset = $('#reset');
  $reset.bind('click', function() {
    socket.emit('requestReset');
  });

  $(window).bind('load', function() {

    // receive messages
    socket.on('message', function (data) {
      printMessage(data.user, data.message);
      window.scrollTo(0, document.body.scrollHeight);
    });
    socket.on('user_disconnect', function(data) {
      var userSpan = document.getElementById(data.user);
      if (socket.id != data.user && userSpan && userSpan.parentNode) {
        userSpan.parentNode.remove(userSpan);
      }
    });

    socket.on('role', function(role) {
      g_role = role;
      if (role === 'guerrilla') {
        printMessage("server", "You are the Guerrilla player!");
      } else if (role === 'coin') {
        printMessage("server", "You are the COIN player!");
      } else {
        printMessage("server", "You are a spectator");
      }
      $('.board').addClass('guerrilla_board');
    });

    socket.on('num_connected_users', function(numConnectedUsers) {
      if (numConnectedUsers >= 2) {
        $('.board').first().show();
        $('#waiting').hide();
      } else {
        $('#waiting').show();
        $('.board').first().hide();
      }
    });

    socket.on('getVote', function(vote) {
      var choice = confirm(vote.question);
      socket.emit('vote', {name: vote.name, choice: choice ? 'yes' : 'no'});
    });

    socket.on('update', function(updateResponse) {
      if (!updateResponse || !updateResponse.gameState) {
        return;
      }
      g_gameState = new checkers.GameState;
      g_gameState.fromDTO(updateResponse.gameState);
      updatePlayerTurnOverlay();
    });

    // send message functionality
    var messageInput = document.getElementById('message');
    var usernameInput = document.getElementById('username');
    var sendButton = document.getElementById('send_button');
    var sendMessage = function() {
      var message = messageInput.value;
      if (!message) {
        return;
      }
      var user = usernameInput.value || 'player';
      socket.emit('message', { user: user, message: message });
      messageInput.value = '';
      messageInput.focus();
    };

    // send messages
    $(sendButton).bind('click', sendMessage);
    $(messageInput).bind('keypress', function(evt) {
      if (evt.keyCode == 13) { sendMessage(); }
    });
  });

});

