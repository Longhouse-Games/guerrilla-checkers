requirejs.config({
  baseUrl: 'client',
  paths: {
    lib: '../lib',
    underscore: "../vendor/underscore/underscore"
  },
  shim: {
    underscore: {
      exports: '_'
    }
  }
});

require(["underscore", "lib/checkers", 'helpers'], function(_, Checkers, helpers) {

  if (Array.prototype.forEach === undefined) {
    Array.prototype.forEach = function(callback) {
      for (var idx = 0; idx < this.length; ++idx) {
        callback(this[idx]);
      }
    }
  }

  var metadata = new Checkers.Metadata();
  var socket = io.connect(null, {
    'remember transport': false
  });
  var g_role = 'spectator';
  var g_gameState = null;
  var g_playSounds = true;
  var g_showShadows = true;
  var g_soundsLoaded = false;

  function getPositionKey(position) {
    if (!position) {
      return undefined;
    }
    return position.x + "," + position.y;
  }

  function isSoldierPlayer() {
    return g_role === metadata.roles[1].slug;
  }

  function isGuerrillaPlayer() {
    return g_role === metadata.roles[0].slug;
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
      g_selectedSoldierPiece = piece;
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
        if (!g_gameState.movedSoldier && !g_gameState.getWinner()) {
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

  function updateCapturedSoldiers() {
    if (!g_gameState) { return; }

    var theme = cssTheme();

    var $side = $("#side");
    var $soldier_status = $("#soldier_status");
    if (!$soldier_status.get(0)) {
      $soldier_status = $("<div></div>").attr("id", "soldier_status");
      $side.append($soldier_status);
    }
    $soldier_status.text('');
    var num_captured = Math.min(6, 6-g_gameState.arrSoldierPieces.length);
    for (var i = 0; i < num_captured; i++) {
      var captured_coin = document.createElement("div");
      captured_coin.className = "captured_coin captured_coin_position"+i;
      $soldier_status.get(0).appendChild(captured_coin);
    }
  }

  function updateGuerrillaReserves() {
    if (!g_gameState) { return; }

    var $side = $("#side");
    var $guerrilla_reserves = $("#guerrilla_reserves");
    if (!$guerrilla_reserves.get(0)) {
      $guerrilla_reserves = $("<div></div>").attr("id", "guerrilla_reserves");
      $side.append($guerrilla_reserves);
    }
    $guerrilla_reserves.text('');

    if (isSoldierPlayer()) {
      var pieces_per_row = 11;
      var HEIGHT = 10;
      var WIDTH = 10;
      var MARGIN_RIGHT = 10;
      var MARGIN_TOP = 7;
      var starting_guerrillas = 66;
      var num_in_play = g_gameState.getGuerrillaPieces().length;
      var num_captured = starting_guerrillas - num_in_play - g_gameState.remainingGuerrillaPieces;
      for (var i = 0; i < starting_guerrillas; i++) {
        var guerrilla = document.createElement("div");
        var row = (Math.floor(i / pieces_per_row));
        guerrilla.className = "guerrilla_reserve";
        if ((i+1) <= (num_captured)) {
          var xmark = document.createElement("div");
          xmark.className = "captured captured"+(i%3); // TODO make the marks more random
          guerrilla.appendChild(xmark);
        } else if ((i+1) <= (num_captured + num_in_play)) {
          guerrilla.className += " in_play";
        } else {
          guerrilla.className += " in_reserve";
        }
        guerrilla.style.top = row*(HEIGHT + MARGIN_TOP);
        guerrilla.style.left = (i % pieces_per_row) * (WIDTH + MARGIN_RIGHT);
        $guerrilla_reserves.get(0).appendChild(guerrilla);
      }
    } else {
      var num_reserves = Math.min(40, g_gameState.remainingGuerrillaPieces);
      var pieces_per_row = 8;
      var HEIGHT = 28;
      var WIDTH = 28;
      var MARGIN_RIGHT = 5;
      var MARGIN_TOP = 2;
      var ODD_ROW_OFFSET = 10;
      for (var i = 0; i < num_reserves; i++) {
        var reserve = document.createElement("div");
        var row = (Math.floor(i / pieces_per_row));
        reserve.className = "guerrilla_piece guerrilla_theme_guerrilla guerrilla_reserve";
        reserve.style.top = row*(HEIGHT + MARGIN_TOP);
        reserve.style.left = (i % pieces_per_row) * (WIDTH + MARGIN_RIGHT) + (row % 2)*ODD_ROW_OFFSET;
        $guerrilla_reserves.get(0).appendChild(reserve);
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
    var css_class = g_showShadows ? 'guerrilla_piece '+cssTheme()+"_guerrilla guerrilla_shadow" : "guerrilla_piece";
    var newPieceOnBoard = addPiece(container, piece, css_class, GUERRILLA_MARGIN);
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
    var css_class = g_showShadows ? 'soldier_piece '+cssTheme()+"_soldier" : "soldier_piece";
    var newPieceOnBoard = addPiece(container, move, css_class, SOLDIER_MARGIN);
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
    if (g_gameState.getWinner()) {
      var winner = _.find(metadata.roles, function(role){ return role.slug === g_gameState.getWinner();});
      var msg;
      if (winner ===  metadata.roles[0]) {
        msg = "GUERRILLAS WIN";
      } else {
        msg = "THE STATE WINS";
      }
      setOverlayText($overlay, msg);
      return;
    }
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
    messageDiv.innerHTML = '<span class="chat_name chat_'+user+'">' + user +
      '</span>' + "<span class='chat_message'>"+message+"</span>";
    document.getElementById('chat_messages').appendChild(messageDiv);
    $('#chat_messages').scrollTop($('#chat_messages')[0].scrollHeight);
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
        $('#side').addClass('guerrilla_side');
      } else if (isSoldierPlayer()) {
        printMessage("server", "You are the State player!");
        $('.board').addClass('coin_board');
        $('#side').addClass('coin_side');
      } else {
        printMessage("server", "You are a spectator");
        $('.board').addClass('guerrilla_board');
        $('#side').addClass('guerrilla_side');
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

      g_gameState = new Checkers.GameState;
      g_gameState.fromDTO(updateResponse.gameState);

      notifyPlayer();
      updatePlayerTurnOverlay();
      updateStatusArea();
      updateGuerrillaPieces();
      updateSoldierPieces();
      updateGuerrillaMoves();
      updateCapturedSoldiers();
      updateGuerrillaReserves();

      if (g_gameState.getWinner()) {
        $("#forfeit").addClass("disabled");
      }
    });

    // send message functionality
    var messageInput = document.getElementById('chat_input');
    var usernameInput = document.getElementById('username');
    var sendButton = document.getElementById('send_chat');
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

  $(".toggle_sound").bind('click', function() {
    if (g_playSounds) {
      g_playSounds = false;
      $("#toggle_sound").text("Enable Sound");
      $("#volume_control").addClass("volume_control_off");
      $("#volume_control").removeClass("volume_control_on");
    } else {
      g_playSounds = true;
      $("#toggle_sound").text("Disable Sound");
      $("#volume_control").addClass("volume_control_on");
      $("#volume_control").removeClass("volume_control_off");
    }
  });

  $("#toggle_shadows").bind('click', function() {
    if (g_showShadows) {
      g_showShadows = false;
      $("#toggle_shadows").text("Enable shadow pieces");
    } else {
      g_showShadows = true;
      $("#toggle_shadows").text("Disable shadow pieces");
    }
    if (isGuerrillaPlayer()) {
      updateGuerrillaMoves();
    } else if (isSoldierPlayer()) {
      updateSoldierPieces();
      setSelectedSoldierPiece(g_selectedSoldierPiece);
    }
  });

  $("#settings_dialog").dialog({
    autoOpen: false,
    dialogClass: "settings_dialog",
    draggable: false,
    resizable: false,
    width: 350,
    buttons: [ { text: "Close", click: function() { $( this ).dialog( "close" ); } } ]
  });
  $("#settings").bind('click', function() {
    if ($("#settings_dialog").dialog("isOpen")) {
      $("#settings_dialog").dialog("close");
    } else {
      $("#settings_dialog").dialog("open");
    }
  });

  function forfeit_game() {
    socket.emit('forfeit');
  }

  $("#forfeit_dialog").dialog({
    autoOpen: false,
    dialogClass: "settings_dialog",
    modal: true,
    width: 400,
    buttons: [
      { text: "Forfeit", click:
        function() {
          forfeit_game();
          $( this ).dialog("close");
        } },
      { text: "Close", click: function() { $( this ).dialog("close"); } }
    ]
  });
  $("#forfeit").bind('click', function() {
    if (!g_gameState.getWinner()) {
      $("#forfeit_dialog").dialog("open");
    }
  });

});

