const http = require('http');
const config = require('./config')
const stop_number_lookup = require('./stop_number_lookup')
const routeNamesToRouteNumbers = require('./routename_to_routenumber');
const emojiRegex = require('emoji-regex');
const queryString = require('query-string');

const AWS = require('aws-sdk');
const LEX_BOT_ALIAS = "beta"
const LEX_BOT_NAME = "BusTracker"
let LEX_BOT_UID = "1229992" // this is required and can be used for managing state, but we're not currently using it.

// This is needed to run locally
let credentials = new AWS.SharedIniFileCredentials({profile: 'default'});
if (credentials.accessKeyId) {
    AWS.config.credentials = credentials;
    AWS.config.update({region: 'us-east-1'});
}

exports.handler = (event, context, callback) => {
    if (event.bot){

        /*  FROM LEX
            Lex recieved a request like 'I am at stop 1066'
            that we couldn't figure out on our own. It should have
            extracted the stop into a slot and passed it seperately.
        */

        let stopId = event.currentIntent.slots['stop']
        return getStopFromStopNumber(stopId)
            .then((data) => callback(null, makeLexAction(data)))
            .catch((err) => callback(null, makeLexError(err)) )
    }
    else if (event.body){

        /*  FROM APIGATEWAY
            With an event body it must be from the API Gateway via the web frontend or Twilio.
            Body will be encoded like a query string i.e. 'body=5th%20G%20Street'
        */

        let body = queryString.parse(event.body)

        if (!body.Body){
            return callback(null, makeResponse("Please enter a stop number"))
        }

        /* Clean input */
        let firstLine = body.Body.split(/\r\n|\r|\n/, 1)[0].replace(/\t/g, " ");
        const emoRegex = emojiRegex();
        let query = firstLine.replace(emoRegex, '').trim()

        if (!query){
            return callback(null, makeResponse("Please enter a stop number"))
        }

        /*  HANDLE SIMPLE STOP NUMER REQUESTS BEFORE LEX
            Intercept requests that are simple numbers such as "1066" or "stop 1066"
            and deal with them rather than passing them to Lex bot.
        */

        var stopRequest = query.toLowerCase().replace(/ /g,'').replace("stop",'').replace("#",'');
        if (/^\d+$/.test(stopRequest)) {
            return getStopFromStopNumber(stopRequest)
            .then((res) => {
                let returnValue = event.resource === "/find"
                ? JSON.stringify({"sessionAttributes" :{"data": res.data}, "intentName": "stopNumber"}) // Match Lex output to make frontend easier
                : busDatatoString(res)
                callback(null, makeResponse(returnValue))
            })
            .catch((err) => callback(null, makeResponse(JSON.stringify(err, ["name", "message"])))) // Don't throw error here - send user a nice error message
        }
        else {

            /*  Not a simple stop request - send to Lex to determine intent
                Lex will send back an object with a 'message' string,
                a 'sessionAttibutes' object, and an 'intent'
            */
            return askLex(query)
            .then((data) => {
                let sessionData = data.sessionAttributes &&  data.sessionAttributes.data && JSON.parse(data.sessionAttributes.data);
                let returnValue = event.resource === "/find"
                    ? JSON.stringify({"sessionAttributes" : {"data":sessionData}, "intentName": data.intentName, "message": data.message })
                    : data.message
                callback(null, makeResponse(returnValue))
            })
            .catch((err) => callback(null, makeResponse("Sorry we had a chatbot error"))) //TODO handle this
        }
    } else {
        /* This shouldn't ever happen */
        console.error(new Error("Received a request without body or bot"))
        callback("Bad Request")
    }
}

/*
    When Lex directly invokes this lambda
    this is the format it expects returned
*/
function makeLexAction(data) {
    return {
        "sessionAttributes": {"data": JSON.stringify(data.data)},
        "dialogAction": {
            "type": "Close",
            "fulfillmentState": "Fulfilled",
            "message":{
                "contentType": "PlainText",
                "content": busDatatoString(data)
            },
        }
    }
}
function makeLexError(err) {
    return {
        "dialogAction": {
            "type": "Close",
            "fulfillmentState": "Fulfilled",
            "message":{
                "contentType": "PlainText",
                "content": err.name + ": " + err.message
            }
        }
    }
}

