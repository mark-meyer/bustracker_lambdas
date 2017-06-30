var http = require('http');
var config = require('./config')
var stop_number_lookup = require('./stop_number_lookup')
var routeNamesToRouteNumbers = require('./routename_to_routenumber');

exports.handler = function(event, context, callback){
    if (event.stop_number){ // called from api gateway of invoke
        getStopFromStopNumber(event.stop_number)
        .then((data) => callback(null, data))
        .catch((err) => callback(err))
    } else if(event.bot.name === "BusTracker"){ // Called from AWS Lex
        var intent = event.currentIntent.name
        var stopID = event.currentIntent.slots['stop']
        getStopFromStopNumber(stopID)
        .then(data => {
            var action = {
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": "Fulfilled",
                    "message":{
                        "contentType": "PlainText",
                        "content": busDatatoString(data)
                    },
                }
            }
            callback(null, action)
        })
        .catch((err) => {
             var action = {
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": "Fulfilled",
                    "message":{
                        "contentType": "PlainText",
                        "content": err.name + ": " + err.message
                    }
                }
            }

            callback(null, action)
        })

    } else {
        callback(new Error("Function called with improper arguments"))
    }

}
function busDatatoString(data){
    var stops = data.data.stops;
    return stops.reduce(function(prev, curr) {
        return prev + '\n\n' + curr.number + " " + curr.name + " - " + curr.times[0] }, `* stop ${data.data.stopId} - ${data.data.stop} *`
    )
}


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
    .catch((err) => Promise.reject(new Error(err)))
}


function requestBusData(busTrackerId) {
    return new Promise((resolve, reject) => {
        var asyncTime =  Date.now()
        var request = http.get(config.MUNI_URL + busTrackerId, (response) => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                reject(new Error('Failed to load bustracker, status code: ' + response.statusCode));
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
        console.error(err, {htmlBody: body, stopID: stopId});
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