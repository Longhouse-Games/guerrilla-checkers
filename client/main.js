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

  var socket = io.connect(null, {
    'remember transport': false
  });
  var g_role = 'spectator';
  var g_gameState = null;
  var g_playSounds = true;
  var g_soundsLoaded = false;

  function getPositionKey(position) {
    if (!position) {
      return undefined;
    }
    return position.x + "," + position.y;
  }

  function isSoldierPlayer() {
    return g_role === 'coin';
  }

  function isGuerrillaPlayer() {
    return g_role === 'guerrillas';
  }

  function isSpectator() {
    return g_role === 'spectator';
  }

  function cssTheme() {
    if (isSoldierPlayer()) {
      return "coin_theme";
    }
    return "guerrilla_theme";
  }

  var g_soldierPiecesOnBoard = {}; // "x,y" -> img
  var g_guerrillaPiecesOnBoard = {}; // "x,y" -> img

  var SQUARE_SIZE = 70;
  var SOLDIER_MARGIN = 39;
  var GUERRILLA_MARGIN = 88;

  function addPiece(container, piece, className, margin, piecesOnBoard) {
    var newPieceOnBoard = document.createElement("div");
    newPieceOnBoard.className += " " + className;
    newPieceOnBoard.style.left = margin + ((piece.position.x) * SQUARE_SIZE) + 'px';
    newPieceOnBoard.style.bottom = margin + ((piece.position.y) * SQUARE_SIZE) + 'px';
    container.appendChild(newPieceOnBoard);
    if (piecesOnBoard) {
      piecesOnBoard[getPositionKey(piece.position)] = newPieceOnBoard;
    }
    return newPieceOnBoard;
  }

  function addSoldierPiece(piece, container) {
    container = container || document.getElementById('pieces');
    var piecesOnBoard = g_soldierPiecesOnBoard;
    var newPieceOnBoard = addPiece(container, piece, 'soldier_piece '+cssTheme()+"_soldier", SOLDIER_MARGIN, piecesOnBoard);
    addSoldierPieceBehaviour(piece);
    return newPieceOnBoard;
  }

  var g_selectedSoldierPiece = null;
  function getSelectedSoldierPiece() {
    return g_selectedSoldierPiece;
  }

  function setSelectedSoldierPiece(piece) {
    for (var positionKey in g_soldierPiecesOnBoard) {
      var otherPieceOnBoard = g_soldierPiecesOnBoard[positionKey];
      var className = otherPieceOnBoard.className.replace(/\s*selected/g, '');
      otherPieceOnBoard.className = className;
    }
    if (g_gameState.isSoldierTurn() && piece) {
      var positionKey = getPositionKey(piece.position);
      var pieceOnBoard = g_soldierPiecesOnBoard[positionKey];
      g_selectedSoldierPiece = pieceOnBoard;
      if (pieceOnBoard) {
        pieceOnBoard.className += " selected";
      }
    } else {
      g_selectedSoldierPiece = null;
    }
    if (piece) {
      updateSoldierMoves(piece);
    } else {
      hideSoldierMoves();
    }
  }

  function addSoldierPieceBehaviour(piece) {
    var positionKey = getPositionKey(piece.position);
    var pieceOnBoard = g_soldierPiecesOnBoard[positionKey];
    if (!pieceOnBoard) {
      return;
    }
    if (isSoldierPlayer()) {
      pieceOnBoard.onclick = function() {
        if (!g_gameState.movedSoldier) {
          setSelectedSoldierPiece(piece);
        }
      }
    }
  }

  function addGuerrillaPiece(piece, container) {
    container = container || document.getElementById('pieces');
    var piecesOnBoard = g_guerrillaPiecesOnBoard;
    var newPieceOnBoard = addPiece(container, piece, 'guerrilla_piece '+cssTheme()+"_guerrilla", GUERRILLA_MARGIN, piecesOnBoard);
    return newPieceOnBoard;
  }

  function updatePieces(arrPieces, piecesOnBoard, addPiece) {
    arrPieces = arrPieces || [];
    piecesOnBoard = piecesOnBoard || {};
    var removedPieces = {};
    for (var positionKey in piecesOnBoard) {
      removedPieces[positionKey] = piecesOnBoard[positionKey];
    }
    // add new pieces
    for (var idxPiece = 0; idxPiece < arrPieces.length; ++idxPiece) {
      var piece = arrPieces[idxPiece];
      var positionKey = getPositionKey(piece.position);
      var pieceOnBoard = piecesOnBoard[positionKey];
      if (!pieceOnBoard) {
        addPiece(piece);
      }
      delete removedPieces[positionKey];
    }
    // remove extra pieces
    for (var positionKey in removedPieces) {
      delete piecesOnBoard[positionKey];
      var pieceOnBoard = removedPieces[positionKey];
      var parentNode = pieceOnBoard.parentNode;
      if (parentNode) {
        parentNode.removeChild(pieceOnBoard);
      }
    }
  }

  function updateSoldierPieces() {
    if (g_gameState) {
      var arrPieces = g_gameState.arrSoldierPieces;
      updatePieces(arrPieces, g_soldierPiecesOnBoard, addSoldierPiece);
      if (isSoldierPlayer() && g_gameState.movedSoldier) {
        setSelectedSoldierPiece(g_gameState.movedSoldier);
      }
    }
  }

  function updateGuerrillaPieces() {
    if (g_gameState) {
      var arrPieces = g_gameState.arrGuerrillaPieces;
      updatePieces(arrPieces, g_guerrillaPiecesOnBoard, addGuerrillaPiece);
    }
  }

  function createGuerrillaMove($moves, move) {
    var piece = { position: move };
    var container = $moves.get(0);
    var newPieceOnBoard = addPiece(container, piece, 'guerrilla_piece '+cssTheme()+"_guerrilla", GUERRILLA_MARGIN);
    newPieceOnBoard.onclick = function() {
      socket.emit('placeGuerrilla', piece);
    }
  }

  function hideGuerrillaMoves() {
    var $moves = $('#guerrilla_moves');
    $moves.css('visibility', 'hidden');
  }

  function showGuerrillaMoves() {
    var $moves = $('#guerrilla_moves');
    $moves.text("");
    var arrMoves = g_gameState.getPotentialGuerrillaMoves();
    for (var idx = 0; idx < arrMoves.length; ++idx) {
      var move = arrMoves[idx];
      createGuerrillaMove($moves, move);
    }
    $moves.css('visibility', 'visible');
  }

  function updateGuerrillaMoves() {
    if (!g_gameState) {
      return;
    }
    hideGuerrillaMoves();
    if (!isGuerrillaPlayer() || g_gameState.getWinner()) {
      return;
    }
    if (g_gameState.isGuerrillaTurn()) {
      showGuerrillaMoves();
    }
  }

  function createSoldierMove($moves, piece, position) {
    var move = { piece: piece.position, position: position };
    var container = $moves.get(0);
    var newPieceOnBoard = addPiece(container, move, 'soldier_piece '+cssTheme()+"_soldier", SOLDIER_MARGIN);
    newPieceOnBoard.onclick = function() {
      socket.emit('moveCOIN', move);
      setSelectedSoldierPiece(null);
      hideSoldierMoves();
    }
  }

  function hideSoldierMoves() {
    var $moves = $('#soldier_moves');
    $moves.css('visibility', 'hidden');
  }

  function showSoldierMoves(piece) {
    var $moves = $('#soldier_moves');
    $moves.text("");
    if (g_gameState.movedSoldier) {
      var arrMoves = g_gameState.getSoldierCapturingMoves(piece);
    } else {
      var arrMoves = g_gameState.getPotentialSoldierMoves(piece);
    }
    for (var idx = 0; idx < arrMoves.length; ++idx) {
      var position = arrMoves[idx];
      createSoldierMove($moves, piece, position);
    }
    $moves.css('visibility', 'visible');
  }

  function updateSoldierMoves(piece) {
    if (!g_gameState) {
      return;
    }
    hideSoldierMoves();
    if (!isSoldierPlayer()) {
      return;
    }
    if (piece && g_gameState.isSoldierTurn()) {
      showSoldierMoves(piece);
    }
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

  function updateStatusArea() {
    var remainingGuerrillas = g_gameState.remainingGuerrillaPieces;
    var capturedGuerrillas = g_gameState.STARTING_GUERRILLA_PIECES - remainingGuerrillas - g_gameState.getGuerrillaPieces().length;
    var capturedCOINs = 6 - g_gameState.getSoldierPieces().length;
    var turns = g_gameState.turnCount;
    $('#remaining_guerrillas').first().text(remainingGuerrillas);
    $('#captured_guerrillas').first().text(capturedGuerrillas);
    $('#captured_coins').first().text(capturedCOINs);
    $('#turn_count').first().text(turns);
  }

  function playSound(id) {
    if (g_playSounds) {
      var sound = document.getElementById(id);
      if (sound.readyState === 4) { // HAVE_ENOUGH_DATA - aka it's loaded
        sound.play();
      }
    }
  }

  function notifyPlayer() {
    if ((isSoldierPlayer() && g_gameState.isSoldierTurn() && !g_gameState.movedSoldier) ||
        (isGuerrillaPlayer() && g_gameState.isGuerrillaTurn()) && !g_gameState.placedGuerrilla) {
      playSound('your_turn');
    }
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

  socket.on('connect', function() {

    // receive messages
    socket.on('message', function (data) {
      printMessage(data.user, data.message);
      window.scrollTo(0, document.body.scrollHeight);
    });
    socket.on('error', function(msg) {
      printMessage("server", "Error: " + msg);
      console.log("Server error: " + msg);
      window.scrollTo(0, document.body.scrollHeight);
    });
    socket.on('session_error', function(data) {
      console.log("Invalid session. Reloading.");
      location.reload();
    });
    socket.on('user_disconnect', function(data) {
      var userSpan = document.getElementById(data.user);
      if (socket.id != data.user && userSpan && userSpan.parentNode) {
        userSpan.parentNode.remove(userSpan);
      }
    });

    socket.on('role', function(role) {
      g_role = role;
      if (isGuerrillaPlayer()) {
        printMessage("server", "You are the Guerrilla player!");
        $('.board').addClass('guerrilla_board');
      } else if (isSoldierPlayer()) {
        printMessage("server", "You are the State player!");
        $('.board').addClass('coin_board');
      } else {
        printMessage("server", "You are a spectator");
        $('.board').addClass('guerrilla_board');
      }
    });

    socket.on('num_connected_users', function(numConnectedUsers) {
      if (numConnectedUsers >= 1) {
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

    socket.on('user_info', function(userInfo) {
      $('#username').val(userInfo.name);
    });

    socket.on('update', function(updateResponse) {
      if (!updateResponse || !updateResponse.gameState) {
        return;
      }

      g_gameState = new checkers.GameState;
      g_gameState.fromDTO(updateResponse.gameState);

      notifyPlayer();
      updatePlayerTurnOverlay();
      updateStatusArea();
      updateGuerrillaPieces();
      updateSoldierPieces();
      updateGuerrillaMoves();
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

  $("#toggle_sound").bind('click', function() {
    if (g_playSounds) {
      g_playSounds = false;
      $("#toggle_sound").text("Enable Sound");
    } else {
      g_playSounds = true;
      $("#toggle_sound").text("Disable Sound");
    }
  });

});

