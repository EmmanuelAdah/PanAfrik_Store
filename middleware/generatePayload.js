// Helper function updated to match Prisma's camelCase naming
function generatePayload(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        country: user.country,
        currency: user.baseCurrency
    };
}

module.exports = generatePayload;