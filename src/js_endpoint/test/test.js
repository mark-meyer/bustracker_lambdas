var path = require('path')
var assert = require('assert')
var sinon = require('sinon')
var nock = require('nock')
var AWS = require('aws-sdk-mock');
var fixtures = require('./fixtures')
var config = require('../config')
var stop_number_lookup = require('../stop_number_lookup')

var {handler} = require("../index.js")
describe('Responds to input from API', function(){

    var sampleQuery = "5th and G street"
    var sampleAPIInput = fixtures.apiRequest(sampleQuery)

    it("Should pass input body query to Lex", function(){
        var text
        var mock = AWS.mock('LexRuntime', 'postText', (params) => {
            text = params.inputText
            callback(null, fixtures.lexReturn)
        })
        return handler(sampleAPIInput, {},(err, response)=>{
            assert((text === sampleQuery), "Did not pass correct string to Lex")
        })
    })

    it("Should return stringified data from Lex back to user in the body property", function(){
        AWS.mock('LexRuntime', 'postText', (params, callback) => {
            callback(null, fixtures.lexReturn )
        })
        return handler(sampleAPIInput, {}, (err, response) => {
            assert(JSON.stringify(fixtures.lexReturn) === response.body, "Returned data was not correct" )
        })
    })

    it("Should return a proper Lambda Proxy Response", function(){
        AWS.mock('LexRuntime', 'postText', (params, callback) => {
            callback(null, fixtures.lexReturn )
        })
        return handler(sampleAPIInput, {}, (err, response) => {
            assert(( response.hasOwnProperty('statusCode')
                        && response.hasOwnProperty('headers')
                        && response.hasOwnProperty('body')),
                        "Return object is not proper Lamdba Proxy Integration Response"
            )
        })

    })
    afterEach(() => AWS.restore() )
})


describe('Resonds to input of plain stop number', function(){
   // const sampleQuery = "1066"
   // const sampleAPIInput = fixtures.apiRequest(sampleQuery)
  
    it("Should respond to empty query", function(){
        return handler(fixtures.apiRequest(""), {}, (err, response) => {
            assert(response.body.includes("Please enter"), "Did not respond properly to empty query")
        })
    })
    it("Should return bus data object from stop id", function(){
        // Get Random Stop
        var keys = Object.keys(stop_number_lookup)
        var key = keys[ keys.length * Math.random() << 0]
        var randStop =  stop_number_lookup[key];
        var sampleAPIInput = fixtures.apiRequest(key)
        var domain, path
        [domain, path] = config.MUNI_URL.split(/(.*[^\/])(\/[^\/].*)/).filter((e) => e)

        nock(domain).get(path + randStop).reply(200, fixtures.muniData);
        return handler(sampleAPIInput, {}, (err, response)=>{
            var body = response && JSON.parse(response.body)
            assert(body.data && body.data.stopId === key, "Did not return stop in Json response")
        })
    })
    it("Should return an error message when stop doesn't exist", function(){
        var sampleAPIInput = fixtures.apiRequest('10000')
        return handler(sampleAPIInput, {}, (err, response)=>{
            assert(response.body.includes('I couldn\'t find stop number 10000'), "Did not return correct error")
        })
    })

})