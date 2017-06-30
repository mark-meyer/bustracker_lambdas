var path = require('path')
var assert = require('assert')
var sinon = require('sinon')

var AWS = require('aws-sdk-mock');

var {handler} = require("../index.js")
var sampleQuery = "5th and G street"
var sampleAPIInput = { resource: '/find',
    path: '/find',
    httpMethod: 'POST',
    headers: null,
    queryStringParameters: null,
    pathParameters: null,
    stageVariables: null,
    body: '{"query": "' +sampleQuery+'"}',
    isBase64Encoded: false
}


describe('Responds to input from API', function(){

    it("Should pass input body query to Lex", function(){
        var text = ""
        AWS.mock('LexRuntime', 'postText', (params, callback) => {
            text = params.inputText
        })
        handler(sampleAPIInput, {},()=>{})
        assert((text === sampleQuery ), "Did not pass correct string to Lex")
        AWS.restore()
    })
    it("Should return formated data string in callback", function(){
        var mockData = {"stopdata": [1, 2, 3]}
        AWS.mock('LexRuntime', 'postText', (params, callback) => {
            callback(null, mockData )
        })
        handler(sampleAPIInput, {}, (err, response) => {
            assert((JSON.stringify(mockData) === response.body), "Returned data was not correct" )
        })
        AWS.restore()
    })
    it("Should return a proper Lambda Proxy Response", function(){
        AWS.mock('LexRuntime', 'postText', (params, callback) => {
            callback(null, "Success" )
        })
        handler(sampleAPIInput, {}, (err, response) => {
            assert(( response.hasOwnProperty('statusCode')
                     && response.hasOwnProperty('headers')
                     && response.hasOwnProperty('body')),
                     "Return object is not proper Lamdba Proxy Integration Response")
        })
        AWS.restore()
    })


})