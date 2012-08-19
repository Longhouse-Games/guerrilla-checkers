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
  var g_boardType = 'guerrilla';
  var g_role = 'spectator';
  var g_init = false;
  var g_gameState = null;
  // TODO refactor. this should be queryable from the game class
  var g_phases = ["GUERRILLA", "GUERRILLA", "SOLDIER"];

  function isCOINPlayer() {
    return g_role === 'coin';
  }

  function isGuerrillaPlayer() {
    return g_role === 'guerrilla';
  }

  function isSpectator() {
    return g_role === 'spectator';
  }

  // allow direct querying of board squares by x/y
  var g_boardSquares = {};
  function getSquare(x, y) {
    return g_boardSquares[x + ',' + y];
  }
  function setSquare(x, y, square) {
    g_boardSquares[x + ',' + y] = square;
  }
  function getIntersection(x, y) {
    return $(getSquare(x,y)).children(".intersection");
  }

  function setTurnText() {
    var yourTurn = "YOUR TURN";
    var opponentsTurn = "OPPONENT'S TURN";
    if (isSpectator()) {
      setOverlayText(getCurrentPhase() + "'S TURN");
      return;
    }
    if (isCOINPlayer()) {
      setOverlayText(isCOINTurn() ? yourTurn : opponentsTurn);
      return;
    }
    if (isGuerrillaPlayer()) {
      setOverlayText(isGuerrillaTurn() ? yourTurn : opponentsTurn);
      return;
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

  function setOverlayText(text) {
    text = text || "";
    var $overlay = $('#turn_overlay').first();
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

  var printMessage = function(user, message) {
    var messageDiv = document.createElement('div');
    messageDiv.innerHTML = '<span style="padding-right: 15px; color: red;">' + user +
      '</span>' + message;
    document.getElementById('chatlog').appendChild(messageDiv);
    $('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
  };

  var $reset = $('#reset');
  $reset.bind('click', function() {
    socket.emit('requestReset');
  });

  var selected = null;

  var moveCOIN = function(socket, start_x, start_y, target_x, target_y) {
    socket.emit('moveCOIN', {
      piece: {x: start_x, y: start_y},
      position: {x:target_x, y:target_y}
    });
  };

  var placeGuerrilla = function(socket, x, y) {
    if (!g_gameState.isValidGuerrillaPlacement({ x:x, y:y })) {
      return;
    }
    console.log("Placing guerrilla at " + x + ", " +y);
    socket.emit('placeGuerrilla', {
      position: {x: x, y: y}
    });
  };

  function getCurrentPhase() {
    return g_phases[g_gameState.getCurrentPhaseIndex()];
  }

  function isGuerrillaTurn() {
    return getCurrentPhase() === 'GUERRILLA';
  }

  function isCOINTurn() {
    return getCurrentPhase() === 'SOLDIER';
  }

  function drawCOINPiece(x, y) {
    square = $(getSquare(x, y));
    img = $('<img src="images/' + g_boardType + '/soldier_piece.png" class="soldier piece" width=68 height=68 alt="white" />');
    square.append(img);
    return square;
  }

  function clearPossibleMoves() {
    function removeShadow(index, element) {
      element.parentNode && element.parentNode.removeChild(element);
    }
    var $board = $("#checkers").first();
    var $shadows = $board.find("img.shadow");
    $shadows.each(removeShadow);
  }

  function drawCOINShadow(x, y) {
    square = $(getSquare(x, y));
    img = $('<img src="images/' + g_boardType + '/soldier_piece.png" class="soldier piece shadow" width=68 height=68 alt="white" />');
    square.append(img);
    return square;
  }

  function drawGuerrillaPiece(x, y) {
    intersection = getIntersection(x, y);
    img = $('<img src="images/' + g_boardType + '/guerrilla_piece.png" class="guerrilla piece"/>');
    intersection.append(img);
    return intersection;
  }

  function drawGuerrillaShadow(x, y) {
    intersection = getIntersection(x, y);
    img = $('<img src="images/' + g_boardType + '/guerrilla_piece.png" class="guerrilla piece shadow"/>');
    intersection.append(img);
    return intersection;
  }

  function doesSquareContainCOINPiece(x, y) {
    pieces = g_gameState.getSoldierPieces() || [];
    var i;
    for (i = 0; i < pieces.length; i++) {
      piece = pieces[i];
      if (piece.position && piece.position.x === x && piece.position.y === y) {
        return true;
      }
    }
    return false;
  }

  function showPossibleGuerrillaMoves() {
    console.log("Showing possible moves");
    var i;
    positions = g_gameState.getPotentialGuerrillaMoves();
    console.log(positions);
    for (i = 0; i < positions.length; i++) {
      drawGuerrillaShadow(positions[i].x, positions[i].y);
    }
  }

  function showPossibleCOINMoves(coin_piece) {

    function getPossibleMovesFunctionName() {
      var movedSoldier = g_gameState.movedSoldier;
      if (!movedSoldier) {
        return "getPotentialSoldierMoves";
      }
      var thisPieceMoved = coin_piece.position.x === movedSoldier.position.x && 
        coin_piece.position.y === movedSoldier.position.y;
      return thisPieceMoved ? "getSoldierCapturingMoves" : "getPotentialSoldierMoves";
    }

    clearPossibleMoves();
    var possibleMovesFunctionName = getPossibleMovesFunctionName();
    positions = g_gameState[possibleMovesFunctionName](coin_piece);
    for (i = 0; i < positions.length; i++) {
      drawCOINShadow(positions[i].x, positions[i].y);
    }

  }

  $(window).bind('load', function() {
    function generateSelectHandler(x, y, square) {
      var squareClass = helpers.getSquareClass(x, y);
      return function() {
        if (!isCOINTurn()) {
          return;
        }
        if (!selected) {
          if (!doesSquareContainCOINPiece(x, y)) {
            return;
          }
          selected = {x: x, y: y, square: square, squareClass: squareClass};
          $(square).removeClass(squareClass);
          $(square).addClass('selected');
          showPossibleCOINMoves({position: selected});
          return;
        }
        moveCOIN(socket, selected.x, selected.y, x, y);
        $(selected.square).removeClass('selected');
        $(selected.square).addClass(selected.squareClass);
        selected = null;

        // deselect text
        document.selection && document.selection.clear();
        window.getSelection() && window.getSelection().removeAllRanges();
      };
    };

    var generateIntersectionHandler = function(x, y, intersection) {
      return function() {
        if (!isGuerrillaTurn()) {
          return;
        }
        placeGuerrilla(socket, x, y);
      };
    }
    var SQUARE_SIZE = 70;
    var HALF_SQUARE_SIZE = 35;

    var initBoard = function() {

      function getSquareZIndex(x, y) {
        return "" + (isCOINPlayer() ? (x+1)*(y+1) : 0);
      }

      function getIntersectionZIndex(x, y) {
        return "" + (isGuerrillaPlayer() ? (x+1)*(y+1) : 0);
      }

      function squareHasIntersection(x, y) {
        return x < 7 && y < 7;
      }

      function createIntersectionDomElement(x, y) {
        var intersection = $('<div />')
          .addClass('intersection')
          .css('z-index', getIntersectionZIndex(x, y));
        return intersection;
      }

      function createSquareDomElement(x, y) {
        var squareClass = helpers.getSquareClass(x, y);
        var square = $('<div />');
        square.addClass('square');
        square.addClass(squareClass);
        square.css('z-index', getSquareZIndex());
        return square;
      }

      function addIntersectionHandlers($intersection, x, y) {
        if (isGuerrillaPlayer()) {
          var clickHandler = generateIntersectionHandler(x, y, $intersection);
          $intersection.bind('click', clickHandler);
        }
      }

      function addSquareHandlers($square, x, y) {
        if (!isCOINPlayer()) {
          return;
        }
        var clickHandler = generateSelectHandler(x, y, $square);
        function dropHandler(event, ui) {
          if (!isCOINTurn()) {
            return;
          }
          var srcPosition = ui.draggable.context.boardPosition;
          moveCOIN(socket, srcPosition.x, srcPosition.y, x, y);
        }
        $square.bind('click', clickHandler);
        $square.droppable({ hoverClass: 'square_hover', drop: dropHandler });
      }

      function forEachPosition(callback) {
        if (typeof callback !== 'function') {
          return;
        }
        for(y = 7; y >= 0; --y) {
          for(x = 0; x < 8; ++x) {
            callback(x, y);
          }
        }
      }

      function createSquare(x, y) {
        var $square = createSquareDomElement(x, y);
        if (squareHasIntersection(x, y)) {
          var $intersection = createIntersectionDomElement(x, y);
          $square.append($intersection);
          addIntersectionHandlers($intersection, x, y);
        }
        setSquare(x, y, $square);
        addSquareHandlers($square, x, y);
        return $square;
      }

      function setBoardStyle($board) {
        $board.css('position', 'relative');
        $board.css('overflow', 'hidden');
      }

      var $board = $('#checkers').first();
      forEachPosition(function(x, y) {
        $board.append(createSquare(x, y));
      });
      setBoardStyle($board);

    }

    // receive messages
    socket.on('user_info', function(user_info) {
      $('#username').val(user_info.name);
    });
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

    socket.on('board_type', function(boardType) {
      g_boardType = boardType;
      $('.board').addClass(g_boardType + '_board');
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

      if (g_init !== true) {
        initBoard();
        g_init = true;
      }

      dto = updateResponse.gameState;

      g_gameState = new checkers.GameState;
      g_gameState.fromDTO(dto);
      console.log(g_gameState);

      setTurnText();

      // clear board state
      $(".piece").remove();
      for (var y = 7; y >= 0; --y) {
        for (var x = 0; x < 8; ++x) {
          var square = getSquare(x, y);
          $(square).children('span').remove();
        }
      }

      // load soldier pieces
      var soldierPieces = g_gameState.getSoldierPieces() || [];
      soldierPieces.forEach(function(soldierPiece) {
        if (!soldierPiece || !soldierPiece.position) {
          return;
        }
        var position = soldierPiece.position;
        var square = getSquare(position.x, position.y);
        if (!square) {
          return;
        }

        function showPossibleMovesForPiece(pieceImage, square) {
          var x = pieceImage.boardPosition.x;
          var y = pieceImage.boardPosition.y;
          var squareClass = helpers.getSquareClass(x, y);
          selected = { x: x, y: y, square: square, squareClass: squareClass };
          square.removeClass(squareClass);
          square.addClass('selected');
          showPossibleCOINMoves({ position: selected });
        }

        square = drawCOINPiece(position.x, position.y);
        if (!isCOINPlayer()) {
          return;
        }
        square.children('img').each(function(index, pieceImage) {
          pieceImage.boardPosition = position;
          if (!isCOINTurn()) {
            return;
          }

          var movedSoldier = g_gameState.movedSoldier;
          if (movedSoldier) {
            var thisPieceMoved = pieceImage.boardPosition.x === movedSoldier.position.x && 
              pieceImage.boardPosition.y === movedSoldier.position.y;
            if (thisPieceMoved) {
              showPossibleMovesForPiece(pieceImage, square);
            }
          }

          $(pieceImage).draggable({
            containment: '#checkers',
            cursorAt: { top: HALF_SQUARE_SIZE, left: HALF_SQUARE_SIZE },
            scroll: false,
            revert: false,
            opacity: 0.6,
            helper: "clone",
            start: function() {
              if (!isCOINTurn()) {
                return;
              }
              showPossibleMovesForPiece(pieceImage, square);
            },
            stop: function() {
              var squareClass = helpers.getSquareClass(x, y);
              square.removeClass('selected');
              square.addClass(squareClass);
              clearPossibleMoves();
            }
          });
        });
      });

      var arrGuerrillaPieces = g_gameState.getGuerrillaPieces() || [];
      for(idx = 0; idx < arrGuerrillaPieces.length; ++idx) {
        var piece = arrGuerrillaPieces[idx];
        drawGuerrillaPiece(piece.position.x, piece.position.y);
      }

      if (isGuerrillaTurn() && isGuerrillaPlayer()) {
        showPossibleGuerrillaMoves();
      }

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

