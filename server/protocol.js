define([], function() {
var Protocol = function(socket) {
  var me = this;
  me.socket = socket;
};

Protocol.prototype.on = function(signal, callback) {
  this.socket.on(signal, function(data) {
    callback.call(this, [data]));
  }
};

return Protocol;
});
