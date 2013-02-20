var requirejs = require('requirejs');
requirejs([ './lib/checkers'], function(Checkers) {

var GUERRILLA_ROLE = Checkers.Metadata.GUERRILLA_ROLE;
var COIN_ROLE = Checkers.Metadata.COIN_ROLE;

var Metadata = function() {
  this.name = "Guerrilla Checkers";
  this.slug = "guerrilla-checkers";
  this.roles = [
    { name: "Guerrillas", slug: GUERRILLA_ROLE },
    { name: "The State", slug: COIN_ROLE }
  ];
};

module.exports.Metadata = Metadata;

});
