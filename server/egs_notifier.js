var requirejs = require('requirejs'),
    logger    = require('./logger'),
    request   = require('request');

requirejs.config({
  nodeRequire: require,
  paths: {
    underscore: "./vendor/underscore"
  },
  shim: {
    underscore: {
      exports: '_'
    }
  }
});

requirejs([ 'underscore'], function(_) {
  var EGSNotifier = function(options) {
    var req = function(val) {
      if (!options[val]) {
        throw "EGSNotifier(): 'host' is a required option";
      }
      return options[val];
    };
    this.host = req('host');
    this.port = options.port || 443;
    this.username = options.username;
    this.password = options.password;
    this.game_id = req('game_id');
    this.game_title = req('game_title');
    this.game_version = req('game_version');
    this.coin_gaming_id = req('coin_gaming_id');
    this.guerrilla_gaming_id = req('guerrilla_gaming_id');
    this.STATES = {
      PEND: "PEND",
      ATTN: "ATTN",
      OVER: "OVER"
    };
    console.log("EGS Notifier started for host: "+this.host);

    this.deliver = function(updates) {
      var path = "/api/secure/jsonws/egs-portlet.gamebot";

      var auth = (this.username && this.password) ? (encodeURIComponent(this.username)+":"+this.password+"@") : "";
      var url = "http://"+auth+this.host+":"+this.port+path;
      var opts = {
        url: url,
        method: 'POST',
        headers: { "Content-type": "text/plain; charset=utf-8" },
        body: JSON.stringify(this.buildPayload(updates))
      };
      console.log("Opts for request:");
      console.log(opts);
      request(opts, function(error, response, body) {
        if (error) {
          console.log("Error notifying EGS. Error: " + error);
          return;
        }
        if (response.statusCode !== 200) {
          console.log("Error notifying EGS. Response code: " + (response.statusCode || 'none') );
          console.log(body);
          return;
        }

        console.log("Response from EGS: " + body);
        return;
      });
    }
    this.buildUpdate = function(gamingId, state) {
      return {
       "gameInstanceId": this.game_id,
       "gameTitle": this.game_title,
       "gameVersion": this.game_version,
       "gamingId": gamingId,
       "state": state
      };
    };
    this.buildPayload = function(updates) {
      return {
         "method": "game-updates",
         "id": 7224,
         "jsonrpc":"2.0",
         "params": {
            "payload": {
                "updates": updates
            }
         }
      }
    }
  };

  EGSNotifier.prototype.guerrillasMove = function() {
    console.log("EGSNotifier: Notifying EGS that it's guerrilla('"+this.guerrilla_gaming_id+"') turn");
    console.log("EGSNotifier: Notifying EGS that it's not coin('"+this.coin_gaming_id+"') turn");
    return this.deliver([
      this.buildUpdate(this.guerrilla_gaming_id, this.STATES.ATTN),
      this.buildUpdate(this.coin_gaming_id, this.STATES.PEND)
    ]);
  };

  EGSNotifier.prototype.coinsMove = function() {
    console.log("EGSNotifier: Notifying EGS that it's coin('"+this.coin_gaming_id+"') turn");
    console.log("EGSNotifier: Notifying EGS that it's not guerrilla('"+this.guerrilla_gaming_id+"') turn");
    return this.deliver([
      this.buildUpdate(this.coin_gaming_id, this.STATES.ATTN),
      this.buildUpdate(this.guerrilla_gaming_id, this.STATES.PEND)
    ]);
  };

  EGSNotifier.prototype.gameover = function() {
    console.log("EGSNotifier: Notifying EGS that it's gameover.");
    return this.deliver([
      this.buildUpdate(this.coin_gaming_id, this.STATES.OVER),
      this.buildUpdate(this.guerrilla_gaming_id, this.STATES.OVER)
    ]);
  }

  module.exports.EGSNotifier = EGSNotifier;
});

