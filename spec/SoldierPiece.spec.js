require(['./lib/checkers'], function(Checkers) {
describe('A Guerrilla Checkers board', function() {
	var board;
	beforeEach(function() {
		board = new Checkers.GameState([], false);
	});
	describe('with a soldier piece at (5,4)', function() {
		beforeEach(function() {
			board = new Checkers.GameState([new Checkers.Position(5,4)], false);
		});
		it('the soldier piece at (5,4) may move to (6,5)', function() {
			var piecePosition = new Checkers.Position(5,4);
			var destination = new Checkers.Position(6,5);
			var soldierPiece = board.soldierPieceAt(piecePosition);
			expect(soldierPiece).not.toBeNull();
			expect(board.isValidSoldierMove(soldierPiece, destination)).toBe(true);
		});
	});
});
});
