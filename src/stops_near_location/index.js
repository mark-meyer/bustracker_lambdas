var https = require('https');

var config = require('./config')
var all_stops = require('./gtfs/geojson/stops.json');

var turf_within = require('@turf/within')
var turf_circle = require('@turf/circle') //saves several MB in dependencies of @turf/buffer
var turf_distance = require('@turf/distance')
var turf_helpers = require('@turf/helpers')


exports.handler = function(event, context, callback){
    /* 
        This is setup to handle calls from AWS Lex, or plain API endpoint
        Calls from Lex will have an event object that includes event.bot
        Calls from API should just pass either:
             query parameter named 'address'
             or a query parameter named 'latlon' as a POST request in the form:
                {latlon: {lat:latitude, lon:longitude}
    */
    if (event.address) { // Called from API Endpoint
        getStopsFromAddress(event.address) 
        .then(  (data) => callback(null, data))
        .catch((err)  => {
            callback(null, {message:`${err.name}. ${err.message}`})
        })
    }

    else if (event.latlon){ // Called from API Endpoint
        if (!event.latlon.lat || !event.latlon.lon){
            callback(new Error("This requires both latitude on longitude to determine the location")) 
            // What happens in the client when lambda returns error?
            // If it produces a server error, how do we find it?
            return;
        }
       var data = findNearestStops(parseFloat(event.latlon.lat), parseFloat(event.latlon.lon));
       if (!data || data.length === 0){
           callback(null, {message: "I was able to determine your location, but I couldn't find any stops within " + config.NEAREST_BUFFER + " miles of you."});
           return;
       }
       //   This is returned in this form to match regular address query 
       //   so it can use the same front end component
        callback(null, {data: {stops:data}})
    } else if (event.bot && event.bot.name === "BusTracker"){ // Called from AWS Lex
        /*  Lex will try to identify the address and pass it as a slot
            Certain intents won't be able to do this and will pass the whole user
            request in the string event.inputTranscript
            
            Lex will only accept a single string as a return value to pass to Twilio, but json data is more
            useful for the api endpoint to allow formatting of specific pieces (such as links)
            The string is returned in message.content; the JSON in sessionAttributes.data. Lex will pass
            the sessionAttributes along to the lambda function
        */
        
        // These slots are defined for various intents in the Lex model.
        // If the request ends up in this lambda function Lex thinks
        // the user is trying to pass an address in some fashion

        var address =   event.currentIntent.slots['streets'] 
                        || event.currentIntent.slots['raw_address']
                        || event.currentIntent.slots['address']
                        || event.inputTranscript

        getStopsFromAddress(address)
        .then(
            (data) => {
                var action = makeAction(stopDataToString(data), data.data ) 
                callback(null, action)
            },
            (err) => {
                if (err instanceof NotFoundError){
                    // Everything worked okay, but Google couldn't find the address
                    var message = "I'm sorry, I wasn't able to find the address '" + address +"'"
                    var action = makeAction(message )
                    callback(null,action)
                } else {
                    // If you end up here it's because Google returned an error to the geocode request
                    var message = "I'm sorry there was a server error while locating '" + address +"'"
                    var action = makeAction(message )
                    callback(null, action)
                }
        })
    } else {
        callback(new Error("Function called with improper arguments"))
    }
}
function makeAction(message, data) { // The format Lex expects
            // data will be JSON data useful for HTML front end or 
            // undefined if there's no data to return. Front end client should use message when there's no data
            // message must be a simple string that Lex can return in a text
            var returnedData
            if (data) returnedData =  {"data": JSON.stringify(data)}
            return {
                "sessionAttributes": returnedData,
                "dialogAction": {
                    "type": "Close",
                    "fulfillmentState": "Fulfilled",
                    "message":{
                        "contentType": "PlainText",
                        "content": message
                    }
                }
            }
        }
function stopDataToString(data){
    // Make a nice string for Lex's return message
    var stops = data.data.stops;
    if (stops.length === 0) {
        return "I found this address, but there were no stops within " + config.NEAREST_BUFFER + " miles of it."
    }
    return stops.reduce(function(prev, curr){
        return prev + `\n\n * Stop: ${curr.stopId} - ${curr.route}`
    }, "Enter one of these stop numbers for details")
}

