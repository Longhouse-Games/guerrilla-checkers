var GUERRILLA_ROLE = 'guerrillas';
var COIN_ROLE = 'coin';

var Metadata = function() {
  this.name = "Guerrilla Checkers";
  this.slug = "guerrilla-checkers";
  this.roles = [
    { name: "Guerrillas", slug: GUERRILLA_ROLE },
    { name: "The State", slug: COIN_ROLE }
  ];
};

exports.Metadata = Metadata;
