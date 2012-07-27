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
	});
});
});
