
define([], function() { // requirejs
//
//// Browser Variables
//if (!assert) {
//	assert = window.assert;
//}

// Global Variables
var SOLDIER_WIDTH = 8;
var SOLDIER_HEIGHT = 8;
var GUERILLA_WIDTH = 7;
var GUERILLA_HEIGHT = 7;

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
	return true;
}

/**
 * Validates the position of a soldier piece.
 */
function validateSoldierPosition(position) {
	validatePosition("soldier piece", position, 0, SOLDIER_WIDTH - 1, 0, SOLDIER_HEIGHT - 1);
};

/**
 * Validates the position of a guerilla piece.
 */
function validateGuerillaPosition(position) {
	validatePosition("guerilla piece", position, 0, GUERILLA_WIDTH - 1, 0, GUERILLA_HEIGHT - 1);
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
 * A guerilla piece.
 */
function GuerillaPiece(position) {
	validateGuerillaPosition(position);
	this.position = position;
};

/**
 * The current state of a guerilla checkers game.
 */
function GameState() {
	var me = this;
	var soldierStartPositions = [
		new Position(3, 2),
		new Position(2, 3),
		new Position(4, 3),
		new Position(3, 4),
		new Position(5, 4),
		new Position(4, 5)
	];

	var STARTING_GUERRILLA_PIECES = 66;

	me.currentPhase = 0;
	me.remainingGuerrillaPieces = STARTING_GUERRILLA_PIECES;
	me.arrPhases = ["GUERRILLA", "GUERRILLA", "SOLDIER"];
	me.arrGuerillaPieces = []; // Array<GuerillaPiece>
	me.arrSoldierPieces = [];  // Array<SoldierPiece>

	

	var pieceAt = function(arrPieces, validatePosition) {
		return function(position) {
			validatePosition(position);
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
	this.guerrillaPieceAt = pieceAt(me.arrGuerillaPieces, validateGuerillaPosition);

	soldierStartPositions.forEach(function(position) {
			var piece = me.createSoldierPiece(position);
			});

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
	validateSoldierPosition(position);
	if (this.soldierPieceAt(position)) {
		return null;
	}
	var piece = new SoldierPiece(new Position(position.x, position.y));
	this.arrSoldierPieces.push(piece);
	return piece;
};

/**
 * Filters out just the game pieces from a game state.
 * @return The guerilla and soldier pieces as arrays in an object.
 */
GameState.prototype.getPieces = function() {
	return {
		arrGuerillaPieces: this.arrGuerillaPieces,
		arrSoldierPieces: this.arrSoldierPieces
	};
};

/**
 * Checks whether the destination is clear, and whether the move is legal.
 * @return {boolean} Whether the move can be performed.
 */
GameState.prototype.isValidSoldierMove = function(soldierPiece, destination) {
	if (!this.getCurrentPhase() != "SOLDIER") return false;
	validateSoldierPosition(destination);
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
 * Move a soldier piece at piecePosition to the given destination.
 * @return {boolean} Whether the piece was successfully moved.
 */
GameState.prototype.moveSoldierPiece = function(piecePosition, destination) {
	if (!this.getCurrentPhase() != "SOLDIER") return false;
	validateSoldierPosition(piecePosition);
	validateSoldierPosition(destination);
	var soldierPiece = this.soldierPieceAt(piecePosition);
	if (!this.isValidSoldierMove(soldierPiece, destination)) {
		return false;
	}
	soldierPiece.position.x = destination.x;
	soldierPiece.position.y = destination.y;
	this.advancePhase();
	return true;
};

/**
 * Place a new guerrilla piece at piecePosition.
 * @return {boolean} Whether the piece was succesfully placed.
 */
GameState.prototype.isValidGuerrillaPlacement = function(piecePosition) {
	if (this.getCurrentPhase() != "GUERRILLA") return false;
	if (this.getRemainingGuerrillaPieces() <= 0) return false;
	if (this.guerrillaPieceAt(piecePosition)) return false;
	return true;
};

GameState.prototype.placeGuerrillaPiece = function(piecePosition) {
	if (!this.isValidGuerrillaPlacement(piecePosition)) return false;
	var piece = new SoldierPiece(piecePosition);
	this.remainingGuerrillaPieces--;
	this.arrGuerillaPieces.push(piece);
	this.advancePhase();
	return true;
};

// exports
return {
	GameState: GameState,
	SoldierPiece: SoldierPiece,
	GuerillaPiece: GuerillaPiece,
	Position: Position
};

}); // end requirejs