function NotFoundError(message) {
    this.name = "Address not found"
    this.message = message
    this.stack = Error().stack
    this.type = 'NOT_FOUND'
}
NotFoundError.prototype = Object.create(Error.prototype);
NotFoundError.prototype.constructor = NotFoundError;

function getStopsFromAddress(address){
    return getGeocodedAddress(address)
    .then((returnObj) => {
        var geocodedPlace = returnObj.data
        if (!geocodedPlace){
            return Promise.reject(new NotFoundError(`Searched for "${address}"`))
        }
        var geocoded_address = geocodedPlace.formatted_address
        var lat = geocodedPlace.location.lat;
        var lon = geocodedPlace.location.lng;

        // Stops can be empty. If no stops are found within max distance
        // this returns an empty array for the data.stops so routes can decide what to do.
        var stops = findNearestStops(lat, lon);

        return {data: {stops: stops, geocodedAddress:geocoded_address} , geocodeTime: returnObj.asyncTime};
    })
    .catch(err => {
        // if error is NOT_FOUND it just means the geocoder came up empty handed
        if (err.type == 'NOT_FOUND') return Promise.reject(err)
        // Otherwise it's a real error coming for Google.
        // TODO: log this error because it shouldn't happen in normal use
        return Promise.reject(new Error(`I'm sorry, there was an error looking up the location`)) // This lies to the user if there is a geocoder error.
    })
}

function findNearestStops(lat, lon) {
    var point = turf_helpers.point([lon, lat]);
    var buffer = turf_helpers.featureCollection([turf_circle(point, config.NEAREST_BUFFER, 64, 'miles')]);
    var nearest_stops = turf_within(all_stops, buffer);

    var out = nearest_stops.features.map(function(stop){
        var stopId = stop.properties.stop_id.match(/\d+/g)[0];
        return { route: stop.properties.name,
                 stopId: stopId,
                 distance: turf_distance(point, stop, "miles"),
                 ll: stopLatLong(stopId)
        }
    });
    // returns empty if none found nearby
    out.sort(function(a, b) {
        return (a.distance - b.distance)
    });
    if (out.length > config.NEAREST_MAX) out = out.slice(0,config.NEAREST_MAX);
    return out;
}

function stopLatLong(stopid) {
    for (var i=0; i < all_stops.features.length; i++) {
        if (all_stops.features[i].properties.stop_id.match(/\d+/g)[0] == stopid) {
            return all_stops.features[i].geometry.coordinates[1] + "," + all_stops.features[i].geometry.coordinates[0];
        }
    }
    return "";
}


function getGeocodedAddress(address) {
    // GOOGLE_MAPS_KEY can be provide in the labda function setup as an ENV
    // TODO: what happens when we reach the free limit?
    var GEOCODE_URL_BASE = "https://maps.googleapis.com/maps/api/geocode/json?"
    var CITY = config.GOOGLE_GEOCODE_LOCATION
    var COUNTRY = "US"
    var timer = Date.now();
    return new Promise((resolve, reject) => {
        var querry = encodeURIComponent(address)
        var request = https.get(`${GEOCODE_URL_BASE}address=${querry}&components=country:${COUNTRY}|administrative_area:${CITY}&key=${process.env.GOOGLE_MAPS_KEY}`, (response) => {
            if (response.statusCode < 200 || response.statusCode > 299) {
                // in the context of a lamdba function, what should happen with real errors?
                reject(new Error('Error from Google Geocoder: ' + response.statusCode));
                return;
            }
            const body = [];
            response.on('data', (chunk) => body.push(chunk));
            response.on('end', () => {
                var geocodeData = JSON.parse(body.join(''))
                if (geocodeData.status != "OK") {
                    return reject(new Error(`Geocoder Error: ${geocodeData.status}`))
                }
                var acceptable_types = [
                    'route',
                    'street_address',
                    'intersection',
                    'transit_station',
                    'point_of_interest',
                    'establishment',
                    'train_station',
                    'bus_station',
                    'neighborhood',
                    'premise',
                    'subpremise'
                ]
                var result = geocodeData.results[0]

                var data = (result.types && acceptable_types.some(el => result.types.includes(el)))
                    ? {location:result.geometry.location, formatted_address: result.formatted_address}
                    : null
                resolve({data: data, asyncTime: Date.now()-timer})
            })
        })
    })
}

