
var http = require('http')
  , querystring = require('querystring');

exports.sendMessage = function(postData, callback) {

	// default arguments
	callback = callback || function(chunk) {};
	postData = postData || {};

	// build query
	var postDataString = querystring.stringify(postData);
	var postOptions = {
		host: 'localhost',
		port: '4000',
		path: '/',
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			'Content-Length': postDataString.length
		}
	};

	// set up the request
	var postRequest = http.request(postOptions, function(res) {
		res.setEncoding('utf8');
		res.on('data', callback);
	});
	postRequest.on('error', function(e) {
		console.log('failed to contact liferay server.');
	});

	// post the data
	postRequest.write(postDataString);
	postRequest.end();

};
