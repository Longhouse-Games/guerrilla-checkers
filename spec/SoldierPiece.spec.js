require(['./lib/checkers'], function(Checkers) {
describe('A guerilla-checkers game', function() {
	describe('which has just begun', function() {
		var board = new Checkers.GameState();
		it('has a soldier piece at (3,2)', function() {
			var position = new Checkers.Position(3,2);
			expect(board.soldierPieceAt(position)).not.toBeNull();
		});
	});
});
});
