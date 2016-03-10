'use strict';

var async         = require('async'),
	moment        = require('moment'),
	platform      = require('./platform'),
	isPlainObject = require('lodash.isplainobject'),
	isArray = require('lodash.isarray'),
	params        = {},
	client;

let sendData = (data) => {
	var processedData = data;

	var save = function () {

		var createObject = {
			index: params.index,
			type: params.type,
			body: processedData
		};

		if (params.id) {
			if (data[params.id] !== undefined)
				createObject.id = data[params.id];
		}

		if (params.parent) {
			if (data[params.parent] !== undefined)
				createObject.parent = data[params.parent];
		}


		client.create(createObject, function (error, result) {
			if (error) {
				console.error('Error creating record on Elasticsearch', error);
				platform.handleException(error);
			} else {
				platform.log(JSON.stringify({
					title: 'Record Successfully inserted to Elasticsearch.',
					data: result
				}));
			}
		});
	};

	if (params.fields) {
		processedData = {};

		async.forEachOf(params.fields, function (field, key, callback) {
			var datum = data[field.source_field],
				processedDatum;

			if (datum !== undefined && datum !== null) {
				if (field.data_type) {
					try {
						if (field.data_type === 'String') {
							if (isPlainObject(datum))
								processedDatum = JSON.stringify(datum);
							else
								processedDatum = ''.concat(datum);
						} else if (field.data_type === 'Integer') {

							var intData = parseInt(datum);

							if (isNaN(intData))
								processedDatum = datum; //store original value
							else
								processedDatum = intData;

						} else if (field.data_type === 'Float') {

							var floatData = parseFloat(datum);

							if (isNaN(floatData))
								processedDatum = datum; //store original value
							else
								processedDatum = floatData;

						} else if (field.data_type === 'Boolean') {

							var type = typeof datum;

							if ((type === 'string' && datum.toLocaleLowerCase() === 'true') ||
								(type === 'number' && datum === 1 )) {
								processedDatum = true;
							} else if ((type === 'string' && datum.toLocaleLowerCase() === 'false') ||
								(type === 'number' && datum === 0 )) {
								processedDatum = false;
							} else {
								processedDatum = datum;
							}

						} else if (field.data_type === 'DateTime') {

							var dtm = new Date(datum);

							if (!isNaN(dtm.getTime())) {
								if (field.format !== undefined)
									processedDatum = moment(dtm).format(field.format);
								else
									processedDatum = dtm;
							} else {
								processedDatum = datum;
							}

						} else if (field.data_type === 'JSON') {
							processedDatum = JSON.parse(datum);
						}
					} catch (e) {
						console.error('Data conversion error in Elasticsearch.', e);
						platform.handleException(e);
						processedDatum = datum;
					}

				} else {
					processedDatum = datum;
				}

			} else {
				processedDatum = null;
			}

			processedData[key] = processedDatum;
			callback();

		}, save);

	} else
		save();
};

platform.on('data', function (data) {
	if(isPlainObject(data)){
		sendData(data);
	}
	else if(isArray(data)){
		async.each(data, function(datum){
			sendData(datum);
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
	var config        = require('./config.json'),
		isEmpty       = require('lodash.isempty'),
		elasticsearch = require('elasticsearch'),
		parseFields, auth, apiVersion, host, parent, id;

	var init = function (e) {
		if (e) {
			console.error('Error parsing JSON field configuration for Elasticsearch.', e);
			return platform.handleException(e);
		}

		if (options.user) {
			if (options.password)
				auth = options.user + ':' + options.password + '@';
			else
				auth = options.user + ':@';
		}

		apiVersion = options.apiVersion || config.apiVersion.default;
		parent = (options.parent ? options.parent : null);
		id = (options.id ? options.id : null);

		host = options.protocol + '://' + auth + options.host;

		if (options.port)
			host = host + ':' + options.port;

		params = {
			index: options.index,
			type: options.type,
			parent: parent,
			id: id,
			fields: parseFields
		};

		client = new elasticsearch.Client({
			host: host,
			apiVersion: apiVersion
		});

		platform.log('Elasticsearch plugin initialized.');
		platform.notifyReady();
	};

	if (options.fields) {
		try {
			parseFields = JSON.parse(options.fields);
		}
		catch (ex) {
			platform.handleException(new Error('Invalid option parameter: fields. Must be a valid JSON String.'));

			return setTimeout(function () {
				process.exit(1);
			}, 2000);
		}

		async.forEachOf(parseFields, function (field, key, callback) {
			if (isEmpty(field.source_field)) {
				callback(new Error('Source field is missing for ' + key + ' in Elasticsearch Plugin'));
			} else if (field.data_type && (field.data_type !== 'String' && field.data_type !== 'Integer' &&
				field.data_type !== 'Float' && field.data_type !== 'Boolean' &&
				field.data_type !== 'DateTime' && field.data_type !== 'JSON')) {
				callback(new Error('Invalid Data Type for ' + key + ' allowed data types are (String, Integer, Float, Boolean, DateTime) in Elasticsearch Plugin'));
			} else
				callback();

		}, init);

	} else
		init(null);
});