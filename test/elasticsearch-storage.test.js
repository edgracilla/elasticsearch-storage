'use strict';

const HOST     = 'reekoh.east-us.azr.facetflow.io',
	  USER     = 'KD8xosnl80e2WR8eyfqENgoNo4VUOs0S',
	  PROTOCOL = 'https',
	  INDEX    = 'reekoh_index',
	  TYPE     = 'reekoh_type',
	  _ID      = new Date().getTime();

var cp     = require('child_process'),
	assert = require('assert'),
	should = require('should'),
	moment = require('moment'),
	storage;

var record = {
	_id: _ID,
	co2: '11%',
	temp: 23,
	quality: 11.25,
	reading_time: '2015-11-27T11:04:13.539Z',
	metadata: '{"metadata_json": "reekoh metadata json"}',
	random_data: 'abcdefg',
	is_normal: true
};

describe('Storage', function () {
	this.slow(5000);

	after('terminate child process', function () {
		storage.send({
			type: 'close'
		});

		setTimeout(function () {
			storage.kill('SIGKILL');
		}, 3000);
	});

	describe('#spawn', function () {
		it('should spawn a child process', function () {
			assert.ok(storage = cp.fork(process.cwd()), 'Child process not spawned.');
		});
	});

	describe('#handShake', function () {
		it('should notify the parent process when ready within 5 seconds', function (done) {
			this.timeout(5000);

			storage.on('message', function (message) {
				if (message.type === 'ready')
					done();
			});

			storage.send({
				type: 'ready',
				data: {
					options: {
						host: HOST,
						user: USER,
						protocol: PROTOCOL,
						id_field: '_id',
						index: INDEX,
						type: TYPE
					}
				}
			}, function (error) {
				assert.ifError(error);
			});
		});
	});

	describe('#data', function () {
		it('should process the data', function (done) {

			storage.send({
				type: 'data',
				data: record
			}, done);

		});
	});

	describe('#data', function () {
		it('should have inserted the data', function (done) {
			this.timeout(5000);

			var elasticsearch = require('elasticsearch');

			var url = PROTOCOL + '://' + USER + ':@' + HOST;

			var client = new elasticsearch.Client({
				host: url,
				apiVersion: '1.0'
			});

			client.get({
				index: INDEX,
				type: TYPE,
				id: _ID
			}, function (error, response) {

				response.should.have.property('_source');

				var resp = response._source;

				should.equal(record.co2, resp.co2, 'Data validation failed. Field: co2');
				should.equal(record.temp, resp.temp, 'Data validation failed. Field: temp');
				should.equal(record.quality, resp.quality, 'Data validation failed. Field: quality');
				should.equal(record.random_data, resp.random_data, 'Data validation failed. Field: random_data');
				should.equal(record.reading_time, resp.reading_time, 'Data validation failed. Field: reading_time');
				should.equal(record.metadata, resp.metadata, 'Data validation failed. Field: metadata');

				done();
			});
		});
	});

});