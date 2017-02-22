/* global describe, it, before, after */

'use strict'

const amqp = require('amqplib')
const should = require('should')
const cp = require('child_process')

const INPUT_PIPE = 'demo.pipe.storage'
const BROKER = 'amqp://guest:guest@127.0.0.1/'
const _ID = new Date().getTime()

let _app = null
let _conn = null
let _channel = null

let conf = {
  host: 'localhost',
  port: 9200,
  user: '',
  protocol: 'http',
  idField: '_id',
  index: 'reekon_index',
  type: 'reekoh_type',
  apiVersion: '2.1'
}

let record = {
  _id: _ID,
  co2: '11%',
  temp: 23,
  quality: 11.25,
  readingTime: '2015-11-27T11:04:13.539Z',
  metadata: '{"metadataJson": "reekoh metadata json"}',
  randomData: 'abcdefg',
  isNormal: true
}

describe('Storage', function () {
  this.slow(5000)

  before('init', () => {
    process.env.BROKER = BROKER
    process.env.INPUT_PIPE = INPUT_PIPE
    process.env.CONFIG = JSON.stringify(conf)

    amqp.connect(BROKER).then((conn) => {
      _conn = conn
      return conn.createChannel()
    }).then((channel) => {
      _channel = channel
    }).catch((err) => {
      console.log(err)
    })
  })

  after('terminate child process', function () {
    _conn.close()
    setTimeout(function () {
      _app.kill('SIGKILL')
    }, 3000)
  })

  describe('#spawn', function () {
    it('should spawn a child process', function () {
      should.ok(_app = cp.fork(process.cwd()), 'Child process not spawned.')
    })
  })

  describe('#handShake', function () {
    it('should notify the parent process when ready within 5 seconds', function (done) {
      this.timeout(5000)

      _app.on('message', (message) => {
        if (message.type === 'ready') {
          done()
        }
      })
    })
  })

  describe('#data', function () {
    it('should process the data', function (done) {
      this.timeout(8000)
      _channel.sendToQueue(INPUT_PIPE, new Buffer(JSON.stringify(record)))

      _app.on('message', (msg) => {
        if (msg.type === 'processed') { done() }
      })
    })
  })

  describe('#data', function () {
    it('should have inserted the data', function (done) {
      this.timeout(5000)

      let elasticsearch = require('elasticsearch')
      // let url = conf.protocol + '://' + conf.user + ':@' + conf.host
      let url = 'http://localhost:9200/'

      let client = new elasticsearch.Client({
        host: url,
        apiVersion: '1.0'
      })

      client.get({
        index: conf.index,
        type: conf.type,
        id: _ID
      }, function (error, response) {
        if (error) return console.log(error)
        response.should.have.property('_source')

        let resp = response._source

        should.equal(record.co2, resp.co2, 'Data validation failed. Field: co2')
        should.equal(record.temp, resp.temp, 'Data validation failed. Field: temp')
        should.equal(record.quality, resp.quality, 'Data validation failed. Field: quality')
        should.equal(record.randomData, resp.randomData, 'Data validation failed. Field: randomData')
        should.equal(record.readingTime, resp.readingTime, 'Data validation failed. Field: readingTime')
        should.equal(record.metadata, resp.metadata, 'Data validation failed. Field: metadata')

        done()
      })
    })
  })
})
