// TODO move to config file / environment variables
var CAS_HOST = "cas.littlevikinggames.com"
var CAS_URL = "https://" + CAS_HOST + "/login";

var express = require('express')
  , app = express.createServer()
  , mongoose = require('mongoose')
  , io = require('socket.io').listen(app)
  , assert = require('assert')
  , cas = require('cas')
  , cookie = require('cookie');
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

requirejs(['underscore', 'moment', './lib/checkers', './server/server.js'], function(_, moment, Checkers, Server) {

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
  name: String,
  session_id: String
});
var User = mongoose.model('User', userSchema);


// next takes the found/created user as parameter
var find_or_create_user = function(username, session_id, next) {
  User.findOne({ name: username }, function (err, user) {
    if (err) {
      throw err;
    }
    if (user) {
      if (user.session_id !== session_id) {
        user.session_id = session_id;
        user.save(function (err) {
          if (err) {
            throw err;
          }
          next(user);
        });
      } else {
        next(user);
      }
    } else {
      var user = new User({ name: username, session_id: session_id });
      user.save(function (err) {
        if (err) {
          throw err;
        }
        next(user);
      });
    }
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

function handleLogin(request, response) {

  console.log("Handling Login!");

  applyHeaders(response);

  var serviceTicket = request.query.ticket;
  var hasServiceTicket = typeof serviceTicket !== 'undefined';

  var hostname = 'http://' + request.headers.host;
  var loginUrl = CAS_URL + '?service=' + encodeURIComponent(hostname);

  var casInstance = new cas({
    base_url: "https://" + CAS_HOST,
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
      response.sendfile(__dirname + '/index.html');
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

app.post('/', function (req, res) {
  handleLogin(req, res);
});
app.get('/', function (req, res) {
  handleLogin(req, res);
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

var arrPlayers = [];
var arrGames = [];
var gameId = 0;

var totalUsers = function() {
  return _.reduce(arrGames, function(accum, server) {
    return accum + server.getPlayerCount();
  }, 0)
};

var findOpenServer = function() {
  for(i=0; i < arrGames.length; ++i) {
    var game = arrGames[i];
    var openRoles = game.getOpenRoles();
    console.log('open roles in ', game.getId(), ': ', openRoles);
    if (openRoles.length > 0) {
      return game;
    }
  }
};


io.sockets.on('connection', function (socket) {
  console.log('connection from: ', socket.handshake.sessionID);
  User.findOne({session_id: socket.handshake.sessionID}, function(err, user) {
    if (err) {
      throw "Unable to look up user by sessionID '"+sessionID+"': "+err;
    }
    var server = findOpenServer();
    console.log('open slots in: ', server);
    if (_.isUndefined(server)) {
      console.log('created game ', gameId);
      var game = new Checkers.GameState();
      server = new Server.Server(function() { return new Checkers.GameState(); }, gameId);
      arrGames.push(server);
      gameId++;
    }

    var player = server.addPlayer(socket, user);
    if (!_.isUndefined(player) && !_.isNull(player))
    {
      arrPlayers.push(player);
    }

    socket.on('disconnect', function(socket) {
      console.log('connected userse: ', totalUsers());
    });

    console.log('joined server: ', server);
    console.log('active games: ', arrGames.length);
    console.log('connected users: ', totalUsers());
  });
});

mongoose.connect('mongodb://localhost/lvg');

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("Guerrilla-checkers listening on http://localhost:" + port);
});

}); // requirejs Checkers

