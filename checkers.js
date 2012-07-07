
var Checkers = function(width, height, pieces) {

// private:

	var m_width = width;
	var m_height = height;
	var m_pieces = {};
	var self = this;

// constructor:

	for(i=0; i < pieces.length; ++i)
	{
		var piece = pieces[i];
		if (typeof m_pieces[piece.x] === 'undefined')  {
			m_pieces[piece.x] = {};
		}
		m_pieces[piece.x][piece.y] = piece;
	}

// public:

	this.exists = function(piece) {
		return piece && m_pieces[piece.x] && m_pieces[piece.x][piece.y];
	};

	this.move = function(piece, position) {

		var strPiece = JSON.stringify(piece);
		var strPosition = JSON.stringify(position);

		// check for basic validity
		if (!(piece && position)) 
			return false;
		if (!self.exists(piece))  
			return false;
		if (self.exists(position)) 
			return false;
		if (Math.abs(Math.abs(piece.x) - Math.abs(position.x)) != 1) 
			return false;
		if (Math.abs(Math.abs(piece.y) - Math.abs(position.y)) != 1) 
			return false;

		// remove piece from board
		piece = m_pieces[piece.x][piece.y];
		delete m_pieces[piece.x][piece.y];

		// change piece position
		piece.x = position.x;
		piece.y = position.y;

		// lazily initialize column
		if (typeof m_pieces[piece.x] === 'undefined')  {
			m_pieces[piece.x] = {};
		}

		// put piece back on board
		m_pieces[piece.x][piece.y] = piece;
		return true;
	};

	this.getPieces = function() { return m_pieces; };
	
};

exports.Checkers = Checkers;
