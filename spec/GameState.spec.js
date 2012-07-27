require(['./lib/checkers'], function(Checkers) {
describe('A guerilla-checkers game', function() {
	var board; 
	
	describe('which has just begun', function() {
		beforeEach(function() {
			board = new Checkers.GameState();
		});
		it('has a soldier piece at (3,2)', function() {
			var position = new Checkers.Position(3,2);
			expect(board.soldierPieceAt(position)).not.toBeNull();
		});

		
		it('guerrilla must make the first move', function() {
			var position = new Checkers.Position(3,2);
			var destination = new Checkers.Position(4,3);
			expect(board.isValidSoldierMove(position, destination)).toBe(false);
			var placement = new Checkers.Position(1,1);
			expect(board.isValidGuerrillaPlacement(placement)).toBe(true);
		});

		it('the Guerrilla player should have 66 remaining pieces', function() {
			expect(board.getRemainingGuerrillaPieces()).toBe(66);
		});
	});

	describe('in which guerrilla has placed a piece at (0,0)', function() {
		var board;
		beforeEach(function() {
			var position = new Checkers.Position(0,0);
			board = new Checkers.GameState();
			board.placeGuerrillaPiece(position);
		});
		
		it('a piece should be at (0,0)', function() {
		});

		it('should still be the Guerrilla player\'s turn.', function() {
			expect(board.getCurrentPhase()).toBe("GUERRILLA");
		});

		it('the guerrilla player should only have 65 pieces remaining.', function() {
			expect(board.getRemainingGuerrillaPieces()).toBe(65);
		});

		it('after the Guerrilla makes an invalid move, it is still the Guerrilla\'s turn.', function() {
			var invalidPosition = new Checkers.Position(0,0);
			expect(board.placeGuerrillaPiece(invalidPosition)).toBe(false);
			expect(board.getCurrentPhase()).toBe("GUERRILLA");
		});

		it('after the Guerrilla makes a valid move, it is the Soldier\'s turn.', function() {
			var validPosition = new Checkers.Position(1,0); // must be placed adjacent
			expect(board.placeGuerrillaPiece(validPosition)).toBe(true);
			expect(board.getCurrentPhase()).toBe("SOLDIER");
		});
	});
	
});
});
