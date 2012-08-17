requirejs.config({
	baseUrl: 'client',
	paths: {
		lib: '../lib'
	}
});

require(["lib/checkers", 'helpers'], function(checkers, h) {
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

	var printMessage = function(user, message) {
		var messageDiv = document.createElement('div');
		messageDiv.innerHTML = '<span style="padding-right: 15px; color: red;">' + user +
			'</span>' + message;
		document.getElementById('chatlog').appendChild(messageDiv);
		$('#chatlog').scrollTop($('#chatlog')[0].scrollHeight);
	};

	var selected = null;

	var moveCOIN = function(socket, start_x, start_y, target_x, target_y) {
		socket.emit('moveCOIN', {
			piece: {x: start_x, y: start_y},
			position: {x:target_x, y:target_y}
		});
	};

	var placeGuerrilla = function(socket, x, y) {
		console.log("Placing guerrilla at " + x + ", " +y);
		socket.emit('placeGuerrilla', {
			position: {x: x, y: y}
		});
	};

	function isGuerrillaTurn() {
		return g_phases[g_gameState.getCurrentPhaseIndex()] === 'GUERRILLA';
	}

	function isCOINTurn() {
		return g_phases[g_gameState.getCurrentPhaseIndex()] === 'SOLDIER';
	}

	function drawCOINPiece(x, y) {
		square = $(getSquare(x, y));
		img = $('<img src="images/' + g_boardType + '/soldier_piece.png" class="soldier piece" width=68 height=68 alt="white" />');
		square.append(img);
		return square;
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
		positions = g_gameState.getPotentialSoldierMoves(coin_piece);
		for (i = 0; i < positions.length; i++) {
			drawCOINShadow(positions[i].x, positions[i].y);
		}
	}

	$(window).bind('load', function() {
		var generateSelectHandler = function(x, y, square) {
			var squareClass = h.getSquareClass(x, y);
			return function() {
				//printMessage({user: '*debug*', message: 'you clicked square {' + x + ',' + y + '}'});
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
				console.log("You click intersection: " + x + ", " + y);
				placeGuerrilla(socket, x, y);
			};
		}
		var SQUARE_SIZE = 70;
		var HALF_SQUARE_SIZE = 35;

		var initBoard = function() {
			// init board
			for(y = 7; y >= 0; --y)
			for(x = 0; x < 8; ++x)
			{
				$('#checkers')
					.first()
					.append(function() {
						var zindex = isCOINPlayer() ? (x+1)*(y+1) : 0;
						var square = $('<div />')
							.addClass('square')
							.addClass(h.getSquareClass(x, y))
							.css('z-index', ''+zindex);

						square.append('<span>' + '{' + x + ',' + y + '}' + '</span>');

						if (x < 7 && y < 7) {
							var zindex = isGuerrillaPlayer() ? (x+1)*(y+1) : 0;
							var intersection = $('<div />')
								.addClass('intersection')
								.css('z-index', ''+zindex);

							square.append(intersection);
							if (isGuerrillaPlayer()) {
								intersection.bind('click', generateIntersectionHandler(x, y, intersection));
							}
						}

						setSquare(x, y, square);

						if (isCOINPlayer()) {
							$(square).bind('click', generateSelectHandler(x, y, square));
							(function(destX, destY) {
								$(square).droppable({
									hoverClass: 'square_hover',
									drop: function( event, ui ) {
										var srcPosition = ui.draggable.context.boardPosition;
										moveCOIN(socket, srcPosition.x, srcPosition.y, destX, destY);
									}
								});
							})(x, y);
						}
						return square;
					}());
			}

			var board = $('#checkers');
			board.css('position', 'relative');
			board.css('overflow', 'hidden');

			board.children('div.square').each(function(index, square) {
				square = $(square);
			});
		}

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

			printMessage('server', "It is the " + g_phases[g_gameState.getCurrentPhaseIndex()] + "'s turn");

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
				square = drawCOINPiece(position.x, position.y);
				if (isCOINPlayer()) {
					square.children('img').each(function(index, pieceImage) {
						pieceImage.boardPosition = position;
						$(pieceImage).draggable({
							containment: '#checkers',
							cursorAt: { top: HALF_SQUARE_SIZE, left: HALF_SQUARE_SIZE },
							scroll: false,
							revert: false,
							opacity: 0.6,
							helper: "clone",
							start: function() {
								square.addClass('selected');
							},
							stop: function() {
								square.removeClass('selected');
							}
						});
					});
				}
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

