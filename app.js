var Raven = require('raven');

var GuerrillaCheckers = require('./server/server.js');
gc = Raven.init(GuerrillaCheckers);

gc.configure({

  send_index: function(request, response) {
    response.sendfile(__dirname + '/index.html');
  },

  send_asset: function(request, response, path) {
    path = __dirname + path;
    response.sendfile(path);
  }

});

gc.run();
