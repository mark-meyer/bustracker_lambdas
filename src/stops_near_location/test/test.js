var assert = require('assert')
var sinon = require('sinon')
var https = require("https")
var PassThrough = require('stream').PassThrough

var all_stops = require('../gtfs/geojson/stops.json');

var {handler} = require("../index.js")

function random_stop() {
    return all_stops.features[Math.floor(Math.random() * all_stops.features.length)]
}

before(function(){
    console.log("before runs")
})

// Is there a better way to test against strings that may change?
// Tests will fail for reasons other than what's tested (i.e expected object is undefined) is that enough to cover those cases?

describe('Find stops from Lat/Lon coordinates', function(){
    it("Should return 'No Stops Found' message with far away coordinates", function() {
        var input = {latlon: {lat: 50.0, lon: -120}}
        handler (input, {}, (err, ret) => {
            assert(ret.message.includes("couldn't find any stops within"), "Did not send 'Not Found'")
        })
    })
    it("Should return an error without lat or lon", function(){
        var input = {latlon: {lat:50}}
        handler (input,{}, (err, ret) => {
            assert(err instanceof Error, "Did not return and error")
        })
    })
    it("Should return a stop when sent that stop's coordinates", function(){
        var {properties: {name}, geometry: {coordinates}} = random_stop()
        var input = {latlon: {lat:coordinates[1], lon:coordinates[0]}}
        handler (input, {}, (err, ret) => {
            assert(ret.data.stops.some((stop) => stop.route === name), "Did not return the correct stop from coordinates")
        })
    })
    it("Returned stop objects should have numeric stopID", function(){
        var {geometry: {coordinates}} = random_stop()
        var input = {latlon: {lat:coordinates[1], lon:coordinates[0]}}
        handler (input, {}, (err, ret) => {
            assert(ret.data.stops.every((el, index, array) => {
                return !isNaN(el.stopId)
            }), "Every stopId is not a numeric value")
        })
    })
    it("Returned stop objects should have numeric distances", function(){
        var {geometry: {coordinates}} = random_stop()
        var input = {latlon: {lat:coordinates[1], lon:coordinates[0]}}
        handler (input, {}, (err, ret) => {
            assert(ret.data.stops.every((el, index, array) =>{
                return !isNaN(el.distance)
            }), "Every returned stop didn't have a numeric distance")
        })
    })
    it("Returned stop objects should have comma seprated string with numeric coordinates", function(){
        var {geometry: {coordinates}} = random_stop()
        var input = {latlon: {lat:coordinates[1], lon:coordinates[0]}}
        handler (input, {}, (err, ret) => {
            assert(ret.data.stops.every((el, index, array)=>{
                let coords = el.ll.split(',')
                return (!isNaN(coords[0] && !isNaN(coords[1])))
            }), "Stop object did not have numeric lat/lon coordinates")
        })
    })
})

var fakeResponses = require('./geocoderResponses')

describe('Get stops from geocoded locations through rest API', function(){
    before(function(){
        /*
             Stub out https.get to return fake data found in ./geocoderResponses.js
        */
        this.setHTTPResponse = function(fakeResponse){
            var response = new PassThrough()
            response.write(JSON.stringify(fakeResponse))
            response.end()
            var request = new PassThrough();
            this.https_get.callsArgWith(1, response)
            .returns(request) 
        }
    })
 
    beforeEach(function() {
        this.https_get = sinon.stub(https, 'get')
    })

    it("Should respond with an error message when geocoder returns an error", function(done){
        this.setHTTPResponse(fakeResponses.failedResponse)
        var input = {address:"623 W. 6th Street"}
        handler(input, {}, (err, ret) => {
            try {
                assert(ret.message.includes("there was an error"), "Did not return error message")
                done()
            } catch(e) {
                 done(e) 
            }
        })
    })

    it("Should return 'not-found' message when the geocoder doesn't find specific address", function(done){ 
        this.setHTTPResponse(fakeResponses.nonspecificResponse)    
        var input = {address:"Downtown Transit Center"}
        handler(input, {}, (err, ret) => {
            try{
                assert(ret.message.includes("Address not found."), "Didn't return 'Not Found' message")
                done()
            } catch(e) {
                done(e)
            }
        })
    })
 
    it("Should return stop data when address is found", function(done){
        this.setHTTPResponse(fakeResponses.goodResponse)
        var input = {address:"623 W. 6th Street"}
        handler(input, {}, function(err, ret) {
            try{
                assert( ret.data.stops.every((el, index, array)=>{return el.hasOwnProperty('stopId')}), "Did not return stop data")
                done()
            } catch(e){
                done(e)
            }
        })
    })

    it("Should respond with an error message when google server doesn't return a useable HTTP status", function(done){
        this.https_get.yields( {statusCode:403})
        var input = {address:"632 W. 6th Street"}
        handler(input, {}, function(err, ret) {
            try{
                assert(ret.message.includes("there was an error"), "Did not return error message")
                done()
            } catch(e) {
                done(e)
            }
        })
    })
    afterEach(function() {
        this.https_get.restore()
    })

})

