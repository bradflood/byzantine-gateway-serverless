/** 
Copyright 2018 Keyhole Software LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('app.js');
var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http');
var cors = require('cors');
var channels = require('./app/channelinfo.js');
var peers = require('./app/peers.js');
var blockinfo = require('./app/blockinfo.js');
var block = require('./app/block.js');
var appconfig = require('./config.js');
var chaincodes = require('./app/chaincodes.js');
var txproposalrate = require('./app/transactionproposalrate.js');
var query = require('./app/query');
var lab = require('./app/createLab');
var host = appconfig.host;
var port = appconfig.port;
var loglevel = appconfig.loglevel;
logger.setLevel(loglevel);

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
//support parsing of application/json type post data
app.use(bodyParser.json());
//support parsing of application/x-www-form-urlencoded post data
app.use(bodyParser.urlencoded({
    extended: false
}));

///////////////////////////////////////////////////////////////////////////////
//////////////////////////// START HTTP SERVER ////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var httpServer = http.createServer(app).listen(port, function () { });
logger.info('********** Starting Express Server @ http://' + host + ':' + port);
httpServer.timeout = 240000;

///////////////////////////////////////////////////////////////////////////////
/////////////////////////// START WEBSOCKET SERVER ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
logger.info('********** Configuring WebSockets');
var io = require('socket.io')(httpServer);
io.on('connection', function (socket) {
    logger.info('A new WebSocket connection has been established');
});
// Set global socket
global.socket = io;

function validateRequiredParameter(req, parameterName) {
    var parameterValue = req.body[parameterName];
    logger.info('Validating required parameter: ' + parameterName + ' with value of: ' + parameterValue);
    return parameterValue !== null && undefined !== parameterValue && parameterValue.length !== 0;
}

function validateChannelIdParameter(req) {
    return validateRequiredParameter(req, 'channelid');
}

///////////////////////////////////////////////////////////////////////////////
////////////////////// Gateway API Endpoint Definitions  //////////////////////
///////////////////////////////////////////////////////////////////////////////
logger.info('********** Adding endpiont definitions');

app.get('/api/v1/queryAllLabs', function(req, res) {
	logger.info('================ /queryAllLabs ======================');
	
	query.getAllLabs('queryAllLabs', 'mychannel', 'lab')
	.then(function(
		message) {
		res.send(message);
	});
});

app.get('/api/v1/queryByState', function(req, res) {
	logger.debug('================ /queryByState ======================');
	
	query.getAllLabs('queryAllLabs')
	.then(function(
		message) {
		var results = JSON.parse(message);
		var data = [];
		for (var i = 0; i < results.length ; i++) {
			if (results[i].Record.state.toUpperCase() == req.query.state.toUpperCase() ) {
				data.push(results[i]);
			}
		}
		res.send(JSON.stringify(data));
	});
});

app.post('/api/v1/createLab', function(req, res) {
	logger.debug('================ /createLab ======================');
	
	// TODO Validate Form values...
	var dateTime = req.body.dateTime;
	var gender = req.body.gender;
	var testType = req.body.testType;
	var age = req.body.age;
	var result = req.body.result;
	var city = req.body.city;
	var county = req.body.county;
	var state = req.body.state;
	

	lab.createLab({dateTime: dateTime, gender: gender, testType: testType, age: age, result: result, city: city, county: county, state: state} )
	.then(function(message) {
		res.send(message);
	});
});

app.post('/api/v1/channel', function (req, res) {
    logger.info('================ /channel ======================');

    if (validateChannelIdParameter(req)) {
        var channelid = req.body.channelid;
        channels.getChannelInfo(channelid)
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply a `channelid` parameter and value.' }).end();
    }
});

app.post('/api/v1/peers', function (req, res) {
    logger.info('================ /peers ======================');

    if (validateChannelIdParameter(req)) {
        var channelid = req.body.channelid;
        peers.getPeers(channelid)
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply a `channelid` parameter and value.' }).end();
    }
});

app.post('/api/v1/blockinfo', function (req, res) {
    logger.info('================ /blockinfo ==================');

    if (validateChannelIdParameter(req)) {
        var channelid = req.body.channelid;
        blockinfo.getBlockInfo(channelid)
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply a `channelid` parameter and value.' }).end();
    }
});

app.post('/api/v1/block', function (req, res) {
    logger.info('================ /block ======================');

    if (validateChannelIdParameter(req) && validateRequiredParameter(req, 'blocknumber') && parseInt(req.body.blocknumber)) {
        var channelid = req.body.channelid;
        var blocknumber = req.body.blocknumber;
        block.getBlock(channelid, parseInt(blocknumber))
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply both `channelid` and `blocknumber` parameters (and values).' }).end();
    }

});

app.post('/api/v1/blockhash', function (req, res) {
    logger.info('================ /blockhash ======================');

    if (validateRequiredParameter(req, 'number') && validateRequiredParameter(req, 'prevhash') && validateRequiredParameter(req, 'datahash')) {
        var number = req.body.number;
        var prev = req.body.prevhash;
        var data = req.body.datahash;
        block.getBlockHash({ number: number, previous_hash: prev, data_hash: data })
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply values for the `number`, `prevhash`, and `datahash` parameters.' }).end();
    }
});

app.post('/api/v1/chaincodes', function (req, res) {
    logger.info('================ /chaincodes ======================');

    if (validateChannelIdParameter(req)) {
        var channelid = req.body.channelid;
        chaincodes.getChaincodes(channelid)
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply a `channelid` parameter and value.' }).end();
    }
});

app.post('/api/v1/channelconfig', function (req, res) {
    logger.info('================ /channelconfig ======================');

    if (validateChannelIdParameter(req) && validateRequiredParameter(req, 'blocknumber') && parseInt(req.body.blocknumber)) {
        var channelid = req.body.channelid;
        var blocknumber = req.body.blocknumber;
        block.getBlock(channelid, parseInt(blocknumber))
            .then(function (response) {
                var json = JSON.parse(response);

                // Get last config block from Metadata
                var configBlock = parseInt(json.metadata.metadata[1].value.index);
                block.getBlock(channelid, configBlock)
                    .then(function (message) {
                        res.send(message);
                    });
            });
    } else {
        res.status(400).json({ error: 'You must supply a value for both the `channelid` and `blocknumber` parameters' }).end();
    }
});

app.post('/api/v1/txproposalrate', function (req, res) {
    logger.info('================ /txproposalrate ======================');

    if (validateChannelIdParameter(req) && validateRequiredParameter(req, 'chaincode')) {
        var channelid = req.body.channelid;
        var chaincode = req.body.chaincode;
        txproposalrate.getTransactionProposalRate(channelid, chaincode)
            .then(function (message) {
                res.send(message);
            });
    } else {
        res.status(400).json({ error: 'You must supply a value for both the `channelid` and `chaincode` parameters' }).end();
    }
});

// All remaining requests are invalid, as we aren't serving up static content here.
app.get('*', function (request, response) {
    logger.error(request.url);
    logger.error(request.method);
    response.status(404).end();
});

logger.info('********** Express Server started successfully.');
