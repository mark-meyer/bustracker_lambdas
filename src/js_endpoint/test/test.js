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

    /* 
        sampleAPIInput simulates the lamdba proxy request that comes from
        AWS API Gateway
    */
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
    var domain, path, stopId, muniStopId
    beforeEach(function(){
        /* Get Random Stop from list */
        var keys = Object.keys(stop_number_lookup);
        stopId = keys[ keys.length * Math.random() << 0];
        muniStopId =  stop_number_lookup[stopId];
        sampleAPIInput = fixtures.apiRequest(stopId);
        [domain, path] = config.MUNI_URL.split(/(.*?[^\/])(\/[^\/].*)/).slice(1,3);
    })
    it("Should respond to empty query", function(){
        handler(fixtures.apiRequest(""), {}, (err, response) => {
            assert(response.body.includes("Please enter"), "Did not respond properly to empty query")
        })
    })
    it("Should return an error message when stop doesn't exist", function(){
        var sampleAPIInput = fixtures.apiRequest('10000')
        return handler(sampleAPIInput, {}, (err, response)=>{
            assert(response.body.includes("I couldn't find stop number 10000"), "Did not return correct error")
        })
    })
    it("Should respond with an error when muni server is down", function(){
        nock(domain).get(path + muniStopId).reply(500, fixtures.muniData);
        return handler(sampleAPIInput, {}, (err, response)=>{
            assert(response.body.includes("Failed to load bustracker"), "Did not return error with HTTP 500")
        })
    })
    it("Should respond with an error when the muni serves unparseable data", function(){
        nock(domain).get(path + muniStopId).reply(200, "<html><body><p>Some random string</p></body></html");
        return  handler(sampleAPIInput, {}, (err, response)=>{
            assert(response.body.includes("Unexpected result from Muni."), "Did not return error with unparseable data")
        })
    })
    it("Should return bus data object from stop id", function(){
        nock(domain).get(path + muniStopId).reply(200, fixtures.muniData);
        return handler(sampleAPIInput, {}, (err, response)=>{
            var body =  JSON.parse(response.body)
            assert(body.data && body.data.stopId === stopId, "Did not return stop in Json response")
        })
    })
    it("Should respond with holiday message when buses aren't running")
})

