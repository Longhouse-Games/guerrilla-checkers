require(['./lib/checkers'], function(Checkers) {
describe('A soldier piece', function() {
	var Position = Checkers.Position;
	var GameState = Checkers.GameState;
	var board;
	beforeEach(function() {
		board = new GameState([], false);
	});
	describe('at (5,4)', function() {
		beforeEach(function() {
			board = new GameState([new Position(5,4)], false);
		});
		it('may move to (6,5)', function() {
			var piecePosition = new Position(5,4);
			var destination = new Position(6,5);
			var soldierPiece = board.soldierPieceAt(piecePosition);
			expect(soldierPiece).not.toBeNull();
			expect(board.isValidSoldierMove(soldierPiece, destination)).toBe(true);
		});



		describe('adjacent to a guerilla piece', function() {
			beforeEach(function() {
				var position = new Position(5,4);
				board.placeGuerrillaPiece(position);
				assert.ok(board.guerrillaPieceAt(position));
			});

			it('can only move to capture the guerilla', function() {
				var piece = board.soldierPieceAt(new Position(5,4));
				var positions =  [
					new Position(piece.position.x - 1, piece.position.x + 1),
					new Position(piece.position.x - 1, piece.position.x - 1),
					new Position(piece.position.x + 1, piece.position.x - 1)
				];
				for(idx=0; i < positions.length; ++i) {
					expect(board.moveSoldierPiece(piece, positions[i])).toBe(false);
				}
				expect(board.moveSoldierPiece(piece, new Position(6,5))).toBe(true);
			});

			it('when capturing the guerrilla, removes it from the board', function() {
				var piece = board.soldierPieceAt(new Position(5,4));
				board.moveSoldierPiece(piece, new Position(6,5));
				expect(board.guerilla(new Poosition(5,4))).toBeNull();
			});

		});
	});

});
});