describe('Get stops from geocoded locations when requested by Lex', function(){
    before(function(){
        /*
             Stub out https.get to return fake data found in ./geocoderResponses.js
        */
        this.setHTTPResponse = function(fakeResponse){
            var response = new PassThrough()
            response.write(JSON.stringify(fakeResponse))
            response.end()
            var request = new PassThrough();
            this.https_get.callsArgWith(1, response)
            .returns(request) 
        }
        this.lexRequest = {
            "currentIntent": {
                "name": "findAdress",
                "slots": {
                "raw_address": "632 W. 6th St.",
                },
            },
            "bot": {
                "name": "BusTracker",
                "alias": "beta",
                "version": "12"
            },
            "inputTranscript": "I am at 632 W. 6th Street",
            "sessionAttributes": { }
        }

    })
 
    beforeEach(function() {
        this.https_get = sinon.stub(https, 'get')
    })

    it("Should return a string with stop numbers in return message", function(done){
        this.setHTTPResponse(fakeResponses.goodResponse)
        handler(this.lexRequest, {}, function(err, ret) {
            var message = ret.dialogAction.message.content
            try{
                assert( message.includes("DOWNTOWN TRANSIT CENTER"), "Did not return required stop string")
                done()
            } catch(e) {
                done(e)
            }

        })
    })

    it("Should return a sessionAttributes object with stop numbers", function(done){
        this.setHTTPResponse(fakeResponses.goodResponse)
        handler(this.lexRequest, {}, function(err, ret) {
            var data = JSON.parse(ret.sessionAttributes.data)
            try{
                assert( data.stops.every((el, index, array) => {
                    return !isNaN(el.stopId)
                }), "Did not return correct stop data")
                done()
            } catch(e) {
                done(e)
            }
        })
    })

    it("Should return a no-nearby-stops message when the geocoder returns distant coordinates ", function(done){
        this.setHTTPResponse(fakeResponses.glennAlpsLocation)
        handler(this.lexRequest, {}, function(err, ret) {
            var message = ret.dialogAction.message.content
            try{
                assert(message.includes("there were no stops within"), "Did not send 'Not Found'")
                done()
            } catch(e) {
                done(e)
            }
        })
    })
    it("Should return an empty stops array in sessionAttributes when the geocoder returns distant coordinates ", function(done){
        this.setHTTPResponse(fakeResponses.glennAlpsLocation)
        handler(this.lexRequest, {}, function(err, ret) {
            var data = JSON.parse(ret.sessionAttributes.data)
            try{
                assert(data.stops.length === 0, "Did not return an empty stops list ")
                done()
            } catch(e) {
                done(e)
            }
        })
    })
    
    it("Should return an address-not-found message when the goecoder fails to find a location ", function(done){
        this.setHTTPResponse(fakeResponses.nonspecificResponse)
        handler(this.lexRequest, {}, function(err, ret) {
            try{
                var message = ret.dialogAction.message.content
                assert(message.includes("I wasn't able to find the address"), "Did not report it couldn't find the address")
                done()
            }
            catch(e){
                done(e)
            }
        })
    })

    it("SessionAttributes should be undefined when goecoder fails to find a location ", function(done){
        this.setHTTPResponse(fakeResponses.nonspecificResponse)
        return handler(this.lexRequest, {}, function(err, ret) {
            try{
                assert.strictEqual(ret.sessionAttributes, undefined, "SessionAttributes should be undefined when there is no stop data")
                done()
            } catch(e){
                done(e)
            }
        })
    })

    afterEach(function() {
            this.https_get.restore()
        })

    })