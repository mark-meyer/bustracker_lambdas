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
var lexruntime = new AWS.LexRuntime();

exports.handler = (event, context, callback) => {
    // SHandler for API Gateway requests from HTML frontend
    // Accepts a 'query' parameter and returns data.

    var query = event.query
    
    // We could test here for a plain numeric query, which is 90% of the traffic
    // and short repsond directly rather than calling lex. This would save $$

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
        else callback(null, data);
    })
};

exports.twillioHandler = (event, context, callback) => {
    // Currently AWS Lex is wired directly to twilio
    // But this means Lex handles all requests even
    // easy to understand all-numeric requests.
    // That's probably not ideal. 

}
