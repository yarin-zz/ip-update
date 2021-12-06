const axios = require("axios");
const dotenv = require("dotenv");

// Initialize configuration from environment variables and .env file
const config = (function loadConfig() {
	const result = dotenv.config();
	if (result.error) {
		throw result.error;
	}
	const required = "API_TOKEN ZONE_ID RECORD_NAME".split(" ");
	required.forEach(key => {
		if (!process.env[key]) {
			throw "Missing required environment variable: " + key;
		}
	});
	return {
		// Required items:
		apiToken: process.env.API_TOKEN,
		zoneId: process.env.ZONE_ID,
		recordName: process.env.RECORD_NAME,
		recordId: process.env.RECORD_ID,
		// Optional items - apply default values:
		checkIpUrl: process.env.CHECK_IP_URL || "https://checkip.amazonaws.com/",
		apiUrl: process.env.API_URL || "https://dns.hetzner.com/api/v1/",
		interval: process.env.INTERVAL || 10 * 1000,
		ttl: process.env.TTL || 60,
		timeout: process.env.TIMEOUT || 5 * 1000
	};
}());

// Base web service configuration
const webServiceBase = { timeout: config.timeout };

// DNS update web service
const dnsApi = axios.create({
	...webServiceBase,
	baseURL: config.apiUrl,
	headers: {
		"Content-Type": "application/json",
		"Auth-API-Token": config.apiToken
	}
});

// IP address check web service
const checkIpApi = axios.create({
	...webServiceBase,
	baseURL: config.checkIpUrl
});

// Application state
var lastIpAddr = null;

function isIpv4Address(str) {
	return !!/^\d{1,3}(\.\d{1,3}){3}$/.test(str);
}

function check() {
	console.debug("Checking IP address...");
	checkIpApi.get("/")
		.then(rsp => {
			const ipAddr = ("" + rsp.data).trim();
			if (!isIpv4Address(ipAddr)) {
				console.error("Received malformed response from IP address check", rsp.data);
			} else if (lastIpAddr !== ipAddr) {
				console.log("IP address has changed from " + lastIpAddr + " to " + ipAddr);
				update(ipAddr);
			}
			schedule();
		})
		.catch(err => {
			console.error("Failed to determine IP address", err);
			schedule();
		});
}

function update(ipAddr) {
	dnsApi.put("records/" + config.recordId, {
			"type": "A",
			"name": config.recordName,
			"value": ipAddr,
			"zone_id": config.zoneId,
			"ttl": parseInt(config.ttl)
		})
		.then(_ => {
			console.log("DNS record has been updated to " + ipAddr);
			lastIpAddr = ipAddr;
		})
		.catch(err => {
			console.error("Failed to update DNS record", err);
		});
}

function schedule() {
	setTimeout(check, config.interval);
}

check();