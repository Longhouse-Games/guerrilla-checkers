var CAS_HOST = process.env.CAS_HOST || "cas.littlevikinggames.com";
var CAS_URL = process.env.CAS_URL || "https://" + CAS_HOST + "/login";
var CAS_HOST_FALLBACK = process.env.CAS_HOST_FALLBACK;
var CAS_URL_FALLBACK = process.env.CAS_URL_FALLBACK || "https://" + CAS_HOST_FALLBACK + "/login";
var PORT = process.env.PORT || 3000;

var KEY_FILE = process.env.KEY_FILE;
var CERT_FILE = process.env.CERT_FILE;

var app;

var use_ssl = false;

var fs = require('fs'),
    express = require('express');

if (KEY_FILE && CERT_FILE) {
  console.log("Using SSL");
  use_ssl = true;

  var server_options = {};
  server_options.key = fs.readFileSync(KEY_FILE);
  server_options.cert = fs.readFileSync(CERT_FILE);

  app = express.createServer(server_options);
} else if ((KEY_FILE && !CERT_FILE) || (CERT_FILE && !KEY_FILE)) {
  throw "If one of KEY_FILE or CERT_FILE are specified, you must supply both of them, not just one";
} else {
  app = express.createServer();
}

var mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas')
  , cookie = require('cookie')
  , Server = require('./server/server')
  , logger = require('./server/logger')
  , util = require('util');
// requirejs
var requirejs = require('requirejs');
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

