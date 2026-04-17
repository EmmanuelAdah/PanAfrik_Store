const Joi = require('joi');


const uuidSchema = Joi.string().guid({ version: 'uuidv4' });

// USER REGISTRATION SCHEMA
const registerSchema = Joi.object({
    fullName: Joi.string()
        .min(3)
        .max(100)
        .required()
        .trim()
        .messages({
            'string.empty': 'Full name is required',
            'string.min': 'Full name must be at least 3 characters long'
        }),

    email: Joi.string()
        .email()
        .lowercase()
        .required()
        .trim()
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
        .required()
        .messages({ 'any.only': 'Invalid role' }),

    country: Joi.string()
        .length(2)
        .uppercase()
        .valid('NG', 'GH', 'KE', 'ZA')
        .required(),

    baseCurrency: Joi.string()
        .length(3)
        .uppercase()
        .valid('NGN', 'GHS', 'KES', 'ZAR')
        .required()
});

// PRODUCT SCHEMA
const productSchema = Joi.object({
    name: Joi.string()
        .min(3)
        .max(255)
        .required()
        .trim(),

    description: Joi.string()
        .max(1000)
        .required()
        .trim(),

    price: Joi.number()
        .positive()
        .precision(2)
        .required(),

    category: Joi.string()
        .max(100)
        .required()
        .trim(),

    // Multer File Validation
    image: Joi.object({
        fieldname: Joi.string(),
        originalname: Joi.string(),
        encoding: Joi.string(),
        mimetype: Joi.string()
            .valid('image/jpeg', 'image/jpg', 'image/png', 'image/webp')
            .required(),
        size: Joi.number().max(5 * 1024 * 1024).required(), // 5MB
        buffer: Joi.any()
    }).required().messages({
        'any.required': 'Product image is required.',
        'number.max': 'Image size must be less than 5MB.',
        'any.only': 'Only JPEG, PNG, and WebP images are allowed.'
    })
});


const cartItemSchema = Joi.object({
    productId: uuidSchema
        .required()
        .messages({
            'string.guid': 'Product ID must be a valid UUID.',
            'any.required': 'Product ID is required.'
    }),

    quantity: Joi.number()
        .integer()
        .min(1)
        .max(1000)
        .required()
        .messages({
            'number.base': 'Quantity must be a number.',
            'number.min': 'Quantity must be at least 1.',
            'any.required': 'Quantity is required.'
    })
});

const validate = (schema, data) => {
    return schema.validate(data, { abortEarly: false, stripUnknown: true });
};

module.exports = {
    validateRegistration: (data) => validate(registerSchema, data),
    validateProduct: (data) => validate(productSchema, data),
    validateCart: (data) => validate(cartItemSchema, data)
};