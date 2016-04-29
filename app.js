'use strict';

var async         = require('async'),
	platform      = require('./platform'),
	isPlainObject = require('lodash.isplainobject'),
	isArray       = require('lodash.isarray'),
	client, opt;

let sendData = function (data, callback) {
	var createObject = {
		index: opt.index,
		type: opt.type
	};

	if (opt.id_field) {
		createObject.id = data[opt.id_field];
		delete data[opt.id_field];
	}

	if (opt.parent_field) {
		createObject.parent = data[opt.parent_field];
		delete data[opt.parent_field];
	}

	client.create(Object.assign(createObject, {
		body: data
	}), (error, result) => {
		if (!error) {
			platform.log(JSON.stringify({
				title: 'Record Successfully inserted to ElasticSearch.',
				data: result
			}));
		}

		callback(error);
	});
};

platform.on('data', function (data) {
	if (isPlainObject(data)) {
		sendData(data, (error) => {
			if (error) platform.handleException(error);
		});
	}
	else if (isArray(data)) {
		async.each(data, (datum, done) => {
			sendData(datum, done);
		}, (error) => {
			if (error) platform.handleException(error);
		});
	}
	else
		platform.handleException(new Error(`Invalid data received. Data must be a valid Array/JSON Object or a collection of objects. Data: ${data}`));
});

/*
 * Event to listen to in order to gracefully release all resources bound to this service.
 */
platform.on('close', function () {
	platform.notifyClose();
});

/*
 * Listen for the ready event.
 */
platform.once('ready', function (options) {
	let host          = `${options.host}`,
		config        = require('./config.json'),
		elasticsearch = require('elasticsearch'),
		auth          = '',
		apiVersion;

	opt = options;

	if (options.port)
		host = `${host}:${options.port}`;

	if (options.user)
		auth = `${options.user}`;

	if (options.password)
		auth = `${auth}:${options.password}@`;
	else if (options.user)
		auth = `${auth}:@`;

	apiVersion = options.apiVersion || config.apiVersion.default;
	host = `${options.protocol}://${auth}${host}`;

	client = new elasticsearch.Client({
		host: host,
		apiVersion: apiVersion
	});

	platform.log('ElasticSearch Storage plugin initialized.');
	platform.notifyReady();
});