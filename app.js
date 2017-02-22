'use strict'

const reekoh = require('reekoh')
const _plugin = new reekoh.plugins.Storage()

const async = require('async')
const elasticsearch = require('elasticsearch')
const isPlainObject = require('lodash.isplainobject')

let client = null
let options = null

let sendData = (data, callback) => {
  let createObject = {
    index: options.index,
    type: options.type
  }

  if (options.idField) {
    createObject.id = data[options.idField]
    delete data[options.idField]
  }

  if (options.parentField) {
    createObject.parent = data[options.parentField]
    delete data[options.parentField]
  }

  client.create(Object.assign(createObject, {
    body: data
  }), (error, result) => {
    if (!error) {
      process.send({ type: 'processed' })
      _plugin.log(JSON.stringify({
        title: 'Record Successfully inserted to ElasticSearch.',
        data: result
      }))
    }

    callback(error)
  })
}

_plugin.on('data', (data) => {
  if (isPlainObject(data)) {
    sendData(data, (error) => {
      if (error) _plugin.logException(error)
    })
  } else if (Array.isArray(data)) {
    async.each(data, (datum, done) => {
      sendData(datum, done)
    }, (error) => {
      if (error) _plugin.logException(error)
    })
  } else {
    _plugin.logException(new Error(`Invalid data received. Data must be a valid Array/JSON Object or a collection of objects. Data: ${data}`))
  }
})

_plugin.once('ready', () => {
  options = _plugin.config

  let host = options.port
    ? `${options.host}:${options.port}`
    : options.host

  let auth = options.user
    ? options.user
    : ''

  auth = options.password
    ? `${auth}:${options.password}@`
    : `${auth}:@`

  host = `${options.protocol}://${auth}${host}`

  client = new elasticsearch.Client({
    host: host,
    apiVersion: options.apiVersion
  })

  _plugin.log('ElasticSearch Storage plugin initialized.')
  process.send({ type: 'ready' })
})
