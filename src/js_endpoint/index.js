var AWS = require('aws-sdk');

var LEX_BOT_ALIAS = "beta"
var LEX_BOT_NAME = "BusTracker"
var LEX_BOT_UID = "1229992" // not confidential — can be used for managing state

// This works locally, but breaks when running on lambda
// How to set role when testing locally?
let credentials = new AWS.SharedIniFileCredentials({profile: 'default'});
if (credentials.accessKeyId) {
    AWS.config.credentials = credentials;
    AWS.config.update({region: 'us-east-1'});
}

var lexruntime = new AWS.LexRuntime({
    apiVersion: '2016-11-28',
})

exports.handler = (event, context, callback) => {
    // Handler for API Gateway requests from HTML frontend
    // Accepts a 'query' POST parameter and returns data.
    var body = JSON.parse(event.body)
    var query = body.query
    console.log("event: ", event)
    if (!query){
        console.log("no query")
        callback(null, makeResponse("Please enter a stop number"))
        return
    }

    /* **********
       We should test here for a plain numeric query, which is 90% of the traffic
       and repsond directly rather than calling Lex. This would save $$
       TODO: Invoke buses_from_stop when query is a number
    *************/
    var params =
    {
        botAlias: LEX_BOT_ALIAS,
        botName: LEX_BOT_NAME,
        inputText: query.toString(),
        userId: LEX_BOT_UID,
        sessionAttributes:
        {
            "source":"webAPI"    // This isn't currently used anywhere, but is a way to tell lamdba functions
                                // Where the request originated from
        }
    }

    lexruntime.postText(params, (err, data) => {
        if (err) console.log(err, err.stack)
        else callback(null, makeResponse(data);
    })
};

exports.twillioHandler = (event, context, callback) => {
     /*  Currently AWS Lex is wired directly to twilio
        But this means Lex handles all requests even
        easy to understand all-numeric requests.
        That's probably not ideal. To prevent this we need to
        accept twilio requests rather than letting the Lex
        Twilio Channel
    */

}

function makeResponse(data){
    return {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
        },
        body: JSON.stringify(data)
    }
}