const Joi = require('joi');

const registerSchema = Joi.object({
    first_name: Joi.string()
        .min(3)
        .max(50)
        .required()
        .messages({
            'string.empty': 'First name is required',
            'string.min': 'First name must be at least 3 characters long'
        }),

    last_name: Joi.string()
        .min(3)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Last name is required',
            'string.min': 'Last name must be at least 3 characters long'
        }),

    email: Joi.string()
        .email()
        .lowercase()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address'
        }),

    password: Joi.string()
        .min(8)
        .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters',
            'string.pattern.base': 'Password must contain one uppercase, one lowercase, and one number'
        }),

    role: Joi.string()
        .valid('merchant', 'customer')
        .required(),

    country: Joi.string()
        .valid('NG', 'GH', 'KE', 'ZA')
        .uppercase()
        .required(),

    base_currency: Joi.string()
        .valid('NGN', 'GHS', 'KES', 'ZAR')
        .uppercase()
        .required()
});

const validateRegistration = (data) => {
    return registerSchema.validate(data, { abortEarly: false });
};

module.exports = {
    validateRegistration
};