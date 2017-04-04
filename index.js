const awsIot = require('aws-iot-device-sdk');

const ENVIRONMENT = require('edison-environment');

var env = new ENVIRONMENT(2, 3, 0, 5, 7);

// Load config file
const config = require('./config.json');

console.log('[START] Start of update-ip-in-aws-iot-shadow application');

var configIoT = {
    "keyPath": config.iotKeyPath,
    "certPath": config.iotCertPath,
    "caPath": config.iotCaPath,
    "clientId": config.iotClientId,
    "region": config.iotRegion,
    "host": config.iotEndpoint,
    "reconnectPeriod": 300,
};

var thingState = {
    temperature: null,
    humidity: null,
    light: {
        raw: null,
        value: null
    },
    uv: {
    	volts: null,
    	intensity: null
    },
    text: {
        line1: null,
        line2: null
    }
};

console.log('[SETUP] thingShadow state initialized with:');
console.log(thingState);
console.log('[SETUP] Initializing IoT thingShadow with config:');
console.log(configIoT);



function refreshShadow() {
    var toUpdate = {
        state: {
            reported: thingState
        }
    };

    console.log('[EVENT] refreshShadow(): Refhreshing the Shadow:');
    console.log(toUpdate);


    thingShadow.update(config.iotThingName, toUpdate);
}




setInterval(function() {
    var temperature = env.th02.getTemperature();
    var humidity = env.th02.getHumidity();
    if (temperature != thingState.temperature || humidity != thingState.humidity) {
        console.log('[EVENT]: Temperature:', temperature, 'celcius');
        console.log('[EVENT]: Humidity:', humidity, '%');
        thingState.temperature = temperature;
        thingState.humidity = humidity;
        refreshShadow();
    }
}, 60000);

var measureLight = false;
setInterval(function() {

	measureLight = !measureLight;

    if (measureLight) {
        var light_raw = env.light.raw_value();
        var light_value = env.light.value();
        if (light_raw != thingState.light.raw || light_value != thingState.light.value) {
            console.log('[EVENT]: Reading Light:', 'raw(' + light_raw + ') ~= ' + light_value + ' lux');
            thingState.light.raw = light_raw;
            thingState.light.value = light_value;
            refreshShadow();
        }
    } else {
        var uv_volts = env.uv.volts();
        var uv_intensity = env.uv.intensity();
        if (uv_volts != thingState.uv.volts || uv_intensity != thingState.uv.intensity) {
            console.log('[EVENT]: Reading UV:', uv_volts, 'V,', uv_intensity, 'mW/m^2');
            thingState.uv.volts = uv_volts;
            thingState.uv.intensity = uv_intensity;
            refreshShadow();
        }
    }

}, 15000);




var thingShadow = awsIot.thingShadow(configIoT);

thingShadow.on('connect', function() {
    console.log('[IOT EVENT] thingShadow.on(connect): Connection established to AWS IoT');
    console.log('[IOT EVENT] thingShadow.on(connect): Registring to thingShadow');
    thingShadow.register(config.iotThingName, {
        persistentSubscribe: true
    }, function() {
        console.log('[IOT EVENT] thingShadow.register: registered');
        // TODO:
        // read the shadow, compare and update if needed
    });
});

thingShadow.on('reconnect', function() {
    console.log('[IOT EVENT] thingShadow.on(reconnect) Trying to reconnect to AWS IoT');
});

thingShadow.on('close', function() {
    console.log('[IOT EVENT] thingShadow.on(close) Connection closed');
    console.log('[IOT EVENT] thingShadow.on(close) unregistring to shadow.');
    thingShadow.unregister(config.iotThingName);
});

thingShadow.on('error', function(err) {
    console.error('[IOT EVENT] thingShadow.on(error) error:', err);
    // process.exit();
    throw new Error('[ERROR] Lets crash the node code because of this error.');
});

thingShadow.on('status', function(thingName, stat, clientToken, stateObject) {
    console.log('[IOT EVENT] thingShadow.on(status): thingName:', thingName);
    console.log('[IOT EVENT] thingShadow.on(status): stat:', stat);
    console.log('[IOT EVENT] thingShadow.on(status): clientToken:', clientToken);
    console.log('[IOT EVENT] thingShadow.on(status): stateObject:', stateObject);
});
