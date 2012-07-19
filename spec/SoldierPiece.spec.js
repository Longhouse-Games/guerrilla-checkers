require(['./lib/checkers'], function(Checkers) {
describe('A guerilla-checkers game', function() {
	describe('which has just begun', function() {
		var board; 
		beforeEach(function() {
			board = new Checkers.GameState();
		});
		it('has a soldier piece at (3,2)', function() {
			var position = new Checkers.Position(3,2);
			expect(board.soldierPieceAt(position)).not.toBeNull();
		});

		it('the soldier piece at (3,2) may move to (4,3)', function() {
			var piecePosition = new Checkers.Position(3,2);
			var destination = new Checkers.Position(4,3);
			expect(board.isValidSoldierMove(piecePosition, destination)).toBe(true);
		});
		it('must begin with a guerilla move', function() {
			var position = new Checkers.Position(3,2);
			var destination = new Checkers.Position(4,3);
			expect(board.isValidSoldierMove(position, destination)).toBe(false);
		});
	});
	
});
});
