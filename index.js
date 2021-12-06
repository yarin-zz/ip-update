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
		// Apply default values:
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
	baseURL: process.env.API_URL,
	headers: {
		"Content-Type": "application/json",
		"Auth-API-Token": process.env.API_TOKEN
	}
});

// IP address check web service
const checkIpApi = axios.create({
	...webServiceBase,
	baseURL: process.env.CHECK_IP_URL
});

// Application state
var lastIpAddr = null;

function check() {
	console.debug("Checking IP address...");
	checkIpApi.get("/")
		.then(rsp => {
			const ipAddr = ("" + rsp.data).trim();
			if (!/^\d+\.\d+.\d+.\d+$/.test(ipAddr)) {
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
	dnsApi.put("records/" + process.env.RECORD_ID, {
			"type": "A",
			"name": process.env.RECORD_NAME,
			"value": ipAddr,
			"zone_id": process.env.ZONE_ID,
			"ttl": parseInt(process.env.TTL)
		})
		.then(rsp => {
			console.log("DNS record has been updated to " + ipAddr);
			lastIpAddr = ipAddr;
		})
		.catch(err => {
			console.error("Failed to update DNS record", err);
		});
}

function schedule() {
	setTimeout(check, process.env.INTERVAL);
}

check();