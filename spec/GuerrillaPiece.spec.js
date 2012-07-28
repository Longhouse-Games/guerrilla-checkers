require(['./lib/checkers'], function(Checkers) {
var Position = Checkers.Position;
var GameState = Checkers.GameState;
describe('A Guerrilla piece', function() {
	var board;
	beforeEach(function() {
		board = new GameState([]);
	});

	it('cannot be placed off the board', function() {
		var position = new Position(-3,GameState.GUERILLA_HEIGHT + 2);
		var placement = board.placeGuerrillaPiece(position);
		expect(placement).toBe(false);
	});

	it('played illegaly will not lower the number of remaining Guerrilla pieces.', function() {
		var position = new Position(-1,-1);
		var count = board.getRemainingGuerrillaPieces();
		var placement = board.placeGuerrillaPiece(position);
		expect(placement).toBe(false);
		expect(board.getRemainingGuerrillaPieces()).toBe(count);
	})

	describe('on a board with no pieces', function() {
		beforeEach(function() {
			board = new GameState([]);
		});
		it('can be played anywhere', function()  {
			for(x = 0; x < Checkers.GUERILLA_WIDTH; ++x)
			{
				for(y = 0; y < Checkers.GUERILLA_HEIGHT; ++y)
				{
					var position = new Position(x, y);
					expect(board.placeGuerrillaPiece(position).toBe(true));
				}
			}
		});
	});

	describe('on a board with at least one Guerrilla', function() {
		beforeEach(function() {
			board = new GameState([]);
			board.placeGuerrillaPiece(new Position(3,5));
		});

		it('first guerilla placed must be adjacent to an existing guerilla', function() {
			var illegal = new Position(1,1);
			expect(board.placeGuerrillaPiece(illegal)).toBe(false);
			var legal= new Position(3,6);
			expect(board.placeGuerrillaPiece(legal)).toBe(true);
		});

		describe('when placing the second guerilla', function() {
			beforeEach(function() {
				board.placeGuerrillaPiece(new Position(3,6));
			});

			it('it must be placed adjacent to the last placed guerilla', function() {
				var illegal = new Position(2,5);
				expect(board.placeGuerrillaPiece(illegal)).toBe(false);
				var legal = new Position(2,6);
				expect(board.placeGuerrillaPiece(legal)).toBe(true);
			});
		});
	});

	describe('placed to capture a soldier piece', function() {
		beforeEach(function() {
			board = new GameState([new Position(2,3)], false);
			board.placeGuerrillaPiece(new Position(2,3));
			board.placeGuerrillaPiece(new Position(2,2));
			board.placeGuerrillaPiece(new Position(1,2));
		});
		it('causes the soldier to be removed from the board.', function() {
			expect(board.soldierPieceAt(new Position(2,3))).not.toBeNull();
			board.placeGuerrillaPiece(new Position(1,3));
			expect(board.soldierPieceAt(new Position(2,3))).toBeNull();
		});
	});
});
});
