# Bustracker Lambda Functions
API for Bustracker to run on AWS Lambda

These are designed to be used as helper functions for the AWS Lex Bot

## Functions for Fulfilment of Lex Requests

#### routes_from_stop_id
Given a stop number returns the ETAs of the next buses coming to that stop.
It expects a sinlge number passes as 'stop_number' or a Lex fulfiment request with a slot for:
* stop

#### stops_near_location
Given an address or intersection it will attempt to reverse geolocate the address and return stops with 1 mile of the location
It expects a single integer passed as 'address' or a Lex fulfilment request with a slot defined for one of:
* streets
* raw_address
* address

#### conversation
Responds for fulfilment requests from Lex for other intents and provides responses depending on the intent

## API interface for Lex

#### js_endpoint
Expects a query parameter passed as a POST request. This query is handed to Lex and the function returns the respinse from Lex.
