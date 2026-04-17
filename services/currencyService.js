const logger = require('../utils/logger');
const redisClient = require('../config/redisConfig');

const fetchExchangeRates = async () => {
    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`);

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const { conversion_rates } = await response.json();

        const { USD , NGN, GHS, ZAR, KES } = conversion_rates;

        return { USD, NGN, GHS, ZAR, KES };
    } catch (error) {
        logger.error("Currency Conversion Error:", error.message);
    }
}

const fetchGrossRates = async () => {
    try {
        const rates = await fetchExchangeRates();

        const currencies = ["NGN", "GHS", "ZAR", "USD", "KES"];
        const currencyMap = {};

        currencies.forEach(base => {
            currencyMap[base] = {};

            currencies.forEach(target => {
                if (base === target) return; // Skip same-currency conversion

                // Calculate cross-rate relative to USD
                const rate = rates[target] / rates[base];

                // Format to 4-5 decimal places for precision
                currencyMap[base][target] = Number(rate.toFixed(5));
            });
        });

        // Construct the final object
        const finalOutput = {
            rates: {...currencyMap},
        };

        // console.log(JSON.stringify(finalOutput, null, 2));
        return finalOutput;

    } catch (error) {
        logger.error("Mapping Error:", error);
        return { message: "Failed to fetch currency rates" };
    }
}

const convertCurrency = async (amount, fromCurrency, toCurrency) => {
    try {
        const exchange = await redisClient.get('rates:global:latest');

        const rate = exchange.rates[fromCurrency][toCurrency]
        return amount * rate;
    } catch (error) {
        logger.error("Currency Conversion Error: ", error.message);
        return null;
    }
};

module.exports = {
    fetchGrossRates,
    convertCurrency
}