requirejs(['underscore', 'moment', './lib/checkers'], function(_, moment, Checkers) {

// global variables
var connectedUsers = 0;

// global types
var Schema = mongoose.Schema;
var ChatSchema = new Schema({
  time: {type: Date},
  user: {type: String},
  message: {type: String, trim: true}
});
var ChatModel = mongoose.model('Chat', ChatSchema);

var userSchema = new Schema({
  name: String
});
var User = mongoose.model('User', userSchema);

var sessionSchema = new Schema({
  session_id: { type: String, default: null },
  username: {type: String, default: null },
  game_id: {type: String, default: null}
});
var Session = mongoose.model('Session', sessionSchema);

var gameSchema = new Schema({
  is_in_progress: { type: Boolean, default: false },
  coin_player_name: { type: String, default: null },
  guerrilla_player_name: { type: String, default: null },
  gameState: String
});

var gameHasUser = function(dbgame, user) {
  return dbgame.coin_player_name === user.name || dbgame.guerrilla_player_name === user.name;
}

// next takes game found, or null if none were found
gameSchema.statics.findMeAGame = function(user, next) {
  _this = this;

  // Find a game that the player is participating in
  _this.findOne(
    // Mongo queries are truly a highpoint of code beauty.
      {$and: [
        {is_in_progress: true},
        {$or: [
          {coin_player_name: user.name},
          {guerrilla_player_name: user.name}
        ]},
      ]},
    function(err, game) {
      if (err) throw err;
      if (game) {
        logger.debug("Found a game with stoopid query");
        next(game);
      }
      else {
        logger.debug("FindingMeAGame: Couldn't find a game that user '"+user.name+"' is participating in.");
        // Find a game where there is an empty slot
        _this.findOne({$and: [ {is_in_progress: true}, {$or: [{coin_player_name: null},{guerrilla_player_name: null}]}]}, function(err, game) {
            if (err) throw err;
            if (game) next(game);
            else {
              logger.debug("FindingMeAGame: Couldn't find a game for user '"+user.name+"' that has an empty slot.");
              // No open games, create a new one! yay!
              dbgame = new Game({ is_in_progress: true });
              dbgame.save(function (err) {
                if (err) { throw err; }
                next(dbgame);
              });
            }
          });
      }
    });
}
var Game = mongoose.model('Game', gameSchema);

var find_or_create_session = function(username, session_id, next) {
  Session.findOne({ session_id: session_id }, function(err, session) {
    if (err) { throw err; }
    if (session) {
      next(session);
    } else {
      session = new Session({ session_id: session_id, username: username });
      session.save(function(err) {
        if (err) { throw err; }
        next(session);
      });
    }
  });
}
// next takes the found/created user as parameter
var find_or_create_user = function(username, session_id, next) {
  find_or_create_session(username, session_id, function(session) {
    User.findOne({ name: username }, function (err, user) {
      if (err) {
        throw err;
      }
      if (user) {
        next(user);
      } else {
        var user = new User({ name: username });
        user.save(function (err) {
          if (err) {
            throw err;
          }
          next(user);
        });
      }
    });
  });
};

// helper functions 
var fetchRecentMessages = function(callback) {
  var chatModel = mongoose.model('Chat');
  chatModel
    .find()
    .sort('time', -1) // descending
    .limit(5)
    .exec(callback);
};

var saveMessageToMongo = function(data) {
  new ChatModel({time: new Date(), user: data.user, message: data.message}).save();
};

function handleLogin(request, response, callback) {

  console.log("Handling Login!");

  applyHeaders(response);

  var serviceTicket = request.query.ticket;
  var hasServiceTicket = typeof serviceTicket !== 'undefined';

  var host = CAS_HOST;
  var cas_url = CAS_URL;

  if (request.query.cas == "test") {
    host = CAS_HOST_FALLBACK;
    cas_url = CAS_URL_FALLBACK;
  }

  var protocol = use_ssl ? "https://" : "http://";
  console.log("Request.url: " + request.url);
  var path = request.url.replace(/[&|\?]?ticket=[\w|-]+/i, "");
  console.log("Path: " + path);
  var hostname = protocol + request.headers.host + path;
  console.log("CAS service: "+hostname);
  var loginUrl = cas_url + '?service=' + encodeURIComponent(hostname);
  console.log("CAS Login URL: "+loginUrl);

  var casInstance = new cas({
    base_url: "https://" + host,
    service: hostname
  });

  // initial visit
  if (!hasServiceTicket) {
    console.log("Redirecting to CAS Login");
    response.redirect(loginUrl);
    return;
  } 

  console.log("Got service ticket!");

  // validate service ticket
  casInstance.validate(serviceTicket, function(error, status, username) {
    if (error || !status) {
      response.redirect(loginUrl);
      return;
    }
    console.log(username + " logged in! SessionID: " + request.cookies['express.sid']);
    find_or_create_user(username, request.cookies['express.sid'], function(user) {
      callback();
    });
  });
}

applyHeaders = function(res) {
  res.header('Expires', 'Wed, 11 Jan 1984 05:00:00 GMT');
  res.header("Cache-Control", "no-cache, must-revalidate, max-age=0");
  res.header('Last-Modified', moment().format());
  res.header('Pragma', 'no-cache');
};

app.configure(function() {
  app.use(express.cookieParser());
  app.use(express.session({secret: 'secret', key: 'express.sid'}));
});
// routing
sendfile = function(res, file) {
  applyHeaders(res);
  res.sendfile(file);
};
serve_dir = function(req, res) {
  applyHeaders(res);
  res.sendfile(__dirname + req.originalUrl);
}

authenticateAppServer = function(req, res, callback) {
  //TODO implement
  callback();
};

handleNew = function(req, res) {
  console.log("Got /new");
  authenticateAppServer(req, res, function() {
    return createGame(req, res);
  });
};

handlePlay = function(req, res) {
  console.log("Got /play");
  handleLogin(req, res, function() {
    return playGame(req, res);
  });
};

var egs_response = function(req, res, params) {
  if (!params.stat) { throw "Params.stat is required"; }

  var format = "xml";
  if (req.param('fmt')) {
    format = req.param('fmt').toLowerCase();
  }

  var code = params.stat === "ERROR" ? 400 : 200;
  if (format === "xml") {
    var body = "<rslt><stat>"+params.stat+"</stat></rlst>";
    if (params.msg) {
      body = body + "<msg>"+params.msg+"</msg>";
    }
    if (params.game_id) {
      body = body + "<glst><cnt>1</cnt><game><gid>"+params.game_id+"</gid></game></glst>";
    }
    res.send(body, { 'Content-Type': 'application/xml' }, code);
  } else if (format === "json") {
    var json = { rslt: { stat: params.stat } };
    if (params.msg) {
      json.rslt.msg = params.msg;
    }
    if (params.game_id) {
      json.rslt.glst = {
        cnt: 1,
        games: [params.game_id]
      };
    }
    res.json(json, code);
  } else if (format === "html" && req.param("dbg") === "1") {
    var html = "";
    html = html + "<b>With ECCO CAS server:</b><br>";
    html = html + "<a href='/play?gid="+params.game_id+"&role=guerrillas&app=BRSR'>Join game '"+params.game_id+"' as Guerrillas</a><br>";
    html = html + "<a href='/play?gid="+params.game_id+"&role=coin&app=BRSR'>Join game '"+params.game_id+"' as COIN</a><br>";
    html = html + "<hr><b>With test CAS server:</b><br>";
    html = html + "<a href='/play?gid="+params.game_id+"&cas=test&role=guerrillas&app=BRSR'>Join game '"+params.game_id+"' as Guerrillas</a><br>";
    html = html + "<a href='/play?gid="+params.game_id+"&cas=test&role=coin&app=BRSR'>Join game '"+params.game_id+"' as COIN</a><br>";
    res.send(html, { 'Content-Type': 'text/html' }, code);
  } else {
    res.send("Invalid format: " + req.fmt+". Must be one of 'json' or 'xml'", 400);
  }
};

var egs_error_response = function(req, res, message) {
  return egs_response(req, res, {
    stat: "ERROR",
    msg: message
  });
};

var egs_game_response = function(req, res, game_id) {
  return egs_response(req, res, {
    stat: "OK",
    game_id: game_id
  });
};

var createGame = function(req, res) {
  var lang = req.lang;
  var debug = req.debug;
  var app = req.app;
  var guerrillas = req.param('role1') || req.param('guerrillas');
  var coin = req.param('role2') || req.param('coin');
  if (!guerrillas || !coin) {
    console.log("Got invalid request for new game:");
    console.log(req.query);
    return egs_error_response(req, res, "Both roles must be provided (guerrillas and coin)");
  }
  var dbgame = new Game({
    is_in_progress: true,
    guerrilla_player_name: guerrillas,
    coin_player_name: coin
  });
  dbgame.save(function (err, game) {
    if (err) { throw err; }

    console.log("Created game: "+game._id+". Guerrillas: "+guerrillas+", COIN: "+coin);
    return egs_game_response(req, res, game._id);
  });
};

var playGame = function(req, res) {
  var game_id = req.param('gid');
  var role = req.param('role');

  if (!game_id) {
    res.send("gid is a required parameter", 400);
    return;
  }
  if (!role) {
    res.send("role is a required parameter", 400);
    return;
  }

  Game.findOne({_id: game_id}, function(err, game) {
    if (err) {
      console.log("Error looking up game '"+game_id+"'");
      res.send("Could not find game with id: " + game_id, 400);
      return;
    }
    console.log("Found game: " + game_id);
    console.log(game);

    // TODO HACK temporary hack to quickly lookup game_id after they connect with websockets
    Session.findOne({session_id: req.cookies['express.sid']}, function(err, session) {
      if (err) {
        console.log("Error looking up session for: " + req.cookies['express.sid']);
        res.send("Could not find session. Try reconnecting.", 400);
        return;
      }

      session.game_id = game_id;
      console.log("Saved game_id to session.");
      session.save(function(err) {
        if (err) { throw err; }

        console.log("Playing game: "+game_id);
        res.sendfile(__dirname + '/index.html');
      });
    });
  });
};

app.post('/new', function(req, res) {
  handleNew(req, res);
});
app.get('/new', function(req,res) {
  handleNew(req, res);
});
app.post('/play', function(req, res) {
  handlePlay(req, res);
});
app.get('/play', function(req, res) {
  handlePlay(req, res);
});

app.get('/debug', function (req, res) {
  sendfile(__dirname + '/debug.html');
});
app.get('/images/*', serve_dir);
app.get('/style/*', serve_dir);
app.get('/lib/*', serve_dir);
app.get('/client/*', serve_dir);
app.get('/scripts/*', serve_dir);

// successful connection
io.set('authorization', function (data, accept) {
  // check if there's a cookie header
  if (data.headers.cookie) {
    // if there is, parse the cookie
    data.cookie = cookie.parse(data.headers.cookie);
    // note that you will need to use the same key to grad the
    // session id, as you specified in the Express setup.
    data.sessionID = data.cookie['express.sid'];
  } else {
   // if there isn't, turn down the connection with a message
   // and leave the function.
   return accept('No cookie transmitted.', false);
  }
  // accept the incoming connection
  accept(null, true);
});

var active_games = [];

var totalUsers = function() {
  return _.reduce(active_games, function(accum, server) {
    return accum + server.getPlayerCount();
  }, 0)
};

var attachPlayerToGame = function(game, socket, user) {
  var player = game.addPlayer(socket, user);

  socket.on('disconnect', function(socket) {
    console.log('connected users: ', totalUsers());
  });

  logger.debug('joined game', util.inspect(game, 1));
  logger.debug('active games: ' + active_games.length);
  logger.debug('connected users: ' + totalUsers());
}

var findActiveGameByUser = function(user) {
  var i = 0;
  for(i = 0; i < active_games.length; i++) {
    dbgame = active_games[i].getDBGame();
    if (gameHasUser(dbgame, user)) {
      return active_games[i];
    }
  }
  return null;
}

var findActiveGameByDBGame = function(dbgame) {
  var i = 0;
  for(i = 0; i < active_games.length; i++) {
    tmp = active_games[i].getDBGame();
    if (tmp._id.equals(dbgame._id)) {
      return active_games[i];
    }
  }
  return null;
}

var loadGame = function(dbgame) {
  var factory = null;
  if (_.isUndefined(dbgame.gameState) || dbgame.gameState === null) {
    logger.debug("Creating new game: "+dbgame._id);
    factory = function() { return new Checkers.GameState(); };
  } else {
    logger.debug("Restoring old game: "+dbgame._id);
    factory = function() {
      gameState = new Checkers.GameState();
      gameState.fromDTO(JSON.parse(dbgame.gameState));
      return gameState;
    };
  }
  return game = new Server.Server(factory, dbgame);
}

io.sockets.on('connection', function (socket) {
  Session.findOne({session_id: socket.handshake.sessionID}, function(err, session) {
    if (err || !session) {
      throw "Unable to look up user by sessionID '"+sessionID+"': "+err;
    }
    var game_id = session.game_id;
    Game.findOne({_id: game_id}, function(err, dbgame) {
      if (err || !dbgame) {
        console.log("Unable to lookup game: "+game_id);
        socket.emit('error', "Unable to lookup requested game. Try refreshing your browser.");
        return;
      }
      User.findOne({name: session.username}, function(err, user) {
        if (err || !user) {
          throw "Unable to look up user by user.name '"+user.name+"': "+err;
        }
        var game = findActiveGameByDBGame(dbgame);
        if (!game) {
          game = loadGame(dbgame);
          logger.debug("Stuffing game into active_games: " + dbgame._id);
          active_games.push(game);
        }
        attachPlayerToGame(game, socket, user);
      });
    });
  });
});

mongoose.connect('mongodb://localhost/lvg');

app.listen(PORT, function() {
  console.log("Guerrilla-checkers listening on http://localhost:" + PORT);
});

}); // requirejs Checkers