/*
    When the lambda is inkoved throught the API
    this is the return format it expects returned
*/
function makeResponse(data) {
    return  {
    "statusCode": 200,
    "headers": {
        "Content-Type": "text/plain",
        "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
    },
    "body": data
    }
}

/* Provide a single string for SMS based requests */
function busDatatoString(data){
    var stops = data.data.stops;
    return stops.reduce(function(prev, curr) {
        return prev + '\n\n' + curr.number + " " + curr.name + " - " + curr.times[0] }, `* stop ${data.data.stopId} - ${data.data.stop} *`
    )
}

/* Call Lex bot with a request */
function askLex(query) {
    var lexruntime = new AWS.LexRuntime({ // This needs to be initialized inside the function for test mocks to work
        apiVersion: '2016-11-28',
    })
    var params = {
        botAlias: LEX_BOT_ALIAS,
        botName: LEX_BOT_NAME,
        inputText: query.toString(),
        userId: LEX_BOT_UID,
        sessionAttributes: {}
    }
    return new Promise((resolve, reject) => {
        lexruntime.postText(params, (err, data) => {
            if (err) {
                console.error(err, err.stack)
                reject(err)
            }
            else resolve(data)
        })
    })
}


/*
    Stop Number lookup functions
*/

function getStopFromStopNumber(stopId) {
    var busTrackerId = stop_number_lookup[parseInt(stopId)];
    // validate number and return error if not a number
    if (!busTrackerId) {
        var err = new Error("Stop numbers are on the bus stop sign (you can skip leading zeroes). If you can't find the stop number, send an address or intersection.")
        err.name = `I couldn't find stop number ${stopId}`
        return Promise.reject(err)
    }
    return requestBusData(busTrackerId)
    .then((muniBusData)=>{
        return {data: parseBusData(muniBusData.data, stopId), muniTime:muniBusData.asyncTime};
    })
}

function requestBusData(busTrackerId) {
    return new Promise((resolve, reject) => {
        var asyncTime =  Date.now()
        var request = http.get(config.MUNI_URL + busTrackerId, (response) => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                var err = new Error('Failed to load bustracker, status code: ' + response.statusCode)
                err.name = "Bustracker is down"
                reject(err);
            }
            const body = [];
            response.on('data', (chunk) => body.push(chunk));
            response.on('end', () => {
                resolve({
                    data: body.join(''),
                    asyncTime: Date.now() - asyncTime
                });
            });
        });
        request.on('error', (err) => reject(err))
    })
};

function parseBusData(body, stopId) {
    var parsed = {
        stops: []
    };

    var stop = body.match(/<h1>(.*)<\/h1>/)
    if (stop == null) {
        var err = new Error('Unexpected result from Muni. Cannot parse returned value.');
        err.name = "Bustracker is down"
       // console.error(err, {htmlBody: body, stopID: stopId});
        throw err;
    }
    parsed.stop = stop[1];

    parsed.stop = parsed.stop.replace(/: (\d*)/, '') // the route number is appended to some but not all routes.
    parsed.stopId = stopId;

    var regex = /<div class='(routeName|departure)'>([^<]+)<\/div>/g
    var stopsAndTimes = [];

    var matches;

    while (matches = regex.exec(body)) {
        stopsAndTimes.push(matches[2]);
    }

    var currentStop = null;
    stopsAndTimes.forEach(function(stopOrTime) {
        if (stopOrTime === 'Done') {
            currentStop.times.push('Out of Service')
        }
        else if(stopOrTime.search(/\d\d:\d\d/) === -1) { // this is a not time so must be a routename. It should always be the first hit through the array
            var routeObject = prependRouteNumberToRouteName(stopOrTime);
            currentStop = {
                name: routeObject.routeName,
                number:routeObject.routeNumber,
                times: []
            }
            parsed.stops.push(currentStop)
        }
        else {
            // Remove leading zero if one. Leave if there are two (if time comes back as 00:30 AM for example)
            currentStop.times.push(stopOrTime.replace(/^0{1}/, ''));
        }
    });
    return parsed;
}

function prependRouteNumberToRouteName(routeName) {
    if (!routeName || routeName=='') {
        return routeName;
    }
    var nameOnly = routeName.substr(0, routeName.lastIndexOf(" -"));
    var routeNumber = routeNamesToRouteNumbers[nameOnly];
    if (routeNumber) {
        return {routeNumber: routeNumber, routeName: routeName};
    }
    return {routeName: routeName};
}