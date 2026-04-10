
const convertCurrency = async () => {
    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/latest/USD`);

        if (!response.ok) {
            throw new Error(`API call failed with status: ${response.status}`);
        }

        const { conversion_rates } = await response.json();

        const { USD , NGN, GHS, ZAR, KES } = conversion_rates;

        return { USD, NGN, GHS, ZAR, KES };
    } catch (error) {
        console.error("Currency Conversion Error:", error.message);
    }
}

const getCrossRates = async () => {
    try {
        const rates = await convertCurrency();

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
            ...currencyMap,
            fetched_at: new Date().toISOString(),
            stale: false
        };

        console.log(JSON.stringify(finalOutput, null, 2));
        return finalOutput;

    } catch (error) {
        console.error("Mapping Error:", error);
    }
}

module.exports = {
    convertCurrency,
    getCrossRates
}

getCrossRates();