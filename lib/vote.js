define(['underscore'], function( _ ) {
var Vote = function(name, question, onPass, getVoters) {
  var me = this;
  me.name = name;
  me.question = question;
  me.onPass = onPass || function () { };
  me.onFail = onPass || function () { };
  me.getVoters = getVoters;
  me.determineResult = this.isUnanimous;
  me.votes = {
    'yes': [],
    'no': []
  };

  me.getAllVotes = function() {
    return me.votes.yes + me.votes.no;
  };
};

Vote.prototype.getName = function() { return this.name; }
Vote.prototype.getQuestion = function() { return this.question; }

Vote.prototype.addVote = function(choice, voter) {
  var isNotDuplicateVoter = function(existingVote) {
    return existingVote !== voter;
  }
  if (_.all(this.votes.yes, isNotDuplicateVoter) &&
      _.all(this.votes.no, isNotDuplicateVoter)) {
    this.votes[choice].push(voter);
    console.log('yes: ', this.votes.yes.length);
    console.log('no: ', this.votes.no.length);
    console.log('required votes: ', this.getVoters());
    if (this.votes.yes.length + this.votes.no.length >= this.getVoters().length) {
      if (this.determineResult()) {
        this.onPass();
      }
    }
  }
};

Vote.prototype.invalidate = function(voter) {
  this.votes.yes = _.without(this.votes.yes, player);
  this.votes.no = _.without(this.votes.no, player);
};

Vote.prototype.isUnanimous = function() {
  return this.votes.yes.length == this.getVoters().length;
};

Vote.prototype.isMajority = function() {
  return this.votes.yes.length >= this.getVoters().length / 2;
};

Vote.prototype.getVoteCount = function() {
  return this.votes.yes.length + this.votes.no.length;
};

// returns undefined if not enough votes
Vote.prototype.getResult = function() {
  if (this.getVoteCount() >= this.getVoters()) {
    return this.determineResult();
  }
};

return Vote;
});
