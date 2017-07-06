
exports.muniData = `DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
                        <html xmlns="http://www.w3.org/1999/xhtml">
                        <head><title>
                            Stop Departures - Powered By Avail Technologies Inc.
                        </title><link type="text/css" rel="Stylesheet" media="screen" href="/InfoPoint/stylesheets/noscript.css" /><meta name="viewport" content="width=400" /></head>
                        <body>
                            <form name="mainform" method="post" action="departures.aspx?stopid=2124" id="mainform">
                        <div>
                        <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="/wEPDwUKMTE2MTY5NDQ1OQ9kFgICAw8WAh4JaW5uZXJodG1sBcICPGgzPlVwY29taW5nIERlcGFydHVyZXMgZnJvbTwvaDM+PGgxPkZJUkVXRUVEIGFuZCBDIFNUUkVFVCBXTlc8L2gxPjxkaXYgY2xhc3M9J3JvdXRlTmFtZSc+T0xEIFNFV0FSRCAtIEluYm91bmQ8L2Rpdj48ZGl2IGNsYXNzPSdkZXBhcnR1cmUnPjA5OjU1IEFNPC9kaXY+PGRpdiBjbGFzcz0nZGVwYXJ0dXJlJz4xMDo1NCBBTTwvZGl2PjxkaXYgY2xhc3M9J2RlcGFydHVyZSc+MTE6NTYgQU08L2Rpdj48L3RyPjxoMyBzdHlsZT0iZmxvYXQ6IGxlZnQ7IGNsZWFyOmJvdGg7IHdpZHRoOjEwMCU7Ij5MYXN0IHVwZGF0ZWQgb246IDIwMTcvMDcvMDUgMTA6MDAgQU08L2gzPmRkLP2lHWcgLtpIlWGzLybFuGXQNCw=" />
                        </div>

                        <div>

                            <input type="hidden" name="__VIEWSTATEGENERATOR" id="__VIEWSTATEGENERATOR" value="4B2F48F9" />
                        </div><h3>Upcoming Departures from</h3><h1>FIREWEED and C STREET WNW</h1><div class='routeName'>OLD SEWARD - Inbound</div><div class='departure'>09:55 AM</div><div class='departure'>10:54 AM</div><div class='departure'>11:56 AM</div></tr><h3 style="float: left; clear:both; width:100%;">Last updated on: 2017/07/05 10:00 AM</h3></form>
                        </body>
                        </html>`

exports.apiRequest = (query) => {
    return {
        resource: '/find',
        path: '/find',
        httpMethod: 'POST',
        body: '{"Body": "' +query+'"}',
    }

}

exports.lexReturn = {
    message: '* stop 1066 - FIREWEED and C STREET WNW *',
    sessionAttributes: { data: '{"stops":[{"route":"5TH AVENUE & F STREET WNW","stopId":"3507","distance":0.05691845245927328,"ll":"61.217605,-149.893845"},{"route":"CITY HALL","stopId":"1450","distance":0.0745025245603552,"ll":"61.216565,-149.894747"},{"route":"DOWNTOWN TRANSIT CENTER","stopId":"2051","distance":0.0810384451911698,"ll":"61.216553,-149.896764"},{"route":"5TH AVENUE & H STREET WNW","stopId":"1359","distance":0.10117887117697162,"ll":"61.217639,-149.898591"},{"route":"6TH AVENUE & H STREET WSW","stopId":"1735","distance":0.10384580227309781,"ll":"61.216522,-149.897789"}],"geocodedAddress":"W 5th Ave & G St, Anchorage, AK 99501, USA"}' }
}

