'use strict'

const reekoh = require('reekoh')
const plugin = new reekoh.plugins.Storage()

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
      plugin.emit('processed')
      plugin.log(JSON.stringify({
        title: 'Record Successfully inserted to ElasticSearch.',
        data: result
      }))
    }

    callback(error)
  })
}

plugin.on('data', (data) => {
  if (isPlainObject(data)) {
    sendData(data, (error) => {
      if (error) plugin.logException(error)
    })
  } else if (Array.isArray(data)) {
    async.each(data, (datum, done) => {
      sendData(datum, done)
    }, (error) => {
      if (error) plugin.logException(error)
    })
  } else {
    plugin.logException(new Error(`Invalid data received. Data must be a valid Array/JSON Object or a collection of objects. Data: ${data}`))
  }
})

plugin.once('ready', () => {
  options = plugin.config
  let host
  let auth

  if (options.port) {
    host = `${options.host}:${options.port}`
  } else {
    host = options.host
  }

  if (options.user) {
    auth = options.user
  } else {
    auth = ''
  }

  if (options.password) {
    auth = `${auth}:${options.password}@`
  } else {
    auth = `${auth}:@`
  }

  host = `${options.protocol}://${auth}${host}`

  client = new elasticsearch.Client({
    host: host,
    apiVersion: options.apiVersion
  })

  plugin.log('ElasticSearch Storage plugin initialized.')
  plugin.emit('init')
})

module.exports = plugin

