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
        .messages({
            'message': 'Invalid role'
        })
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

const productSchema = (data) => {
    const schema = Joi.object({
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

        // Validate file metadata if you pass req.file to this function
        image: Joi.object({
            fieldname: Joi.string(),
            originalname: Joi.string(),
            encoding: Joi.string(),
            mimetype: Joi.string().valid('image/jpeg', 'image/jpg', 'image/png', 'image/webp').required(),
            size: Joi.number().max(5 * 1024 * 1024).required(), // 5MB
            buffer: Joi.any()
        }).required()
            .messages({
                'any.required': 'Product image is required.',
                'number.max': 'Image size must be less than 5MB.',
                'any.only': 'Only JPEG, PNG, and WebP images are allowed.'
            })
    });

    return schema.validate(data);
};

const validateProduct = (data) => {
    return productSchema.validate(data, { abortEarly: false });
};

const cartItemSchema = Joi.object({
    productId: Joi.string()
        .guid({ version: 'uuidv4' })
        .required()
        .messages({
            'string.guid': 'Product ID must be a valid UUID.',
            'any.required': 'Product ID is required.'
        }),

    quantity: Joi.number()
        .integer()
        .min(1)
        .max(1000) // Optional upper limit to prevent overflow or errors
        .required()
        .messages({
            'number.base': 'Quantity must be a number.',
            'number.integer': 'Quantity must be a whole number.',
            'number.min': 'Quantity must be at least 1.',
            'any.required': 'Quantity is required.'
        })
});

const validateCart = (data) => {
    return cartItemSchema.validate(data, { abortEarly: false });
};

module.exports = {
    validateRegistration,
    validateProduct,
    validateCart
};