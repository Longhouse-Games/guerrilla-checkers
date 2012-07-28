
define([], function() { // requirejs
//
//// Browser Variables
//if (!assert) {
//	assert = window.assert;
//}

// Global Variables
var SOLDIER_WIDTH = 8;
var SOLDIER_HEIGHT = 8;
var GUERRILLA_WIDTH = 7;
var GUERRILLA_HEIGHT = 7;

/**
 * Validates the position of a generic piece.
 */
function validatePosition(context, position, xMin, xMax, yMin, yMax) {
//	assert.ok(position, "no position provided to " + context);
//	assert.ok(typeof position === 'object', context + " position must be an object e.g. { x: 1, y: 3 }");
//	assert.ok(typeof position.x === 'number', "non-numeric x position provided to " + context);
//	assert.ok(typeof position.y === 'number', "non-numeric y position provided to " + context);
//	assert.ok(position.x >= xMin && position.x <= xMax, "invalid x position provided to " + context);
//	assert.ok(position.y >= yMin && position.y <= yMax, "invalid y position provided to " + context);
	if (position.x < xMin || position.x > xMax) return false;
	if (position.y < yMin || position.y > yMax) return false;
	return true;
}

/**
 * Validates the position of a soldier piece.
 */
function validateSoldierPosition(position) {
	return validatePosition("soldier piece", position, 0, SOLDIER_WIDTH - 1, 0, SOLDIER_HEIGHT - 1);
};

/**
 * Validates the position of a guerrilla piece.
 */
function validateGuerrillaPosition(position) {
	return validatePosition("guerrilla piece", position, 0, GUERRILLA_WIDTH - 1, 0, GUERRILLA_HEIGHT - 1);
};

/**
 * Generic 2D position.
 */
function Position(x, y) {
	this.x = x;
	this.y = y;
};

/**
 * A soldier piece.
 */
function SoldierPiece(position) {
	validateSoldierPosition(position);
	this.position = position;
};

/**
 * A guerrilla piece.
 */
function GuerrillaPiece(position) {
	validateGuerrillaPosition(position);
	this.position = position;
};

/**
 * The current state of a guerrilla checkers game.
 */
function GameState() {
	var me = this;
	var soldierStartPositions = arguments[0] || [
		new Position(3, 2),
		new Position(2, 3),
		new Position(4, 3),
		new Position(3, 4),
		new Position(5, 4),
		new Position(4, 5)
	];

	me.validatePhases = false; // properly initialized after baord setup

	var STARTING_GUERRILLA_PIECES = 66;

	me.currentPhase = 0;
	me.remainingGuerrillaPieces = STARTING_GUERRILLA_PIECES;
	me.arrPhases = ["GUERRILLA", "GUERRILLA", "SOLDIER"];
	me.arrGuerrillaPieces = []; // Array<GuerrillaPiece>
	me.arrSoldierPieces = [];  // Array<SoldierPiece>

	me.movedSoldier = null;
	me.placedGuerrilla = null;

	

	var pieceAt = function(arrPieces, validate) {
		return function(position) {
			validate(position);
			var numPieces = arrPieces.length;
			for (var idx = 0; idx < numPieces; ++idx) {
				var piece = arrPieces[idx];
				var piecePosition = piece.position;
				if (piecePosition.x === position.x && piecePosition.y === position.y) {
					return piece;
				}
			}
			return null;
		};
	};

	/**
	 * Retrieves the soldier piece at the specified position.
	 * @param position The zero-based position to check for a piece
	 * @return {SoldierPiece} The piece at the specified position, 
	 *         or null if not found.
	 */
	this.soldierPieceAt = pieceAt(me.arrSoldierPieces, validateSoldierPosition);

	/**
	 * Retrieves the soldier piece at the specified position.
	 * @param position The zero-based position to check for a piece
	 * @return {SoldierPiece} The piece at the specified position, 
	 *         or null if not found.
	 */
	this.guerrillaPieceAt = pieceAt(me.arrGuerrillaPieces, validateGuerrillaPosition);

	soldierStartPositions.forEach(function(position) {
			var piece = me.createSoldierPiece(position);
			});
	me.validatePhases = arguments.length > 1 ? arguments[1] : true;

	me.getCurrentPhase = function() {
		return me.arrPhases[me.currentPhase];
	}

	me.getRemainingGuerrillaPieces = function() {
		return me.remainingGuerrillaPieces;
	};
};

GameState.prototype.advancePhase = function() {
		this.currentPhase = (this.currentPhase + 1) % this.arrPhases.length;
		return this.getCurrentPhase();
};
/**
 * Create a soldier piece at the given position.
 * If there is already a piece there, this will fail and return null.
 * @param position The position to create a new soldier piece at.
 * @return {SoldierPiece} The newly created soldier piece, or null.
 */
GameState.prototype.createSoldierPiece = function(position) {
	if (!validateSoldierPosition(position)) { return null; }
	if (this.soldierPieceAt(position)) { return null; }

	var piece = new SoldierPiece(new Position(position.x, position.y));
	this.arrSoldierPieces.push(piece);
	return piece;
};

/**
 * Filters out just the game pieces from a game state.
 * @return The guerrilla and soldier pieces as arrays in an object.
 */
GameState.prototype.getPieces = function() {
	return {
		arrGuerrillaPieces: this.arrGuerillaPieces,
		arrSoldierPieces: this.arrSoldierPieces
	};
};

/**
 * Checks whether the destination is clear.
 * @return {boolean} Whether the move can be performed.
 */
GameState.prototype.isValidNewSoldierPosition = function(soldierPiece, destination) {
	if (!validateSoldierPosition(destination)) { return false; }
	if (!soldierPiece) {
		return false;
	}
	var blockingPiece = this.soldierPieceAt(destination);
	if (blockingPiece) {
		return false;
	}
	var xDiff = Math.abs(soldierPiece.position.x - destination.x);
	var yDiff = Math.abs(soldierPiece.position.y - destination.y);
	return xDiff === 1 && yDiff === 1;
};

/**
 * Checks whether the destination is clear, and whether the move is legal.
 * @return {boolean} Whether the move can be performed.
 */
GameState.prototype.isValidSoldierMove = function(soldierPiece, destination) {
	if (!this.isValidNewSoldierPosition(soldierPiece, destination)) return false;
	//console.log('testing move ', soldierPiece.position, ' -> ', destination);
	var arrMoves =  this.getSoldierCapturingMoves(soldierPiece);
	if (arrMoves.length === 0) {
		arrMoves = this.getPotentialSoldierMoves(soldierPiece);
	}

	//console.log('capturing moves: ', arrMoves);

	for(idx = 0; idx < arrMoves.length; ++idx) {
		if (destination.x == arrMoves[idx].x && destination.y == arrMoves[idx].y) return true;
	}
	return false;
};


GameState.prototype.getPotentialSoldierMoves = function(soldierPiece) {
	var arrMoves = [];
	var testPositions = [
		new Position(soldierPiece.position.x + 1, soldierPiece.position.y + 1),
		new Position(soldierPiece.position.x + 1, soldierPiece.position.y - 1),
		new Position(soldierPiece.position.x - 1, soldierPiece.position.y - 1),
		new Position(soldierPiece.position.x - 1, soldierPiece.position.y + 1),
	];

	for(idx = 0; idx < testPositions.length; ++idx) {
		var position = testPositions[idx];
		if (this.isValidNewSoldierPosition(soldierPiece, position)) {
			arrMoves.push(position);
		}
	}
	return arrMoves;
};

/**
 * For a given soldier piece, determine which moves will capture a guerrilla piece.
 * @return {array} Array of capturable guerrilla pieces.
 */
GameState.prototype.getSoldierCapturingMoves = function(soldierPiece) {
	var arrMoves = this.getPotentialSoldierMoves(soldierPiece);
	//console.log('getSoldierCapturingMoves');
	//console.log('  potential moves: ', arrMoves);
	var arrCapturingMoves = []
	for(idx = 0; idx < arrMoves.length; ++idx) {
		var capture = this.getCapturedGuerrilla(soldierPiece, arrMoves[idx]);
		if (capture) {
			arrCapturingMoves.push(arrMoves[idx]);
		}
	}
	//console.log('determined capturing moves: ', arrCapturingMoves);
	return arrCapturingMoves;
};

/**
 * Move a soldier piece at piecePosition to the given destination.
 * @return {boolean} Whether the piece was successfully moved.
 */
GameState.prototype.moveSoldierPiece = function(piecePosition, destination) {
	if (!this.verifyPhase("SOLDIER")) return false;
	var soldierPiece = this.soldierPieceAt(piecePosition);
	if (!this.isValidSoldierMove(soldierPiece, destination)) {
		return false;
	}
	
	var guerrillaPiece = this.getCapturedGuerrilla(piecePosition, destination);
	//console.log('captured guerrilla: ', guerrillaPiece);
	if (guerrillaPiece) {
		this.removeGuerrillaPiece(guerrillaPiece);
	}
	soldierPiece.position.x = destination.x;
	soldierPiece.position.y = destination.y;
	this.advancePhase();
	return true;
};



/**
 * Get guerrilla piece a soldier move may have captured.
 * @return {object} Guerrilla piece of a capture occured, null otherwise.
 */
GameState.prototype.getCapturedGuerrilla = function(soldierPosition, destination) {
	//console.log('guerrillas in play: ', this.arrGuerrillaPieces);
	var guerrillaPiece = null;
	var deltaX = destination.x - soldierPosition.x;
	var deltaY = destination.y - soldierPosition.y;

	if (deltaX === 1 && deltaY === 1) {
		guerrillaPiece = this.guerrillaPieceAt(soldierPosition);
	} else if (deltaX === 1 && deltaY === -1) {
		guerrillaPiece = this.guerrillaPieceAt(new Position(soldierPosition.x, soldierPosition.y - 1));
	} else if (deltaX === -1 && deltaY === -1) {
		guerrillaPiece = this.guerrillaPieceAt(new Position(soldierPosition.x, soldierPosition.y));
	} else if (deltaX === -1 && deltaY === 1) {
		guerrillaPiece = this.guerrillaPieceAt(new Position(soldierPosition.x - 1, soldierPosition.y));
	}
	return guerrillaPiece;
}

/**
 * Place a new guerrilla piece at piecePosition.
 * @return {boolean} Whether the piece was succesfully placed.
 */
GameState.prototype.isValidGuerrillaPlacement = function(piecePosition) {
	if (!validateGuerrillaPosition(piecePosition)) return false;
	if (this.getRemainingGuerrillaPieces() <= 0) return false;
	if (this.guerrillaPieceAt(piecePosition)) return false;
	if (this.arrGuerrillaPieces.length > 0) {
		if (this.guerrillaPieceAt(new Position(piecePosition.x - 1, piecePosition.y))) return true;
		if (this.guerrillaPieceAt(new Position(piecePosition.x + 1, piecePosition.y))) return true;
		if (this.guerrillaPieceAt(new Position(piecePosition.x, piecePosition.y - 1))) return true;
		if (this.guerrillaPieceAt(new Position(piecePosition.x, piecePosition.y + 1))) return true;
	} else {
		return true;
	}

	
};

GameState.prototype.placeGuerrillaPiece = function(piecePosition) {
	if (!this.verifyPhase('GUERRILLA')) return false;
	if (!this.isValidGuerrillaPlacement(piecePosition)) return false;
	var piece = new GuerrillaPiece(piecePosition);
	this.remainingGuerrillaPieces--;
	this.arrGuerrillaPieces.push(piece);
	this.advancePhase();
	return true;
};

GameState.prototype.removeGuerrillaPiece = function(guerrillaPiece) {
	if (guerrillaPiece) {
		//console.log('removing: ', guerrillaPiece);
		for(idx = 0; idx < this.arrGuerrillaPieces.length; ++idx) {
			var maybePiece = this.arrGuerrillaPieces[idx];
			if (maybePiece.position.x === guerrillaPiece.position.x
				&& maybePiece.position.y === guerrillaPiece.position.y) {

				//console.log('match found: ', this.arrGuerrillaPieces[idx], guerrillaPiece);
				var arrPruned = this.arrGuerrillaPieces.splice(idx, 1);
				//console.log('pruned: ', arrPruned);
				this.arrGuerrillaPieces = this.arrGuerrillaPieces.splice(idx, 1);
				return true;
			}
		}
	}
	return false;
};



GameState.prototype.verifyPhase = function(phase) {
	if (this.validatePhases) {
		return this.getCurrentPhase() === phase;
	} else {
		return true;
	}
};

// exports
return {
	GameState: GameState,
	SoldierPiece: SoldierPiece,
	GuerrillaPiece: GuerrillaPiece,
	Position: Position
};

}); // end requirejs
