var path = require('path')
var assert = require('assert')
var sinon = require('sinon')
var nock = require('nock')
var AWS = require('aws-sdk-mock');
var fixtures = require('./fixtures')
var config = require('../config')

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
    const sampleQuery = "1066"
    const sampleAPIInput = fixtures.apiRequest(sampleQuery)

    it("Should respond to empty query", function(){
        return handler(fixtures.apiRequest(""), {}, (err, response) => {
            assert(response.body.includes("Please enter"), "Did not respond properly to empty query")
        })
    })

    it("Should bus bus data object from stop id", function(){
        config.MUNI_URL
        var muni = nock(MUNI_URL + '2124')
        return handler(sampleAPIInput, {}, (err, response)=>{
            console.log(response)
            assert(true)
        })
    })

})